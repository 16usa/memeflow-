import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {evaluate} from '../src/evaluate.mjs';
import {
  evaluateSettingsGate,
  PREOPEN_RPC_KEYS
} from '../src/settings-gate.mjs';
import {
  makeLiveEvalMetrics,
  makeEvaluateForActiveUsers
} from '../src/liveeval.mjs';
import {JsonStore} from '../src/store.mjs';
import {defaultSettings} from '../src/settings.mjs';

assert.deepEqual(
  [...PREOPEN_RPC_KEYS],
  [
    'maxSuspectedRiskyWalletsPct',
    'maxInsidersPct'
  ]
);

const now=Date.now();

const baseToken={
  mint:'RiskIsolationMint',
  launchPlatform:'pump',
  name:'Risk Isolation',
  symbol:'RISK',
  pumpCreatedAt:now-60_000,
  discoveredAt:now-10_000,
  priceSol:0.00001,
  totalSupply:1_000_000_000,
  holderFresh:true,
  holderCount:120,
  top10Pct:10,
  developerPct:2,
  buyPressure:3,
  bondingCurvePct:20,
  marketCapUsd:100_000,
  liquidityUsd:25_000,
  qualityScore:95,
  opportunityScore:90,
  opportunityEvidenceReady:true,
  opportunityTrendHealthy:true,
  opportunityEventCount:30,

  // This evidence was persisted by a prior FINAL pre-open scan.
  suspectedRiskyWalletsPct:18,
  insidersPct:12,
  walletClusterRiskScannedAt:now
};

const settings={
  ...defaultSettings(),

  // Make ordinary gates permissive enough that only final wallet risk differs.
  minScore:0,
  minConfidence:0,
  minBuyPressure:0,
  minHolders:null,
  maxHolders:null,
  minTop10Pct:null,
  maxTop10Pct:null,
  minDeveloperPct:null,
  maxDeveloperPct:null,
  minMarketCapUsd:null,
  maxMarketCapUsd:null,
  minLiquidityUsd:0,
  requireFreshHolderSnapshot:false,
  requireWebsiteOrX:false,

  // FINAL-only limits deliberately fail against persisted evidence.
  maxSuspectedRiskyWalletsPct:10,
  maxInsidersPct:5
};

const ordinaryGate=
  evaluateSettingsGate(baseToken,settings);

assert.equal(
  ordinaryGate.gates.some(
    g=>PREOPEN_RPC_KEYS.includes(g.key)
  ),
  false,
  'ordinary live gate must not include FINAL-only wallet risk'
);

const ordinary=
  evaluate(baseToken,settings);

assert.notEqual(
  ordinary.state,
  'BLOCKED',
  'persisted pre-open evidence must not leak backward into ordinary live state'
);

assert.equal(
  ordinary.walletRiskPending,
  false,
  'ordinary live evaluation must not wait on FINAL-only wallet risk'
);

const finalGate=
  evaluateSettingsGate(
    baseToken,
    settings,
    {includePreOpenRisk:true}
  );

assert.equal(
  finalGate.failedGates.some(
    g=>g.key==='maxSuspectedRiskyWalletsPct'
  ),
  true
);
assert.equal(
  finalGate.failedGates.some(
    g=>g.key==='maxInsidersPct'
  ),
  true
);

const finalEvaluation=
  evaluate(
    baseToken,
    settings,
    {includePreOpenRisk:true}
  );

assert.equal(
  finalEvaluation.state,
  'BLOCKED',
  'FINAL pre-open mode must preserve wallet-risk blocking'
);

// Policy grouping regression:
// users differing ONLY in FINAL-only wallet-risk thresholds must still share
// one ordinary live evaluate() policy group.
const dir=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-v43-risk-isolation-')
);

try{
  const store=new JsonStore(dir);

  for(let i=0;i<500;i++){
    const id=`v43u${i}`;
    store.state.users[id]={
      id,
      lastActiveAt:now,
      settings:{
        ...settings,
        maxSuspectedRiskyWalletsPct:
          i%2===0 ? 5 : 35,
        maxInsidersPct:
          i%3===0 ? 4 : 25
      },
      settingsVersion:1,
      isOwner:i===0,
      killSwitch:false
    };
  }

  const metrics=makeLiveEvalMetrics();
  const run=makeEvaluateForActiveUsers({
    store,
    metrics,
    batchSize:25
  });

  await run(baseToken);

  assert.equal(metrics.activeEvaluationUsers,500);
  assert.equal(
    metrics.livePolicyGroups,
    1,
    'FINAL-only settings must not split ordinary live policy groups'
  );
  assert.equal(
    metrics.liveUniquePolicyEvaluations,
    1
  );
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}

// Static final-path proof: final pre-open call must explicitly opt in.
const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

assert.match(
  app,
  /const finalDecision=evaluate\(\s*updated,\s*settings,\s*\{includePreOpenRisk:true\}\s*\);/
);

console.log('preopen wallet risk isolation v43 ok');
