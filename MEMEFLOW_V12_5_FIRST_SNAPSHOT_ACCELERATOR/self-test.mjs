import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const serverPath=path.join(appDir,'app-server.mjs');
const solanaPath=path.join(appDir,'src','solana.mjs');
const server=fs.readFileSync(serverPath,'utf8');
const solana=fs.readFileSync(solanaPath,'utf8');

assert(solana.includes('MEMEFLOW_V12_5_FIRST_SNAPSHOT_ACCELERATOR'));
console.log('PASS: V12.5 accelerator marker present');

assert(solana.includes('MEMEFLOW V11 HOLDER BACKOFF'));
assert(solana.includes('Math.pow(2,Math.min(item.retries,3))'));
console.log('PASS: V11 exponential retry/backoff preserved');

assert(!/nextDueAt\s*:\s*Date\.now\(\)\s*\+\s*10000\b/.test(
  solana.slice(Math.max(0,solana.indexOf('MEMEFLOW V11 HOLDER BACKOFF')-10000),
               solana.indexOf('MEMEFLOW V11 HOLDER BACKOFF')+14000)
));
console.log('PASS: old 10-second first holder-attempt delay removed');

assert(server.includes('MEMEFLOW_V12_5_FIRST_SNAPSHOT_METRICS'));
assert(server.includes('targetFirstAttemptMs:750'));
assert(server.includes('oldestQueuedNoAttemptAgeMs'));
assert(server.includes('firstSnapshotSlaMissesCurrent'));
console.log('PASS: first-snapshot SLA diagnostics installed');

assert(server.includes('MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT'));
console.log('PASS: V12.4 fast Phase-A remains installed');

for(const p of [solanaPath,serverPath]){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||r.stdout);
}
console.log('PASS: modified modules syntax-valid');

console.log('');
console.log('ALL V12.5 SELF-TESTS PASSED');
