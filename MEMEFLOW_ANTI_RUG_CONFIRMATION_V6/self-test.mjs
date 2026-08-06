import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const evalPath=path.join(appDir,'src','evaluate.mjs');
const storePath=path.join(appDir,'src','store.mjs');

const evalText=fs.readFileSync(evalPath,'utf8');
const storeText=fs.readFileSync(storePath,'utf8');

assert(evalText.includes('function antiRugConfirmation('));
assert(evalText.includes('strong?45:(warningCount>=2?180:90)'));
assert(evalText.includes('liquidity fell'));
assert(evalText.includes('holder count fell'));
assert(evalText.includes('Top-10 concentration increased'));
assert(storeText.includes('antiRugHistory:antiRugHistory'));
console.log('PASS: staged 45/90/180 sec anti-rug confirmation installed');
console.log('PASS: price/liquidity/holder/concentration deterioration gates installed');
console.log('PASS: rolling token risk snapshots installed');

const {evaluate}=await import(pathToFileURL(evalPath).href);
const now=Date.now();
const baseSettings={
  minScore:72,minConfidence:70,minHolders:30,maxTop10Pct:25,maxDeveloperPct:20,
  minBuyPressure:1.2,requireFreshHolderSnapshot:true,maxTokenAgeMinutes:180
};
function token(ageSec,overrides={}){
  const discoveredAt=now-ageSec*1000;
  return {
    mint:'T',discoveredAt,priceSol:1,peakPriceSol:1.05,
    holderCount:40,holderFresh:true,top10Pct:20,developerPct:2,
    liquiditySol:10,buyPressure:1.7,dataQuality:1,
    antiRugHistory:[
      {at:now-20000,priceSol:.98,liquiditySol:9.8,holderCount:35,top10Pct:20,developerPct:2,buyPressure:1.6},
      {at:now-5000,priceSol:1,liquiditySol:10,holderCount:40,top10Pct:20,developerPct:2,buyPressure:1.7}
    ],
    ...overrides
  };
}

let d=evaluate(token(30),baseSettings);
assert.equal(d.state,'WAITING');
console.log('PASS: 30-second token cannot become BUY READY');

d=evaluate(token(60),baseSettings);
assert.equal(d.state,'BUY READY');
assert.equal(d.antiRug.strong,true);
console.log('PASS: strong stable token may clear after 45 seconds');

d=evaluate(token(60,{peakPriceSol:1.6,priceSol:1,buyPressure:1.0}),baseSettings);
assert.equal(d.state,'BLOCKED');
console.log('PASS: sharp early dump is blocked immediately');

d=evaluate(token(120,{
  antiRugHistory:[
    {at:now-30000,priceSol:1,liquiditySol:10,holderCount:40,top10Pct:12,developerPct:2,buyPressure:1.4},
    {at:now-5000,priceSol:.9,liquiditySol:8.2,holderCount:36,top10Pct:18,developerPct:2,buyPressure:1.25}
  ],
  priceSol:.9,peakPriceSol:1.1,holderCount:36,top10Pct:18,liquiditySol:8.2,buyPressure:1.25
}),baseSettings);
assert.equal(d.state,'WAITING');
assert(d.antiRug.requiredAgeSec>=180);
console.log('PASS: suspicious launch is held until 180 seconds');

console.log('');
console.log('ALL V6 SELF-TESTS PASSED');