import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const p='memeflow-app/src/enrich.mjs';
if(!fs.existsSync(p)){
  console.error('FAIL: '+p+' not found');
  process.exit(1);
}
const s=fs.readFileSync(p,'utf8');
let failed=0;
function check(name,ok){
  console.log((ok?'PASS: ':'FAIL: ')+name);
  if(!ok)failed++;
}
check('V12.16 marker',s.includes('MEMEFLOW_V12_16_HOLDER_THROUGHPUT_FIX'));
check('minimum concurrency 4',/maxConcurrent=Math\.max\(4,requestedMaxConcurrent\)/.test(s));
check('fresh reserve',/freshReserved/.test(s)&&/recoveryLimit/.test(s));
check('15s fresh window',/freshWindowMs/.test(s));
check('active lane accounting',/activeLane/.test(s));
check('fresh priority in drain',/Fresh first attempts always win/.test(s));
check('recovery capacity cap',/v1216ActiveCount\('recovery'\)>=recoveryLimit/.test(s));
check('diagnostic fresh wait',/freshHolderWaitMs/.test(s));
check('diagnostic runnable age',/oldestRunnableHolderAgeMs/.test(s));
check('existing worker timeout still present',/workerTimeoutMs|HOLDER_WORKER_TIMEOUT|holder worker timeout after/i.test(s));

const syntax=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
check('node --check enrich.mjs',syntax.status===0);
if(syntax.status!==0)console.error(syntax.stderr||syntax.stdout);

if(failed){
  console.error(`FAIL: ${failed} self-test(s) failed`);
  process.exit(2);
}
console.log('PASS: MEMEFLOW V12.16 self-test complete');
