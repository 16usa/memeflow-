import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const evaluatePath=path.join(appDir,'src','evaluate.mjs');
const serverPath=path.join(appDir,'app-server.mjs');

const {evaluate}=await import(pathToFileURL(evaluatePath).href+'?v='+Date.now());
const now=Date.now();

const token={
  mint:'TESTPUMP',
  name:'TEST',
  symbol:'TEST',
  launchPlatform:'pump',
  protocol:'pump',
  source:'Solana bonding curve',
  discoveredAt:now-120000,
  updatedAt:now,
  lastPriceAt:now,
  lastPriceChangeAt:now,
  lastMarketActivityAt:now,
  priceSol:0.000001,
  peakPriceSol:0.00000102,
  liquiditySol:20,
  liquidityUsd:null,
  marketCapUsd:20000,
  holderCount:60,
  holderFresh:true,
  top10Pct:20,
  developerPct:2,
  buyPressure:1.6,
  dataQuality:1,
  antiRugHistory:[
    {at:now-30000,priceSol:0.000001,liquiditySol:20,holderCount:55,top10Pct:20,developerPct:2,buyPressure:1.6},
    {at:now-5000,priceSol:0.000001,liquiditySol:20,holderCount:60,top10Pct:20,developerPct:2,buyPressure:1.6}
  ]
};

const base={
  minScore:72,minConfidence:70,
  minLiquidityUsd:0,minBuyPressure:1.2,
  minHolders:50,maxHolders:null,
  minMarketCapUsd:10000,maxMarketCapUsd:null,
  minBondingCurvePct:null,maxBondingCurvePct:null,
  minTotalFeesSol:null,maxTotalFeesSol:null,
  minVolume24hUsd:null,maxVolume24hUsd:null,
  minBuyTransactions:null,maxBuyTransactions:null,
  minSellTransactions:null,maxSellTransactions:null,
  minTotalTransactions:null,maxTotalTransactions:null,
  minBundlePct:null,maxBundlePct:null,
  minTokenAgeMinutes:0,maxTokenAgeMinutes:1000,
  minTop10Pct:null,maxTop10Pct:25,
  minDeveloperPct:null,maxDeveloperPct:20,
  minSniperPct:null,maxSniperPct:null,
  developerBlacklistWallets:[],
  requireTwitter:false,requireWebsite:false,requireTelegram:false,requireAnySocial:false,
  requireFreshHolderSnapshot:true,
  launchPlatforms:['pump'],
  includeKeywords:'',excludeKeywords:''
};

let d=evaluate(token,base);
assert(!d.reasons.some(x=>/Liquidity USD data pending/i.test(x)),JSON.stringify(d));
console.log('PASS: minLiquidityUsd=0 disables the filter; missing USD liquidity does not cause WAITING');

d=evaluate(token,{...base,minLiquidityUsd:1000});
assert(d.reasons.some(x=>/Liquidity USD data pending/i.test(x)),JSON.stringify(d));
console.log('PASS: positive minLiquidityUsd enables the filter and waits for missing data');

d=evaluate({...token,holderCount:1},{...base,minHolders:50});
assert.equal(d.state,'BLOCKED');
assert(d.reasons.some(x=>/Holders 1 below minimum 50/i.test(x)));
console.log('PASS: real positive minHolders still blocks');

d=evaluate({...token,holderCount:1},{...base,minHolders:0});
assert(!d.reasons.some(x=>/Holders .* below minimum 0/i.test(x)));
console.log('PASS: minHolders=0 disables optional holder threshold');

d=evaluate({...token,launchPlatform:'pump',protocol:'pump',source:'Solana RPC'},base);
assert(!d.reasons.some(x=>/Launch platform data pending/i.test(x)));
console.log('PASS: pump launch identity survives a descriptive Solana RPC/source label');

const st=fs.readFileSync(serverPath,'utf8');
assert(st.includes("launchPlatform:'pump',protocol:'pump'"));
assert(st.includes("launchPlatform:t.launchPlatform||'pump'"));
assert(st.includes("settingsVersion,reevaluatedAt:Date.now()"));
assert(st.includes("'/api/debug/filter-pipeline'"));
console.log('PASS: discovery tagging, price-update preservation and forced settings re-evaluation are installed');

for(const f of [evaluatePath,serverPath]){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||r.stdout);
}
console.log('PASS: syntax checks');

console.log('');
console.log('ALL V9 SELF-TESTS PASSED');
