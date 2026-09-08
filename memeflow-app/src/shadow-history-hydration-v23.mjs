import fs from 'node:fs';

// Shared non-blocking JSONL hydration primitives for V23 shadow memories.
// The tail rule deliberately matches the previous synchronous loaders: when a
// file exceeds the byte bound, discard only its potentially partial first row.
let hydrationQueue=Promise.resolve();
let initialGracePending=true;

// MEMEFLOW_SHADOW_HISTORY_LOW_PRIORITY_V145
// These histories are SHADOW ONLY. Page availability and the live HTTP loop
// always take priority over rebuilding historical diagnostics.
const initialGraceMs=Math.max(
  5_000,
  Number(process.env.MEMEFLOW_SHADOW_HYDRATION_GRACE_MS||20_000)
);
const betweenFilesIdleMs=Math.max(
  0,
  Number(process.env.MEMEFLOW_SHADOW_HYDRATION_FILE_IDLE_MS||100)
);

// Serialize large history tails so shadow constructors never compete with one
// another (or startup-critical storage work) for disk and CPU.
export function enqueueHistoryHydration(task){
  const run=async()=>{
    if(initialGracePending){
      initialGracePending=false;
      // Give app-server and the first browser navigation a clean startup lane.
      await new Promise(resolve=>setTimeout(resolve,initialGraceMs));
    }

    const result=await task();

    // Do not hand the CPU directly from one large history to the next.
    if(betweenFilesIdleMs>0){
      await new Promise(
        resolve=>setTimeout(resolve,betweenFilesIdleMs)
      );
    }

    return result;
  };

  const queued=hydrationQueue.then(run,run);
  // Keep the queue usable if a caller ever supplies an unhandled task.
  hydrationQueue=queued.catch(()=>{});
  return queued;
}

export async function readBoundedJsonlTail(file,maxBytes){
  if(!file)return '';

  try{
    const stat=await fs.promises.stat(file);
    if(!(stat.size>0))return '';

    if(stat.size<=maxBytes){
      return await fs.promises.readFile(file,'utf8');
    }

    const handle=await fs.promises.open(file,'r');

    try{
      const buffer=Buffer.allocUnsafe(maxBytes);
      const {bytesRead}=await handle.read(
        buffer,
        0,
        maxBytes,
        stat.size-maxBytes
      );
      let text=buffer.subarray(0,bytesRead).toString('utf8');
      const newline=text.indexOf('\n');
      if(newline>=0)text=text.slice(newline+1);
      return text;
    }finally{
      await handle.close();
    }
  }catch(error){
    // A missing history is a normal cold start. Other I/O failures must reach
    // the owner so its status can report a failed hydration attempt.
    if(error?.code==='ENOENT')return '';
    throw error;
  }
}

export async function parseJsonlCooperatively(text,onRow,{
  yieldEvery=16,
  yieldAfterMs=2,
  idleMs=20
}={}){
  const source=String(text||'');
  const safeYieldEvery=Math.max(1,Number(yieldEvery)||16);
  const safeYieldAfterMs=Math.max(1,Number(yieldAfterMs)||2);
  const safeIdleMs=Math.max(0,Number(idleMs)||0);

  let start=0;
  let rowsSinceYield=0;
  let sliceStartedAt=Date.now();

  const yieldToRuntime=async()=>{
    if(safeIdleMs>0){
      // A timer creates an actual idle window. setImmediate alone yields
      // fairness but can still keep one CPU core saturated continuously.
      await new Promise(resolve=>setTimeout(resolve,safeIdleMs));
    }else{
      await new Promise(resolve=>setImmediate(resolve));
    }
    rowsSinceYield=0;
    sliceStartedAt=Date.now();
  };

  while(start<source.length){
    // If the previous row callback consumed the entire slice budget, give HTTP
    // and live timers a turn before parsing another historical row.
    if(
      rowsSinceYield>0 &&
      (
        rowsSinceYield>=safeYieldEvery ||
        Date.now()-sliceStartedAt>=safeYieldAfterMs
      )
    ){
      await yieldToRuntime();
    }

    const newline=source.indexOf('\n',start);
    const end=newline<0?source.length:newline;
    const line=source.slice(start,end);

    if(line.trim()){
      try{
        onRow(JSON.parse(line));
      }catch{
        onRow(null,true);
      }
      rowsSinceYield++;
    }

    start=end+1;
  }
}