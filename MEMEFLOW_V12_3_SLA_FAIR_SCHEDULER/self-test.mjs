import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const s=fs.readFileSync(server,'utf8');

assert(s.includes('MEMEFLOW_V12_3_SLA_FAIR_SCHEDULER'));
assert(s.includes('FRESH_SLA_MS'));
assert(s.includes('currentFreshBacklog'));
assert(s.includes('oldestFreshUnprocessedAgeMs'));
assert(s.includes('slaMisses15s'));
console.log('PASS: SLA metrics installed');

assert(s.includes('.filter(bridgeNeedsFastStart)'));
assert(s.includes('.sort((a,b)=>Number(a?.discoveredAt||0)-Number(b?.discoveredAt||0))'));
console.log('PASS: oldest-unprocessed-first ordering installed');

assert(s.includes('bridgePipelineStarted'));
assert(s.includes('bridgeNeedsFastStart'));
console.log('PASS: pipeline-start detection installed');

assert(s.includes('currentUrgentFreshBacklog'));
assert(s.includes('slaEscalations'));
console.log('PASS: urgent fresh-token escalation metrics installed');

if(s.includes("diagnosticVersion:'V10.2-same-instance'")){
  assert(s.includes('slaState:'));
  assert(s.includes('pipelineStarted:bridgePipelineStarted(token)'));
  console.log('PASS: per-token SLA diagnostics installed');
}

const r=spawnSync(process.execPath,['--check',server],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr||r.stdout);
console.log('PASS: app-server.mjs syntax-valid');

console.log('');
console.log('ALL V12.3 SELF-TESTS PASSED');
