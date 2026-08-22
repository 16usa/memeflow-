import assert from 'node:assert/strict';
import {evaluateSettingsGate,evaluateSettingsAdmission,settingsContextSignature} from '../src/settings-gate.mjs';
import {evaluate} from '../src/evaluate.mjs';

const now=Date.now();
const baseToken={
  mint:'Mint111111111111111111111111111111111111',
  launchPlatform:'pump',name:'Alpha Moon',symbol:'ALPHA',creator:'Creator111',
  discoveredAt:now-10*60_000,
  bondingCurvePct:25,marketCapUsd:25_000,totalFeesSol:1.2,volume24hUsd:50_000,
  buyTransactions:120,sellTransactions:40,totalTransactions:160,
  holderCount:120,bundlePct:3,top10Pct:18,developerPct:4,sniperPct:2,
  liquidityUsd:20_000,buyPressure:3,holderFresh:true,
  twitterUrl:'https://x.example/a',websiteUrl:'https://example.com',telegramUrl:'https://t.me/a',
  metadataFetchedAt:now,priceSol:0.00001,dataQuality:1
};
const settings={
  launchPlatforms:['pump'],includeKeywords:'alpha',excludeKeywords:'rug',
  minBondingCurvePct:10,maxBondingCurvePct:80,minMarketCapUsd:10_000,maxMarketCapUsd:100_000,
  minTotalFeesSol:0.5,maxTotalFeesSol:5,minVolume24hUsd:10_000,maxVolume24hUsd:100_000,
  minBuyTransactions:10,maxBuyTransactions:500,minSellTransactions:1,maxSellTransactions:500,
  minTotalTransactions:20,maxTotalTransactions:1000,minHolders:30,maxHolders:500,
  minBundlePct:1,maxBundlePct:10,minTokenAgeMinutes:1,maxTokenAgeMinutes:180,
  minTop10Pct:5,maxTop10Pct:25,minDeveloperPct:0,maxDeveloperPct:20,
  minSniperPct:0,maxSniperPct:10,minLiquidityUsd:12_000,minBuyPressure:1.5,
  developerBlacklistWallets:['BadCreator'],requireTwitter:true,requireWebsite:true,requireTelegram:true,
  requireAnySocial:true,requireWebsiteOrX:true,requireFreshHolderSnapshot:true,minScore:0,minConfidence:0
};

assert.equal(evaluateSettingsGate(baseToken,settings).state,'PASS');

for(const [key,value] of [
  ['marketCapUsd',150_000],['bondingCurvePct',90],['totalFeesSol',10],['volume24hUsd',5_000],
  ['buyTransactions',2],['sellTransactions',900],['holderCount',5],['bundlePct',20],
  ['top10Pct',40],['developerPct',50],['sniperPct',30],['liquidityUsd',1_000],['buyPressure',0.5]
]){
  const gate=evaluateSettingsGate({...baseToken,[key]:value},settings);
  assert.equal(gate.state,'BLOCKED',`${key} must be enforced`);
}

assert.equal(evaluateSettingsGate({...baseToken,creator:'BadCreator'},settings).state,'BLOCKED');
assert.equal(evaluateSettingsGate({...baseToken,name:'rug alpha'},settings).state,'BLOCKED');
assert.equal(evaluateSettingsGate({...baseToken,name:'beta',symbol:'BETA'},settings).state,'BLOCKED');
assert.equal(evaluateSettingsGate({...baseToken,twitterUrl:null},settings).state,'BLOCKED');

// Missing data remains WAITING, but a known failure must outrank it.
const mixed={...baseToken,holderCount:null,holderFresh:false,buyPressure:0.5};
assert.equal(evaluate(mixed,{...settings,minHolders:30,minBuyPressure:1.5}).state,'BLOCKED');

// Fresh-holder false before a completed snapshot is incomplete data, not a terminal fail.
const waiting=evaluateSettingsGate({...baseToken,holderFresh:false,holderCount:null},{requireFreshHolderSnapshot:true,minHolders:30});
assert.equal(waiting.state,'WAITING');

// Score remains independent from policy thresholds.
const a=evaluate(baseToken,{...settings,minScore:0,minConfidence:0});
const b=evaluate(baseToken,{...settings,minScore:100,minConfidence:100});
assert.equal(a.score,b.score);
assert.equal(a.confidence,b.confidence);


const entries=[
  {uid:'u1',version:2,settings:{launchPlatforms:['pump'],maxTop10Pct:10}},
  {uid:'u2',version:9,settings:{launchPlatforms:['pump'],maxTop10Pct:12}}
];
const rejected=evaluateSettingsAdmission({...baseToken,top10Pct:40},entries,{now,recheckMs:5000});
assert.equal(rejected.allow,false);
assert.equal(rejected.retryable,true);
assert.equal(rejected.recheckAt,now+5000);
assert.equal(rejected.signature,settingsContextSignature(entries));
const admitted=evaluateSettingsAdmission({...baseToken,top10Pct:11},entries,{now,recheckMs:5000});
assert.equal(admitted.allow,true); // u2 still accepts it

const stableAndDynamic=evaluateSettingsAdmission(
  {...baseToken,launchPlatform:'other',top10Pct:40},
  [{uid:'u1',version:1,settings:{launchPlatforms:['pump'],maxTop10Pct:10}}],
  {now,recheckMs:5000}
);
assert.equal(stableAndDynamic.allow,false);
assert.equal(stableAndDynamic.retryable,false); // stable platform mismatch already makes rescans useless

const mixedUsers=evaluateSettingsAdmission(
  {...baseToken,top10Pct:40},
  [
    {uid:'u1',version:1,settings:{launchPlatforms:['other']}},
    {uid:'u2',version:1,settings:{launchPlatforms:['pump'],maxTop10Pct:10}}
  ],
  {now,recheckMs:5000}
);
assert.equal(mixedUsers.allow,false);
assert.equal(mixedUsers.retryable,true); // u2 can still recover as concentration changes

console.log('settings gate ok');
