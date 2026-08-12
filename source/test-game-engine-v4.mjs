import assert from 'node:assert/strict';
import {GameEngine} from './game-engine.mjs';

class Store {
  constructor(state=null){
    this.state=state||{tokens:{},gamePaper:{users:{}}};
    this._dec={};
  }
  save(){}
  decisions(uid){return this._dec[uid]||[];}
}

function seed(store,uid='u',mint='MintA'){
  const t=Date.now();
  store.state.tokens[mint]={mint,name:'Pepe Test',symbol:'PEPE',priceSol:1,lastPriceAt:t,updatedAt:t,holderFresh:true,holderCount:120,top10Pct:18,developerPct:1,buyPressure:2.2,liquiditySol:45,marketCapSol:500};
  store._dec[uid]=[{mint,state:'BUY READY',score:91,confidence:90,updatedAt:t,primaryReason:'All configured gates passed'}];
}

{
  const store=new Store();seed(store);
  const engine=new GameEngine(store,{startingBalance:1000,maxRoundMs:60_000});
  const events=[];const off=engine.subscribe('u',e=>events.push(e));
  const r=engine.start('u',{bet:100,autoCashout:1.5,stopLoss:.75,requestId:'abc'});
  assert.equal(r.ok,true);assert.equal(r.balance,900);assert.equal(r.session.multiplier,1);
  const dup=engine.start('u',{bet:100,requestId:'abc'});assert.equal(dup.ok,true);assert.equal(dup.resumed,true);
  store.state.tokens.MintA={...store.state.tokens.MintA,priceSol:1.2,lastPriceAt:Date.now()+20,updatedAt:Date.now()+20};
  engine.onTokenUpdate('MintA',store.state.tokens.MintA);assert.equal(engine.status('u').session.state,'LIVE');
  const lastAt=engine.status('u').session.latestPriceAt;
  store.state.tokens.MintA={...store.state.tokens.MintA,priceSol:.2,lastPriceAt:lastAt-1000,updatedAt:lastAt-1000};
  engine.onTokenUpdate('MintA',store.state.tokens.MintA);assert.ok(engine.status('u').session.multiplier>1); // out of order ignored
  store.state.tokens.MintA={...store.state.tokens.MintA,priceSol:1.55,lastPriceAt:Date.now()+50,updatedAt:Date.now()+50};
  engine.onTokenUpdate('MintA',store.state.tokens.MintA);const done=engine.status('u').session;assert.equal(done.state,'COMPLETE');assert.equal(done.reason,'AUTO_CASH_OUT');assert.equal(done.payout,155);assert.equal(engine.status('u').balance,1055);assert.ok(events.some(e=>e.type==='tick'));assert.ok(events.some(e=>e.type==='state'));off();
}

{
  const store=new Store();seed(store);
  const engine=new GameEngine(store,{startingBalance:1000});engine.start('u',{bet:100,stopLoss:.8});
  store.state.tokens.MintA={...store.state.tokens.MintA,priceSol:.72,lastPriceAt:Date.now()+10,updatedAt:Date.now()+10};engine.onTokenUpdate('MintA',store.state.tokens.MintA);
  const s=engine.status('u').session;assert.equal(s.reason,'STOP_LOSS');assert.equal(s.payout,72);
}

{
  const store=new Store();seed(store);
  const engine=new GameEngine(store,{startingBalance:1000,maxRoundMs:60_000,livePriceMaxAgeMs:4000});engine.start('u',{bet:100});
  const raw=store.state.gamePaper.users.u.session;raw.startedAt=Date.now()-70_000;raw.lastPriceAt=Date.now()-20_000;
  store.state.tokens.MintA.lastPriceAt=Date.now()-20_000;store.state.tokens.MintA.updatedAt=Date.now()-20_000;
  const stale=engine.status('u').session;assert.equal(stale.state,'LIVE');assert.equal(stale.timeoutPending,true);
  store.state.tokens.MintA.priceSol=1.1;store.state.tokens.MintA.lastPriceAt=Date.now();store.state.tokens.MintA.updatedAt=Date.now();engine.onTokenUpdate('MintA',store.state.tokens.MintA);
  assert.equal(engine.status('u').session.reason,'ROUND_TIMEOUT');
}

{
  const store=new Store();seed(store);
  // A generic metadata update is not a fresh market quote. If the real price timestamp is absent,
  // the selector must reject the token instead of treating updatedAt as price freshness.
  delete store.state.tokens.MintA.lastPriceAt;
  delete store.state.tokens.MintA.lastPriceChangeAt;
  store.state.tokens.MintA.updatedAt=Date.now();
  const engine=new GameEngine(store,{startingBalance:1000});
  const r=engine.start('u',{bet:50});assert.equal(r.ok,false);assert.equal(r.code,'NO_CANDIDATE');assert.equal(r.selector.stalePrice,1);
}

{
  const store=new Store();seed(store);const e1=new GameEngine(store,{startingBalance:1000});e1.start('u',{bet:50});
  const e2=new GameEngine(store,{startingBalance:1000});assert.equal(e2.activeRoundCount(),1);assert.equal(e2.status('u').session.state,'LIVE');
  store.state.tokens.MintA.lastPriceAt=Date.now();store.state.tokens.MintA.updatedAt=Date.now();const r=e2.cashout('u');assert.equal(r.ok,true);assert.equal(r.session.state,'COMPLETE');
}

console.log('PEPE GAME V4 ENGINE TESTS: PASS');
