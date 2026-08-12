import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const enginePath=process.argv[2]?path.resolve(process.argv[2]):path.resolve('./src/game-engine.mjs');
const {GameEngine}=await import(pathToFileURL(enginePath).href+'?v571='+Date.now());

class FakeStore {
  constructor(){
    this.state={users:{u:{id:'u',killSwitch:false}},tokens:{},gamePaper:{version:'x',users:{}}};
    this.rows=[];this.saves=0;
  }
  save(){this.saves++;}
  decisions(uid){return uid==='u'?this.rows:[];}
}
const M1='11111111111111111111111111111111';
const M2='22222222222222222222222222222222';
const token=(mint=M1,price=1,extra={})=>({mint,name:'Test',symbol:'TST',priceSol:price,holderFresh:true,holderCount:100,top10Pct:20,developerPct:1,buyPressure:2,liquiditySol:50,...extra});
const decision=(mint=M1,state='BUY READY',score=80,extra={})=>({mint,state,score,confidence:90,...extra});
function make(){
  const store=new FakeStore();
  store.state.tokens[M1]=token();
  store.rows=[decision()];
  const engine=new GameEngine(store,{startingBalance:1000,sweepIntervalMs:10000,marketLossAbortMs:30000});
  return {store,engine};
}

// Core regression: Game must accept a site-approved BUY READY without adding its own timestamp gates.
{
  const {store,engine}=make();
  store.state.tokens[M1]=token(M1,1,{holderFresh:false,holderScannedAt:Date.now()-3600000,lastPriceAt:Date.now()-3600000,antiRugHistory:[{at:Date.now()-1000,priceSol:2},{at:Date.now(),priceSol:.5}]});
  store.rows=[decision(M1,'BUY READY',75,{updatedAt:Date.now()-3600000})];
  const picked=engine.pickCandidate('u');
  assert.equal(picked?.mint,M1,'site BUY READY must remain eligible even when old Game-only freshness/coherence metrics look bad');
  const started=engine.start('u',{bet:100,requestId:'site-authority'});
  assert.equal(started.ok,true);
  assert.equal(started.session.state,'LIVE');
  assert.equal(started.selector.policy,'MEMEFLOW_SETTINGS_ONLY');
  engine.destroy();
}

// Game must not accept states that the site engine did not approve.
for(const state of ['BLOCKED','WATCH','WAITING']){
  const {store,engine}=make();
  store.rows=[decision(M1,state,99)];
  const started=engine.start('u',{bet:100,requestId:'no-'+state});
  assert.equal(started.ok,false,state+' must not launch');
  assert.equal(started.code,'NO_CANDIDATE');
  engine.destroy();
}

// A valid price is the only Game-side mechanical requirement for forming 1.00x.
{
  const {store,engine}=make();
  store.state.tokens[M1]=token(M1,0);
  const started=engine.start('u',{bet:100,requestId:'no-price'});
  assert.equal(started.ok,false);assert.equal(started.selector.noPrice,1);
  engine.destroy();
}

// Game-specific market-shape/crowding must not override MEMEFLOW's score preference.
{
  const {store,engine}=make();
  const base=Date.now();
  store.state.tokens[M1]=token(M1,1,{antiRugHistory:[{at:base-5000,priceSol:2},{at:base,priceSol:.5}]});
  store.state.tokens[M2]=token(M2,1,{antiRugHistory:[{at:base-5000,priceSol:1},{at:base,priceSol:1.01}]});
  store.rows=[decision(M1,'BUY READY',91,{updatedAt:base-100}),decision(M2,'BUY READY',80,{updatedAt:base})];
  engine.activeByMint.set(M1,new Set(['a','b','c','d','e']));
  const picked=engine.pickCandidate('u');
  assert.equal(picked.mint,M1,'Game telemetry/crowding may not down-rank a higher MEMEFLOW score');
  assert.equal(picked.selectorScore,91);
  engine.destroy();
}

// Same score: newer site decision is the tie-breaker, not Game risk scoring.
{
  const {store,engine}=make();
  const base=Date.now();
  store.state.tokens[M2]=token(M2,1);
  store.rows=[decision(M1,'BUY READY',90,{updatedAt:base-1000}),decision(M2,'BUY READY',90,{updatedAt:base})];
  assert.equal(engine.pickCandidate('u').mint,M2);
  engine.destroy();
}

// Site kill switch remains authoritative.
{
  const {store,engine}=make();store.state.users.u.killSwitch=true;
  const started=engine.start('u',{bet:100,requestId:'kill'});
  assert.equal(started.ok,false);assert.equal(started.code,'KILL_SWITCH');
  engine.destroy();
}

// Live settlement safety remains intact after restoring site-engine authority.
{
  const {store,engine}=make();
  store.state.tokens[M1]=token(M1,1,{lastPriceAt:Date.now()});
  engine.start('u',{bet:100,autoCashout:1.5,stopLoss:.75,requestId:'live'});
  store.state.tokens[M1]={...store.state.tokens[M1],priceSol:1.51,lastPriceAt:Date.now()+1};
  engine.onTokenUpdate(M1,store.state.tokens[M1]);
  const st=engine.status('u',{sync:false});
  assert.equal(st.session.state,'COMPLETE');assert.equal(st.session.reason,'AUTO_CASH_OUT');
  engine.destroy();
}

console.log('PEPE GAME V5.7.1 SITE-ENGINE AUTHORITY TESTS: PASS');
