import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ENTRY_ADMISSION_KEYS,
  LOGIC_DECISION_KEYS,
  PREOPEN_RPC_KEYS,
  evaluateEntryAdmission,
  evaluateSettingsAdmission,
  evaluateSettingsGate
} from '../src/settings-gate.mjs';

import {
  defaultSettings,
  normalizeSettings,
  validateSettings
} from '../src/settings.mjs';

const now=Date.now();

const overlap=(a,b)=>a.filter(x=>b.includes(x));
assert.deepEqual(overlap(ENTRY_ADMISSION_KEYS,LOGIC_DECISION_KEYS),[]);
assert.deepEqual(overlap(ENTRY_ADMISSION_KEYS,PREOPEN_RPC_KEYS),[]);
assert.deepEqual(overlap(LOGIC_DECISION_KEYS,PREOPEN_RPC_KEYS),[]);

for(const key of [
  'minBuyPressure',
  'requireFreshHolderSnapshot',
  'requireWebsiteOrX',
  'minScore',
  'minConfidence',
  'decisionFreshnessSec'
]){
  assert.equal(
    ENTRY_ADMISSION_KEYS.includes(key),
    false,
    `${key} is Logic and must not hide scanner cards`
  );
}

for(const key of [
  'maxSuspectedRiskyWalletsPct',
  'maxInsidersPct'
]){
  assert.equal(
    PREOPEN_RPC_KEYS.includes(key),
    true,
    `${key} must remain final RPC policy`
  );
  assert.equal(ENTRY_ADMISSION_KEYS.includes(key),false);
}

const allEntryOff={
  ...defaultSettings(),

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
  developerBlacklistWallets:[],

  // Intentionally strict Logic. These MUST NOT affect visibility.
  minBuyPressure:9,
  minScore:99,
  minConfidence:99,
  requireFreshHolderSnapshot:true,
  requireWebsiteOrX:true,

  // FINAL RPC only.
  maxSuspectedRiskyWalletsPct:1,
  maxInsidersPct:1
};

const rawPump={
  mint:'RawPump111111111111111111111111111111111',
  launchPlatform:'pump',
  discoveredAt:now,
  buyPressure:null,
  holderFresh:false,
  socialsKnown:false
};

const openAdmission=evaluateEntryAdmission(rawPump,allEntryOff,{now});
assert.equal(openAdmission.admitted,true);
assert.equal(openAdmission.gates.some(g=>g.key==='minBuyPressure'),false);
assert.equal(openAdmission.gates.some(g=>g.key==='requireFreshHolderSnapshot'),false);
assert.equal(openAdmission.gates.some(g=>g.key==='requireWebsiteOrX'),false);

// Full Logic still applies AFTER admission.
const fullGate=evaluateSettingsGate(rawPump,allEntryOff);
assert.notEqual(fullGate.state,'PASS');

// Global discovery/holder admission must also ignore Logic-only failures.
const globalAdmission=evaluateSettingsAdmission(
  rawPump,
  [{uid:'u1',version:1,settings:allEntryOff}],
  {now,recheckMs:2000}
);
assert.equal(globalAdmission.allow,true);

const mcFiltered=evaluateEntryAdmission(
  {...rawPump,marketCapUsd:3000},
  {...allEntryOff,minMarketCapUsd:5000},
  {now}
);
assert.equal(mcFiltered.admitted,false);
assert.equal(
  mcFiltered.failedGates.some(g=>g.key==='minMarketCapUsd'),
  true
);

const mcAdmitted=evaluateEntryAdmission(
  {...rawPump,marketCapUsd:5001},
  {...allEntryOff,minMarketCapUsd:5000},
  {now}
);
assert.equal(mcAdmitted.admitted,true);

const holderWaiting=evaluateEntryAdmission(
  {...rawPump,marketCapUsd:6000,holderCount:null},
  {...allEntryOff,minMarketCapUsd:5000,minHolders:30},
  {now}
);
assert.equal(holderWaiting.admitted,false);
assert.equal(holderWaiting.waitingGates.some(g=>g.key==='minHolders'),true);

const holderAdmitted=evaluateEntryAdmission(
  {...rawPump,marketCapUsd:6000,holderCount:31},
  {...allEntryOff,minMarketCapUsd:5000,minHolders:30},
  {now}
);
assert.equal(holderAdmitted.admitted,true);

const rpcDoesNotHide=evaluateEntryAdmission(
  {
    ...rawPump,
    marketCapUsd:6000,
    suspectedRiskyWalletsPct:99,
    insidersPct:99
  },
  {
    ...allEntryOff,
    minMarketCapUsd:5000,
    maxSuspectedRiskyWalletsPct:1,
    maxInsidersPct:1
  },
  {now}
);
assert.equal(rpcDoesNotHide.admitted,true);

// "Custom" is a valid decision preset state, not a second rule layer.
const custom=validateSettings({...defaultSettings(),profile:'custom'});
assert.equal(custom.ok,true);
assert.equal(custom.settings.profile,'custom');

// Obsolete UI-only controls must not survive canonical normalization.
const normalized=normalizeSettings({
  ...defaultSettings(),
  profile:'custom',
  ownerApproval:true,
  requireTokenLogo:true,
  requireDevMigrated:true,
  maxDeveloperRugHistoryPct:12,
  maxDeveloperExitPct:15
});
for(const key of [
  'ownerApproval',
  'requireTokenLogo',
  'requireDevMigrated',
  'maxDeveloperRugHistoryPct',
  'maxDeveloperExitPct'
]){
  assert.equal(
    Object.prototype.hasOwnProperty.call(normalized,key),
    false,
    `${key} must not exist in canonical settings`
  );
}

// UI contract: no fake controls; wallet risk is separated from Entry Filters.
const settingsPage=fs.readFileSync(
  new URL('../settings-page.js',import.meta.url),
  'utf8'
);

for(const obsolete of [
  "['ownerApproval'",
  "['requireTokenLogo'",
  "['requireDevMigrated'",
  "['maxDeveloperRugHistoryPct'",
  "['maxDeveloperExitPct'"
]){
  assert.equal(settingsPage.includes(obsolete),false,obsolete);
}

assert.match(settingsPage,/\['preopen', 'Pre-open RPC verification'/);
assert.match(settingsPage,/\['profile', 'Decision preset'.*?'custom','Custom'/s);
assert.match(settingsPage,/Minimum buy pressure for BUY READY/);
assert.match(settingsPage,/Scanner scans all · these filters control cards \+ trading/);
assert.match(settingsPage,/mf293SyncProfileSelection/);

const filterStart=settingsPage.indexOf("['filters', 'Entry filters'");
const preopenStart=settingsPage.indexOf("['preopen', 'Pre-open RPC verification'");
assert.ok(filterStart>=0&&preopenStart>filterStart);
const filterBlock=settingsPage.slice(filterStart,preopenStart);
assert.equal(filterBlock.includes('maxSuspectedRiskyWalletsPct'),false);
assert.equal(filterBlock.includes('maxInsidersPct'),false);

const html=fs.readFileSync(
  new URL('../settings.html',import.meta.url),
  'utf8'
);
assert.match(html,/MEMEFLOW_SETTINGS_CACHE_CHAIN_FIX_V1/);
assert.match(html,/settings-page\.js\?v=[A-Za-z0-9._-]+/);

console.log('settings architecture v2 ok');
