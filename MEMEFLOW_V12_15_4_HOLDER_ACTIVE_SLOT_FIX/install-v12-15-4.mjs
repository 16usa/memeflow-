#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const MARKER = 'MEMEFLOW_V12_15_4_HOLDER_ACTIVE_SLOT_FIX';
const cwd = process.cwd();
const candidates = [
  path.join(cwd, 'memeflow-app', 'src', 'enrich.mjs'),
  path.join(cwd, 'src', 'enrich.mjs'),
];
const target = candidates.find(p => fs.existsSync(p));

if (!target) {
  console.error('ABORT: cannot find memeflow-app/src/enrich.mjs (run from ~/workspace or ~/workspace/memeflow-app)');
  process.exit(1);
}

let src = fs.readFileSync(target, 'utf8');
if (src.includes(MARKER)) {
  console.log('PASS: MEMEFLOW V12.15.4 already installed');
  console.log('Target:', target);
  process.exit(0);
}

const needle = 'export function makeHolderQueue';
const start = src.indexOf(needle);
if (start < 0) {
  console.error('ABORT: makeHolderQueue() not found');
  process.exit(1);
}

// Find the opening { of makeHolderQueue and then its matching closing }.
// This parser ignores braces inside JS strings/comments/templates well enough for this function.
const open = src.indexOf('{', start);
if (open < 0) {
  console.error('ABORT: makeHolderQueue opening brace not found');
  process.exit(1);
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let mode = 'code';
  let quote = null;
  let escaped = false;

  for (let i = openIndex; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (mode === 'lineComment') {
      if (c === '\n') mode = 'code';
      continue;
    }
    if (mode === 'blockComment') {
      if (c === '*' && n === '/') { mode = 'code'; i++; }
      continue;
    }
    if (mode === 'string') {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) { mode = 'code'; quote = null; }
      continue;
    }
    if (mode === 'template') {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      // This function replacement contains no template nesting requirement in old source;
      // treat closing backtick as template end and ignore braces while inside.
      if (c === '`') mode = 'code';
      continue;
    }

    if (c === '/' && n === '/') { mode = 'lineComment'; i++; continue; }
    if (c === '/' && n === '*') { mode = 'blockComment'; i++; continue; }
    if (c === '"' || c === "'") { mode = 'string'; quote = c; continue; }
    if (c === '`') { mode = 'template'; continue; }

    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const end = findMatchingBrace(src, open);
if (end < 0) {
  console.error('ABORT: could not locate end of makeHolderQueue()');
  process.exit(1);
}

const replacement = String.raw`
/* ${MARKER}
 * Fixes holder queue starvation caused by occupied/stale worker slots.
 * - active jobs are leased in a Map with start timestamps
 * - every job is bounded by a worker timeout
 * - slot release happens in finally and immediately kicks drain()
 * - watchdog reaps stale bookkeeping and kicks overdue pending work
 * - diagnostics expose active/pending ages without changing user filters
 */
export function makeHolderQueue(config,deps){
  const maxConcurrent=Math.max(1,Number(config?.maxConcurrent??2));
  const queueMax=Math.max(10,Number(config?.queueMax??500));
  const initialDelayMs=Math.min(10000,Math.max(0,Number(config?.initialDelayMs??750)));
  const retryDelayMs=Math.max(1000,Number(config?.retryDelayMs??30000));
  const maxRetries=Math.max(1,Number(config?.maxRetries??8));
  const jobTimeoutMs=Math.max(
    3000,
    Number(
      config?.jobTimeoutMs ??
      process.env.HOLDER_JOB_TIMEOUT_MS ??
      12000
    )
  );
  const watchdogMs=Math.max(
    100,
    Number(
      config?.watchdogMs ??
      process.env.HOLDER_QUEUE_WATCHDOG_MS ??
      250
    )
  );

  const {enrichHoldersFn,holderMetrics,admissionFn=null}=deps;

  const pending=new Map(); // mint -> {mint,retries,enqueuedAt,dueAt}
  const active=new Map();  // mint -> {mint,item,startedAt,leaseId}
  const history=new Map();

  let wakeTimer=null;
  let wakeAt=0;
  let leaseSeq=0;
  let draining=false;

  // Metrics are additive: older diagnostics remain compatible.
  holderMetrics.holderWorkerTimeouts ??= 0;
  holderMetrics.holderStaleSlotsReaped ??= 0;
  holderMetrics.holderWatchdogRuns ??= 0;
  holderMetrics.holderDrainRuns ??= 0;
  holderMetrics.holderDrainKicks ??= 0;
  holderMetrics.holderMaxObservedActive ??= 0;
  holderMetrics.holderMaxObservedPending ??= 0;

  function diagRow(mint){
    let row=history.get(mint);
    if(!row){
      row={
        mint,
        queuedAt:null,
        nextDueAt:null,
        attempts:0,
        lastAttemptAt:null,
        lastSuccessAt:null,
        lastError:null,
        lastErrorAt:null,
        rateLimited:0,
        retries:0,
        status:'unknown',
        activeStartedAt:null,
        activeEndedAt:null,
        lastDurationMs:null,
        workerTimeouts:0
      };
      history.set(mint,row);
    }
    return row;
  }

  function pruneHistory(){
    if(history.size<=2500)return;
    const rows=[...history.values()]
      .sort((a,b)=>(b.lastAttemptAt||b.queuedAt||0)-(a.lastAttemptAt||a.queuedAt||0));
    history.clear();
    for(const row of rows.slice(0,1200))history.set(row.mint,row);
  }

  function nextPendingDueAt(){
    let next=Infinity;
    for(const item of pending.values()){
      const due=Number(item?.dueAt||0);
      if(due<next)next=due;
    }
    return Number.isFinite(next)?next:null;
  }

  function scheduleWake(){
    if(!pending.size){
      if(wakeTimer){ clearTimeout(wakeTimer); wakeTimer=null; }
      wakeAt=0;
      return;
    }

    const next=nextPendingDueAt();
    if(next==null)return;

    if(wakeTimer && wakeAt && wakeAt<=next)return;
    if(wakeTimer){ clearTimeout(wakeTimer); wakeTimer=null; }

    wakeAt=next;
    wakeTimer=setTimeout(()=>{
      wakeTimer=null;
      wakeAt=0;
      kickDrain();
    },Math.max(0,next-Date.now()));
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
      d.nextDueAt=null;
    }
  }

  function reschedule(item,delayMs){
    const base=Math.max(1000,Number(delayMs)||retryDelayMs);
    const exponential=Math.min(120000,base*Math.pow(2,Math.min(Number(item.retries||0),3)));
    const jitter=Math.floor(Math.random()*750);
    const next={
      ...item,
      retries:Number(item.retries||0)+1,
      dueAt:Date.now()+exponential+jitter
    };
    pending.set(item.mint,next);
    const d=diagRow(item.mint);
    d.retries=next.retries;
    d.nextDueAt=next.dueAt;
    d.status='queued';
    scheduleWake();
  }

  function timeoutPromise(ms,mint,leaseId){
    return new Promise((_,reject)=>{
      const t=setTimeout(()=>{
        const e=new Error('holder worker timeout after '+ms+'ms');
        e.code='HOLDER_WORKER_TIMEOUT';
        e.holderWorkerTimeout=true;
        e.mint=mint;
        e.leaseId=leaseId;
        reject(e);
      },ms);
      t.unref?.();
    });
  }

  function releaseLease(mint,leaseId,status){
    const lease=active.get(mint);
    if(!lease || lease.leaseId!==leaseId)return false;
    active.delete(mint);

    const d=diagRow(mint);
    const now=Date.now();
    d.activeEndedAt=now;
    d.lastDurationMs=d.activeStartedAt?Math.max(0,now-d.activeStartedAt):null;
    d.activeStartedAt=null;
    if(status)d.status=status;
    return true;
  }

  async function run(item){
    if(admissionFn){
      let gate=null;
      try{
        gate=admissionFn(item.mint)||{allow:true};
      }catch(e){
        holderMetrics.holderAdmissionErrors=(holderMetrics.holderAdmissionErrors||0)+1;
        gate={allow:true,reason:'admission_error_fail_open'};
      }

      if(gate.allow===false){
        holderMetrics.lastHolderAdmissionReason=gate.reason||'deferred';
        if(gate.drop===true){
          holderMetrics.holderAdmissionDropped=(holderMetrics.holderAdmissionDropped||0)+1;
          const d=diagRow(item.mint);
          d.status='admission-dropped';
          d.nextDueAt=null;
          return;
        }

        holderMetrics.holderAdmissionDeferred=(holderMetrics.holderAdmissionDeferred||0)+1;
        const next={
          ...item,
          dueAt:Date.now()+Math.max(250,Number(gate.retryInMs||3000))
        };
        pending.set(item.mint,next);
        const d=diagRow(item.mint);
        d.status='queued';
        d.nextDueAt=next.dueAt;
        scheduleWake();
        return;
      }
      holderMetrics.holderAdmissionAllowed=(holderMetrics.holderAdmissionAllowed||0)+1;
    }

    // Reserve the slot BEFORE the first await.
    const leaseId=++leaseSeq;
    const startedAt=Date.now();
    active.set(item.mint,{mint:item.mint,item,startedAt,leaseId});
    holderMetrics.holderMaxObservedActive=Math.max(
      holderMetrics.holderMaxObservedActive||0,
      active.size
    );

    const d=diagRow(item.mint);
    d.attempts++;
    d.lastAttemptAt=startedAt;
    d.activeStartedAt=startedAt;
    d.status='running';
    d.nextDueAt=null;

    let finalStatus='failed';

    try{
      const result=await Promise.race([
        Promise.resolve().then(()=>enrichHoldersFn(item.mint)),
        timeoutPromise(jobTimeoutMs,item.mint,leaseId)
      ]);

      if(result?.rateLimited){
        holderMetrics.holderRateLimited++;
        d.rateLimited++;
        d.lastError='rate limited';
        d.lastErrorAt=Date.now();

        if(Number(item.retries||0)<maxRetries){
          holderMetrics.holderRetries++;
          reschedule(item,result.retryAfter??retryDelayMs);
          finalStatus='queued';
        }else{
          holderMetrics.holderFailed++;
          holderMetrics.lastHolderError='max retries exceeded on rate limit';
          holderMetrics.lastHolderErrorAt=Date.now();
          finalStatus='failed';
        }
      }else{
        holderMetrics.holderSucceeded++;
        holderMetrics.lastHolderError=null;
        d.lastSuccessAt=Date.now();
        d.lastError=null;
        d.lastErrorAt=null;
        finalStatus='success';
      }
    }catch(e){
      const timedOut=Boolean(e?.holderWorkerTimeout || e?.code==='HOLDER_WORKER_TIMEOUT');

      if(timedOut){
        holderMetrics.holderWorkerTimeouts++;
        d.workerTimeouts=(d.workerTimeouts||0)+1;
        d.lastError=sanitize(e?.message||'holder worker timeout');
        d.lastErrorAt=Date.now();

        if(Number(item.retries||0)<maxRetries){
          holderMetrics.holderRetries++;
          // Timeout retry is intentionally shorter than normal RPC backoff.
          reschedule(item,Math.min(retryDelayMs,5000));
          finalStatus='queued';
        }else{
          holderMetrics.holderFailed++;
          holderMetrics.lastHolderError=d.lastError;
          holderMetrics.lastHolderErrorAt=Date.now();
          finalStatus='failed';
        }
      }else if(Number(item.retries||0)<maxRetries && isRateLimited(e)){
        holderMetrics.holderRateLimited++;
        holderMetrics.holderRetries++;
        d.lastError=sanitize(e?.message||'rate limited');
        d.lastErrorAt=Date.now();
        reschedule(item,e?.retryAfterMs??retryDelayMs);
        finalStatus='queued';
      }else{
        holderMetrics.holderFailed++;
        holderMetrics.lastHolderError=sanitize(e?.message||'unknown');
        holderMetrics.lastHolderErrorAt=Date.now();
        d.lastError=holderMetrics.lastHolderError;
        d.lastErrorAt=Date.now();
        finalStatus='failed';
      }
    }finally{
      // Only the lease owner may free this slot.
      releaseLease(item.mint,leaseId,finalStatus);
      // Do not wait for the next timer. A newly freed slot should consume an overdue item now.
      kickDrain();
    }
  }

  function chooseDue(now){
    const rows=[...pending.values()].filter(item=>Number(item?.dueAt||0)<=now);
    if(!rows.length)return null;

    // First attempts before retries. Within first attempts, newest token first.
    rows.sort((a,b)=>{
      const ar=Number(a?.retries||0);
      const br=Number(b?.retries||0);
      if((ar===0)!==(br===0))return ar===0?-1:1;
      if(ar===0 && br===0)return Number(b?.enqueuedAt||0)-Number(a?.enqueuedAt||0);
      return Number(a?.dueAt||0)-Number(b?.dueAt||0);
    });
    return rows[0]||null;
  }

  function drain(){
    if(draining)return;
    draining=true;
    holderMetrics.holderDrainRuns++;

    try{
      const now=Date.now();

      while(active.size<maxConcurrent){
        const due=chooseDue(now);
        if(!due)break;

        pending.delete(due.mint);
        // run() reserves the active slot synchronously before its first await.
        void run(due);
      }

      holderMetrics.holderMaxObservedPending=Math.max(
        holderMetrics.holderMaxObservedPending||0,
        pending.size
      );
    }finally{
      draining=false;
      scheduleWake();
    }
  }

  function kickDrain(){
    holderMetrics.holderDrainKicks++;
    queueMicrotask(drain);
  }

  function enqueue(mint){
    if(!mint||pending.has(mint)||active.has(mint))return false;
    if(pending.size>=queueMax)dropOldest();

    const now=Date.now();
    const item={mint,retries:0,enqueuedAt:now,dueAt:now+initialDelayMs};
    pending.set(mint,item);

    const d=diagRow(mint);
    d.queuedAt=d.queuedAt||now;
    d.nextDueAt=item.dueAt;
    d.status='queued';
    d.retries=0;

    holderMetrics.holderQueued++;
    holderMetrics.holderMaxObservedPending=Math.max(
      holderMetrics.holderMaxObservedPending||0,
      pending.size
    );

    pruneHistory();
    scheduleWake();

    // If delay is already due (or turns due before another event), give drain an immediate chance.
    if(initialDelayMs===0)kickDrain();
    return true;
  }

  // Independent safety net. It does NOT wait for the regular wake timer.
  const watchdog=setInterval(()=>{
    holderMetrics.holderWatchdogRuns++;
    const now=Date.now();

    // A lease should normally disappear via Promise.race + finally.
    // Reap only if bookkeeping somehow survives well beyond the configured timeout.
    for(const [mint,lease] of active){
      const age=now-Number(lease.startedAt||now);
      if(age>jobTimeoutMs+Math.max(1000,watchdogMs*4)){
        active.delete(mint);
        holderMetrics.holderStaleSlotsReaped++;

        const d=diagRow(mint);
        d.lastError='stale active slot reaped after '+age+'ms';
        d.lastErrorAt=now;
        d.activeEndedAt=now;
        d.lastDurationMs=age;
        d.activeStartedAt=null;
        d.status='stale-reaped';

        const item=lease.item;
        if(item && Number(item.retries||0)<maxRetries && !pending.has(mint)){
          holderMetrics.holderRetries++;
          reschedule(item,1000);
        }
      }
    }

    const next=nextPendingDueAt();
    if(next!=null && next<=now && active.size<maxConcurrent){
      kickDrain();
    }
  },watchdogMs);
  watchdog.unref?.();

  return {
    enqueue,
    drain:()=>kickDrain(),
    get queueDepth(){return pending.size},
    get processing(){return active.size},
    get activeCount(){return active.size},
    get pendingCount(){return pending.size},
    get jobTimeoutMs(){return jobTimeoutMs},
    get watchdogMs(){return watchdogMs},
    get oldestAgeMs(){
      if(!pending.size)return null;
      return Date.now()-Math.min(...[...pending.values()].map(x=>x.enqueuedAt));
    },
    get oldestActiveAgeMs(){
      if(!active.size)return null;
      return Date.now()-Math.min(...[...active.values()].map(x=>x.startedAt));
    },
    get nextDueInMs(){
      const next=nextPendingDueAt();
      return next==null?null:Math.max(0,next-Date.now());
    },
    activeSnapshot(){
      const now=Date.now();
      return [...active.values()].map(x=>({
        mint:x.mint,
        startedAt:x.startedAt,
        activeAgeMs:Math.max(0,now-x.startedAt),
        retries:Number(x.item?.retries||0),
        leaseId:x.leaseId
      }));
    },
    inspect(mint){
      const row=history.get(mint)||null;
      const p=pending.get(mint)||null;
      const a=active.get(mint)||null;
      const now=Date.now();

      return {
        ...(row||{mint,attempts:0,status:a?'running':'unknown'}),
        pending:Boolean(p),
        active:Boolean(a),
        activeStartedAt:a?.startedAt??row?.activeStartedAt??null,
        activeAgeMs:a?Math.max(0,now-a.startedAt):null,
        nextDueAt:p?.dueAt??row?.nextDueAt??null,
        nextDueInMs:p?Math.max(0,p.dueAt-now):null,
        queueRetries:p?.retries??row?.retries??0,
        queueDepth:pending.size,
        activeCount:active.size,
        workerTimeoutMs:jobTimeoutMs
      };
    }
  };
}
`;

const backup = target + '.before-v12-15-4-' + new Date().toISOString().replace(/[:.]/g,'-');
fs.copyFileSync(target, backup);

const out = src.slice(0, start) + replacement + src.slice(end + 1);
fs.writeFileSync(target, out, 'utf8');

console.log('PASS: MEMEFLOW V12.15.4 HOLDER ACTIVE SLOT FIX installed');
console.log('Target:', target);
console.log('Backup:', backup);
console.log('Next: run self-test, then restart MEMEFLOW');
