import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowPolicyCandidateBuilderV23_20
} from '../src/shadow-policy-candidate-builder-v23_20.mjs';

const benchmarkWin={
  report(){
    return {
      pairedRows:140,
      positive:70,
      negative:70,
      delta:{
        brier:0.012,
        logLoss:0.026,
        accuracyPct:2.5,
        ecePct:4.2,
        highConfidenceMissRatePct:7.1
      },
      pairedWins:{
        raw:40,
        challenger:75,
        ties:25
      },
      verdict:{
        status:
          'ERROR_AWARE_CHALLENGER_WINS',
        challengerWins:true,
        reviewEligible:true
      }
    };
  }
};

const patternsReady={
  patternReport(){
    return {
      maturePatterns:3,
      highRiskPatterns:1,
      patterns:[
        {
          patternId:
            'HIGH_MODEL_DISAGREEMENT + TRAJECTORY_FADING',
          tags:[
            'HIGH_MODEL_DISAGREEMENT',
            'TRAJECTORY_FADING'
          ],
          support:31,
          missLift:1.82,
          severity:'HIGH'
        }
      ]
    };
  }
};

const builder=
  createShadowPolicyCandidateBuilderV23_20({
    errorAwareBenchmark:
      benchmarkWin,
    errorPatternLearner:
      patternsReady
  });

const result=
  builder.build();

assert.equal(
  result.ready,
  true
);

assert.equal(
  result.status,
  'CANDIDATE_READY_FOR_SIMULATION'
);

assert.equal(
  result.blockers.length,
  0
);

assert.ok(
  result.gates.every(
    row=>row.pass===true
  )
);

assert.ok(
  result.candidate
);

assert.equal(
  result.candidate.mode,
  'BALANCED'
);

assert.equal(
  result.candidate.trigger.minPenaltyPct,
  10
);

assert.equal(
  result.candidate.trigger.maxAdjustedConfidencePct,
  55
);

assert.equal(
  result.candidate.proposedAction,
  'DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH'
);

assert.equal(
  result.candidate.controls.applicationAllowed,
  false
);

assert.equal(
  result.candidate.controls.simulationRequired,
  true
);

assert.equal(
  result.candidate.controls.scoreMutation,
  false
);

assert.equal(
  result.candidate.controls.stateMutation,
  false
);

assert.equal(
  result.candidate.controls.buySellMutation,
  false
);

assert.equal(
  result.candidate.controls.settingsMutation,
  false
);

assert.equal(
  result.candidate.impactClaim
    .quantitativePolicyImpactKnown,
  false
);

const blocked=
  createShadowPolicyCandidateBuilderV23_20({
    errorAwareBenchmark:{
      report(){
        return {
          pairedRows:40,
          positive:25,
          negative:15,
          delta:{
            brier:0.001,
            logLoss:0.001
          },
          verdict:{
            status:'BENCHMARK_COLD_START',
            reviewEligible:false
          }
        };
      }
    },
    errorPatternLearner:{
      patternReport(){
        return {
          maturePatterns:0,
          highRiskPatterns:0,
          patterns:[]
        };
      }
    }
  }).build();

assert.equal(
  blocked.ready,
  false
);

assert.equal(
  blocked.candidate,
  null
);

assert.ok(
  blocked.blockers.includes(
    'BENCHMARK_REVIEW_ELIGIBLE'
  )
);

assert.ok(
  blocked.blockers.includes(
    'PAIRED_SAMPLE'
  )
);

assert.ok(
  blocked.blockers.includes(
    'MATURE_ERROR_PATTERN'
  )
);

const source=
  fs.readFileSync(
    'src/shadow-policy-candidate-builder-v23_20.mjs',
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
  /createShadowPolicyCandidateBuilderV23_20/
);

assert.match(
  shadow,
  /policyCandidateBuilderStatus/
);

assert.match(
  shadow,
  /buildPolicyCandidate/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/policy-candidate/
);

assert.match(
  html,
  /id="policyCandidateStatus"/
);

assert.match(
  js,
  /loadPolicyCandidate/
);

console.log(
  'shadow policy candidate builder v23.20 ok'
);
