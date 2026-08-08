import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve('memeflow-app/src/enrich.mjs');
if (!fs.existsSync(target)) {
  console.error('ABORT: memeflow-app/src/enrich.mjs not found. Run from ~/workspace.');
  process.exit(1);
}

let s = fs.readFileSync(target, 'utf8');
const marker = 'MEMEFLOW_V12_16_HOLDER_THROUGHPUT_FIX';

if (s.includes(marker)) {
  console.log('PASS: MEMEFLOW V12.16 already installed');
  process.exit(0);
}

// V12.16 is intentionally based on the V12.15.x worker-timeout/queue-drain line.
// Refuse to patch an older queue because that could reintroduce the active-slot bug.
if (!/workerTimeoutMs|HOLDER_WORKER_TIMEOUT|holder worker timeout after/i.test(s)) {
  console.error('ABORT: V12.15.x holder worker-timeout protection was not detected.');
  console.error('Install the latest V12.15.x patch first, then run V12.16.');
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = target + `.before-v12-16-holder-throughput-${stamp}`;
fs.copyFileSync(target, backup);

function replaceOne(re, replacement, label) {
  const matches = [...s.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))];
  if (matches.length !== 1) {
    console.error(`ABORT: ${label}: expected exactly 1 match, found ${matches.length}`);
    fs.copyFileSync(backup, target);
    process.exit(3);
  }
  s = s.replace(re, replacement);
}

// 1) Raise holder capacity to 4, while reserving half for fresh first-attempt work.
// Existing env/config values above 4 remain honored.
const maxConcurrentRe = /const\s+maxConcurrent\s*=\s*Math\.max\(\s*1\s*,\s*Number\(\s*config\?\.\s*maxConcurrent\s*\?\?\s*([^)]+)\)\s*\)\s*;/;
const mm = s.match(maxConcurrentRe);
if (!mm) {
  console.error('ABORT: maxConcurrent declaration not found');
  fs.copyFileSync(backup, target);
  process.exit(4);
}
const oldDefault = mm[1].trim();
s = s.replace(maxConcurrentRe, `/* ${marker}
   4 bounded workers total; 2 are protected from recovery traffic so a new Pump
   token does not wait behind stale/retry holder scans. Existing values >4 win. */
  const requestedMaxConcurrent=Math.max(1,Number(config?.maxConcurrent??${oldDefault}));
  const maxConcurrent=Math.max(4,requestedMaxConcurrent);
  const freshReserved=Math.min(2,Math.max(1,maxConcurrent-1));
  const recoveryLimit=Math.max(1,maxConcurrent-freshReserved);
  const freshWindowMs=Math.max(5000,Number(config?.freshWindowMs??15000));`);

// 2) Track lane of active jobs without changing holder RPC/backoff behavior.
if (!s.includes('const activeLane=new Map();')) {
  replaceOne(
    /const\s+active\s*=\s*new\s+Set\(\s*\)\s*;/,
    `const active=new Set();
  const activeLane=new Map(); // V12.16 mint -> 'fresh' | 'recovery'`,
    'active set'
  );
}

// Helper inserted immediately before drain().
if (!s.includes('function v1216Lane(')) {
  replaceOne(
    /\n\s*function\s+drain\s*\(\s*\)\s*\{/,
    `
  function v1216Lane(item,now=Date.now()){
    const attempts=Number(diagRow(item.mint)?.attempts||0);
    const age=Math.max(0,now-Number(item.enqueuedAt||item.queuedAt||now));
    return attempts===0 && age<=freshWindowMs ? 'fresh' : 'recovery';
  }
  function v1216ActiveCount(lane){
    let n=0;
    for(const value of activeLane.values()) if(value===lane)n++;
    return n;
  }
  function v1216OldestRunnableAge(now=Date.now()){
    const due=[...pending.values()].filter(x=>Number(x?.dueAt||0)<=now);
    if(!due.length)return null;
    return now-Math.min(...due.map(x=>Number(x.enqueuedAt||x.queuedAt||now)));
  }
  function v1216FreshWait(now=Date.now()){
    const due=[...pending.values()].filter(x=>Number(x?.dueAt||0)<=now && v1216Lane(x,now)==='fresh');
    if(!due.length)return 0;
    return now-Math.min(...due.map(x=>Number(x.enqueuedAt||x.queuedAt||now)));
  }

  function drain(){`,
    'drain insertion point'
  );
}

// 3) Mark active lane right after active.add(). We do not touch timeout/retry code.
if (!/activeLane\.set\(item\.mint/.test(s)) {
  replaceOne(
    /active\.add\(item\.mint\)\s*;/,
    `active.add(item.mint);
    activeLane.set(item.mint,v1216Lane(item));`,
    'active.add'
  );
}

// 4) Release lane in finally.
if (!/activeLane\.delete\(item\.mint\)/.test(s)) {
  replaceOne(
    /active\.delete\(item\.mint\)\s*;/,
    `active.delete(item.mint);
      activeLane.delete(item.mint);`,
    'active.delete'
  );
}

// 5) Replace only drain() body. A small brace scanner avoids fragile line-number patches.
function findFunctionRange(src, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, 'm');
  const m = re.exec(src);
  if (!m) return null;
  const open = src.indexOf('{', m.index);
  let depth = 0, quote = null, esc = false, lineComment = false, blockComment = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i+1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') { lineComment = true; i++; continue; }
    if (c === '/' && n === '*') { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return {start:m.index, end:i+1};
    }
  }
  return null;
}

const dr = findFunctionRange(s, 'drain');
if (!dr) {
  console.error('ABORT: drain() function not found after preparation');
  fs.copyFileSync(backup, target);
  process.exit(5);
}

const newDrain = `function drain(){
    wakeTimer=null;
    wakeAt=0;
    const now=Date.now();

    while(active.size<maxConcurrent){
      const runnable=[...pending.values()]
        .filter(item=>Number(item?.dueAt||0)<=now);

      if(!runnable.length)break;

      const fresh=runnable
        .filter(item=>v1216Lane(item,now)==='fresh')
        .sort((a,b)=>Number(a.enqueuedAt||0)-Number(b.enqueuedAt||0));

      let due=null;

      if(fresh.length){
        // Fresh first attempts always win. FIFO within the 15s SLA window.
        due=fresh[0];
      }else{
        // Recovery is capped so fresh work always has protected capacity.
        if(v1216ActiveCount('recovery')>=recoveryLimit)break;
        const recovery=runnable
          .filter(item=>v1216Lane(item,now)==='recovery')
          .sort((a,b)=>{
            const ar=Number(a.retries||0), br=Number(b.retries||0);
            if(ar!==br)return ar-br;
            return Number(a.dueAt||0)-Number(b.dueAt||0);
          });
        if(recovery.length)due=recovery[0];
      }

      if(!due)break;
      pending.delete(due.mint);
      void run(due);
    }
    scheduleWake();
  }`;

s = s.slice(0, dr.start) + newDrain + s.slice(dr.end);

// 6) Enrich inspect() diagnostics without requiring app-server changes.
// Current debug endpoint already serializes holderQueue.inspect(mint).
const qRetryNeedle = /queueRetries\s*:\s*p\?\.retries\s*\?\?\s*row\?\.retries\s*\?\?\s*0/;
if (qRetryNeedle.test(s) && !s.includes('freshHolderWaitMs:')) {
  s = s.replace(qRetryNeedle, `queueRetries:p?.retries??row?.retries??0,
        queueDepth:pending.size,
        activeCount:active.size,
        maxConcurrent,
        freshReserved,
        freshActive:v1216ActiveCount('fresh'),
        recoveryActive:v1216ActiveCount('recovery'),
        oldestRunnableHolderAgeMs:v1216OldestRunnableAge(),
        freshHolderWaitMs:v1216FreshWait()`);
}

// Syntax check before writing is impossible on the in-memory string, so write,
// run node --check, and roll back automatically if it fails.
fs.writeFileSync(target, s);
const {spawnSync} = await import('node:child_process');
const check = spawnSync(process.execPath, ['--check', target], {encoding:'utf8'});
if (check.status !== 0) {
  fs.copyFileSync(backup, target);
  console.error('ABORT: patched enrich.mjs failed node --check; backup restored.');
  console.error(check.stderr || check.stdout);
  process.exit(6);
}

console.log('PASS: MEMEFLOW V12.16 HOLDER THROUGHPUT FIX installed');
console.log('Target:', target);
console.log('Backup:', backup);
console.log('Workers: minimum 4 at runtime (higher configured values preserved)');
console.log('Fresh reserve: 2 slots; recovery cap: 2 slots at default concurrency');
console.log('Next: run self-test, restart MEMEFLOW, then inspect debug lifecycle.');
