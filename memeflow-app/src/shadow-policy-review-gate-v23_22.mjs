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
