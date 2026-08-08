import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const p='memeflow-app/src/enrich.mjs';
if(!fs.existsSync(p)){
  console.error('FAIL: '+p+' not found');
  process.exit(1);
}
const s=fs.readFileSync(p,'utf8');
let fail=0;
function t(name,ok){
  console.log((ok?'PASS: ':'FAIL: ')+name);
  if(!ok) fail++;
}
t('V12.16.1 marker',s.includes('MEMEFLOW_V12_16_1_HOLDER_THROUGHPUT_SAFE_FIX'));
t('minimum holder concurrency 4',/maxConcurrent\s*=\s*Math\.max\(\s*4\s*,/.test(s));
t('existing holder worker timeout preserved',/holder worker timeout after|workerTimeoutMs|HOLDER_WORKER_TIMEOUT/i.test(s));
t('holder retry/backoff logic preserved',/retryDelayMs|maxRetries|reschedule/i.test(s));

const c=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
t('node --check enrich.mjs',c.status===0);
if(c.status!==0) console.error(c.stderr||c.stdout);

if(fail){
  console.error(`FAIL: ${fail} self-test(s) failed`);
  process.exit(2);
}
console.log('PASS: MEMEFLOW V12.16.1 self-test complete');
