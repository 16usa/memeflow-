import assert from 'node:assert/strict';
import {createOpportunityEngine} from '../src/opportunity-engine.mjs';
import {evaluateSettingsGate} from '../src/settings-gate.mjs';
import {evaluate} from '../src/evaluate.mjs';

const engine=createOpportunityEngine();
const totalRaw=1_000_000_000_000_000n;
const creator='Creator1111111111111111111111111111111111';
let snap=null;

for(let i=0;i<8;i++){
  snap=engine.update({
    mint:'MintGrowing',user:`Buyer${i}`,isBuy:true,
    solAmount:BigInt(300_000_000+i*10_000_000),
    tokenAmount:10_000_000_000_000n,
    timestamp:1_700_000_000n+BigInt(i),slot:100+i,
    realTokenReserves:700_000_000_000_000n-BigInt(i)*10_000_000_000_000n,
    fee:1_000_000n,creatorFee:500_000n
  },{
    creator,
    priceSol:1e-6*(1+i*.06),
    liquiditySol:30,
    holderCount:30+i,
    top10Pct:18,
    developerPct:4,
    holderFresh:true,
    totalSupplyRaw:totalRaw,totalSupply:1_000_000_000,
    initialRealTokenReservesRaw:700_000_000_000_000n,
    launchSlot:100,launchSignature:'create',
    solUsd:150
  });
}

assert.equal(snap.opportunityEvidenceReady,true);
assert.equal(snap.opportunityTrendHealthy,true);
assert.ok(snap.opportunityScore>=60);
assert.ok(snap.qualityScore>=70);
assert.equal(snap.buyTransactions,8);
assert.equal(snap.sellTransactions,0);
assert.equal(snap.totalTransactions,8);
assert.ok(snap.totalFeesSol>0);
assert.ok(snap.volume24hUsd>0);
assert.ok(snap.marketCapUsd>0);
assert.ok(snap.liquidityUsd>0);
assert.ok(snap.bondingCurvePct>0);
assert.ok(snap.bundlePct>=0);
assert.ok(snap.sniperPct>=0);

const liveToken={
  mint:'MintGrowing',launchPlatform:'pump',name:'Alpha',symbol:'ALPHA',
  creator,discoveredAt:Date.now()-20_000,
  priceSol:1.42e-6,totalSupply:1_000_000_000,
  holderFresh:true,holderCount:37,top10Pct:18,developerPct:4,
  twitterUrl:'https://x.example/alpha',websiteUrl:'https://alpha.example',
  telegramUrl:'https://t.me/alpha',
  ...snap
};

const allSettings={
  launchPlatforms:['pump'],includeKeywords:'alpha',excludeKeywords:'rug',
  minBondingCurvePct:1,maxBondingCurvePct:80,
  minMarketCapUsd:1,maxMarketCapUsd:1_000_000,
  minTotalFeesSol:0.001,maxTotalFeesSol:10,
  minVolume24hUsd:1,maxVolume24hUsd:1_000_000,
  minBuyTransactions:1,maxBuyTransactions:100,
  minSellTransactions:null,maxSellTransactions:100,
  minTotalTransactions:1,maxTotalTransactions:100,
  minHolders:10,maxHolders:500,
  minBundlePct:0,maxBundlePct:50,
  minTokenAgeMinutes:0,maxTokenAgeMinutes:180,
  minTop10Pct:0,maxTop10Pct:25,
  minDeveloperPct:0,maxDeveloperPct:20,
  minSniperPct:0,maxSniperPct:50,
  minLiquidityUsd:1,minBuyPressure:1.2,
  developerBlacklistWallets:['BadCreator'],
  requireTwitter:true,requireWebsite:true,requireTelegram:true,
  requireAnySocial:true,requireWebsiteOrX:true,requireFreshHolderSnapshot:true,
  minScore:65,minConfidence:70,
  maxSuspectedRiskyWalletsPct:35,maxInsidersPct:25
};

const gate=evaluateSettingsGate(liveToken,allSettings);
assert.equal(gate.state,'PASS');
assert.equal(gate.waitingGates.length,0);

const decision=evaluate(liveToken,allSettings);
assert.equal(decision.state,'BUY READY');
assert.ok(decision.qualityScore>=70);
assert.ok(decision.opportunityScore>=60);

// Whale-driven flow should score materially lower than distributed demand.
const whale=createOpportunityEngine();
let whaleSnap=null;
for(let i=0;i<8;i++){
  whaleSnap=whale.update({
    mint:'Whale',user:i<6?'SameWhale':`Other${i}`,isBuy:true,
    solAmount:i<6?1_000_000_000n:50_000_000n,
    tokenAmount:10_000_000_000_000n,timestamp:1_700_100_000n+BigInt(i),slot:200+i,
    realTokenReserves:650_000_000_000_000n
  },{
    creator:'Creator2',priceSol:1e-6*(1+i*.03),liquiditySol:20,
    holderCount:30+i,top10Pct:20,developerPct:5,holderFresh:true,
    totalSupplyRaw:totalRaw,totalSupply:1_000_000_000,
    initialRealTokenReservesRaw:700_000_000_000_000n,launchSlot:200,solUsd:150
  });
}
assert.ok(whaleSnap.whaleDominancePct>80);
assert.ok(whaleSnap.opportunityScore<snap.opportunityScore);

// Strong sell-off must become dead and be removable immediately.
const dead=createOpportunityEngine();
let deadSnap=null;
for(let i=0;i<6;i++){
  deadSnap=dead.update({
    mint:'Dead',user:`B${i}`,isBuy:true,solAmount:300_000_000n,
    tokenAmount:10_000_000_000_000n,timestamp:1_700_200_000n+BigInt(i),
    slot:300+i,realTokenReserves:650_000_000_000_000n
  },{
    creator:'Creator3',priceSol:1e-6*(1+i*.1),liquiditySol:20,
    holderCount:20+i,top10Pct:20,developerPct:5,holderFresh:true,
    totalSupplyRaw:totalRaw,totalSupply:1_000_000_000,
    initialRealTokenReservesRaw:700_000_000_000_000n,launchSlot:300,solUsd:150
  });
}
for(let i=0;i<8;i++){
  deadSnap=dead.update({
    mint:'Dead',user:`B${i%6}`,isBuy:false,solAmount:300_000_000n,
    tokenAmount:8_000_000_000_000n,timestamp:1_700_200_010n+BigInt(i),
    slot:320+i,realTokenReserves:690_000_000_000_000n
  },{
    creator:'Creator3',priceSol:1.5e-6*(1-i*.1),liquiditySol:10,
    holderCount:20-i,top10Pct:25,developerPct:5,holderFresh:true,
    totalSupplyRaw:totalRaw,totalSupply:1_000_000_000,
    initialRealTokenReservesRaw:700_000_000_000_000n,launchSlot:300,solUsd:150
  });
}
assert.equal(deadSnap.dead,true);
assert.ok(deadSnap.deadReason);
assert.equal(evaluate({...liveToken,...deadSnap},{...allSettings,minScore:0,minConfidence:0}).state,'BLOCKED');

console.log('opportunity engine v1 ok');
