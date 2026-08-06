
import assert from 'node:assert/strict';
import {evaluate,__lifecycleForTest} from './memeflow-app/src/evaluate.mjs';

const now=Date.now();
const settings={maxTokenAgeMinutes:180,minScore:0,minConfidence:0};

let r=evaluate({
  discoveredAt:now-181*60_000,
  updatedAt:now,
  priceSol:1,
  peakPriceSol:1,
  dataQuality:1
},settings);
assert.equal(r.state,'EXPIRED');
assert.equal(r.terminal,true);

r=evaluate({
  discoveredAt:now-5*60_000,
  updatedAt:now,
  lastPriceAt:now,
  lastPriceChangeAt:now-120_000,
  lastMarketActivityAt:now-120_000,
  priceSol:0.5,
  peakPriceSol:1,
  buyPressure:0.8,
  dataQuality:1
},settings);
assert.equal(r.state,'BLOCKED');
assert.match(r.primaryReason,/Momentum lost/);

r=evaluate({
  discoveredAt:now-2*60_000,
  updatedAt:now,
  lastPriceAt:now,
  lastPriceChangeAt:now,
  lastMarketActivityAt:now,
  priceSol:1,
  peakPriceSol:1,
  buyPressure:2,
  dataQuality:1,
  holderCount:40,
  top10Pct:20,
  developerPct:0,
  holderFresh:true
},{...settings,minHolders:30,maxTop10Pct:25,minBuyPressure:1.2});
assert.notEqual(r.state,'EXPIRED');
assert.equal(r.terminal,false);

console.log('PASS: old candidates expire.');
console.log('PASS: collapsed weak-momentum candidates block.');
console.log('PASS: fresh active candidates remain eligible.');
