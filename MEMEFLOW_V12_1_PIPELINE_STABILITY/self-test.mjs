import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const s=fs.readFileSync(server,'utf8');

assert(s.includes('MEMEFLOW_V12_1_PIPELINE_STABILITY'));
assert(s.includes('let bridgeRunActive=false'));
assert(s.includes('runsSkippedBusy'));
console.log('PASS: one-at-a-time bridge lock present');

assert(s.includes('BRIDGE_MAX_PER_RUN'));
assert(s.includes('all.slice(0,BRIDGE_MAX_PER_RUN)'));
assert(s.includes('tokensDeferred'));
console.log('PASS: bounded recovery batch present');

assert(s.includes('BRIDGE_MIN_TOKEN_AGE_MS'));
assert(s.includes('bridgeAgeMs(token,now)<BRIDGE_MIN_TOKEN_AGE_MS'));
console.log('PASS: normal discovery head-start present');

assert(s.includes('await new Promise(resolve=>setTimeout(resolve,25))'));
console.log('PASS: cooperative yield between recovery items present');

if(s.includes("diagnosticVersion:'V10.2-same-instance'")){
  assert(s.includes('holderStallReason'));
  assert(s.includes('READY_BUT_NOT_STARTED_10S'));
  console.log('PASS: stalled holder queue diagnosis present');
}

const r=spawnSync(process.execPath,['--check',server],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr||r.stdout);
console.log('PASS: app-server.mjs syntax-valid');

console.log('');
console.log('ALL V12.1 SELF-TESTS PASSED');
