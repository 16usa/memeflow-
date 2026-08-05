import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {JsonStore,defaults} from './store.mjs';
import {makeLiveEvalMetrics,makeEvaluateForActiveUsers} from './liveeval.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────

function tmpStore(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'memeflow-liveeval-'));
  return new JsonStore(dir);
}

function makeToken(mint,overrides={}){
  return {mint,name:'T',symbol:'T',priceSol:0.001,marketCapSol:5,liquiditySol:2,
    holderCount:50,top10Pct:15,developerPct:5,buyPressure:1.5,holderFresh:true,
    dataQuality:0.8,source:'test',discoveredAt:Date.now(),...overrides};
}

// Force synchronous write bypassing 200ms debounce
function syncSave(store){
  clearTimeout(store._st);
  const {decisions:_d,...persist}=store.state;
  fs.writeFileSync(store.file,JSON.stringify(persist),'utf8');
}

function addActiveUser(store,uid,hoursAgo=1){
  store.user(uid);
  store.state.users[uid].lastActiveAt=Date.now()-hoursAgo*3600000;
}

function addInactiveUser(store,uid){
  store.user(uid);
  // No lastActiveAt set — treated as never active
}

// ── tests ────────────────────────────────────────────────────────────────────

await test('live token is evaluated for active users only', async ()=>{
  const store=tmpStore();
  const uidActive='active-1';
  const uidInactive='inactive-1';
  addActiveUser(store,uidActive,1);   // active 1 hour ago
  addInactiveUser(store,uidInactive); // no lastActiveAt

  const metrics=makeLiveEvalMetrics();
  const evalFn=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25,delayMs:0});
  const token=makeToken('LIVE-MINT1');
  store.addToken(token);

  await evalFn(token);

  assert.equal(store.decisions(uidActive).length,1,'active user got a decision');
  assert.equal(store.decisions(uidInactive).length,0,'inactive user skipped');
  assert.equal(metrics.liveEvaluationsPerformed,1,'one evaluation performed');
  assert.equal(metrics.liveEvaluationTokensProcessed,1,'one token processed');
});

await test('inactive users are skipped during live evaluation', async ()=>{
  const store=tmpStore();
  const inactive=['u1','u2','u3'];
  for(const uid of inactive) addInactiveUser(store,uid);

  const metrics=makeLiveEvalMetrics();
  const evalFn=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25,delayMs:0});
  const token=makeToken('INACTIVE-MINT1');
  store.addToken(token);

  await evalFn(token);

  for(const uid of inactive)
    assert.equal(store.decisions(uid).length,0,`${uid} skipped`);
  assert.equal(metrics.liveEvaluationsPerformed,0,'no evaluations performed');
  assert.equal(metrics.liveEvaluationUsersSkipped,3,'3 users skipped');
});

await test('owner user is always included regardless of lastActiveAt', async ()=>{
  const store=tmpStore();
  const uidOwner='owner-user';
  store.user(uidOwner);
  // No lastActiveAt, but isOwner=true
  store.state.users[uidOwner].isOwner=true;

  const metrics=makeLiveEvalMetrics();
  const evalFn=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25,delayMs:0});
  const token=makeToken('OWNER-MINT1');
  store.addToken(token);

  await evalFn(token);

  assert.equal(store.decisions(uidOwner).length,1,'owner always evaluated');
  assert.equal(metrics.liveEvaluationsPerformed,1);
});

await test('touchUser marks a user active so they receive future live decisions', async ()=>{
  const store=tmpStore();
  const uid='user-newcomer';
  store.user(uid);
  // Initially no lastActiveAt — inactive

  const metrics=makeLiveEvalMetrics();
  const evalFn=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25,delayMs:0});

  const tokenBefore=makeToken('BEFORE-MINT');
  store.addToken(tokenBefore);
  await evalFn(tokenBefore);
  assert.equal(store.decisions(uid).length,0,'no decision before activation');

  // Simulate user making a request — handler calls store.touchUser(uid)
  store.touchUser(uid);

  const tokenAfter=makeToken('AFTER-MINT');
  store.addToken(tokenAfter);
  await evalFn(tokenAfter);
  assert.equal(store.decisions(uid).length,1,'decision present after activation');
});

await test('newly active user receives future live decisions', async ()=>{
  const store=tmpStore();
  const uid='user-new-active';
  store.user(uid);
  store.touchUser(uid); // mark active now

  const metrics=makeLiveEvalMetrics();
  const evalFn=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25,delayMs:0});

  const tokens=['NEW-1','NEW-2','NEW-3'].map(m=>makeToken(m));
  for(const t of tokens) store.addToken(t);
  for(const t of tokens) await evalFn(t);

  assert.ok(store.decisions(uid).length>=3,'gets all future live decisions');
  assert.equal(metrics.liveEvaluationTokensProcessed,3);
});

await test('maximum 250 decisions retained per user', async ()=>{
  const store=tmpStore();
  const uid='user-cap';
  addActiveUser(store,uid,1);

  const metrics=makeLiveEvalMetrics();
  const evalFn=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25,delayMs:0});

  // Evaluate 300 distinct tokens
  for(let i=0;i<300;i++){
    const t=makeToken('CAP-MINT-'+String(i).padStart(3,'0'),{discoveredAt:Date.now()-i});
    store.addToken(t);
    await evalFn(t);
  }

  const count=store._uidDec[uid]?.size||0;
  assert.ok(count<=250,`cap enforced: ${count} ≤ 250`);
  assert.ok(count>0,'has some decisions');
});

await test('1000 inactive users do not create decisions for one new token', async ()=>{
  const store=tmpStore();
  // Add 50 inactive users (enough to represent the large pool without slow test)
  for(let i=0;i<50;i++) addInactiveUser(store,'bulk-inactive-'+i);
  // Add 1 active user
  addActiveUser(store,'solo-active',1);

  const metrics=makeLiveEvalMetrics();
  const evalFn=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25,delayMs:0});
  const token=makeToken('BULK-MINT');
  store.addToken(token);

  await evalFn(token);

  const totalDecisions=Object.values(store._uidDec).reduce((s,m)=>s+m.size,0);
  assert.equal(totalDecisions,1,'only 1 decision — the active user');
  assert.equal(metrics.liveEvaluationsPerformed,1,'only 1 evaluation performed');
  assert.equal(metrics.liveEvaluationUsersSkipped,50,'50 inactive users skipped');
});

await test('live evaluation is non-blocking and returns a Promise', async ()=>{
  const store=tmpStore();
  const uid='user-async';
  addActiveUser(store,uid,1);
  // Add enough users to force multiple batches with delayMs=10
  for(let i=0;i<60;i++) addActiveUser(store,'batch-user-'+i,1);

  const metrics=makeLiveEvalMetrics();
  const evalFn=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25,delayMs:10});
  const token=makeToken('ASYNC-MINT');
  store.addToken(token);

  const before=Date.now();
  const p=evalFn(token);
  assert.ok(p instanceof Promise,'returns a Promise (non-blocking fire-and-forget interface)');
  await p;
  const elapsed=Date.now()-before;
  // 61 users / 25 batchSize = 3 batches → 2 inter-batch delays of 10ms → ≥ 15ms
  assert.ok(elapsed>=10,`elapsed ${elapsed}ms shows async yielding occurred`);
});

await test('decisions remain excluded from disk persistence after live evaluation', async ()=>{
  const store=tmpStore();
  const uid='user-disk';
  addActiveUser(store,uid,1);
  const token=makeToken('DISK-MINT2');
  store.addToken(token);
  syncSave(store); // baseline save (no decisions)

  const metrics=makeLiveEvalMetrics();
  const evalFn=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25,delayMs:0});
  await evalFn(token);
  // Wait for debounced save to flush
  await new Promise(r=>setTimeout(r,300));

  const onDisk=JSON.parse(fs.readFileSync(store.file,'utf8'));
  assert.equal(Object.keys(onDisk.decisions||{}).length,0,'no decisions written to disk');
});

await test('inactive user decisions are evicted from memory', async ()=>{
  const store=tmpStore();
  const uid='user-evict';
  // User was active, gets decisions
  addActiveUser(store,uid,1);
  const metrics=makeLiveEvalMetrics();

  // Force lastEvictAt to be old by directly setting _uidDec with some decisions
  store.user(uid);
  store.setDecision(uid,'EVICT-MINT1',{state:'WATCH',score:75,confidence:80,primaryReason:'test',reasons:[]});
  assert.ok(store._uidDec[uid]?.size>0,'has decisions before eviction');

  // Now mark user inactive (> 24h ago)
  store.state.users[uid].lastActiveAt=Date.now()-90000000; // 25 hours ago

  // Force eviction by triggering evaluation with a fresh factory (lastEvictAt=0)
  const evalFn=makeEvaluateForActiveUsers({store,metrics,activeUserHoursMs:86400000,batchSize:25,delayMs:0});
  const token=makeToken('EVICT-TRIGGER');
  store.addToken(token);
  await evalFn(token); // lastEvictAt=0 → eviction runs

  // User's _uidDec should be cleared
  assert.ok(!store._uidDec[uid]||store._uidDec[uid].size===0,'inactive user decisions evicted');
});
