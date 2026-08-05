import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {JsonStore,defaults} from './store.mjs';
import {makeRecoveryMetrics,startDecisionRecovery,lazyRecoverUser} from './recovery.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────

function tmpStore(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'memeflow-recovery-'));
  return new JsonStore(dir);
}

function makeToken(mint,overrides={}){
  return {mint,name:'TEST',symbol:'TST',priceSol:0.001,marketCapSol:5,liquiditySol:2,
    holderCount:50,top10Pct:15,developerPct:5,buyPressure:1.5,holderFresh:true,
    dataQuality:0.8,source:'test',discoveredAt:Date.now(),...overrides};
}

// Force a synchronous write, bypassing the 200ms debounce
function syncSave(store){
  clearTimeout(store._st);
  const {decisions:_d,...persist}=store.state;
  fs.writeFileSync(store.file,JSON.stringify(persist),'utf8');
}

// getLiveState that always reports no live work
const quietLive=()=>({queueDepth:0,processing:0});

// ── original 8 tests (updated for new interface) ──────────────────────────────

await test('decisions disappear from memory on simulated restart', ()=>{
  const store=tmpStore();
  const uid='user-restart-a';
  store.user(uid);
  store.addToken(makeToken('RESTART-MINT1'));
  store.setDecision(uid,'RESTART-MINT1',{state:'WATCH',score:75,confidence:80,primaryReason:'test',reasons:[]});
  assert.ok(store.decisions(uid).length>0,'has decisions before restart');
  syncSave(store);

  const store2=new JsonStore(store.dir);
  assert.equal(store2.decisions(uid).length,0,'decisions gone after restart');
  assert.ok(Object.keys(store2.state.tokens).length>0,'tokens still present');
  assert.ok(store2.state.users[uid],'user still present');
});

await test('persisted tokens and user settings reload after restart', ()=>{
  const store=tmpStore();
  const uid='user-reload-b';
  store.user(uid);
  store.setSettings(uid,{...defaults(),minScore:88,minHolders:55});
  store.addToken(makeToken('RELOAD-MINT2'));
  syncSave(store);

  const store2=new JsonStore(store.dir);
  assert.ok(store2.state.tokens['RELOAD-MINT2'],'token reloaded');
  assert.equal(store2.settings(uid).minScore,88,'minScore setting reloaded');
  assert.equal(store2.settings(uid).minHolders,55,'minHolders setting reloaded');
});

await test('recovery rebuilds decisions for active users', async ()=>{
  const store=tmpStore();
  const uid='user-rebuild-c';
  store.user(uid);
  store.touchUser(uid); // mark as recently active
  store.addToken(makeToken('REBUILD-MINT3'));
  store.addToken(makeToken('REBUILD-MINT4'));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,metrics,getLiveState:quietLive,batchSize:10,delayMs:1,tokenLimit:200,activeUserHoursMs:86400000});

  assert.equal(metrics.decisionRecoveryStatus,'complete');
  assert.ok(store.decisions(uid).length>=2,'decisions rebuilt for both tokens');
});

await test('different users receive different decisions based on settings', async ()=>{
  const store=tmpStore();
  const uidStrict='user-strict-d';
  const uidLoose='user-loose-d';
  store.user(uidStrict); store.touchUser(uidStrict);
  store.user(uidLoose);  store.touchUser(uidLoose);
  // Strict: minHolders=999 — BLOCKED
  store.setSettings(uidStrict,{...defaults(),minHolders:999,minScore:99,minConfidence:99});
  // Loose: everything passes — BUY READY
  store.setSettings(uidLoose,{...defaults(),minHolders:0,minScore:0,minConfidence:0,
    maxTop10Pct:100,maxDeveloperPct:100,minBuyPressure:0,requireFreshHolderSnapshot:false});

  store.addToken(makeToken('DIFF-MINT5'));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,metrics,getLiveState:quietLive,batchSize:10,delayMs:1,tokenLimit:200,activeUserHoursMs:86400000});

  const dStrict=store.decisions(uidStrict);
  const dLoose=store.decisions(uidLoose);
  assert.equal(dStrict.length,1,'strict user has a decision');
  assert.equal(dLoose.length,1,'loose user has a decision');
  assert.equal(dStrict[0].state,'BLOCKED','strict user blocked by minHolders=999');
  assert.equal(dLoose[0].state,'BUY READY','loose user passes all gates');
});

await test('recovery does not persist decisions to disk', async ()=>{
  const store=tmpStore();
  const uid='user-nodisk-e';
  store.user(uid); store.touchUser(uid);
  store.addToken(makeToken('DISK-MINT6'));
  store.state.decisions={};store._uidDec={};
  syncSave(store);

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,metrics,getLiveState:quietLive,batchSize:10,delayMs:1,tokenLimit:200,activeUserHoursMs:86400000});
  await new Promise(r=>setTimeout(r,300)); // flush debounced save

  const onDisk=JSON.parse(fs.readFileSync(store.file,'utf8'));
  assert.equal(Object.keys(onDisk.decisions||{}).length,0,'no decisions written to disk');
});

await test('recovery is non-blocking and yields between batches', async ()=>{
  const store=tmpStore();
  const uid='user-yield-f';
  store.user(uid); store.touchUser(uid);
  for(let i=0;i<3;i++) store.addToken(makeToken('YIELD-MINT-'+i));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  const before=Date.now();
  const p=startDecisionRecovery({store,metrics,getLiveState:quietLive,batchSize:1,delayMs:10,tokenLimit:200,activeUserHoursMs:86400000});
  assert.ok(p instanceof Promise,'startDecisionRecovery returns a Promise');
  await p;
  const elapsed=Date.now()-before;
  // 3 tokens at batchSize=1 → 2 inter-batch yields of 10ms each → ≥ 15ms
  assert.ok(elapsed>=15,`elapsed ${elapsed}ms should be ≥ 15ms`);
});

await test('recovery continues if individual token evaluation fails', async ()=>{
  const store=tmpStore();
  const uid='user-fault-g';
  store.user(uid); store.touchUser(uid);
  for(let i=0;i<5;i++) store.addToken(makeToken('FAULT-MINT-'+i));
  store.state.decisions={};store._uidDec={};

  // Make settings() throw for uid on the 3rd evaluation call
  let calls=0;
  const origSettings=store.settings.bind(store);
  store.settings=(id)=>{calls++;if(id===uid&&calls===3)throw new Error('test settings failure');return origSettings(id)};

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,metrics,getLiveState:quietLive,batchSize:10,delayMs:1,tokenLimit:200,activeUserHoursMs:86400000});

  assert.equal(metrics.decisionRecoveryStatus,'complete','recovery completes despite error');
  assert.equal(metrics.decisionRecoveryErrors,1,'exactly one error recorded');
  assert.equal(metrics.decisionRecoveryTokensProcessed,5,'all 5 tokens counted');
});

await test('recovery metrics are tracked correctly', async ()=>{
  const store=tmpStore();
  store.user('u1-metrics'); store.touchUser('u1-metrics');
  store.user('u2-metrics'); store.touchUser('u2-metrics');
  for(let i=0;i<4;i++) store.addToken(makeToken('METRICS-MINT-'+i));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  assert.equal(metrics.decisionRecoveryStatus,'pending');
  assert.equal(metrics.decisionRecoveryStartedAt,null);

  await startDecisionRecovery({store,metrics,getLiveState:quietLive,batchSize:2,delayMs:1,tokenLimit:200,activeUserHoursMs:86400000});

  assert.equal(metrics.decisionRecoveryStatus,'complete');
  assert.ok(metrics.decisionRecoveryStartedAt!==null);
  assert.ok(metrics.decisionRecoveryCompletedAt>=metrics.decisionRecoveryStartedAt);
  assert.equal(metrics.decisionRecoveryTokensTotal,4);
  assert.equal(metrics.decisionRecoveryTokensLimit,200);
  assert.equal(metrics.decisionRecoveryTokensProcessed,4);
  assert.equal(metrics.decisionRecoveryUsersTotal,2);
  assert.equal(metrics.decisionRecoveryUsersProcessed,2);
  assert.equal(metrics.decisionRecoveryEvaluationsPerformed,8,'4 tokens × 2 users');
  assert.equal(metrics.decisionRecoveryErrors,0);
  // decisionRecoveryDecisionsCreated should equal total retained (≤ 4×2=8)
  assert.ok(metrics.decisionRecoveryDecisionsCreated<=8);
  assert.ok(metrics.decisionRecoveryDecisionsCreated>0);
});

// ── 8 new tests per spec ──────────────────────────────────────────────────────

await test('only newest tokenLimit tokens are recovered at startup', async ()=>{
  const store=tmpStore();
  const uid='user-limit-h';
  store.user(uid); store.touchUser(uid);
  // Add 10 tokens with distinct discoveredAt so ordering is deterministic
  const mints=[];
  for(let i=0;i<10;i++){
    const mint='LIMIT-MINT-'+i;
    mints.push(mint);
    store.addToken(makeToken(mint,{discoveredAt:Date.now()-i*1000}));
  }
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  // Limit to newest 3
  await startDecisionRecovery({store,metrics,getLiveState:quietLive,batchSize:10,delayMs:1,tokenLimit:3,activeUserHoursMs:86400000});

  assert.equal(metrics.decisionRecoveryTokensLimit,3);
  assert.equal(metrics.decisionRecoveryTokensProcessed,3,'only 3 tokens processed');
  assert.equal(store.decisions(uid).length,3,'only 3 decisions created');
  // The 3 newest (i=0,1,2) should be present; i=3+ should not
  const minted=new Set(store.decisions(uid).map(d=>d.mint));
  assert.ok(minted.has('LIMIT-MINT-0'),'newest token present');
  assert.ok(minted.has('LIMIT-MINT-1'),'2nd token present');
  assert.ok(minted.has('LIMIT-MINT-2'),'3rd token present');
  assert.ok(!minted.has('LIMIT-MINT-9'),'oldest token absent');
});

await test('inactive users are skipped during startup recovery', async ()=>{
  const store=tmpStore();
  const uidActive='user-active-i';
  const uidInactive='user-inactive-i';
  store.user(uidActive);
  store.user(uidInactive);
  // Active user: last seen 1 hour ago
  store.state.users[uidActive].lastActiveAt=Date.now()-3600000;
  // Inactive user: last seen 2 days ago (outside 24h window)
  store.state.users[uidInactive].lastActiveAt=Date.now()-172800000;

  store.addToken(makeToken('SKIP-MINT1'));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,metrics,getLiveState:quietLive,batchSize:10,delayMs:1,tokenLimit:200,activeUserHoursMs:86400000});

  assert.equal(metrics.decisionRecoveryUsersTotal,1,'only 1 active user');
  assert.equal(store.decisions(uidActive).length,1,'active user has a decision');
  assert.equal(store.decisions(uidInactive).length,0,'inactive user has no decisions');
});

await test('users with no lastActiveAt are skipped at startup', async ()=>{
  const store=tmpStore();
  const uid='user-no-seen-j';
  store.user(uid);
  // No lastActiveAt set (legacy user)
  assert.equal(store.state.users[uid].lastActiveAt,undefined);

  store.addToken(makeToken('NOSEEN-MINT1'));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,metrics,getLiveState:quietLive,batchSize:10,delayMs:1,tokenLimit:200,activeUserHoursMs:86400000});

  assert.equal(metrics.decisionRecoveryUsersTotal,0,'no active users');
  assert.equal(store.decisions(uid).length,0,'legacy user skipped');
});

await test('lazy recovery runs for user with no decisions', async ()=>{
  const store=tmpStore();
  const uid='user-lazy-k';
  store.user(uid);
  store.addToken(makeToken('LAZY-MINT1'));
  store.addToken(makeToken('LAZY-MINT2'));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  assert.equal(store.decisions(uid).length,0,'no decisions before lazy recovery');

  await lazyRecoverUser({store,uid,metrics,tokenLimit:200});

  assert.ok(store.decisions(uid).length>=2,'decisions built after lazy recovery');
  assert.equal(metrics.lazyRecoveryCompleted,1,'completed metric incremented');
  assert.equal(metrics.lazyRecoveryUsersRunning,0,'running metric back to 0');
});

await test('duplicate lazy recovery requests for same user are deduplicated', async ()=>{
  const store=tmpStore();
  const uid='user-dedup-l';
  store.user(uid);
  for(let i=0;i<5;i++) store.addToken(makeToken('DEDUP-MINT-'+i));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  // Fire two concurrent requests for the same user
  const p1=lazyRecoverUser({store,uid,metrics,tokenLimit:200});
  const p2=lazyRecoverUser({store,uid,metrics,tokenLimit:200});
  assert.strictEqual(p1,p2,'both calls return the same Promise');

  await Promise.all([p1,p2]);
  // Should only complete once
  assert.equal(metrics.lazyRecoveryCompleted,1,'only one completion');
  // Running counter should never go negative
  assert.equal(metrics.lazyRecoveryUsersRunning,0,'running counter clean');
});

await test('historical recovery pauses when live queue is non-empty', async ()=>{
  const store=tmpStore();
  const uid='user-pause-m';
  store.user(uid); store.touchUser(uid);
  for(let i=0;i<3;i++) store.addToken(makeToken('PAUSE-MINT-'+i));
  store.state.decisions={};store._uidDec={};

  // Live queue is busy for the first 2 polls, then clears
  let liveCalls=0;
  const busyThenClear=()=>{
    liveCalls++;
    return liveCalls<=2?{queueDepth:5,processing:2}:{queueDepth:0,processing:0};
  };

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,metrics,getLiveState:busyThenClear,batchSize:10,delayMs:1,tokenLimit:200,activeUserHoursMs:86400000});

  assert.ok(metrics.decisionRecoveryPausedForLiveWork>=1,'paused at least once for live work');
  assert.equal(metrics.decisionRecoveryStatus,'complete','recovery still completes after yielding');
});

await test('at most 250 decisions retained per user in memory', async ()=>{
  const store=tmpStore();
  const uid='user-cap-n';
  store.user(uid); store.touchUser(uid);
  // Add 300 tokens
  for(let i=0;i<300;i++) store.addToken(makeToken('CAP-MINT-'+String(i).padStart(3,'0'),{discoveredAt:Date.now()-i}));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,metrics,getLiveState:quietLive,batchSize:50,delayMs:1,tokenLimit:300,activeUserHoursMs:86400000});

  const count=store._uidDec[uid]?.size||0;
  assert.ok(count<=250,`at most 250 decisions retained, got ${count}`);
  assert.ok(count>0,'some decisions present');
});

await test('lazy recovery does not persist decisions to disk', async ()=>{
  const store=tmpStore();
  const uid='user-lazydisk-o';
  store.user(uid);
  store.addToken(makeToken('LAZYDISK-MINT1'));
  store.state.decisions={};store._uidDec={};
  syncSave(store);

  const metrics=makeRecoveryMetrics();
  await lazyRecoverUser({store,uid,metrics,tokenLimit:200});
  await new Promise(r=>setTimeout(r,300)); // flush debounced save

  const onDisk=JSON.parse(fs.readFileSync(store.file,'utf8'));
  assert.equal(Object.keys(onDisk.decisions||{}).length,0,'no decisions on disk after lazy recovery');
});
