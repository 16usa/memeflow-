import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createShadowTokenPatternMemoryV23_9} from '../src/shadow-token-pattern-memory-v23_9.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-v23-9-'));

function snap({mint,at,state='RISING',regime='EXPANSION',p=75,c=70,d=5,pd=15,cd=10,flow=.55,ret=20,sm=74}){
  return {
    mint,observedAt:at,
    windows:{'15000':{price:{returnPct:ret}}},
    specialists:{coordination:{suspectedCoordination:false},smartMoneyMemory:{weightedPositiveProbabilityPct:sm}},
    evidence:{regime,flowAcceleration:{netFlow5s:flow},dataQuality:{completenessPct:100}},
    shadowDriftRegime:{driftStatus:'STABLE'},
    shadowConfidenceGovernor:{status:'MODERATE_CONFIDENCE',consensusProbabilityPositivePct:p,ensembleConfidencePct:c,disagreementPct:d},
    shadowTokenTrajectory:{trajectoryState:state,probabilityDeltaWindow:pd,confidenceDeltaWindow:cd}
  };
}

function labeled({mint,at,positive}){
  return {
    anchor:{mint,at,features:snap({
      mint,at,
      state:positive?'RISING':'FADING',
      regime:positive?'EXPANSION':'CHOP',
      p:positive?76:28,c:positive?70:52,d:positive?5:17,
      pd:positive?16:-17,cd:positive?10:-9,
      flow:positive?.58:-.28,ret:positive?21:-14,sm:positive?76:33
    })},
    outcome:{
      mint,observedAt:at+300_000,horizonMs:300_000,
      returnPct:positive?40:-35,
      maxFavorableExcursionPct:positive?65:4,
      maxAdverseExcursionPct:positive?-8:-40,
      dead:false
    }
  };
}

try{
  const m=createShadowTokenPatternMemoryV23_9({
    dataDir:tmp,minimumExamples:8,topK:12,minimumSimilarity:.10
  });
  const base=1_801_000_000_000;

  for(let i=0;i<12;i++)assert.ok(m.recordOutcome(labeled({mint:`P${i}`,at:base+i*1000,positive:true})));
  for(let i=0;i<8;i++)assert.ok(m.recordOutcome(labeled({mint:`N${i}`,at:base+20000+i*1000,positive:false})));
  assert.equal(m.status().examples,20);

  const now=base+1_000_000;
  const pos=m.predict(snap({mint:'CURP',at:now}),{mint:'CURP',at:now});
  assert.equal(pos.ready,true);
  assert.ok(pos.patternProbabilityPositivePct>60);
  assert.ok(pos.positiveNeighbours>pos.negativeNeighbours);

  const neg=m.predict(snap({
    mint:'CURN',at:now,state:'FADING',regime:'CHOP',
    p:28,c:52,d:17,pd:-17,cd:-9,flow:-.28,ret:-14,sm:33
  }),{mint:'CURN',at:now});
  assert.equal(neg.ready,true);
  assert.ok(neg.patternProbabilityPositivePct<50);
  assert.ok(neg.negativeNeighbours>=neg.positiveNeighbours);

  const early=m.predict(snap({mint:'EARLY',at:base+50_000}),{mint:'EARLY',at:base+50_000});
  assert.ok(early.historicalExamples<m.status().examples);

  m.recordOutcome(labeled({mint:'SELF',at:base+40_000,positive:true}));
  const self=m.predict(snap({mint:'SELF',at:now}),{mint:'SELF',at:now});
  assert.ok(self.neighbours.every(x=>x.mint!=='SELF'));

  assert.equal(await m.flush(),true);
  const restored=createShadowTokenPatternMemoryV23_9({dataDir:tmp,minimumExamples:8});
  assert.ok(restored.status().rowsLoaded>=20);

  assert.equal(typeof m.buy,'undefined');
  assert.equal(typeof m.sell,'undefined');
  assert.equal(typeof m.execute,'undefined');

  // Project wiring / strict SHADOW contract.
  const shadow=fs.readFileSync('src/token-intelligence-shadow-v23.mjs','utf8');
  const app=fs.readFileSync('app-server.mjs','utf8');
  assert.match(shadow,/createShadowTokenPatternMemoryV23_9/);
  assert.match(shadow,/shadowTokenPatternMemory\.predict/);
  assert.match(shadow,/shadowTokenPatternMemory\.recordOutcome/);
  assert.match(shadow,/shadowTokenPatternMemory:shadowTokenPatternMemory\.status\(\)/);
  assert.match(app,/\/api\/owner\/intelligence\/token-pattern-memory/);
  assert.match(app,/listTokenPatternPredictions/);

  const source=fs.readFileSync('src/shadow-token-pattern-memory-v23_9.mjs','utf8');
  assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
  assert.doesNotMatch(source,/openPosition\s*\(/);
  assert.doesNotMatch(source,/closePosition\s*\(/);
  assert.doesNotMatch(source,/setSettings\s*\(/);
  assert.doesNotMatch(source,/tradeEligible/);
  assert.doesNotMatch(source,/decisionScore/);
  assert.doesNotMatch(source,/patternScore/);

  console.log('shadow token pattern memory v23.9 ok');
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
