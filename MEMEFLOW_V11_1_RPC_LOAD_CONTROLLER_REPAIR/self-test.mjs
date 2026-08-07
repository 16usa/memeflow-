import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const enrich=path.join(appDir,'src','enrich.mjs');
const solana=path.join(appDir,'src','solana.mjs');

const s=fs.readFileSync(server,'utf8');
const e=fs.readFileSync(enrich,'utf8');
const r=fs.readFileSync(solana,'utf8');

assert(r.includes("RPC_MIN_INTERVAL_MS||350"));
assert(r.includes("RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS||3500"));
assert(r.includes("RPC_GET_ACCOUNT_INFO_MIN_INTERVAL_MS||1000"));
console.log('PASS: V11 RPC pacing present');

assert(r.includes('_globalCooldownUntil'));
assert(r.includes('_noteProviderCooldown'));
assert(r.includes('connection rate limits'));
console.log('PASS: V11 provider cooldown + rate-limit recognition present');

assert(e.includes('MEMEFLOW_V11_HOLDER_BACKOFF'));
assert(e.includes('Math.pow(2,Math.min(item.retries,3))'));
assert(e.includes('Math.random()*2000'));
console.log('PASS: V11 holder exponential backoff + jitter present');

assert(s.includes('MEMEFLOW_V11_PRICE_LOAD_SHED'));
assert(s.includes('holderBacklog'));
assert(s.includes('backgroundEveryMs=12000'));
assert(s.includes('backgroundEveryMs=30000'));
assert(s.includes('backgroundEveryMs=90000'));
console.log('PASS: V11 adaptive price polling + holder priority present');

for(const p of [solana,enrich,server]){
  const x=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  assert.equal(x.status,0,x.stderr||x.stdout);
}
console.log('PASS: solana.mjs / enrich.mjs / app-server.mjs syntax-valid');

console.log('');
console.log('ALL V11.1 SELF-TESTS PASSED');
