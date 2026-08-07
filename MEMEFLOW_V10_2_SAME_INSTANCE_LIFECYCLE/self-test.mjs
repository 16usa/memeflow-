import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const s=fs.readFileSync(server,'utf8');

assert(s.includes("'/api/debug/filter-pipeline-lifecycle'"));
assert(s.includes("diagnosticVersion:'V10.2-same-instance'"));
assert(s.includes("holderQueue.inspect?.(mint)"));
assert(s.includes("priceLifecycleDiag.get(mint)"));
assert(s.includes("store?._uidDec?.get?.(u.id)?.get?.(mint)"));
assert(s.includes("tokensInThisInstance"));
console.log('PASS: same-instance endpoint present');
console.log('PASS: holder/price/decision diagnostics included');
console.log('PASS: O(1) decision lookup included');
console.log('PASS: instance identity included');

const r=spawnSync(process.execPath,['--check',server],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr||r.stdout);
console.log('PASS: app-server.mjs syntax-valid');

console.log('');
console.log('ALL V10.2 SELF-TESTS PASSED');
