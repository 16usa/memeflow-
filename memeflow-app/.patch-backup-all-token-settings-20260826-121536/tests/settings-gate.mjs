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
  metadataFetchedAt:now,priceSol:0.00001,dataQuality:1,
  qualityScore:95,opportunityScore:80,opportunityEvidenceReady:true,opportunityTrendHealthy:true,opportunityEventCount:12
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
assert.equal(evaluate(mixed,{...settings,minHolders:30,minBuyPressure:1.5}).state,'WAITING');

// Fresh-holder false before a completed snapshot is incomplete data, not a terminal fail.
const waiting=evaluateSettingsGate({...baseToken,holderFresh:false,holderCount:null},{requireFreshHolderSnapshot:true,minHolders:30});
assert.equal(waiting.state,'WAITING');

// Score remains independent from policy thresholds.
const a=evaluate(baseToken,{...settings,minScore:0,minConfidence:0});
const b=evaluate(baseToken,{...settings,minScore:100,minConfidence:100});
assert.equal(a.score,b.score);
assert.equal(a.confidence,b.confidence);

// Regression: stale dataQuality must not pin a fully enriched live token at 0%.
const staleQuality=evaluate(
  {...baseToken,dataQuality:0},
  {...settings,minScore:0,minConfidence:70}
);
assert.equal(staleQuality.confidence,100);
assert.equal(staleQuality.state,'BUY READY');
assert.equal(staleQuality.reasons.some(x=>String(x).includes('confidence 0%')),false);

// Null/missing fields must not be treated as numeric zero and inflate score/confidence.
const missingEvidence=evaluate(
  {priceSol:null,holderFresh:false,dataQuality:0},
  {minScore:0,minConfidence:70,requireFreshHolderSnapshot:true}
);
assert.equal(missingEvidence.score,0);
assert.equal(missingEvidence.confidence,0);
assert.equal(missingEvidence.state,'WAITING');

// WS recovery: holder evidence can arrive first; missing market evidence keeps WAITING.
const holderPhase=evaluate(
  {...baseToken,buyPressure:null,priceSol:null,dataQuality:0},
  {...settings,minScore:0,minConfidence:70,minBuyPressure:1.5}
);
assert.equal(holderPhase.confidence,70);
assert.equal(holderPhase.state,'WAITING');

// Once the WS market event fills price + pressure, the same token becomes BUY READY.
const marketPhase=evaluate(
  {...baseToken,buyPressure:2,priceSol:0.00001,dataQuality:0},
  {...settings,minScore:0,minConfidence:70,minBuyPressure:1.5}
);
assert.equal(marketPhase.confidence,100);
assert.equal(marketPhase.state,'BUY READY');

// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
// Missing linked-wallet RPC evidence does NOT delay BUY READY.
// Known evidence can still hard-block execution.
const walletRiskSettings={
  ...settings,
  minScore:72,
  minConfidence:70,
  maxSuspectedRiskyWalletsPct:35,
  maxInsidersPct:25
};

const buyCandidateWithRiskPending=evaluate(
  {
    ...baseToken,
    suspectedRiskyWalletsPct:null,
    insidersPct:null
  },
  walletRiskSettings
);

assert.equal(
  buyCandidateWithRiskPending.score>=72,
  true
);

assert.equal(
  buyCandidateWithRiskPending.walletRiskPending,
  true
);

assert.equal(
  buyCandidateWithRiskPending.state,
  'BUY READY'
);

const buyCandidateRiskPassed=evaluate(
  {
    ...baseToken,
    suspectedRiskyWalletsPct:0,
    insidersPct:0
  },
  walletRiskSettings
);

assert.equal(
  buyCandidateRiskPassed.walletRiskPending,
  false
);

assert.equal(
  buyCandidateRiskPassed.walletRiskPenalty,
  0
);

assert.equal(
  buyCandidateRiskPassed.state,
  'BUY READY'
);

const walletClusterBlocked=evaluate(
  {
    ...baseToken,
    suspectedRiskyWalletsPct:40,
    insidersPct:0
  },
  walletRiskSettings
);

assert.equal(
  walletClusterBlocked.state,
  'BLOCKED'
);

// Risk/policy failures still outrank recovered confidence.
const riskBlocked=evaluate(
  {...baseToken,top10Pct:40,dataQuality:0},
  {...settings,minScore:0,minConfidence:70,maxTop10Pct:25}
);
assert.equal(riskBlocked.confidence,100);
assert.equal(riskBlocked.state,'WATCH'); // dynamic concentration fail prevents BUY but may recover

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
