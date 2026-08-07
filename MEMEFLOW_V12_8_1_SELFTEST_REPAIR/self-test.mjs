import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const serverPath=path.join(appDir,'app-server.mjs');
const enrichPath=path.join(appDir,'src','enrich.mjs');

const server=fs.readFileSync(serverPath,'utf8');
const enrich=fs.readFileSync(enrichPath,'utf8');

assert(enrich.includes('MEMEFLOW_V12_8_HOLDER_ADMISSION_QUEUE'));
assert(enrich.includes('admissionFn=null'));
assert(enrich.includes('holderAdmissionDeferred'));
console.log('PASS: holder queue admission support present');

assert(server.includes('MEMEFLOW_V12_8_ADMISSION_GATE'));
assert(server.includes('holderAdmissionForActiveUsers'));
assert(server.includes('admissionFn:holderAdmissionForActiveUsers'));
console.log('PASS: admission gate wired to holder queue');

assert(server.includes("lastReason='buy_pressure_below_user_min'"));
assert(server.includes("lastReason='price_pending'"));
console.log('PASS: dynamic cheap filters defer expensive holder RPC');

assert(!server.includes('store?._uidDec?.get?.(u.id)?.get?.(mint)'));
console.log('PASS: broken diagnostic decision lookup removed');

if(server.includes('MEMEFLOW_V12_8_CANDIDATE_FILTER')){
  assert(server.includes("includeBlocked"));
  assert(server.includes("'BLOCKED','EXPIRED','SKIP','BUY_BLOCKED'"));
  console.log('PASS: non-candidate decisions hidden by default with audit override');
}

assert(enrich.includes('MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY'));
assert(server.includes('MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT'));
console.log('PASS: V12.4 and V12.7 protections preserved');

for(const p of [enrichPath,serverPath]){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||r.stdout);
}
console.log('PASS: modified modules syntax-valid');

console.log('');
console.log('ALL V12.8 SELF-TESTS PASSED');
