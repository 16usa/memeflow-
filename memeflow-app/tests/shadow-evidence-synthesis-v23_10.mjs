import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowEvidenceSynthesisV23_10
} from '../src/shadow-evidence-synthesis-v23_10.mjs';

function snapshot({
  governorP=72,
  governorC=75,
  governorReady=true,
  patternP=78,
  patternC=60,
  patternReady=true,
  neighbours=15,
  trajectory='RISING',
  drift='STABLE',
  completeness=100,
  smartMoney=74,
  smartMoneyConfidence=70,
  smartMoneyReady=true,
  coordination=false
}={}){
  return {
    mint:'T1',
    observedAt:1_801_100_000_000,
    evidence:{
      dataQuality:{
        completenessPct:completeness
      }
    },
    specialists:{
      coordination:{
        suspectedCoordination:coordination
      },
      smartMoneyMemory:{
        reputationReady:smartMoneyReady,
        weightedPositiveProbabilityPct:smartMoney,
        historicalConfidencePct:smartMoneyConfidence
      }
    },
    shadowDriftRegime:{
      driftStatus:drift
    },
    shadowConfidenceGovernor:{
      ready:governorReady,
      consensusProbabilityPositivePct:governorP,
      ensembleConfidencePct:governorC
    },
    shadowTokenTrajectory:{
      trajectoryState:trajectory
    },
    shadowTokenPattern:{
      ready:patternReady,
      neighbourCount:neighbours,
      patternProbabilityPositivePct:patternP,
      matchConfidencePct:patternC
    }
  };
}

const synthesis=createShadowEvidenceSynthesisV23_10();

const good=synthesis.predict(snapshot());

assert.equal(good.shadowOnly,true);
assert.equal(good.ready,true);
assert.equal(good.direction,'POSITIVE');
assert.ok(good.synthesisProbabilityPositivePct>70);
assert.ok(good.patternWeightPct<=35);
assert.equal(good.blockers.length,0);

const conflict=synthesis.predict(snapshot({
  governorP:82,
  patternP:30,
  patternC:80,
  trajectory:'STABLE'
}));

assert.equal(conflict.status,'SYNTHESIS_CONFLICT');
assert.ok(conflict.synthesisConfidencePct<good.synthesisConfidencePct);
assert.ok(conflict.blockers.includes('GOVERNOR_PATTERN_CONFLICT'));

const drifted=synthesis.predict(snapshot({
  trajectory:'DRIFTED',
  drift:'DRIFT'
}));

assert.equal(drifted.status,'SYNTHESIS_DRIFT_SUPPRESSED');
assert.ok(drifted.synthesisConfidencePct<good.synthesisConfidencePct);

const noPattern=synthesis.predict(snapshot({
  patternReady:false,
  neighbours:0
}));

assert.equal(noPattern.ready,true);
assert.equal(noPattern.patternWeightPct,0);
assert.ok(noPattern.modifiers.includes('PATTERN_NOT_READY_CONFIDENCE_CAP'));

const cold=synthesis.predict(snapshot({
  governorReady:false
}));

assert.equal(cold.ready,false);
assert.equal(cold.status,'SYNTHESIS_COLD_START');

assert.equal(typeof synthesis.buy,'undefined');
assert.equal(typeof synthesis.sell,'undefined');
assert.equal(typeof synthesis.execute,'undefined');

// Project wiring / strict SHADOW contract.
const shadow=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs',
  'utf8'
);

const app=fs.readFileSync(
  'app-server.mjs',
  'utf8'
);

assert.match(
  shadow,
  /createShadowEvidenceSynthesisV23_10/
);

assert.match(
  shadow,
  /shadowEvidenceSynthesis\.predict/
);

assert.match(
  shadow,
  /shadowEvidenceSynthesis:shadowEvidenceSynthesis\.status\(\)/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/evidence-synthesis/
);

assert.match(
  app,
  /listEvidenceSynthesisPredictions/
);

const source=fs.readFileSync(
  'src/shadow-evidence-synthesis-v23_10.mjs',
  'utf8'
);

assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/setSettings\s*\(/);
assert.doesNotMatch(source,/tradeEligible/);
assert.doesNotMatch(source,/decisionScore/);
assert.doesNotMatch(source,/synthesisScore/);

console.log('shadow evidence synthesis v23.10 ok');
