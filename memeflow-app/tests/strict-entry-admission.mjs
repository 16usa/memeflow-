import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  evaluateEntryAdmission
} from '../src/settings-gate.mjs';

import {
  makeLiveEvalMetrics,
  makeEvaluateForActiveUsers
} from '../src/liveeval.mjs';

import {defaultSettings} from '../src/settings.mjs';

const now=Date.now();

const strictSettings={
  launchPlatforms:['pump'],
  minMarketCapUsd:30000,
  minHolders:30,
  minTokenAgeMinutes:20,
  maxTop10Pct:25,
  maxDeveloperPct:20,
  minBuyPressure:1.2,
  requireAnySocial:true,
  requireFreshHolderSnapshot:true,
  maxSuspectedRiskyWalletsPct:35,
  maxInsidersPct:25
};

const tooEarly={
  mint:'Early',
  launchPlatform:'pump',
  // MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1:
  // real token age comes from Pump/create time, not scanner discovery time.
  pumpCreatedAt:now-90_000,
  discoveredAt:now-1_000,
  marketCapUsd:2600,
  holderCount:5,
  top10Pct:20,
  developerPct:10,
  buyPressure:2,
  holderFresh:true,
  twitterUrl:'https://x.com/example',
  socialsKnown:true
};

const earlyAdmission=evaluateEntryAdmission(tooEarly,strictSettings);
assert.equal(earlyAdmission.admitted,false);
assert.equal(earlyAdmission.state,'PENDING');
assert.equal(earlyAdmission.hasStableFailure,false);
assert.ok(earlyAdmission.failedGates.some(g=>g.key==='minMarketCapUsd'));
assert.ok(earlyAdmission.failedGates.some(g=>g.key==='minHolders'));
assert.ok(earlyAdmission.failedGates.some(g=>g.key==='minTokenAgeMinutes'));

const admitted={
  ...tooEarly,
  mint:'Admitted',
  pumpCreatedAt:now-(21*60_000),
  discoveredAt:now-1_000,
  marketCapUsd:35000,
  holderCount:44,
  top10Pct:18,
  developerPct:7,
  buyPressure:2.2
};

const good=evaluateEntryAdmission(admitted,strictSettings);
assert.equal(good.admitted,true);
assert.equal(good.state,'ADMITTED');

// clock threshold admission regression
const fiveMinuteSettings={
  ...strictSettings,
  minTokenAgeMinutes:5,
  minMarketCapUsd:null,
  minHolders:null,
  maxTop10Pct:null,
  maxDeveloperPct:null,
  minBuyPressure:null,
  requireAnySocial:false,
  requireFreshHolderSnapshot:false
};
const justBeforeFive={
  ...admitted,
  pumpCreatedAt:now-(5*60_000)+1000
};
const justAfterFive={
  ...admitted,
  pumpCreatedAt:now-(5*60_000)-1000
};
assert.equal(
  evaluateEntryAdmission(justBeforeFive,fiveMinuteSettings,{now}).admitted,
  false
);
assert.equal(
  evaluateEntryAdmission(justAfterFive,fiveMinuteSettings,{now}).admitted,
  true
);

const finalOnly=evaluateEntryAdmission(
  {
    ...admitted,
    suspectedRiskyWalletsPct:99,
    insidersPct:99
  },
  strictSettings
);
assert.equal(finalOnly.admitted,true);
assert.ok(
  finalOnly.gates.every(
    g=>g.key!=='maxSuspectedRiskyWalletsPct'&&g.key!=='maxInsidersPct'
  )
);

const stable=evaluateEntryAdmission(
  {
    ...admitted,
    name:'Definitely scam token'
  },
  {
    ...strictSettings,
    excludeKeywords:'scam'
  }
);
assert.equal(stable.admitted,false);
assert.equal(stable.state,'REJECTED');
assert.equal(stable.hasStableFailure,true);

const missing=evaluateEntryAdmission(
  {
    mint:'Missing',
    launchPlatform:'pump',
    pumpCreatedAt:now-(21*60_000),
    discoveredAt:now-1_000
  },
  strictSettings
);
assert.equal(missing.admitted,false);
assert.equal(missing.state,'PENDING');
assert.ok(missing.waitingGates.length>0);

const baseSettings={
  ...defaultSettings(),
  minHolders:0,
  maxTop10Pct:null,
  maxDeveloperPct:null,
  minBuyPressure:0,
  requireFreshHolderSnapshot:false,
  minTokenAgeMinutes:0,
  maxTokenAgeMinutes:null,
  minScore:0,
  minConfidence:0,
  maxSuspectedRiskyWalletsPct:null,
  maxInsidersPct:null
};

const fakeStore={
  state:{
    users:{
      allowed:{lastActiveAt:now,settingsVersion:1},
      hidden:{lastActiveAt:now,settingsVersion:1}
    },
    decisions:{}
  },
  _uidDec:{},
  settings(){return baseSettings},
  setDecision(uid,mint,decision){
    const key=uid+':'+mint;
    this.state.decisions[key]={...decision,mint};
    if(!this._uidDec[uid])this._uidDec[uid]=new Map();
    this._uidDec[uid].set(key,this.state.decisions[key]);
    return this.state.decisions[key];
  }
};

const metrics=makeLiveEvalMetrics();
const live=makeEvaluateForActiveUsers({
  store:fakeStore,
  metrics,
  admissionCheck:(_token,_settings,uid)=>({
    admitted:uid==='allowed'
  })
});

await live({
  mint:'LiveMint',
  priceSol:0.00001,
  holderCount:50,
  top10Pct:15,
  developerPct:5,
  buyPressure:2,
  holderFresh:true,
  qualityScore:80,
  opportunityScore:70,
  opportunityEvidenceReady:true,
  opportunityTrendHealthy:true
});

assert.ok(fakeStore.state.decisions['allowed:LiveMint']);
assert.equal(fakeStore.state.decisions['hidden:LiveMint'],undefined);
assert.equal(metrics.entryAdmissionLastPassedUsers,1);
assert.ok(metrics.entryAdmissionUsersHidden>=1);

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

assert.match(app,/MEMEFLOW_STRICT_ENTRY_ADMISSION_V1/);
assert.match(app,/admissionCheck:__mfLiveEvalAdmissionCheck/);
assert.match(app,/__mfAdmittedScannerTokensForUser\(u\.id\)/);
assert.match(app,/preAdmissionHidden:/);
assert.match(app,/preAdmissionHiddenForUser:/);

// MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE
// Entry admission strictly gates TRADING but classifies Live Token States.
const liveStatesRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveStatesRoute,/MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE/);
assert.match(liveStatesRoute,/MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE/);
// MEMEFLOW_LIVE_STATES_PREFIX_HOTPATH_V61
assert.match(
  liveStatesRoute,
  /MEMEFLOW_LIVE_STATES_PREFIX_HOTPATH_V61/
);
assert.match(
  liveStatesRoute,
  /selectNewestCurrentTokensV61/
);
assert.match(
  liveStatesRoute,
  /Object\.values\(store\.state\.tokens\|\|\{\}\)/
);
assert.match(
  liveStatesRoute,
  /rawScannerTokens:_liveStatesInventoryV61\.liveCount/
);
assert.doesNotMatch(
  liveStatesRoute,
  /const _rawTokens=__mfLiveScannerTokens\(\)/
);
assert.match(liveStatesRoute,/state:_blocked\?'BLOCKED':'WAITING'/);
assert.match(liveStatesRoute,/preAdmissionPending:_pending/);
assert.match(liveStatesRoute,/preAdmissionRejected:_rejected/);
assert.match(liveStatesRoute,/preAdmissionHidden:0/);
assert.doesNotMatch(liveStatesRoute,/_hiddenBySettings\+\+;\s*continue/);

const discovery=app.slice(
  app.indexOf('function startDiscovery(i=0){'),
  app.indexOf('function shadowValidateSettings')
);
assert.doesNotMatch(discovery,/scanWalletClusterRisk/);

console.log('strict entry admission v1 ok');
