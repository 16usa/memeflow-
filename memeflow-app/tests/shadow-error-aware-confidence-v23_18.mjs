import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowErrorAwareConfidenceV23_18
} from '../src/shadow-error-aware-confidence-v23_18.mjs';

function snapshot({
  probability=80,
  confidence=80,
  disagreement=52,
  trajectory='FADING',
  regime='EXPANSION',
  stage='DEEP'
}={}){
  return {
    __stage:stage,
    evidence:{
      regime,
      dataQuality:{
        completenessPct:100
      }
    },
    specialists:{
      wallet:{
        topBuyerSolSharePct:20
      },
      coordination:{
        suspectedCoordination:false
      },
      smartMoneyMemory:{
        weightedPositiveProbabilityPct:72
      }
    },
    shadowConfidenceGovernor:{
      ready:true,
      disagreementPct:disagreement,
      consensusProbabilityPositivePct:probability,
      ensembleConfidencePct:confidence
    },
    shadowTokenTrajectory:{
      trajectoryState:trajectory,
      turningPoint:false
    },
    shadowTokenPattern:{
      ready:true,
      patternProbabilityPositivePct:75
    },
    shadowDriftRegime:{
      status:'REGIME_READY',
      driftStatus:'STABLE'
    },
    shadowEvidenceSynthesis:{
      ready:true,
      status:'SYNTHESIS_STRONG',
      direction:'BULLISH',
      synthesisProbabilityPositivePct:probability,
      synthesisConfidencePct:confidence,
      crossSourceDisagreementPct:disagreement,
      blockers:[]
    },
    shadowOutcomeCalibration:{
      ready:true,
      status:'CALIBRATION_HEALTHY',
      calibratedProbabilityPositivePct:probability,
      calibratedConfidencePct:confidence
    }
  };
}

const maturePair={
  patternId:
    'HIGH_MODEL_DISAGREEMENT + TRAJECTORY_FADING',
  tags:[
    'HIGH_MODEL_DISAGREEMENT',
    'TRAJECTORY_FADING'
  ],
  support:31,
  misses:24,
  posteriorMissRatePct:71,
  baselineMissRatePct:34,
  lowerBoundMissRatePct:58,
  missLift:1.82,
  mature:true,
  severity:'HIGH'
};

const redundantSingle={
  patternId:'TRAJECTORY_FADING',
  tags:[
    'TRAJECTORY_FADING'
  ],
  support:40,
  misses:25,
  posteriorMissRatePct:63,
  baselineMissRatePct:34,
  lowerBoundMissRatePct:52,
  missLift:1.55,
  mature:true,
  severity:'MEDIUM'
};

const learner={
  patternReport(){
    return {
      patterns:[
        maturePair,
        redundantSingle
      ]
    };
  }
};

const brain=
  createShadowErrorAwareConfidenceV23_18({
    errorPatternLearner:learner
  });

const snap=snapshot();

const row=
  brain.predict(
    snap,
    {
      mint:'MINT_A',
      at:1_801_600_000_000,
      stage:'DEEP'
    }
  );

assert.equal(
  row.status,
  'PENALTY_APPLIED'
);

assert.equal(
  row.probabilityPositivePct,
  80
);

assert.equal(
  row.rawConfidencePct,
  80
);

assert.ok(
  row.adjustedConfidencePct<
  row.rawConfidencePct
);

assert.ok(
  row.penaltyPct>0
);

assert.ok(
  row.penaltyPct<=40
);

assert.ok(
  row.currentTags.includes(
    'HIGH_MODEL_DISAGREEMENT'
  )
);

assert.ok(
  row.currentTags.includes(
    'TRAJECTORY_FADING'
  )
);

// Correlation guard: the single tag is redundant after the pair.
assert.equal(
  row.selectedPatterns.length,
  1
);

assert.equal(
  row.selectedPatterns[0].patternId,
  maturePair.patternId
);

assert.equal(
  row.probabilityMutation,
  false
);

assert.equal(
  row.tradingMutation,
  false
);

const noMatch=
  brain.predict(
    snapshot({
      disagreement:10,
      trajectory:'RISING'
    }),
    {
      mint:'MINT_B',
      at:1_801_600_001_000,
      stage:'DEEP'
    }
  );

assert.equal(
  noMatch.status,
  'NO_PATTERN_MATCH'
);

assert.equal(
  noMatch.penaltyPct,
  0
);

assert.equal(
  noMatch.adjustedConfidencePct,
  noMatch.rawConfidencePct
);

const empty=
  createShadowErrorAwareConfidenceV23_18({
    errorPatternLearner:{
      patternReport(){
        return {
          patterns:[]
        };
      }
    }
  });

const cold=
  empty.predict(
    snapshot(),
    {
      mint:'MINT_C',
      at:1_801_600_002_000,
      stage:'DEEP'
    }
  );

assert.equal(
  cold.status,
  'NO_MATURE_PATTERNS'
);

assert.equal(
  cold.penaltyPct,
  0
);

assert.ok(
  brain.status().penaltiesApplied>=1
);

assert.equal(
  brain.status().probabilityMutation,
  false
);

assert.equal(
  brain.status().confidenceOnly,
  true
);

const source=
  fs.readFileSync(
    'src/shadow-error-aware-confidence-v23_18.mjs',
    'utf8'
  );

assert.doesNotMatch(
  source,
  /from ['"]\.\/evaluate\.mjs['"]/
);

assert.doesNotMatch(
  source,
  /openPosition\s*\(/
);

assert.doesNotMatch(
  source,
  /closePosition\s*\(/
);

assert.doesNotMatch(
  source,
  /setSettings\s*\(/
);

assert.doesNotMatch(
  source,
  /tradeEligible/
);

assert.doesNotMatch(
  source,
  /decisionScore/
);

const shadow=
  fs.readFileSync(
    'src/token-intelligence-shadow-v23.mjs',
    'utf8'
  );

const app=
  fs.readFileSync(
    'app-server.mjs',
    'utf8'
  );

const html=
  fs.readFileSync(
    'owner-intelligence.html',
    'utf8'
  );

const js=
  fs.readFileSync(
    'owner-intelligence.js',
    'utf8'
  );

assert.match(
  shadow,
  /createShadowErrorAwareConfidenceV23_18/
);

assert.match(
  shadow,
  /snapshot\.shadowErrorAwareConfidence/
);

assert.match(
  shadow,
  /errorAwareConfidenceStatus/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/error-aware-confidence/
);

assert.match(
  html,
  /id="errorAwareConfidenceList"/
);

assert.match(
  js,
  /loadErrorAwareConfidence/
);

console.log(
  'shadow error-aware confidence v23.18 ok'
);
