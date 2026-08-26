import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

import {JsonStore} from '../src/store.mjs';
import {defaultSettings} from '../src/settings.mjs';
import {makeLiveEvalMetrics,makeEvaluateForActiveUsers} from '../src/liveeval.mjs';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-live-policy-'));
try{
  const store=new JsonStore(dir);
  const settings={...defaultSettings(),minScore:65,minConfidence:70};
  const now=Date.now();
  for(let i=0;i<500;i++){
    const id=`u${i}`;
    store.state.users[id]={
      id,lastActiveAt:now,settings:{...settings},settingsVersion:1,
      killSwitch:false,isOwner:i===0
    };
  }
  const token={
    mint:'PerfMint',launchPlatform:'pump',name:'Perf',symbol:'PERF',
    creator:'Creator',discoveredAt:now-10_000,
    priceSol:0.000001,totalSupply:1_000_000_000,
    holderFresh:true,holderCount:80,top10Pct:15,developerPct:4,buyPressure:3,
    bondingCurvePct:20,marketCapUsd:150_000,totalFeesSol:0.1,volume24hUsd:40_000,
    buyTransactions:20,sellTransactions:5,totalTransactions:25,bundlePct:2,sniperPct:3,
    liquidityUsd:20_000,
    qualityScore:90,opportunityScore:80,opportunityEvidenceReady:true,
    opportunityTrendHealthy:true,opportunityEventCount:25
  };
  const metrics=makeLiveEvalMetrics();
  const run=makeEvaluateForActiveUsers({store,metrics,batchSize:25});
  const started=performance.now();
  await run(token);
  const firstMs=performance.now()-started;
  assert.equal(metrics.activeEvaluationUsers,500);
  assert.equal(metrics.livePolicyGroups,1);
  assert.equal(metrics.liveUniquePolicyEvaluations,1);
  assert.equal(store.decisions('u1').length,1);

  const burst=[];
  for(let i=0;i<50;i++)burst.push(run({...token,updatedAt:now+i}));
  await Promise.all(burst);
  assert.ok(metrics.liveEvaluationCoalesced>0);
  assert.ok(metrics.liveUniquePolicyEvaluations<10);
  assert.ok(firstMs<5000,`500-user grouped evaluation too slow: ${firstMs}ms`);

  console.log(JSON.stringify({
    test:'live policy performance',
    users:500,
    firstEvaluationMs:+firstMs.toFixed(2),
    policyGroups:metrics.livePolicyGroups,
    uniquePolicyEvaluations:metrics.liveUniquePolicyEvaluations,
    coalesced:metrics.liveEvaluationCoalesced
  }));
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
