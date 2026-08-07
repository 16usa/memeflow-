import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const enrich=path.join(appDir,'src','enrich.mjs');
const server=path.join(appDir,'app-server.mjs');
const e=fs.readFileSync(enrich,'utf8');
const s=fs.readFileSync(server,'utf8');

assert(e.includes('const history=new Map(); // V10 holder lifecycle diagnostics'));
assert(e.includes('inspect(mint){'));
assert(e.includes('_diag.attempts++'));
assert(e.includes("_diag.status='success'"));
console.log('PASS: holder queue per-mint lifecycle diagnostics installed');

assert(s.includes('const priceLifecycleDiag=new Map(); // V10'));
assert(s.includes('_pd2.snapshotCount++'));
assert(s.includes("'/api/debug/token-lifecycle'"));
console.log('PASS: price snapshot diagnostics and token lifecycle endpoint installed');

assert(!e.includes('HOLDER_INITIAL_DELAY_MS='));
console.log('PASS: enrich.mjs does not alter server holder timing configuration');

for(const f of [enrich,server]){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||r.stdout);
}
console.log('PASS: syntax checks');

console.log('');
console.log('ALL V10 SELF-TESTS PASSED');
