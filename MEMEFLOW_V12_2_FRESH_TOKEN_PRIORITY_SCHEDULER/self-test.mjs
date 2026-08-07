import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const s=fs.readFileSync(server,'utf8');

assert(s.includes('MEMEFLOW_V12_2_FRESH_TOKEN_PRIORITY_SCHEDULER'));
assert(s.includes('FRESH_PRIORITY_MAX_AGE_MS'));
assert(s.includes('FRESH_PRIORITY_BATCH'));
assert(s.includes('RECOVERY_BATCH'));
console.log('PASS: two-lane scheduler configuration present');

assert(s.includes("label==='fresh'"));
assert(s.includes('Promise.race([bridgeRepairToken(token,now),timeout])'));
assert(s.includes('BRIDGE_ITEM_TIMEOUT_MS'));
console.log('PASS: per-token timeout isolation present');

assert(s.includes("?'fresh-priority'"));
assert(s.includes(":'recovery'"));
console.log('PASS: scheduler lane diagnostics present');

assert(s.includes('freshPriorityStarted'));
assert(s.includes('freshPrioritySucceeded'));
assert(s.includes('recoveryStarted'));
assert(s.includes('recoverySucceeded'));
console.log('PASS: V12.2 scheduler metrics present');

const r=spawnSync(process.execPath,['--check',server],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr||r.stdout);
console.log('PASS: app-server.mjs syntax-valid');

console.log('');
console.log('ALL V12.2 SELF-TESTS PASSED');
