import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const p='memeflow-app/src/enrich.mjs';
if(!fs.existsSync(p)){console.error('FAIL: '+p+' missing');process.exit(1)}
const s=fs.readFileSync(p,'utf8');

const checks=[
  ['marker',s.includes('MEMEFLOW_V12_15_HOLDER_QUEUE_DRAIN_WAKE_FIX')],
  ['enqueue kick',s.includes('queueMicrotask(()=>drain())')],
  ['watchdog',s.includes('stuckQueuedRescued')],
  ['worker timeout',s.includes('HOLDER_WORKER_TIMEOUT')],
  ['jobsStarted metric',s.includes('jobsStarted')],
  ['initial delay accepts 75ms',s.includes('Math.max(25,Number(config?.initialDelayMs??75))')],
  ['concurrency reservation before await',s.includes("active.add(mint); // reserve worker slot BEFORE any async work")],
];

let ok=true;
for(const [name,pass] of checks){
  console.log((pass?'PASS: ':'FAIL: ')+name);
  if(!pass)ok=false;
}
const nc=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
if(nc.status===0)console.log('PASS: node --check '+p);
else{console.log('FAIL: node --check '+p);console.log(nc.stderr);ok=false}

process.exit(ok?0:1);
