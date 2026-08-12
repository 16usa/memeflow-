import assert from 'node:assert/strict';
import {GameEngine} from './game-engine.mjs';

class Store {
  constructor(){this.state={tokens:{},gamePaper:{users:{}}};this._dec={};this.saves=0;}
  save(){this.saves++;}
  decisions(uid){return this._dec[uid]||[];}
}
const uid='u1';
const store=new Store();
const now=Date.now();
store.state.tokens.A={mint:'A',name:'Alpha',symbol:'A',priceSol:1,lastPriceAt:now,holderCount:100,top10Pct:12,buyPressure:2,liquiditySol:40};
store.state.tokens.B={mint:'B',name:'Beta',symbol:'B',priceSol:2,lastPriceAt:now-90_000,holderCount:200,top10Pct:10,buyPressure:3,liquiditySol:60};
store._dec[uid]=[
  {mint:'B',state:'BUY READY',score:99,updatedAt:now},
  {mint:'A',state:'BUY READY',score:90,updatedAt:now}
];
const game=new GameEngine(store,{startingBalance:1000,startPriceMaxAgeMs:15000,decisionMaxAgeMs:45000,livePriceMaxAgeMs:20000,cashoutPriceMaxAgeMs:30000,maxRoundMs:600000});

// Stale higher-score token must lose to fresh eligible token.
let pick=game.pickCandidate(uid);
assert.equal(pick.mint,'A');
assert.equal(game.lastSelectorByUser.get(uid).stalePrice,1);

// Start fresh round.
let r=game.start(uid,{bet:100,autoCashout:1.5,stopLoss:.75,requestId:'req-1'});
assert.equal(r.ok,true); assert.equal(r.session.state,'LIVE'); assert.equal(r.session.mint,'A'); assert.equal(r.balance,900);

// Duplicate request resumes instead of charging twice.
let dup=game.start(uid,{bet:100,autoCashout:1.5,stopLoss:.75,requestId:'req-1'});
assert.equal(dup.ok,true); assert.equal(dup.balance,900);

// Auto cashout settles exactly at configured trigger even on jump.
store.state.tokens.A.priceSol=1.8; store.state.tokens.A.lastPriceAt=Date.now();
game.onTokenUpdate('A',store.state.tokens.A);
let s=game.status(uid);
assert.equal(s.session.state,'COMPLETE'); assert.equal(s.session.multiplier,1.5); assert.equal(s.session.payout,150); assert.equal(s.balance,1050);

// Reset and stop loss.
game.reset(uid);
store._dec[uid]=[{mint:'A',state:'BUY READY',score:90,updatedAt:Date.now()}];
store.state.tokens.A.priceSol=1;store.state.tokens.A.lastPriceAt=Date.now();
r=game.start(uid,{bet:100,autoCashout:0,stopLoss:.8,requestId:'req-2'});assert.equal(r.ok,true);
store.state.tokens.A.priceSol=.76;store.state.tokens.A.lastPriceAt=Date.now();game.onTokenUpdate('A',store.state.tokens.A);s=game.status(uid);assert.equal(s.session.reason,'STOP_LOSS');assert.equal(s.session.state,'COMPLETE');assert.equal(s.session.payout,76);

// Stale price prevents manual paper cashout instead of pretending quote freshness.
game.reset(uid);store.state.tokens.A.priceSol=1;store.state.tokens.A.lastPriceAt=Date.now();store._dec[uid]=[{mint:'A',state:'BUY READY',score:90,updatedAt:Date.now()}];r=game.start(uid,{bet:50,requestId:'req-3'});assert.equal(r.ok,true);store.state.tokens.A.lastPriceAt=Date.now()-60_000;const stale=game.cashout(uid);assert.equal(stale.ok,false);assert.equal(stale.code,'PRICE_STALE');assert.equal(stale.status.session.state,'LIVE');

// Fresh quote unlocks cashout.
store.state.tokens.A.priceSol=1.1;store.state.tokens.A.lastPriceAt=Date.now();const fresh=game.cashout(uid);assert.equal(fresh.ok,true);assert.equal(fresh.session.state,'COMPLETE');

// Corrupted negative persisted balance is clamped to 0, never refilled to starting balance.
store.state.gamePaper.users.bad={balance:-500,session:null,history:[]};const bad=game.ensureUser('bad');assert.equal(bad.balance,0);

console.log('PEPE GAME V3 ENGINE TESTS: PASS');
