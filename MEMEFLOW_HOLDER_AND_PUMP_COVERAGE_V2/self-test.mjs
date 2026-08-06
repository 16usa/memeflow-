import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;

const solanaPath=path.join(appDir,'src','solana.mjs');
const enrichPath=path.join(appDir,'src','enrich.mjs');
const serverPath=path.join(appDir,'app-server.mjs');

const sol=await import(pathToFileURL(solanaPath).href);

// Verify current Pump IDL non-create coverage.
for(const disc of [
  sol.PUMP_DISC_EXTEND_ACCOUNT,
  sol.PUMP_DISC_BUY_EXACT_QUOTE_V2
]){
  assert(Array.isArray(disc)&&disc.length===8);
}
console.log('PASS: current Pump non-create discriminators installed');

const enrichText=fs.readFileSync(enrichPath,'utf8');
assert(enrichText.includes("holderSource:'Solana getProgramAccounts unique-wallet scan'"));
assert(enrichText.includes('aggregateWalletBalances'));
assert(enrichText.includes('get oldestAgeMs()'));
assert(enrichText.includes('get nextDueInMs()'));
console.log('PASS: unique-wallet holder aggregation installed');
console.log('PASS: reliable due-time holder scheduler installed');

const {makeHolderQueue,makeHolderMetrics}=await import(pathToFileURL(enrichPath).href);
const metrics=makeHolderMetrics();
let calls=0;
const q=makeHolderQueue(
  {maxConcurrent:1,queueMax:10,initialDelayMs:1000,retryDelayMs:5000,maxRetries:2},
  {holderMetrics:metrics,enrichHoldersFn:async()=>{calls++;return {rateLimited:false}}}
);
assert(q.enqueue('TEST_MINT'));
assert.equal(q.queueDepth,1);
assert(q.nextDueInMs!==null);
await new Promise(r=>setTimeout(r,1300));
assert.equal(calls,1);
assert.equal(metrics.holderSucceeded,1);
assert.equal(q.queueDepth,0);
assert.equal(q.processing,0);
console.log('PASS: queued holder job actually wakes and completes');

const serverText=fs.readFileSync(serverPath,'utf8');
assert(serverText.includes('holderOldestQueuedAgeMs:holderQueue.oldestAgeMs'));
assert(serverText.includes('holderNextDueInMs:holderQueue.nextDueInMs'));
console.log('PASS: holder queue diagnostics exposed');

console.log('');
console.log('ALL V2 SELF-TESTS PASSED');