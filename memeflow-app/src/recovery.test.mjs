import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {JsonStore,defaults} from './store.mjs';
import {evaluate} from './evaluate.mjs';
import {makeRecoveryMetrics,startDecisionRecovery} from './recovery.mjs';

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

// Mirrors the evaluateAll closure in app-server.mjs
function buildEvaluateAll(store){
  return function evaluateAll(token){
    for(const uid of Object.keys(store.state.users)){
      const d=evaluate(token,store.settings(uid));
      store.setDecision(uid,token.mint,{...d,primaryReason:d.primaryReason});
    }
  };
}

// Force a synchronous save, bypassing the 200ms debounce
function syncSave(store){
  clearTimeout(store._st);
  const {decisions:_d,...persist}=store.state;
  fs.writeFileSync(store.file,JSON.stringify(persist),'utf8');
}

// ── tests ────────────────────────────────────────────────────────────────────

await test('decisions disappear from memory on simulated restart', ()=>{
  const store=tmpStore();
  const uid='user-restart-a';
  store.user(uid);
  store.addToken(makeToken('RESTART-MINT1'));
  store.setDecision(uid,'RESTART-MINT1',{state:'WATCH',score:75,confidence:80,primaryReason:'test',reasons:[]});
  assert.ok(store.decisions(uid).length>0,'has decisions before restart');

  // Simulate restart: fresh store instance from same dir (decisions not persisted)
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

await test('recovery rebuilds decisions from persisted tokens', async ()=>{
  const store=tmpStore();
  const uid='user-rebuild-c';
  store.user(uid);
  store.addToken(makeToken('REBUILD-MINT3'));
  store.addToken(makeToken('REBUILD-MINT4'));
  // Simulate restart: clear in-memory decisions
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,evaluateAll:buildEvaluateAll(store),metrics,batchSize:10,delayMs:1});

  assert.equal(metrics.decisionRecoveryStatus,'complete');
  assert.ok(store.decisions(uid).length>=2,'decisions rebuilt for both tokens');
});

await test('different users receive different decisions based on settings', async ()=>{
  const store=tmpStore();
  const uidStrict='user-strict';
  const uidLoose='user-loose';
  store.user(uidStrict);
  store.user(uidLoose);
  // Strict: minHolders=999 — token with holderCount=50 will be BLOCKED
  store.setSettings(uidStrict,{...defaults(),minHolders:999,minScore:99,minConfidence:99});
  // Loose: minHolders=0, minScore=0, minConfidence=0 — same token will be BUY READY
  store.setSettings(uidLoose,{...defaults(),minHolders:0,minScore:0,minConfidence:0,
    maxTop10Pct:100,maxDeveloperPct:100,minBuyPressure:0,requireFreshHolderSnapshot:false});

  const token=makeToken('DIFF-MINT5');
  store.addToken(token);
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,evaluateAll:buildEvaluateAll(store),metrics,batchSize:10,delayMs:1});

  const dStrict=store.decisions(uidStrict);
  const dLoose=store.decisions(uidLoose);
  assert.equal(dStrict.length,1,'strict user has a decision');
  assert.equal(dLoose.length,1,'loose user has a decision');

  const stateStrict=dStrict[0].state;
  const stateLoose=dLoose[0].state;
  assert.notEqual(stateStrict,stateLoose,
    `strict (${stateStrict}) and loose (${stateLoose}) users should get different states`);
  // Strict user should be blocked by high minHolders threshold
  assert.equal(stateStrict,'BLOCKED','strict user blocked by minHolders=999');
  // Loose user should pass all gates with permissive settings
  assert.equal(stateLoose,'BUY READY','loose user passes all gates');
});

await test('recovery does not persist decisions to disk', async ()=>{
  const store=tmpStore();
  const uid='user-nodisk-d';
  store.user(uid);
  store.addToken(makeToken('DISK-MINT6'));
  store.state.decisions={};store._uidDec={};
  syncSave(store);

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,evaluateAll:buildEvaluateAll(store),metrics,batchSize:10,delayMs:1});

  // Wait for any debounced save to flush
  await new Promise(r=>setTimeout(r,300));

  const onDisk=JSON.parse(fs.readFileSync(store.file,'utf8'));
  assert.equal(Object.keys(onDisk.decisions||{}).length,0,'no decisions written to disk');
});

await test('recovery yields to the event loop between batches', async ()=>{
  const store=tmpStore();
  store.user('user-yield-e');
  for(let i=0;i<3;i++)store.addToken(makeToken('YIELD-MINT-'+i));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  const before=Date.now();
  // batchSize=1 with delayMs=10 → 2 yields of 10ms between the 3 batches
  const p=startDecisionRecovery({store,evaluateAll:buildEvaluateAll(store),metrics,batchSize:1,delayMs:10});
  assert.ok(p instanceof Promise,'startDecisionRecovery returns a Promise (non-blocking)');
  await p;
  const elapsed=Date.now()-before;
  // Must yield at least twice: elapsed ≥ 2 × 10ms = 20ms
  assert.ok(elapsed>=15,`elapsed ${elapsed}ms should be ≥ 15ms (2 yields × 10ms)`);
});

await test('recovery resumes safely if one token evaluation fails', async ()=>{
  const store=tmpStore();
  const uid='user-fault-f';
  store.user(uid);
  for(let i=0;i<5;i++)store.addToken(makeToken('FAULT-MINT-'+i));
  store.state.decisions={};store._uidDec={};

  let calls=0;
  const flakyEvaluateAll=(token)=>{
    calls++;
    if(calls===3)throw new Error('simulated token failure');
    buildEvaluateAll(store)(token);
  };

  const metrics=makeRecoveryMetrics();
  await startDecisionRecovery({store,evaluateAll:flakyEvaluateAll,metrics,batchSize:10,delayMs:1});

  assert.equal(metrics.decisionRecoveryStatus,'complete','recovery completes despite error');
  assert.equal(metrics.decisionRecoveryErrors,1,'exactly one error recorded');
  assert.equal(metrics.decisionRecoveryTokensProcessed,5,'all 5 tokens counted as processed');
  // 4 successful evaluations × 1 user = 4 decisions
  assert.ok(store.decisions(uid).length>=4,'decisions built for non-failing tokens');
});

await test('recovery metrics are tracked correctly', async ()=>{
  const store=tmpStore();
  store.user('u1');store.user('u2');
  for(let i=0;i<4;i++)store.addToken(makeToken('METRICS-MINT-'+i));
  store.state.decisions={};store._uidDec={};

  const metrics=makeRecoveryMetrics();
  assert.equal(metrics.decisionRecoveryStatus,'pending','initial status is pending');
  assert.equal(metrics.decisionRecoveryStartedAt,null,'no start time yet');

  await startDecisionRecovery({store,evaluateAll:buildEvaluateAll(store),metrics,batchSize:2,delayMs:1});

  assert.equal(metrics.decisionRecoveryStatus,'complete');
  assert.ok(metrics.decisionRecoveryStartedAt!==null,'startedAt recorded');
  assert.ok(metrics.decisionRecoveryCompletedAt!==null,'completedAt recorded');
  assert.ok(metrics.decisionRecoveryCompletedAt>=metrics.decisionRecoveryStartedAt);
  assert.equal(metrics.decisionRecoveryTokensTotal,4);
  assert.equal(metrics.decisionRecoveryTokensProcessed,4);
  assert.equal(metrics.decisionRecoveryDecisionsCreated,8,'4 tokens × 2 users');
  assert.equal(metrics.decisionRecoveryErrors,0);
});
