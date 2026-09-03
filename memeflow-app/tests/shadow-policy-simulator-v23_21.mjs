import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowPolicySimulatorV23_21
} from '../src/shadow-policy-simulator-v23_21.mjs';

const candidate={
  candidateId:
    'V23_20_ERROR_AWARE_ENTRY_GUARD_BALANCED',
  mode:'BALANCED',
  proposedAction:
    'DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH',
  trigger:{
    requireMatureErrorPattern:true,
    requirePenaltyApplied:true,
    minPenaltyPct:10,
    maxAdjustedConfidencePct:55
  }
};

const rows=[];

// 120 rows: 60 positive, 60 negative.
// Affect 24 negatives + 4 positives => strong protective precision.
for(let i=0;i<120;i++){
  const positive=i<60;

  const affected=
    positive
      ? i<4
      : i<84;

  rows.push({
    key:`ROW_${i}`,
    scored:true,
    horizonMs:300_000,
    classification:
      positive
        ? 'POSITIVE'
        : 'NEGATIVE',
    errorAwareStatus:
      affected
        ? 'PENALTY_APPLIED'
        : 'NO_PATTERN_MATCH',
    penaltyPct:
      affected
        ? 20
        : 0,
    adjustedConfidencePct:
      affected
        ? 45
        : 80,
    rawConfidencePct:80,
    rawProbabilityPct:
      positive
        ? 80
        : 20,
    challengerProbabilityPct:
      positive
        ? 70
        : 30
  });
}

const simulator=
  createShadowPolicySimulatorV23_21({
    policyCandidateBuilder:{
      build(){
        return {
          ready:true,
          candidate
        };
      }
    },
    errorAwareBenchmark:{
      listRows(){
        return rows;
      },
      report(){
        return {
          raw:{
            meanBrier:0.20,
            meanLogLoss:0.60
          },
          challenger:{
            meanBrier:0.17,
            meanLogLoss:0.52
          },
          delta:{
            brier:0.03,
            logLoss:0.08
          }
        };
      }
    }
  });

const result=
  simulator.simulate();

assert.equal(
  result.ready,
  true
);

assert.equal(
  result.status,
  'SIMULATION_PASSES_REVIEW_GATE'
);

assert.equal(
  result.metrics.evaluableRows,
  120
);

assert.equal(
  result.metrics.affectedRows,
  28
);

assert.equal(
  result.metrics.preventedNegative,
  24
);

assert.equal(
  result.metrics.missedPositiveOpportunity,
  4
);

assert.ok(
  result.metrics.negativePrecisionPct>=60
);

assert.ok(
  result.metrics.positiveOpportunityCostPct<=12
);

assert.ok(
  result.metrics.negativeBlockRatePct>=15
);

assert.ok(
  result.metrics.netProtectedMinusMissed>0
);

assert.ok(
  result.gates.every(
    row=>row.pass===true
  )
);

assert.equal(
  result.verdict.reviewEligible,
  true
);

assert.equal(
  result.controls.applicationAllowed,
  false
);

assert.equal(
  result.controls.automaticPromotion,
  false
);

assert.equal(
  result.controls.stateMutation,
  false
);

assert.equal(
  result.controls.buySellMutation,
  false
);

assert.equal(
  result.controls.forecastMutation,
  false
);

const blocked=
  createShadowPolicySimulatorV23_21({
    policyCandidateBuilder:{
      build(){
        return {
          ready:false,
          candidate:null
        };
      }
    },
    errorAwareBenchmark:{
      listRows(){
        return rows;
      }
    }
  }).simulate();

assert.equal(
  blocked.status,
  'SIMULATION_BLOCKED'
);

assert.equal(
  blocked.verdict.reviewEligible,
  false
);

const source=
  fs.readFileSync(
    'src/shadow-policy-simulator-v23_21.mjs',
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

const benchmark=
  fs.readFileSync(
    'src/shadow-error-aware-benchmark-v23_19.mjs',
    'utf8'
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
  benchmark,
  /function listRows/
);

assert.match(
  shadow,
  /createShadowPolicySimulatorV23_21/
);

assert.match(
  shadow,
  /policySimulatorStatus/
);

assert.match(
  shadow,
  /runPolicySimulation/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/policy-simulation/
);

assert.match(
  html,
  /id="policySimulationStatus"/
);

assert.match(
  js,
  /loadPolicySimulation/
);

console.log(
  'shadow policy simulator v23.21 ok'
);
