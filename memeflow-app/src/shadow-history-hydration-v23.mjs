import fs from 'node:fs';

// Shared non-blocking JSONL hydration primitives for V23 shadow memories.
// The tail rule deliberately matches the previous synchronous loaders: when a
// file exceeds the byte bound, discard only its potentially partial first row.
let hydrationQueue=Promise.resolve();
let initialGracePending=true;

// Serialize large history tails so the nine shadow constructors never compete
// with one another (or startup-critical storage work) for disk and CPU.
export function enqueueHistoryHydration(task){
  const run=async()=>{
    if(initialGracePending){
      initialGracePending=false;
      // Give app-server time to bind its listener and finish critical startup.
      await new Promise(resolve=>setTimeout(resolve,5_000));
    }
    return task();
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
  yieldEvery=64,
  yieldAfterMs=6
}={}){
  const source=String(text||'');
  let start=0;
  let rowsSinceYield=0;
  let sliceStartedAt=Date.now();

  while(start<source.length){
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

    if(
      rowsSinceYield>=yieldEvery ||
      Date.now()-sliceStartedAt>=yieldAfterMs
    ){
      await new Promise(resolve=>setImmediate(resolve));
      rowsSinceYield=0;
      sliceStartedAt=Date.now();
    }

    start=end+1;
  }
}