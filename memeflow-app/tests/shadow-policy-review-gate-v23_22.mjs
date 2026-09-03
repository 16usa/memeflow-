import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowPolicyReviewGateV23_22
} from '../src/shadow-policy-review-gate-v23_22.mjs';

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

const gate=
  createShadowPolicyReviewGateV23_22({
    policyCandidateBuilder:{
      build(){
        return {
          ready:true,
          status:
            'CANDIDATE_READY_FOR_SIMULATION',
          candidate
        };
      }
    },
    policySimulator:{
      simulate(){
        return {
          ready:true,
          status:
            'SIMULATION_PASSES_REVIEW_GATE',
          candidateId:
            candidate.candidateId,
          metrics:{
            evaluableRows:180,
            affectedRows:30,
            affectedRatePct:16.67,
            preventedNegative:25,
            missedPositiveOpportunity:5,
            negativePrecisionPct:83.33,
            negativeBlockRatePct:27.78,
            positiveOpportunityCostPct:5.56,
            positivePreservationPct:94.44,
            netProtectedMinusMissed:20
          },
          verdict:{
            pass:true,
            reviewEligible:true,
            reason:
              'POLICY_GUARD_SHOWS_POSITIVE_SHADOW_ACTION_IMPACT'
          }
        };
      }
    },
    errorAwareBenchmark:{
      report(){
        return {
          pairedRows:180,
          delta:{
            brier:0.012,
            logLoss:0.026,
            highConfidenceMissRatePct:6.2
          },
          verdict:{
            status:
              'ERROR_AWARE_CHALLENGER_WINS',
            reviewEligible:true
          }
        };
      }
    },
    outcomeCalibration:{
      status(){
        return {
          targetStatus:
            'CALIBRATION_HEALTHY',
          targetEcePct:6.4
        };
      }
    },
    driftRegime:{
      status(){
        return {
          drift:{
            status:'STABLE'
          }
        };
      }
    }
  });

const result=
  gate.evaluate();

assert.equal(
  result.status,
  'POLICY_CANDIDATE_FOR_MANUAL_REVIEW'
);

assert.equal(
  result.candidateForManualReview,
  true
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

assert.equal(
  result.reviewPacket.recommendation,
  'MANUAL_REVIEW_ALLOWED'
);

assert.equal(
  result.reviewPacket.livePolicyChanged,
  false
);

assert.equal(
  result.controls.applicationAllowed,
  false
);

assert.equal(
  result.controls.applyEndpointExists,
  false
);

assert.equal(
  result.controls.automaticPromotion,
  false
);

assert.equal(
  result.controls.scoreMutation,
  false
);

assert.equal(
  result.controls.stateMutation,
  false
);

assert.equal(
  result.controls.settingsMutation,
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
  createShadowPolicyReviewGateV23_22({
    policyCandidateBuilder:{
      build(){
        return {
          ready:true,
          status:
            'CANDIDATE_READY_FOR_SIMULATION',
          candidate
        };
      }
    },
    policySimulator:{
      simulate(){
        return {
          status:
            'SIMULATION_PASSES_REVIEW_GATE',
          candidateId:
            candidate.candidateId,
          metrics:{
            evaluableRows:180,
            affectedRows:30,
            affectedRatePct:16,
            negativePrecisionPct:80,
            negativeBlockRatePct:25,
            positiveOpportunityCostPct:6,
            positivePreservationPct:94,
            netProtectedMinusMissed:20
          },
          verdict:{
            pass:true,
            reviewEligible:true
          }
        };
      }
    },
    errorAwareBenchmark:{
      report(){
        return {
          pairedRows:180,
          delta:{
            brier:0.012,
            logLoss:0.026
          },
          verdict:{
            status:
              'ERROR_AWARE_CHALLENGER_WINS',
            reviewEligible:true
          }
        };
      }
    },
    outcomeCalibration:{
      status(){
        return {
          targetStatus:
            'CALIBRATION_MISALIGNED',
          targetEcePct:14
        };
      }
    },
    driftRegime:{
      status(){
        return {
          drift:{
            status:'DRIFT'
          }
        };
      }
    }
  }).evaluate();

assert.equal(
  blocked.status,
  'POLICY_REVIEW_BLOCKED'
);

assert.equal(
  blocked.candidateForManualReview,
  false
);

assert.ok(
  blocked.blockers.includes(
    'CALIBRATION_HEALTH'
  )
);

assert.ok(
  blocked.blockers.includes(
    'DRIFT_HEALTH'
  )
);

const source=
  fs.readFileSync(
    'src/shadow-policy-review-gate-v23_22.mjs',
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
  /createShadowPolicyReviewGateV23_22/
);

assert.match(
  shadow,
  /policyReviewGateStatus/
);

assert.match(
  shadow,
  /evaluatePolicyReviewGate/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/policy-review/
);

assert.doesNotMatch(
  app,
  /\/api\/owner\/intelligence\/policy-review\/apply/
);

assert.match(
  html,
  /id="policyReviewStatus"/
);

assert.match(
  js,
  /loadPolicyReview/
);

console.log(
  'shadow policy review gate v23.22 ok'
);
