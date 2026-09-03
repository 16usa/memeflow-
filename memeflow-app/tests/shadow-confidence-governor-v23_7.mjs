import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowConfidenceGovernorV23_7
} from '../src/shadow-confidence-governor-v23_7.mjs';

const governor=
  createShadowConfidenceGovernorV23_7();

const base={
  mint:'V23_7_GOOD',
  specialists:{
    smartMoneyMemory:{
      reputationReady:true,
      readyWallets:4,
      weightedPositiveProbabilityPct:76,
      historicalConfidencePct:72
    }
  },
  shadowMathBrain:{
    modelReady:true,
    validated:true,
    probabilityPositivePct:78,
    modelConfidencePct:80
  },
  shadowModelArena:{
    modelReady:true,
    validated:true,
    calibratedProbabilityPositivePct:74,
    modelConfidencePct:82
  },
  shadowDriftRegime:{
    regimeModelReady:true,
    regimeModelValidated:true,
    probabilityPositivePct:80,
    modelConfidencePct:70,
    driftStatus:'STABLE'
  }
};

const good=
  governor.predict(
    base,
    {mint:'V23_7_GOOD'}
  );

assert.equal(good.shadowOnly,true);
assert.equal(good.ready,true);
assert.ok(
  good.consensusProbabilityPositivePct>70
);
assert.ok(
  good.ensembleConfidencePct>0
);
assert.equal(good.sourceCount,4);
assert.equal(
  good.validatedSourceCount,
  4
);
assert.ok(
  good.correlationHaircutPct<100
);
assert.ok(
  good.effectiveSourceCount<
  good.sourceCount
);

const conflict=
  structuredClone(base);

conflict.shadowMathBrain
  .probabilityPositivePct=95;

conflict.shadowModelArena
  .calibratedProbabilityPositivePct=5;

conflict.shadowDriftRegime
  .probabilityPositivePct=90;

conflict.specialists
  .smartMoneyMemory
  .weightedPositiveProbabilityPct=10;

const disagreement=
  governor.predict(conflict);

assert.equal(
  disagreement.status,
  'HIGH_DISAGREEMENT'
);
assert.ok(
  disagreement.disagreementPct>=20
);

const drift=
  structuredClone(base);

drift.shadowDriftRegime
  .driftStatus='DRIFT';

const drifted=
  governor.predict(drift);

assert.equal(
  drifted.status,
  'DRIFT_SUPPRESSED'
);
assert.ok(
  drifted.ensembleConfidencePct<
  good.ensembleConfidencePct
);

const cold=
  governor.predict({
    shadowMathBrain:{
      modelReady:false
    },
    shadowModelArena:{
      modelReady:false
    },
    shadowDriftRegime:{
      regimeModelReady:false
    }
  });

assert.equal(cold.ready,false);
assert.equal(
  cold.status,
  'INSUFFICIENT_EVIDENCE'
);
assert.equal(
  cold.consensusProbabilityPositivePct,
  null
);

const api=governor;
assert.equal(
  typeof api.execute,
  'undefined'
);
assert.equal(
  typeof api.buy,
  'undefined'
);
assert.equal(
  typeof api.sell,
  'undefined'
);

// Project wiring contract.
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
  /createShadowConfidenceGovernorV23_7/
);
assert.match(
  shadow,
  /shadowConfidenceGovernor\.predict/
);
assert.match(
  shadow,
  /shadowConfidenceGovernor:shadowConfidenceGovernor\.status\(\)/
);
assert.match(
  app,
  /\/api\/owner\/intelligence\/shadow-confidence-governor/
);
assert.match(
  app,
  /shadowConfidenceGovernorStatus/
);
assert.match(
  app,
  /listShadowConfidenceGovernorPredictions/
);

const source=fs.readFileSync(
  'src/shadow-confidence-governor-v23_7.mjs',
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
assert.doesNotMatch(
  source,
  /governorScore/
);

console.log(
  'shadow confidence governor v23.7 ok'
);
