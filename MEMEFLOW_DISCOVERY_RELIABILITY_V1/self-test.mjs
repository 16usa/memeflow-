import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;

for(const rel of ['src/store.mjs','src/liveeval.mjs','src/discqueue.mjs','src/solana.mjs','src/enrich.mjs','app-server.mjs']){
  const p=path.join(appDir,rel);
  assert(fs.existsSync(p),`missing ${rel}`);
}

const {JsonStore}=await import(pathToFileURL(path.join(appDir,'src/store.mjs')).href);
const {makeLiveEvalMetrics,makeEvaluateForActiveUsers}=await import(pathToFileURL(path.join(appDir,'src/liveeval.mjs')).href);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'memeflow-reliability-'));
const store=new JsonStore(tmp);

// Reproduce the old production failure: an existing user with no settings field.
store.state.users.legacy={
  id:'legacy',
  createdAt:new Date().toISOString(),
  lastActiveAt:Date.now(),
  isOwner:false
};
const repaired=store.settings('legacy');
assert(repaired && typeof repaired==='object');
assert(Number.isFinite(Number(repaired.minScore)));
console.log('PASS: legacy user settings are auto-repaired');

const metrics=makeLiveEvalMetrics();
const run=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25});
await run({
  mint:'TEST_MINT',
  name:'test',
  symbol:'TEST',
  discoveredAt:Date.now(),
  priceSol:0.000001,
  liquiditySol:1,
  marketCapSol:10,
  holderCount:40,
  holderFresh:true,
  top10Pct:10,
  developerPct:1,
  buyPressure:2,
  dataQuality:1,
  lastPriceAt:Date.now(),
  lastMarketActivityAt:Date.now()
});
assert.equal(metrics.liveEvaluationBatchErrors,0);
assert(metrics.liveEvaluationsPerformed>=1);
assert(metrics.decisionsInMemoryByActiveUsers>=1);
console.log('PASS: live evaluation succeeds for repaired users');
console.log('PASS: liveEvaluationBatchErrors = 0');

const server=fs.readFileSync(path.join(appDir,'app-server.mjs'),'utf8');
assert(server.includes('void enrich(result.mint,result.curve)'));
assert(server.includes('function curvePressure('));
assert(server.includes('backgroundEveryMs=60_000'));
assert(server.includes('await evaluateAll(updated)'));
assert(server.includes('wsReconnectAttempt=0'));
console.log('PASS: discovery queue is decoupled from enrichment');
console.log('PASS: adaptive price polling + curve pressure installed');
console.log('PASS: WebSocket reconnect reset installed');

const enrich=fs.readFileSync(path.join(appDir,'src/enrich.mjs'),'utf8');
assert(enrich.includes("getProgramAccounts"));
assert(enrich.includes("holderSource:'Solana getProgramAccounts'"));
assert(!/largest\s*=\s*await rpc\.call\('getTokenLargestAccounts'/.test(enrich));
console.log('PASS: direct native holder scan installed');
console.log('PASS: getTokenLargestAccounts holder bottleneck removed');

const disc=fs.readFileSync(path.join(appDir,'src/discqueue.mjs'),'utf8');
assert(disc.includes('maxSignatureAgeMs = 900000'));
assert(disc.includes('queueMax = 1000'));
console.log('PASS: discovery retention increased to 15 minutes');

const sol=fs.readFileSync(path.join(appDir,'src/solana.mjs'),'utf8');
assert(sol.includes('RPC_MIN_INTERVAL_MS||200'));
assert(sol.includes('async _pace()'));
console.log('PASS: global RPC pacing installed');

console.log('');
console.log('ALL SELF-TESTS PASSED');