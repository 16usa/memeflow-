import assert from 'node:assert/strict';
import {GameEngine} from './game-engine.mjs';

class FakeStore {
  constructor(){
    this.state={users:{u:{id:'u',killSwitch:false}},tokens:{},gamePaper:{version:'x',users:{}}};
    this.rows=[];this.saves=0;
  }
  save(){this.saves++;}
  decisions(uid){return uid==='u'?this.rows:[];}
}

const mint='11111111111111111111111111111111';
const freshToken=(price=1,extra={})=>({mint,name:'Pepe Test',symbol:'PEPE',priceSol:price,lastPriceAt:Date.now(),holderFresh:true,holderScannedAt:Date.now(),holderCount:120,top10Pct:18,developerPct:1,buyPressure:2.2,liquiditySol:52,...extra});
const freshDecision=(extra={})=>({mint,state:'BUY READY',score:91,confidence:0.91,updatedAt:Date.now(),primaryReason:'Passed test gates',...extra});

function make(options={}){
  const store=new FakeStore();
  store.state.tokens[mint]=freshToken();store.rows=[freshDecision()];
  const engine=new GameEngine(store,{startingBalance:1000,startPriceMaxAgeMs:12000,decisionMaxAgeMs:45000,holderMaxAgeMs:90000,decisionCoherenceToleranceMs:4000,livePriceMaxAgeMs:15000,cashoutPriceMaxAgeMs:20000,marketLossAbortMs:30000,sweepIntervalMs:10000,...options});
  return {store,engine};
}

{
  const {store,engine}=make();
  const s=engine.start('u',{bet:100,autoCashout:1.5,stopLoss:.75,requestId:'r1'});
  assert.equal(s.ok,true);assert.equal(s.session.state,'LIVE');assert.equal(s.balance,900);assert.equal(s.session.multiplier,1);assert.equal(engine.activeRoundCount(),1);
  const rev=s.stateRevision;
  const duplicate=engine.status('u');
  assert.equal(duplicate.stateRevision,rev,'same cached token snapshot must not churn revision');
  engine.destroy();
}

{
  const {store,engine}=make();
  engine.start('u',{bet:100,autoCashout:1.5,stopLoss:.75,requestId:'r2'});
  store.state.tokens[mint]={...store.state.tokens[mint],priceSol:1.52,lastPriceAt:Date.now()+1};
  engine.onTokenUpdate(mint,store.state.tokens[mint]);
  const st=engine.status('u',{sync:false});
  assert.equal(st.session.state,'COMPLETE');assert.equal(st.session.reason,'AUTO_CASH_OUT');assert.equal(st.balance,1052);assert.equal(st.stats.wins,1);
  const again=engine.cashout('u');assert.equal(again.ok,true);assert.equal(again.idempotent,true,'cashout must be idempotent after completion');
  engine.destroy();
}

{
  const {store,engine}=make();
  engine.start('u',{bet:100,autoCashout:0,stopLoss:.80,requestId:'r3'});
  store.state.tokens[mint]={...store.state.tokens[mint],priceSol:.72,lastPriceAt:Date.now()+1};
  engine.onTokenUpdate(mint,store.state.tokens[mint]);
  const st=engine.status('u',{sync:false});assert.equal(st.session.reason,'STOP_LOSS');assert.equal(st.session.state,'COMPLETE');assert.ok(st.session.profit<0);assert.equal(st.stats.losses,1);
  engine.destroy();
}

{
  const {store,engine}=make();
  const stale=freshToken(1,{lastPriceAt:Date.now()-60000});store.state.tokens[mint]=stale;
  const result=engine.start('u',{bet:100,requestId:'stale'});assert.equal(result.ok,false);assert.equal(result.code,'NO_CANDIDATE');assert.equal(result.selector.stalePrice,1);
  engine.destroy();
}

{
  const {store,engine}=make();
  store.state.tokens[mint]=freshToken(1,{lastPriceAt:Date.now()+60000});
  const result=engine.start('u',{bet:100,requestId:'future'});assert.equal(result.ok,false);assert.equal(result.selector.futurePrice,1);
  engine.destroy();
}

{
  const {store,engine}=make();
  store.rows=[freshDecision({updatedAt:Date.now()+60000})];
  const result=engine.start('u',{bet:100,requestId:'future-d'});assert.equal(result.ok,false);assert.equal(result.selector.futureDecision,1);
  engine.destroy();
}

{
  const {store,engine}=make();
  store.state.tokens[mint]=freshToken(1,{holderFresh:false});
  const result=engine.start('u',{bet:100,requestId:'holder'});assert.equal(result.ok,false);assert.equal(result.selector.staleHolders,1);
  engine.destroy();
}


{
  const {store,engine}=make();
  store.state.tokens[mint]=freshToken(1,{holderScannedAt:Date.now()-120000});
  const result=engine.start('u',{bet:100,requestId:'holder-age'});assert.equal(result.ok,false);assert.equal(result.selector.staleHolderAge,1);
  engine.destroy();
}

{
  const {store,engine}=make();
  store.state.tokens[mint]=freshToken(1,{holderScannedAt:Date.now()+60000});
  const result=engine.start('u',{bet:100,requestId:'future-holder'});assert.equal(result.ok,false);assert.equal(result.selector.futureHolder,1);
  engine.destroy();
}

{
  const {store,engine}=make({decisionCoherenceToleranceMs:1000});
  const base=Date.now();
  store.state.tokens[mint]=freshToken(1,{lastPriceAt:base,holderScannedAt:base-100});
  store.rows=[freshDecision({updatedAt:base-5000})];
  const result=engine.start('u',{bet:100,requestId:'decision-behind-price'});assert.equal(result.ok,false);assert.equal(result.selector.decisionBehindPrice,1);
  engine.destroy();
}

{
  const {store,engine}=make({decisionCoherenceToleranceMs:1000});
  const base=Date.now();
  store.state.tokens[mint]=freshToken(1,{lastPriceAt:base-6000,holderScannedAt:base});
  store.rows=[freshDecision({updatedAt:base-5000})];
  const result=engine.start('u',{bet:100,requestId:'decision-behind-holder'});assert.equal(result.ok,false);assert.equal(result.selector.decisionBehindHolder,1);
  engine.destroy();
}

{
  const {store,engine}=make();store.state.users.u.killSwitch=true;
  const result=engine.start('u',{bet:100,requestId:'kill'});assert.equal(result.ok,false);assert.equal(result.code,'KILL_SWITCH');engine.destroy();
}

{
  const {store,engine}=make({marketLossAbortMs:30000});
  engine.start('u',{bet:100,requestId:'dead'});
  const session=store.state.gamePaper.users.u.session;
  session.lastPriceAt=Date.now()-31000;
  store.state.tokens[mint]={...store.state.tokens[mint],lastPriceAt:session.lastPriceAt};
  engine.sweep();
  const st=engine.status('u',{sync:false});assert.equal(st.session.state,'COMPLETE');assert.equal(st.session.voided,true);assert.equal(st.session.reason,'MARKET_DATA_LOST_REFUND');assert.equal(st.session.payout,100);assert.equal(st.session.profit,0);assert.equal(st.balance,1000);assert.equal(st.stats.voidedRounds,1);
  engine.destroy();
}

{
  const {store,engine}=make();
  engine.start('u',{bet:100,requestId:'restart'});engine.destroy();
  const engine2=new GameEngine(store,{startingBalance:1000,sweepIntervalMs:10000,marketLossAbortMs:30000});
  assert.equal(engine2.activeRoundCount(),1,'restart must rebuild active index');assert.equal(engine2.status('u',{sync:false}).session.state,'LIVE');engine2.destroy();
}

{
  const {store,engine}=make();
  engine.start('u',{bet:100,requestId:'stale-cash'});
  const s=store.state.gamePaper.users.u.session;s.lastPriceAt=Date.now()-25000;store.state.tokens[mint]={...store.state.tokens[mint],lastPriceAt:s.lastPriceAt};
  const result=engine.cashout('u');assert.equal(result.ok,false);assert.equal(result.code,'PRICE_STALE');assert.equal(engine.status('u',{sync:false}).session.state,'LIVE');engine.destroy();
}

{
  const {store,engine}=make();
  let events=[];const unsub=engine.subscribe('u',x=>events.push(x));
  engine.start('u',{bet:100,requestId:'events'});
  store.state.tokens[mint]={...store.state.tokens[mint],priceSol:1.1,lastPriceAt:Date.now()+1};engine.onTokenUpdate(mint,store.state.tokens[mint]);
  assert.ok(events.length>=2);assert.ok(events.every(x=>x.engineEpoch===engine.epoch));assert.ok(events.map(x=>x.eventSeq).every((x,i,a)=>i===0||x>a[i-1]));unsub();engine.destroy();
}

console.log('PEPE GAME V5.1 ENGINE TESTS: PASS');
