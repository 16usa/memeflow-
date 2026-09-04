#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="0ea36fac15c17ad4866ca98d4561b50b40eb1de2"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
MODULE="memeflow-app/src/shadow-policy-review-gate-v23_22.mjs"
TEST="memeflow-app/tests/shadow-policy-review-gate-v23_22.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$MODULE" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW POLICY REVIEW GATE V23.22 ==="

clear_lock(){
  if [[ -e .git/index.lock ]]; then
    active=""

    for proc in /proc/[0-9]*; do
      [[ -r "$proc/comm" ]] || continue
      comm="$(cat "$proc/comm" 2>/dev/null || true)"

      case "$comm" in
        git|git-*)
          cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"

          if [[ "$cwd" == "$ROOT" || "$cwd" == "$ROOT/"* ]]; then
            active="$proc:$comm:$cwd"
            break
          fi
        ;;
      esac
    done

    if [[ -n "$active" ]]; then
      echo "V23.22 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.22 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.22 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.22 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.22 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.22 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.22 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-policy-review-gate-v23-22-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.22 FAILED - RESTORING ==="

    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] &&
        cp "$BACKUP/$f" "$f" ||
        true
    done

    for f in "${NEW_FILES[@]}"; do
      rm -f "$f"
    done

    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true

    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi

  exit "$rc"
}

trap rollback EXIT INT TERM

cat > "$MODULE" <<'EOF_MODULE'
// MEMEFLOW_SHADOW_POLICY_REVIEW_GATE_V23_22
//
// SHADOW ONLY.
//
// Final review-readiness gate for the V23.20 -> V23.21 policy path.
// It combines candidate readiness, simulator impact, benchmark evidence,
// calibration health and drift health into ONE owner-readable decision.
//
// This gate can only say:
//   keep building evidence
//   probation / blocked
//   candidate for MANUAL review
//
// It can NEVER:
// - apply a policy
// - mutate V22/V23 Score or State
// - mutate Settings
// - open/close positions
// - change BUY/SELL
// - automatically promote anything

const TARGET_HORIZON_MS=300_000;

const MIN_EVALUABLE=150;
const MIN_AFFECTED=20;
const MIN_NEGATIVE_PRECISION_PCT=65;
const MAX_POSITIVE_OPPORTUNITY_COST_PCT=10;
const MIN_NEGATIVE_BLOCK_RATE_PCT=18;
const MIN_NET_PROTECTION=5;
const MIN_POSITIVE_PRESERVATION_PCT=90;
const MAX_AFFECTED_RATE_PCT=35;
const MIN_BRIER_EDGE=0.005;
const MIN_LOGLOSS_EDGE=0.01;
const MAX_ECE_PCT=10;

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const round=(value,digits=2)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

const up=value=>
  String(value||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

function gate(
  id,
  label,
  pass,
  actual,
  required,
  kind='QUALITY'
){
  return {
    id,
    label,
    kind,
    pass:pass===true,
    actual:actual??null,
    required
  };
}

export function createShadowPolicyReviewGateV23_22({
  policyCandidateBuilder=null,
  policySimulator=null,
  errorAwareBenchmark=null,
  outcomeCalibration=null,
  driftRegime=null
}={}){
  let evaluations=0;
  let reviewEligibleCount=0;
  let errors=0;
  let last=null;

  function evaluate(){
    try{
      const candidateResult=
        policyCandidateBuilder
          ?.build?.()||{};

      const simulation=
        policySimulator
          ?.simulate?.()||{};

      const benchmark=
        errorAwareBenchmark
          ?.report?.({
            horizonMs:
              TARGET_HORIZON_MS
          })||{};

      const calibrationStatus=
        outcomeCalibration
          ?.status?.()||{};

      const driftStatus=
        driftRegime
          ?.status?.()||{};

      const candidate=
        candidateResult?.candidate||null;

      const metrics=
        simulation?.metrics||{};

      const candidateId=
        candidate?.candidateId||null;

      const simulationCandidateId=
        simulation?.candidateId||null;

      const benchmarkVerdict=
        up(
          benchmark?.verdict?.status
        );

      const calibrationHealth=
        up(
          calibrationStatus?.targetStatus
        );

      const calibrationEce=
        finite(
          calibrationStatus?.targetEcePct
        );

      const driftHealth=
        up(
          driftStatus?.drift?.status
        );

      const brierEdge=
        finite(
          benchmark?.delta?.brier
        );

      const logLossEdge=
        finite(
          benchmark?.delta?.logLoss
        );

      const gates=[
        gate(
          'V23_20_CANDIDATE_READY',
          'V23.20 policy candidate ready',
          candidateResult?.ready===true &&
          Boolean(candidate),
          candidateResult?.status||'UNKNOWN',
          'CANDIDATE_READY_FOR_SIMULATION',
          'CHAIN'
        ),
        gate(
          'V23_21_SIMULATION_PASS',
          'V23.21 simulation review gate',
          simulation?.verdict
            ?.reviewEligible===true &&
          simulation?.verdict?.pass===true,
          simulation?.status||'UNKNOWN',
          'SIMULATION_PASSES_REVIEW_GATE',
          'CHAIN'
        ),
        gate(
          'CANDIDATE_IDENTITY',
          'Candidate identity is unchanged',
          Boolean(candidateId) &&
          candidateId===simulationCandidateId,
          `${candidateId||'NONE'} / ${simulationCandidateId||'NONE'}`,
          'same candidate id',
          'CHAIN'
        ),
        gate(
          'V23_19_BENCHMARK_WIN',
          'V23.19 benchmark remains review eligible',
          benchmark?.verdict
            ?.reviewEligible===true &&
          benchmarkVerdict===
            'ERROR_AWARE_CHALLENGER_WINS',
          benchmarkVerdict,
          'ERROR_AWARE_CHALLENGER_WINS',
          'CHAIN'
        ),
        gate(
          'EVALUABLE_SAMPLE',
          'Policy-evaluable 5m rows',
          Number(
            metrics?.evaluableRows||0
          )>=MIN_EVALUABLE,
          Number(
            metrics?.evaluableRows||0
          ),
          `>=${MIN_EVALUABLE}`,
          'SAMPLE'
        ),
        gate(
          'AFFECTED_SAMPLE',
          'Affected policy rows',
          Number(
            metrics?.affectedRows||0
          )>=MIN_AFFECTED,
          Number(
            metrics?.affectedRows||0
          ),
          `>=${MIN_AFFECTED}`,
          'SAMPLE'
        ),
        gate(
          'NEGATIVE_PRECISION',
          'Blocked-row negative precision',
          Number(
            metrics?.negativePrecisionPct||0
          )>=MIN_NEGATIVE_PRECISION_PCT,
          round(
            metrics?.negativePrecisionPct,
            2
          ),
          `>=${MIN_NEGATIVE_PRECISION_PCT}%`
        ),
        gate(
          'POSITIVE_OPPORTUNITY_COST',
          'Positive opportunity cost',
          finite(
            metrics?.positiveOpportunityCostPct
          )!==null &&
          Number(
            metrics?.positiveOpportunityCostPct
          )<=
            MAX_POSITIVE_OPPORTUNITY_COST_PCT,
          round(
            metrics?.positiveOpportunityCostPct,
            2
          ),
          `<=${MAX_POSITIVE_OPPORTUNITY_COST_PCT}%`
        ),
        gate(
          'NEGATIVE_BLOCK_RATE',
          'Negative outcomes intercepted',
          Number(
            metrics?.negativeBlockRatePct||0
          )>=MIN_NEGATIVE_BLOCK_RATE_PCT,
          round(
            metrics?.negativeBlockRatePct,
            2
          ),
          `>=${MIN_NEGATIVE_BLOCK_RATE_PCT}%`
        ),
        gate(
          'NET_PROTECTION',
          'Net protected minus missed',
          Number(
            metrics?.netProtectedMinusMissed||0
          )>=MIN_NET_PROTECTION,
          Number(
            metrics?.netProtectedMinusMissed||0
          ),
          `>=${MIN_NET_PROTECTION}`
        ),
        gate(
          'POSITIVE_PRESERVATION',
          'Positive opportunity preservation',
          Number(
            metrics?.positivePreservationPct||0
          )>=MIN_POSITIVE_PRESERVATION_PCT,
          round(
            metrics?.positivePreservationPct,
            2
          ),
          `>=${MIN_POSITIVE_PRESERVATION_PCT}%`
        ),
        gate(
          'AFFECTED_RATE_CAP',
          'Policy breadth remains bounded',
          finite(
            metrics?.affectedRatePct
          )!==null &&
          Number(
            metrics?.affectedRatePct
          )<=MAX_AFFECTED_RATE_PCT,
          round(
            metrics?.affectedRatePct,
            2
          ),
          `<=${MAX_AFFECTED_RATE_PCT}%`
        ),
        gate(
          'BRIER_EDGE',
          'Forecast Brier edge remains meaningful',
          brierEdge!==null &&
          brierEdge>=MIN_BRIER_EDGE,
          round(
            brierEdge,
            6
          ),
          `>=${MIN_BRIER_EDGE}`
        ),
        gate(
          'LOGLOSS_EDGE',
          'Forecast log-loss edge remains meaningful',
          logLossEdge!==null &&
          logLossEdge>=MIN_LOGLOSS_EDGE,
          round(
            logLossEdge,
            6
          ),
          `>=${MIN_LOGLOSS_EDGE}`
        ),
        gate(
          'CALIBRATION_HEALTH',
          'Calibration is healthy',
          calibrationHealth===
            'CALIBRATION_HEALTHY',
          calibrationHealth,
          'CALIBRATION_HEALTHY',
          'HEALTH'
        ),
        gate(
          'CALIBRATION_ECE',
          'Calibration ECE',
          calibrationEce!==null &&
          calibrationEce<=MAX_ECE_PCT,
          round(
            calibrationEce,
            2
          ),
          `<=${MAX_ECE_PCT}%`,
          'HEALTH'
        ),
        gate(
          'DRIFT_HEALTH',
          'No severe model drift',
          ![
            'DRIFT',
            'ERROR'
          ].includes(driftHealth),
          driftHealth,
          'not DRIFT/ERROR',
          'HEALTH'
        )
      ];

      const failed=
        gates.filter(
          row=>row.pass!==true
        );

      const blockers=
        failed.map(
          row=>row.id
        );

      const hardHealthBlock=
        calibrationHealth===
          'CALIBRATION_MISALIGNED' ||
        [
          'DRIFT',
          'ERROR'
        ].includes(driftHealth);

      const evidenceBuilding=
        Number(
          metrics?.evaluableRows||0
        )<MIN_EVALUABLE ||
        Number(
          metrics?.affectedRows||0
        )<MIN_AFFECTED;

      let status=
        'POLICY_REVIEW_LOCKED';

      let candidateForManualReview=false;

      if(hardHealthBlock){
        status=
          'POLICY_REVIEW_BLOCKED';
      }else if(failed.length===0){
        status=
          'POLICY_CANDIDATE_FOR_MANUAL_REVIEW';
        candidateForManualReview=true;
      }else if(evidenceBuilding){
        status=
          'POLICY_REVIEW_EVIDENCE_BUILDING';
      }else if(
        simulation?.verdict
          ?.reviewEligible===true
      ){
        status=
          'POLICY_REVIEW_PROBATION';
      }

      const result={
        version:
          'MEMEFLOW_SHADOW_POLICY_REVIEW_GATE_V23_22',
        shadowOnly:true,
        authority:
          'MANUAL_REVIEW_READINESS_ONLY',
        targetHorizonMs:
          TARGET_HORIZON_MS,
        status,
        candidateForManualReview,
        automaticPromotion:false,
        applicationAllowed:false,
        ownerApprovalRequired:true,
        candidate:{
          candidateId,
          mode:
            candidate?.mode||null,
          proposedAction:
            candidate?.proposedAction||null,
          trigger:
            candidate?.trigger||null
        },
        simulation:{
          status:
            simulation?.status||'UNKNOWN',
          verdict:
            simulation?.verdict||null,
          metrics:
            metrics||null
        },
        benchmark:{
          verdict:
            benchmarkVerdict,
          pairedRows:
            Number(
              benchmark?.pairedRows||0
            ),
          brierDelta:
            round(
              brierEdge,
              6
            ),
          logLossDelta:
            round(
              logLossEdge,
              6
            ),
          highConfidenceMissRateDeltaPct:
            round(
              benchmark?.delta
                ?.highConfidenceMissRatePct,
              2
            )
        },
        calibration:{
          status:
            calibrationHealth,
          ecePct:
            round(
              calibrationEce,
              2
            )
        },
        drift:{
          status:
            driftHealth
        },
        gates,
        blockers,
        reviewPacket:{
          recommendation:
            candidateForManualReview
              ? 'MANUAL_REVIEW_ALLOWED'
              : 'DO_NOT_REVIEW_FOR_APPLICATION_YET',
          evidenceFrozen:true,
          livePolicyChanged:false,
          nextAction:
            candidateForManualReview
              ? 'OWNER_REVIEW_ONLY_NO_APPLY_ENDPOINT'
              : 'KEEP_COLLECTING_OR_FIX_BLOCKERS',
          rollbackPlan:
            'NO_LIVE_CHANGE_EXISTS; ANY_FUTURE_APPLICATION_MUST_BE_SEPARATELY_VERSIONED_AND_REVERSIBLE'
        },
        controls:{
          automaticPromotion:false,
          applicationAllowed:false,
          applyEndpointExists:false,
          ownerApprovalRequired:true,
          scoreMutation:false,
          stateMutation:false,
          settingsMutation:false,
          buySellMutation:false,
          forecastMutation:false
        }
      };

      evaluations++;

      if(candidateForManualReview){
        reviewEligibleCount++;
      }

      last=result;
      return result;
    }catch{
      errors++;

      const result={
        version:
          'MEMEFLOW_SHADOW_POLICY_REVIEW_GATE_V23_22',
        shadowOnly:true,
        authority:
          'MANUAL_REVIEW_READINESS_ONLY',
        targetHorizonMs:
          TARGET_HORIZON_MS,
        status:
          'POLICY_REVIEW_GATE_ERROR',
        candidateForManualReview:false,
        automaticPromotion:false,
        applicationAllowed:false,
        ownerApprovalRequired:true,
        candidate:null,
        simulation:null,
        benchmark:null,
        calibration:null,
        drift:null,
        gates:[],
        blockers:[
          'POLICY_REVIEW_GATE_ERROR'
        ],
        reviewPacket:{
          recommendation:
            'DO_NOT_REVIEW_FOR_APPLICATION_YET',
          evidenceFrozen:true,
          livePolicyChanged:false,
          nextAction:
            'FIX_REVIEW_GATE_ERROR',
          rollbackPlan:
            'NO_LIVE_CHANGE_EXISTS'
        },
        controls:{
          automaticPromotion:false,
          applicationAllowed:false,
          applyEndpointExists:false,
          ownerApprovalRequired:true,
          scoreMutation:false,
          stateMutation:false,
          settingsMutation:false,
          buySellMutation:false,
          forecastMutation:false
        }
      };

      last=result;
      return result;
    }
  }

  function status(){
    return {
      version:
        'MEMEFLOW_SHADOW_POLICY_REVIEW_GATE_V23_22',
      shadowOnly:true,
      authority:
        'MANUAL_REVIEW_READINESS_ONLY',
      evaluations,
      reviewEligibleCount,
      errors,
      policy:{
        minEvaluable:
          MIN_EVALUABLE,
        minAffected:
          MIN_AFFECTED,
        minNegativePrecisionPct:
          MIN_NEGATIVE_PRECISION_PCT,
        maxPositiveOpportunityCostPct:
          MAX_POSITIVE_OPPORTUNITY_COST_PCT,
        minNegativeBlockRatePct:
          MIN_NEGATIVE_BLOCK_RATE_PCT,
        minNetProtection:
          MIN_NET_PROTECTION,
        minPositivePreservationPct:
          MIN_POSITIVE_PRESERVATION_PCT,
        maxAffectedRatePct:
          MAX_AFFECTED_RATE_PCT,
        minBrierEdge:
          MIN_BRIER_EDGE,
        minLogLossEdge:
          MIN_LOGLOSS_EDGE,
        maxEcePct:
          MAX_ECE_PCT,
        manualReviewRequired:true,
        automaticPromotion:false,
        applicationAllowed:false
      },
      last:
        last||evaluate()
    };
  }

  return {
    evaluate,
    status
  };
}

EOF_MODULE

cat > "$TEST" <<'EOF_TEST'
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

EOF_TEST

python3 - <<'PY'
from pathlib import Path

sp=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
ap=Path("memeflow-app/app-server.mjs")
hp=Path("memeflow-app/owner-intelligence.html")
jp=Path("memeflow-app/owner-intelligence.js")
cp=Path("memeflow-app/owner-intelligence.css")

s=sp.read_text(encoding="utf-8")
a=ap.read_text(encoding="utf-8")
h=hp.read_text(encoding="utf-8")
j=jp.read_text(encoding="utf-8")
c=cp.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(
            f"V23.22 REFUSED: {label}: expected 1 exact match, got {n}"
        )
    return text.replace(old,new,1)

old="""import {
  createShadowPolicySimulatorV23_21
} from './shadow-policy-simulator-v23_21.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowPolicyReviewGateV23_22
} from './shadow-policy-review-gate-v23_22.mjs';""",
    "review gate import"
)

old="""  const shadowPolicySimulator=
    createShadowPolicySimulatorV23_21({
      policyCandidateBuilder:
        shadowPolicyCandidateBuilder,
      errorAwareBenchmark:
        shadowErrorAwareBenchmark
    });"""

s=once(
    s,
    old,
    old+"""

  const shadowPolicyReviewGate=
    createShadowPolicyReviewGateV23_22({
      policyCandidateBuilder:
        shadowPolicyCandidateBuilder,
      policySimulator:
        shadowPolicySimulator,
      errorAwareBenchmark:
        shadowErrorAwareBenchmark,
      outcomeCalibration:
        shadowOutcomeCalibration,
      driftRegime:
        shadowDriftRegime
    });""",
    "review gate construction"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_21'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_22'",
    "network version"
)

old="""      shadowPolicyCandidateBuilder:shadowPolicyCandidateBuilder.status(),
      shadowPolicySimulator:shadowPolicySimulator.status()
"""

s=once(
    s,
    old,
    """      shadowPolicyCandidateBuilder:shadowPolicyCandidateBuilder.status(),
      shadowPolicySimulator:shadowPolicySimulator.status(),
      shadowPolicyReviewGate:shadowPolicyReviewGate.status()
""",
    "review gate status"
)

old="""    runPolicySimulation:
      ()=>shadowPolicySimulator.simulate(),
    status
"""

s=once(
    s,
    old,
    """    runPolicySimulation:
      ()=>shadowPolicySimulator.simulate(),
    policyReviewGateStatus:
      ()=>shadowPolicyReviewGate.status(),
    evaluatePolicyReviewGate:
      ()=>shadowPolicyReviewGate.evaluate(),
    status
""",
    "review gate API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_SHADOW_POLICY_REVIEW_GATE_MONITOR_V23_22
 * Owner-only, read-only review readiness. No apply route exists.
 */
 if(
   url.pathname==='/api/owner/intelligence/policy-review' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const result=
     tokenIntelligenceShadowV23
       .evaluatePolicyReviewGate();

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     manualReviewReadinessOnly:true,
     applicationAllowed:false,
     automaticPromotion:false,
     applyEndpointExists:false,
     result
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "review gate owner route"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      <!-- MEMEFLOW_SHADOW_POLICY_REVIEW_GATE_V23_22_UI -->
      <section
        id="policyReviewMonitor"
        class="oi-panel oi-policy-review"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              FINAL READINESS · MANUAL REVIEW ONLY
            </span>
            <h2>V23.22 Policy Review Gate</h2>
            <p>
              Combines the V23.20 candidate, V23.21 simulation,
              V23.19 forecast benchmark, calibration and drift into
              one final owner review-readiness verdict. There is no
              apply endpoint and nothing can auto-promote.
            </p>
          </div>

          <span
            id="policyReviewStatus"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>EVALUABLE</span>
            <strong id="policyReviewEvaluable">—</strong>
            <small>review gate target 150</small>
          </article>

          <article class="oi-stat">
            <span>AFFECTED</span>
            <strong id="policyReviewAffected">—</strong>
            <small>review gate target 20</small>
          </article>

          <article class="oi-stat">
            <span>NEG PRECISION</span>
            <strong id="policyReviewPrecision">—</strong>
            <small>target ≥65%</small>
          </article>

          <article class="oi-stat">
            <span>OPPORTUNITY COST</span>
            <strong id="policyReviewOpportunityCost">—</strong>
            <small>target ≤10%</small>
          </article>
        </div>

        <div class="oi-grid oi-grid-2">
          <div>
            <h3>Final gates</h3>
            <div
              id="policyReviewGates"
              class="oi-promotion-checks"
            ></div>
          </div>

          <div>
            <h3>Review packet</h3>
            <div
              id="policyReviewPacket"
              class="oi-list"
            ></div>
          </div>
        </div>

        <div
          id="policyReviewVerdict"
          class="oi-promotion-blocker"
          data-state="blocked"
        >
          Not eligible for manual policy review yet.
        </div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "review gate UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

js_block=r"""/* MEMEFLOW_SHADOW_POLICY_REVIEW_GATE_V23_22_UI_JS */
function renderPolicyReview(payload={}){
  const result=payload?.result||{};
  const metrics=
    result?.simulation?.metrics||{};
  const gates=
    Array.isArray(result?.gates)
      ? result.gates
      : [];

  const badge=$('policyReviewStatus');

  if(badge){
    badge.className=
      'oi-ai-status '+
      (
        result?.candidateForManualReview===true
          ? 'online'
          : (
              result?.status==='POLICY_REVIEW_BLOCKED'
                ? 'offline'
                : ''
            )
      );

    badge.textContent=
      String(
        result?.status||'UNKNOWN'
      ).replaceAll('_',' ');
  }

  $('policyReviewEvaluable').textContent=
    num(metrics?.evaluableRows,0);

  $('policyReviewAffected').textContent=
    num(metrics?.affectedRows,0);

  $('policyReviewPrecision').textContent=
    pct(metrics?.negativePrecisionPct);

  $('policyReviewOpportunityCost').textContent=
    pct(metrics?.positiveOpportunityCostPct);

  $('policyReviewGates').innerHTML=
    gates.length
      ? gates.map(row=>`
          <div class="oi-promotion-check ${row?.pass===true?'pass':'fail'}">
            <span class="oi-promotion-check-dot"></span>
            <div>
              <strong>${esc(row?.label||row?.id||'Gate')}</strong>
              <small>
                ${esc(row?.kind||'QUALITY')}
                · actual ${esc(String(row?.actual??'—'))}
                · required ${esc(String(row?.required??'—'))}
              </small>
            </div>
          </div>
        `).join('')
      : `
          <div class="oi-empty">
            Final review gates unavailable.
          </div>
        `;

  const packet=$('policyReviewPacket');

  if(packet){
    packet.innerHTML=[
      [
        'Candidate',
        result?.candidate?.candidateId||'—'
      ],
      [
        'Mode',
        result?.candidate?.mode||'—'
      ],
      [
        'Recommendation',
        String(
          result?.reviewPacket
            ?.recommendation||'—'
        ).replaceAll('_',' ')
      ],
      [
        'Calibration',
        result?.calibration?.status||'—'
      ],
      [
        'Calibration ECE',
        pct(result?.calibration?.ecePct)
      ],
      [
        'Drift',
        result?.drift?.status||'—'
      ],
      [
        'Brier Δ',
        num(
          result?.benchmark
            ?.brierDelta,
          6
        )
      ],
      [
        'Log-loss Δ',
        num(
          result?.benchmark
            ?.logLossDelta,
          6
        )
      ]
    ].map(([name,value])=>`
      <div class="oi-row">
        <span>${esc(name)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `).join('');
  }

  const verdict=$('policyReviewVerdict');

  if(verdict){
    verdict.dataset.state=
      result?.candidateForManualReview===true
        ? 'ready'
        : 'blocked';

    verdict.textContent=
      result?.candidateForManualReview===true
        ? 'CANDIDATE FOR MANUAL OWNER REVIEW. No live policy changed, no automatic promotion occurred, and no apply endpoint exists.'
        : (
            Array.isArray(result?.blockers) &&
            result.blockers.length
          )
            ? `Blocked: ${result.blockers.join(', ').replaceAll('_',' ')}`
            : 'Not eligible for manual policy review yet.';
  }
}

async function loadPolicyReview(){
  try{
    const payload=await api(
      '/api/owner/intelligence/policy-review'
    );

    renderPolicyReview(payload);
  }catch(error){
    const badge=$('policyReviewStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const verdict=$('policyReviewVerdict');

    if(verdict){
      verdict.dataset.state='blocked';
      verdict.textContent=
        `Policy review gate unavailable: ${error.message}`;
    }
  }
}

/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

j=once(
    j,
    js_anchor,
    js_block,
    "review gate UI JS"
)

old="""      loadPolicyCandidate(),
      loadPolicySimulation()
    ]);
"""

j=once(
    j,
    old,
    """      loadPolicyCandidate(),
      loadPolicySimulation(),
      loadPolicyReview()
    ]);
""",
    "review gate load"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_SHADOW_POLICY_REVIEW_GATE_V23_22
   ========================================================== */

.oi-policy-review
.oi-grid-2{
  margin-top:12px;
}

.oi-policy-review
.oi-list{
  margin-top:7px;
}

/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

c=once(
    c,
    css_anchor,
    css_block,
    "review gate CSS"
)

cp.write_text(c,encoding="utf-8")

print("V23_22_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/shadow-policy-simulator-v23_21.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-policy-simulator-v23_21.mjs && node tests/shadow-policy-review-gate-v23_22.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.22 REFUSED: package test anchor changed"
    )

if "shadow-policy-review-gate-v23_22.mjs" in s:
    raise SystemExit(
        "V23.22 REFUSED: review gate test already installed"
    )

d["scripts"]["test:core"]=s.replace(
    needle,
    replacement,
    1
)

p.write_text(
    json.dumps(d,indent=2)+"\n",
    encoding="utf-8"
)

print("PACKAGE_TRANSFORM_OK")

PY

python3 - <<'PY'
from pathlib import Path

for name in [
 "memeflow-app/app-server.mjs",
 "memeflow-app/src/token-intelligence-shadow-v23.mjs",
 "memeflow-app/package.json",
 "memeflow-app/owner-intelligence.html",
 "memeflow-app/owner-intelligence.js",
 "memeflow-app/owner-intelligence.css",
 "memeflow-app/src/shadow-policy-review-gate-v23_22.mjs",
 "memeflow-app/tests/shadow-policy-review-gate-v23_22.mjs"
]:
    p=Path(name)

    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_22_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V23.22 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$MODULE"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.22 TARGETED TESTS ==="

(
  cd memeflow-app

  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/wallet-reputation-shadow-v23_2.mjs
  node tests/learning-dataset-shadow-v23_3.mjs
  node tests/shadow-math-brain-v23_4.mjs
  node tests/shadow-model-arena-v23_5.mjs
  node tests/shadow-drift-regime-v23_6.mjs
  node tests/shadow-confidence-governor-v23_7.mjs
  node tests/shadow-token-trajectory-v23_8.mjs
  node tests/shadow-token-pattern-memory-v23_9.mjs
  node tests/shadow-evidence-synthesis-v23_10.mjs
  node tests/shadow-outcome-calibration-v23_11.mjs
  node tests/shadow-champion-benchmark-v23_12.mjs
  node tests/shadow-promotion-gate-v23_13.mjs
  node tests/shadow-promotion-report-v23_14.mjs
  node tests/token-intelligence-scorecard-v23_15.mjs
  node tests/shadow-outcome-review-v23_16.mjs
  node tests/shadow-error-pattern-learner-v23_17.mjs
  node tests/shadow-error-aware-confidence-v23_18.mjs
  node tests/shadow-error-aware-benchmark-v23_19.mjs
  node tests/shadow-policy-candidate-builder-v23_20.mjs
  node tests/shadow-policy-simulator-v23_21.mjs
  node tests/shadow-policy-review-gate-v23_22.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.22 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.22 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
 "memeflow-app/src/shadow-policy-review-gate-v23_22.mjs"
).read_text()

s=Path(
 "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()

a=Path(
 "memeflow-app/app-server.mjs"
).read_text()

h=Path(
 "memeflow-app/owner-intelligence.html"
).read_text()

j=Path(
 "memeflow-app/owner-intelligence.js"
).read_text()

c=Path(
 "memeflow-app/owner-intelligence.css"
).read_text()

p=Path(
 "memeflow-app/package.json"
).read_text()

errors=[]

for x in [
 "MEMEFLOW_SHADOW_POLICY_REVIEW_GATE_V23_22",
 "POLICY_CANDIDATE_FOR_MANUAL_REVIEW",
 "POLICY_REVIEW_EVIDENCE_BUILDING",
 "POLICY_REVIEW_PROBATION",
 "POLICY_REVIEW_BLOCKED",
 "MIN_EVALUABLE=150",
 "MIN_AFFECTED=20",
 "MIN_NEGATIVE_PRECISION_PCT=65",
 "MAX_POSITIVE_OPPORTUNITY_COST_PCT=10",
 "MIN_NEGATIVE_BLOCK_RATE_PCT=18",
 "MIN_NET_PROTECTION=5",
 "MIN_POSITIVE_PRESERVATION_PCT=90",
 "MAX_AFFECTED_RATE_PCT=35",
 "MIN_BRIER_EDGE=0.005",
 "MIN_LOGLOSS_EDGE=0.01",
 "MAX_ECE_PCT=10",
 "applicationAllowed:false",
 "automaticPromotion:false",
 "applyEndpointExists:false"
]:
    if x not in m:
        errors.append("review gate marker missing: "+x)

for x in [
 "from './evaluate.mjs'",
 "openPosition(",
 "closePosition(",
 "setSettings(",
 "tradeEligible",
 "decisionScore"
]:
    if x in m:
        errors.append("forbidden authority: "+x)

for x in [
 "createShadowPolicyReviewGateV23_22",
 "shadowPolicyReviewGate:shadowPolicyReviewGate.status()",
 "policyReviewGateStatus",
 "evaluatePolicyReviewGate",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_22"
]:
    if x not in s:
        errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/policy-review",
 "manualReviewReadinessOnly:true",
 "applicationAllowed:false",
 "automaticPromotion:false",
 "applyEndpointExists:false"
]:
    if x not in a:
        errors.append("route missing: "+x)

if "/api/owner/intelligence/policy-review/apply" in a:
    errors.append("forbidden policy-review apply endpoint exists")

for x in [
 'id="policyReviewStatus"',
 'id="policyReviewEvaluable"',
 'id="policyReviewAffected"',
 'id="policyReviewPrecision"',
 'id="policyReviewOpportunityCost"',
 'id="policyReviewGates"',
 'id="policyReviewPacket"',
 'id="policyReviewVerdict"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "loadPolicyReview",
 "renderPolicyReview",
 "/api/owner/intelligence/policy-review"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

if ".oi-policy-review" not in c:
    errors.append("UI CSS missing")

if "shadow-policy-review-gate-v23_22.mjs" not in p:
    errors.append("V23.22 test missing from package")

for x in [
 "shadowMathBrain.predict",
 "shadowModelArena.predict",
 "shadowDriftRegime.predict",
 "shadowConfidenceGovernor.predict",
 "shadowTokenTrajectory.observe",
 "shadowTokenPatternMemory.predict",
 "shadowEvidenceSynthesis.predict",
 "shadowOutcomeCalibration.predict",
 "shadowChampionBenchmark.recordOutcome",
 "shadowPromotionGate.status",
 "shadowPromotionReport.status",
 "tokenIntelligenceScorecard.status",
 "shadowOutcomeReview.recordOutcome",
 "shadowErrorPatternLearner.observeReview",
 "shadowErrorAwareConfidence.predict",
 "shadowErrorAwareBenchmark.recordOutcome",
 "shadowPolicyCandidateBuilder.build",
 "shadowPolicySimulator.simulate"
]:
    if x not in s:
        errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit(
        "V23_22_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_22_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.22 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|src/token-intelligence-shadow-v23\.mjs|src/shadow-policy-review-gate-v23_22\.mjs|tests/shadow-policy-review-gate-v23_22\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.22 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.22 STAGED ==="

git diff --cached --stat

git commit -m "feat: add shadow policy manual review gate v23.22"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.22 CONTRACT:"
echo "  combines V23.20 candidate + V23.21 simulation + V23.19 benchmark + calibration + drift"
echo "  final gate is stricter than V23.21: >=150 evaluable / >=20 affected"
echo "  negative precision >=65%; positive opportunity cost <=10%"
echo "  negative block rate >=18%; positive preservation >=90%; affected rate <=35%"
echo "  Brier edge >=0.005; log-loss edge >=0.01; ECE <=10%; no DRIFT/ERROR"
echo "  passing means candidateForManualReview=true ONLY"
echo "  no apply endpoint exists"
echo "  applicationAllowed=false; automaticPromotion=false"
echo "  V22 remains the only trading authority"
echo "  no Score/State/Settings/BUY/SELL/forecast mutation"
