#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const candidates=[
  path.join(cwd,'memeflow-app','src','enrich.mjs'),
  path.join(cwd,'src','enrich.mjs')
];
const target=candidates.find(p=>fs.existsSync(p));
if(!target){
  console.error('FAIL: enrich.mjs not found');
  process.exit(1);
}

const s=fs.readFileSync(target,'utf8');
let failed=0;
function check(name,ok){
  console.log((ok?'PASS: ':'FAIL: ')+name);
  if(!ok)failed++;
}

check('V12.15.4 marker',s.includes('MEMEFLOW_V12_15_4_HOLDER_ACTIVE_SLOT_FIX'));
check('active Map lease tracking',/const active=new Map\(\)/.test(s));
check('worker timeout race',s.includes('HOLDER_WORKER_TIMEOUT') && s.includes('Promise.race'));
check('finally releases slot',s.includes('releaseLease(item.mint,leaseId,finalStatus)'));
check('immediate drain kick after release',s.includes('kickDrain();'));
check('watchdog exists',s.includes('holderWatchdogRuns') && s.includes('setInterval'));
check('stale slot reaper exists',s.includes('holderStaleSlotsReaped'));
check('active diagnostics exist',s.includes('oldestActiveAgeMs') && s.includes('activeSnapshot'));
check('75ms-compatible initial delay',s.includes('Math.max(0,Number(config?.initialDelayMs??750))'));

const syntax=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});
check('node --check '+target,syntax.status===0);
if(syntax.status!==0){
  console.error(syntax.stderr||syntax.stdout);
}

if(failed){
  console.error('SELF-TEST FAILED:',failed,'check(s)');
  process.exit(1);
}
console.log('PASS: MEMEFLOW V12.15.4 self-test complete');
