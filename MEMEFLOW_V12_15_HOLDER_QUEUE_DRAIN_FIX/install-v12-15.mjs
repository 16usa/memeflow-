import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const target=path.join(root,'memeflow-app','src','enrich.mjs');
const marker='MEMEFLOW_V12_15_HOLDER_QUEUE_DRAIN_WAKE_FIX';

if(!fs.existsSync(target)){
  console.error('ABORT: target not found:',target);
  process.exit(1);
}

let src=fs.readFileSync(target,'utf8');
if(src.includes(marker)){
  console.log('PASS: MEMEFLOW V12.15 already installed');
  process.exit(0);
}

const start=src.indexOf('export function makeHolderQueue(config,deps){');
if(start<0){
  console.error('ABORT: makeHolderQueue() not found');
  process.exit(1);
}

// makeHolderQueue is the final exported block in current MEMEFLOW enrich.mjs.
// Replace from its declaration through EOF to avoid brittle line-number patches.
const backup=target+'.before-v12-15-holder-queue-drain-'+new Date().toISOString().replace(/[:.]/g,'-');
fs.copyFileSync(target,backup);

const replacement=String.raw`export function makeHolderQueue(config,deps){
  /* MEMEFLOW_V12_15_HOLDER_QUEUE_DRAIN_WAKE_FIX */
  const maxConcurrent=Math.max(1,Number(config?.maxConcurrent??2));
  const queueMax=Math.max(10,Number(config?.queueMax??500));
  // Respect the fast configured first attempt. Older code clamped this to >=1000ms.
  const initialDelayMs=Math.min(10000,Math.max(25,Number(config?.initialDelayMs??75)));
  const retryDelayMs=Math.max(1000,Number(config?.retryDelayMs??30000));
  const maxRetries=Math.max(1,Number(config?.maxRetries??8));
  const jobTimeoutMs=Math.max(3000,Number(config?.jobTimeoutMs??process.env.HOLDER_JOB_TIMEOUT_MS??12000));
  const {enrichHoldersFn,holderMetrics,admissionFn=null}=deps;

  const pending=new Map();
  const active=new Set();
  const history=new Map();
  let wakeTimer=null;
  let wakeAt=0;
  let draining=false;

  holderMetrics.workerWakeups=Number(holderMetrics.workerWakeups||0);
  holderMetrics.jobsStarted=Number(holderMetrics.jobsStarted||0);
  holderMetrics.jobsCompleted=Number(holderMetrics.jobsCompleted||0);
  holderMetrics.jobsTimedOut=Number(holderMetrics.jobsTimedOut||0);
  holderMetrics.stuckQueuedRescued=Number(holderMetrics.stuckQueuedRescued||0);

  function diagRow(mint){
    let row=history.get(mint);
    if(!row){
      row={mint,queuedAt:null,nextDueAt:null,attempts:0,lastAttemptAt:null,lastSuccessAt:null,lastError:null,lastErrorAt:null,rateLimited:0,retries:0,status:'unknown'};
      history.set(mint,row);
    }
    return row;
  }

  function pruneHistory(){
    if(history.size<=2000)return;
    const rows=[...history.values()].sort((a,b)=>(b.lastAttemptAt||b.queuedAt||0)-(a.lastAttemptAt||a.queuedAt||0));
    history.clear();
    for(const row of rows.slice(0,1000))history.set(row.mint,row);
  }

  function clearWakeTimer(){
    if(wakeTimer){
      clearTimeout(wakeTimer);
      wakeTimer=null;
    }
    wakeAt=0;
  }

  function scheduleWake(){
    if(!pending.size){
      clearWakeTimer();
      return;
    }
    const now=Date.now();
    const next=Math.min(...[...pending.values()].map(x=>Number(x.dueAt||now)));
    if(wakeTimer && wakeAt && wakeAt<=next)return;
    clearWakeTimer();
    wakeAt=next;
    wakeTimer=setTimeout(()=>{
      wakeTimer=null;
      wakeAt=0;
      holderMetrics.workerWakeups++;
      drain();
    },Math.max(0,next-now));
    wakeTimer.unref?.();
  }

  function dropOldest(){
    let oldest=null;
    for(const item of pending.values()){
      if(!oldest||item.enqueuedAt<oldest.enqueuedAt)oldest=item;
    }
    if(oldest){
      pending.delete(oldest.mint);
      holderMetrics.holderDropped++;
      const d=diagRow(oldest.mint);
      d.status='dropped';
      d.lastError='queue capacity drop';
      d.lastErrorAt=Date.now();
    }
  }

  function reschedule(item,delayMs){
    const base=Math.max(1000,Number(delayMs)||retryDelayMs);
    const exponential=Math.min(120000,base*Math.pow(2,Math.min(item.retries,3)));
    const jitter=Math.floor(Math.random()*750);
    const dueAt=Date.now()+exponential+jitter;
    pending.set(item.mint,{...item,retries:item.retries+1,dueAt});
    const d=diagRow(item.mint);
    d.retries=item.retries+1;
    d.nextDueAt=dueAt;
    d.status='queued';
  }

  async function withTimeout(promise,mint){
    let timer;
    try{
      return await Promise.race([
        Promise.resolve(promise),
        new Promise((_,reject)=>{
          timer=setTimeout(()=>{
            const e=new Error(\`holder worker timeout after ${jobTimeoutMs}ms\`);
            e.code='HOLDER_WORKER_TIMEOUT';
            e.holderWorkerTimeout=true;
            reject(e);
          },jobTimeoutMs);
          timer.unref?.();
        })
      ]);
    }finally{
      if(timer)clearTimeout(timer);
    }
  }

  async function run(item){
    const mint=item.mint;
    const d=diagRow(mint);
    active.add(mint); // reserve worker slot BEFORE any async work
    d.attempts++;
    d.lastAttemptAt=Date.now();
    d.status='running';
    holderMetrics.jobsStarted++;

    try{
      if(admissionFn){
        let gate;
        try{
          gate=admissionFn(mint)||{allow:true};
        }catch(e){
          holderMetrics.holderAdmissionErrors=(holderMetrics.holderAdmissionErrors||0)+1;
          gate={allow:true,reason:'admission_error_fail_open'};
        }

        if(gate.allow===false){
          holderMetrics.lastHolderAdmissionReason=gate.reason||'deferred';
          if(gate.drop===true){
            holderMetrics.holderAdmissionDropped=(holderMetrics.holderAdmissionDropped||0)+1;
            d.status='admission-dropped';
            return;
          }
          holderMetrics.holderAdmissionDeferred=(holderMetrics.holderAdmissionDeferred||0)+1;
          const dueAt=Date.now()+Math.max(250,Number(gate.retryInMs||3000));
          pending.set(mint,{...item,dueAt});
          d.nextDueAt=dueAt;
          d.status='queued';
          return;
        }
        holderMetrics.holderAdmissionAllowed=(holderMetrics.holderAdmissionAllowed||0)+1;
      }

      const result=await withTimeout(enrichHoldersFn(mint),mint);

      if(result?.rateLimited){
        holderMetrics.holderRateLimited++;
        d.rateLimited++;
        d.lastError='rate limited';
        d.lastErrorAt=Date.now();
        if(item.retries<maxRetries){
          holderMetrics.holderRetries++;
          reschedule(item,result.retryAfter??retryDelayMs);
        }else{
          holderMetrics.holderFailed++;
          holderMetrics.lastHolderError='max retries exceeded on rate limit';
          holderMetrics.lastHolderErrorAt=Date.now();
          d.status='failed';
        }
      }else{
        holderMetrics.holderSucceeded++;
        holderMetrics.jobsCompleted++;
        holderMetrics.lastHolderError=null;
        d.lastSuccessAt=Date.now();
        d.lastError=null;
        d.lastErrorAt=null;
        d.status='success';
      }
    }catch(e){
      if(e?.holderWorkerTimeout || e?.code==='HOLDER_WORKER_TIMEOUT'){
        holderMetrics.jobsTimedOut++;
        d.lastError=sanitize(e?.message||'holder worker timeout');
        d.lastErrorAt=Date.now();
        if(item.retries<maxRetries){
          holderMetrics.holderRetries++;
          reschedule(item,Math.min(retryDelayMs,5000));
        }else{
          holderMetrics.holderFailed++;
          d.status='failed';
        }
      }else if(item.retries<maxRetries && isRateLimited(e)){
        holderMetrics.holderRateLimited++;
        holderMetrics.holderRetries++;
        reschedule(item,e?.retryAfterMs??retryDelayMs);
      }else{
        holderMetrics.holderFailed++;
        holderMetrics.lastHolderError=sanitize(e?.message||'unknown');
        holderMetrics.lastHolderErrorAt=Date.now();
        d.lastError=sanitize(e?.message||'unknown');
        d.lastErrorAt=Date.now();
        d.status='failed';
      }
    }finally{
      active.delete(mint);
      // Do not wait for another external event. Immediately hand the freed slot
      // to the next due holder job.
      queueMicrotask(()=>drain());
    }
  }

  function nextDueItem(now){
    const due=[...pending.values()]
      .filter(item=>Number(item?.dueAt||0)<=now)
      .sort((a,b)=>{
        const aa=Number(diagRow(a.mint)?.attempts||0);
        const ba=Number(diagRow(b.mint)?.attempts||0);
        if((aa===0)!==(ba===0))return aa===0?-1:1;
        if(aa===0&&ba===0)return Number(a.enqueuedAt||0)-Number(b.enqueuedAt||0);
        return Number(a.dueAt||0)-Number(b.dueAt||0);
      });
    return due[0]||null;
  }

  function drain(){
    if(draining)return;
    draining=true;
    try{
      // Any timer that called us is no longer authoritative; reschedule from
      // current queue state when this drain finishes.
      clearWakeTimer();
      const now=Date.now();
      while(active.size<maxConcurrent){
        const due=nextDueItem(now);
        if(!due)break;
        pending.delete(due.mint);
        void run(due);
      }
    }finally{
      draining=false;
      scheduleWake();
    }
  }

  function enqueue(mint){
    if(!mint||pending.has(mint)||active.has(mint))return false;
    if(pending.size>=queueMax)dropOldest();
    const now=Date.now();
    const dueAt=now+initialDelayMs;
    pending.set(mint,{mint,retries:0,enqueuedAt:now,dueAt});
    const d=diagRow(mint);
    d.queuedAt=d.queuedAt||now;
    d.nextDueAt=dueAt;
    d.status='queued';
    holderMetrics.holderQueued++;
    pruneHistory();

    // Critical V12.15 change: every enqueue actively kicks the worker.
    queueMicrotask(()=>drain());
    scheduleWake();
    return true;
  }

  // Safety heartbeat. If a timer was lost/cancelled or the event loop ordering
  // produced a stale queued item, this rescues it without requiring discovery.
  const watchdog=setInterval(()=>{
    if(!pending.size)return;
    const now=Date.now();
    const overdue=[...pending.values()].some(x=>Number(x.dueAt||0)<=now);
    if(overdue && active.size<maxConcurrent){
      holderMetrics.stuckQueuedRescued++;
      holderMetrics.workerWakeups++;
      drain();
    }
  },250);
  watchdog.unref?.();

  return {
    enqueue,
    drain,
    get queueDepth(){return pending.size},
    get processing(){return active.size},
    get oldestAgeMs(){
      if(!pending.size)return null;
      return Date.now()-Math.min(...[...pending.values()].map(x=>x.enqueuedAt));
    },
    get nextDueInMs(){
      if(!pending.size)return null;
      return Math.max(0,Math.min(...[...pending.values()].map(x=>x.dueAt))-Date.now());
    },
    inspect(mint){
      const row=history.get(mint)||null;
      const p=pending.get(mint)||null;
      return {
        ...(row||{mint,attempts:0,status:active.has(mint)?'running':'unknown'}),
        pending:Boolean(p),
        active:active.has(mint),
        nextDueAt:p?.dueAt??row?.nextDueAt??null,
        nextDueInMs:p?Math.max(0,p.dueAt-Date.now()):null,
        queueRetries:p?.retries??row?.retries??0
      };
    }
  };
}
`;
src=src.slice(0,start)+replacement+'\n';
fs.writeFileSync(target,src);

console.log('PASS: MEMEFLOW V12.15 HOLDER QUEUE DRAIN FIX installed');
console.log('Target:',target);
console.log('Backup:',backup);
console.log('Next: node MEMEFLOW_V12_15_HOLDER_QUEUE_DRAIN_FIX/self-test-v12-15.mjs && restart MEMEFLOW');
