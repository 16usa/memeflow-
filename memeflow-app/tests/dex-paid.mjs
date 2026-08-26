import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  isConfirmedDexPaidOrder,
  summarizeDexPaidOrders,
  createDexPaidVerifier
} from '../src/dex-paid.mjs';

import {
  ENTRY_ADMISSION_KEYS,
  LOGIC_DECISION_KEYS,
  PREOPEN_RPC_KEYS,
  evaluateEntryAdmission
} from '../src/settings-gate.mjs';

import {
  defaultSettings,
  normalizeSettings
} from '../src/settings.mjs';

assert.equal(
  isConfirmedDexPaidOrder({
    status:'approved',
    paymentTimestamp:123
  }),
  true
);

assert.equal(
  isConfirmedDexPaidOrder({
    status:'processing',
    paymentTimestamp:123
  }),
  true
);

assert.equal(
  isConfirmedDexPaidOrder({
    status:'on-hold',
    paymentTimestamp:123
  }),
  true
);

assert.equal(
  isConfirmedDexPaidOrder({
    status:'cancelled',
    paymentTimestamp:123
  }),
  false
);

assert.equal(
  isConfirmedDexPaidOrder({
    status:'rejected',
    paymentTimestamp:123
  }),
  false
);

assert.equal(
  isConfirmedDexPaidOrder({
    status:'approved',
    paymentTimestamp:null
  }),
  false
);

const summary=summarizeDexPaidOrders([
  {type:'tokenProfile',status:'rejected',paymentTimestamp:10},
  {type:'tokenAd',status:'approved',paymentTimestamp:20}
]);

assert.equal(summary.confirmed,true);
assert.equal(summary.confirmedCount,1);
assert.equal(summary.orderType,'tokenAd');
assert.equal(summary.paymentTimestamp,20);

let fetchCount=0;
const verifier=createDexPaidVerifier({
  minIntervalMs:1,
  positiveTtlMs:60_000,
  fetchImpl:async()=>({
    ok:true,
    status:200,
    async json(){
      fetchCount++;
      return [
        {
          type:'tokenProfile',
          status:'approved',
          paymentTimestamp:999
        }
      ];
    }
  })
});

const first=await verifier.check('MintPaid111');
const second=await verifier.check('MintPaid111');
assert.equal(first.confirmed,true);
assert.equal(second.confirmed,true);
assert.equal(fetchCount,1,'positive DEX Paid result must be cached');

assert.equal(ENTRY_ADMISSION_KEYS.includes('requireDexPaid'),true);
assert.equal(LOGIC_DECISION_KEYS.includes('requireDexPaid'),false);
assert.equal(PREOPEN_RPC_KEYS.includes('requireDexPaid'),false);

const base={
  ...defaultSettings(),
  requireDexPaid:false,
  minLiquidityUsd:0,
  minHolders:null,
  maxHolders:null,
  minTokenAgeMinutes:null,
  maxTokenAgeMinutes:null,
  minMarketCapUsd:null,
  maxMarketCapUsd:null,
  minBondingCurvePct:null,
  maxBondingCurvePct:null,
  minTotalFeesSol:null,
  maxTotalFeesSol:null,
  minVolume24hUsd:null,
  maxVolume24hUsd:null,
  minBuyTransactions:null,
  maxBuyTransactions:null,
  minSellTransactions:null,
  maxSellTransactions:null,
  minTotalTransactions:null,
  maxTotalTransactions:null,
  minTop10Pct:null,
  maxTop10Pct:null,
  minDeveloperPct:null,
  maxDeveloperPct:null,
  minBundlePct:null,
  maxBundlePct:null,
  minSniperPct:null,
  maxSniperPct:null,
  requireTwitter:false,
  requireWebsite:false,
  requireTelegram:false,
  requireAnySocial:false,
  includeKeywords:'',
  excludeKeywords:'',
  developerBlacklistWallets:[]
};

const token={
  mint:'PaidGate111',
  launchPlatform:'pump',
  discoveredAt:Date.now()
};

assert.equal(
  evaluateEntryAdmission(token,base).admitted,
  true,
  'DEX Paid OFF must not change scanner admission'
);

const waiting=evaluateEntryAdmission(
  token,
  {...base,requireDexPaid:true}
);
assert.equal(waiting.admitted,false);
assert.equal(waiting.waitingGates.some(g=>g.key==='requireDexPaid'),true);

const rejected=evaluateEntryAdmission(
  {...token,dexPaidConfirmed:false},
  {...base,requireDexPaid:true}
);
assert.equal(rejected.admitted,false);
assert.equal(rejected.failedGates.some(g=>g.key==='requireDexPaid'),true);
assert.equal(
  rejected.failedGates.find(g=>g.key==='requireDexPaid')?.retryable,
  true
);

const admitted=evaluateEntryAdmission(
  {...token,dexPaidConfirmed:true},
  {...base,requireDexPaid:true}
);
assert.equal(admitted.admitted,true);

assert.equal(normalizeSettings({requireDexPaid:true}).requireDexPaid,true);
assert.equal(normalizeSettings({requireDexPaid:false}).requireDexPaid,false);

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);
assert.match(app,/createDexPaidVerifier/);
assert.match(app,/__mfDexPaidSweepTimer/);
assert.match(app,/dexPaidConfirmed/);
assert.doesNotMatch(app,/MEMEFLOW_DEX_POOL_VIEW_FILTER_V1/);
assert.doesNotMatch(app,/dexViewRequested/);
assert.doesNotMatch(app,/dexPool:_dexPaid/);
assert.doesNotMatch(app,/mfDexFilterRowsByPaid/);

const settingsPage=fs.readFileSync(
  new URL('../settings-page.js',import.meta.url),
  'utf8'
);
const dexFilterStart=settingsPage.indexOf("['filters', 'Entry filters'");
const dexPreopenStart=settingsPage.indexOf("['preopen', 'Pre-open RPC verification'");
assert.ok(dexFilterStart>=0&&dexPreopenStart>dexFilterStart);
const dexFilterBlock=settingsPage.slice(dexFilterStart,dexPreopenStart);
assert.match(dexFilterBlock,/\['requireDexPaid', 'Require confirmed DEX Paid', 'boolean'\]/);
assert.doesNotMatch(settingsPage,/mf293DexPaidFilter/);
assert.doesNotMatch(settingsPage,/memeflow:dex-pool-filter/);
assert.doesNotMatch(settingsPage,/mf293DexPoolFilterEnabled/);
assert.doesNotMatch(settingsPage,/mf293DexQuerySuffix/);

const systemTokens=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);
assert.doesNotMatch(systemTokens,/memeflow:dex-pool-filter/);
assert.doesNotMatch(systemTokens,/DEX_POOL_FILTER_KEY/);

console.log('dex paid entry filter v1 ok');
