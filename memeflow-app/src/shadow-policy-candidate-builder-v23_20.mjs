// MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20
//
// SHADOW ONLY.
//
// Converts a VALIDATED V23.19 benchmark win into a concrete,
// reviewable policy candidate for the NEXT simulator stage.
//
// This module does NOT:
// - mutate V22/V23 Score
// - mutate State
// - change BUY/SELL
// - change Settings
// - auto-promote
// - auto-apply
//
// V23.20 only produces a candidate specification plus evidence/gates.

const TARGET_HORIZON_MS=300_000;

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

function candidateMode(report={}){
  const brier=
    finite(report?.delta?.brier)??0;

  const logLoss=
    finite(report?.delta?.logLoss)??0;

  const hc=
    finite(
      report?.delta
        ?.highConfidenceMissRatePct
    );

  if(
    brier>=0.01 &&
    logLoss>=0.02 &&
    hc!==null &&
    hc>=5
  ){
    return 'BALANCED';
  }

  return 'CONSERVATIVE';
}

function policyForMode(mode){
  if(mode==='BALANCED'){
    return {
      minPenaltyPct:10,
      maxAdjustedConfidencePct:55,
      requireMaturePattern:true,
      requirePenaltyApplied:true,
      candidateAction:
        'DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH'
    };
  }

  return {
    minPenaltyPct:15,
    maxAdjustedConfidencePct:50,
    requireMaturePattern:true,
    requirePenaltyApplied:true,
    candidateAction:
      'DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH'
  };
}

function gate(
  id,
  label,
  pass,
  actual,
  required
){
  return {
    id,
    label,
    pass:pass===true,
    actual,
    required
  };
}

export function createShadowPolicyCandidateBuilderV23_20({
  errorAwareBenchmark=null,
  errorPatternLearner=null
}={}){
  let builds=0;
  let readyBuilds=0;
  let errors=0;
  let last=null;

  function build(){
    try{
      const benchmark=
        errorAwareBenchmark
          ?.report?.({
            horizonMs:
              TARGET_HORIZON_MS
          })||{};

      const patterns=
        errorPatternLearner
          ?.patternReport?.({
            horizonMs:
              TARGET_HORIZON_MS,
            limit:100,
            includeImmature:false
          })||{};

      const benchmarkVerdict=
        benchmark?.verdict||{};

      const maturePatterns=
        Number(
          patterns?.maturePatterns||0
        );

      const highRiskPatterns=
        Number(
          patterns?.highRiskPatterns||0
        );

      const gates=[
        gate(
          'BENCHMARK_REVIEW_ELIGIBLE',
          'V23.19 benchmark passed review gate',
          benchmarkVerdict
            ?.reviewEligible===true,
          benchmarkVerdict
            ?.status||'UNKNOWN',
          'ERROR_AWARE_CHALLENGER_WINS'
        ),
        gate(
          'PAIRED_SAMPLE',
          'Paired 5m sample',
          Number(
            benchmark?.pairedRows||0
          )>=100,
          Number(
            benchmark?.pairedRows||0
          ),
          '>=100'
        ),
        gate(
          'POSITIVE_SAMPLE',
          'Positive 5m sample',
          Number(
            benchmark?.positive||0
          )>=20,
          Number(
            benchmark?.positive||0
          ),
          '>=20'
        ),
        gate(
          'NEGATIVE_SAMPLE',
          'Negative 5m sample',
          Number(
            benchmark?.negative||0
          )>=20,
          Number(
            benchmark?.negative||0
          ),
          '>=20'
        ),
        gate(
          'BRIER_EDGE',
          'Brier improvement',
          Number(
            benchmark?.delta?.brier||0
          )>=0.0025,
          round(
            benchmark?.delta?.brier,
            6
          ),
          '>=0.0025'
        ),
        gate(
          'LOGLOSS_EDGE',
          'Log-loss improvement',
          Number(
            benchmark?.delta?.logLoss||0
          )>=0.005,
          round(
            benchmark?.delta?.logLoss,
            6
          ),
          '>=0.005'
        ),
        gate(
          'MATURE_ERROR_PATTERN',
          'At least one mature V23.17 pattern',
          maturePatterns>=1,
          maturePatterns,
          '>=1'
        )
      ];

      const blockers=
        gates
          .filter(row=>row.pass!==true)
          .map(row=>row.id);

      const ready=
        blockers.length===0;

      let candidate=null;

      if(ready){
        const mode=
          candidateMode(benchmark);

        const policy=
          policyForMode(mode);

        candidate={
          candidateId:
            `V23_20_ERROR_AWARE_ENTRY_GUARD_${mode}`,
          version:
            'MEMEFLOW_SHADOW_POLICY_CANDIDATE_V23_20',
          shadowOnly:true,
          authority:
            'CANDIDATE_ONLY',
          status:
            'READY_FOR_SHADOW_SIMULATION',
          mode,
          objective:
            'REDUCE_ERROR_AWARE_FALSE_CONFIDENCE_WITHOUT_CHANGING_LIVE_AUTHORITY',
          scope:
            'PRE_OPEN_SHADOW_READINESS_ONLY',
          trigger:{
            requireMatureErrorPattern:
              policy.requireMaturePattern,
            requirePenaltyApplied:
              policy.requirePenaltyApplied,
            minPenaltyPct:
              policy.minPenaltyPct,
            maxAdjustedConfidencePct:
              policy.maxAdjustedConfidencePct
          },
          proposedAction:
            policy.candidateAction,
          benchmarkEvidence:{
            pairedRows:
              Number(
                benchmark?.pairedRows||0
              ),
            positive:
              Number(
                benchmark?.positive||0
              ),
            negative:
              Number(
                benchmark?.negative||0
              ),
            brierDelta:
              round(
                benchmark?.delta?.brier,
                6
              ),
            logLossDelta:
              round(
                benchmark?.delta?.logLoss,
                6
              ),
            accuracyDeltaPct:
              round(
                benchmark?.delta?.accuracyPct,
                2
              ),
            eceDeltaPct:
              round(
                benchmark?.delta?.ecePct,
                2
              ),
            highConfidenceMissRateDeltaPct:
              round(
                benchmark?.delta
                  ?.highConfidenceMissRatePct,
                2
              ),
            pairedWins:
              benchmark?.pairedWins||null
          },
          patternEvidence:{
            maturePatterns,
            highRiskPatterns,
            topPatterns:
              Array.isArray(patterns?.patterns)
                ? patterns.patterns
                    .slice(0,5)
                    .map(row=>({
                      patternId:
                        row?.patternId||null,
                      tags:
                        row?.tags||[],
                      support:
                        row?.support??0,
                      missLift:
                        row?.missLift??null,
                      severity:
                        row?.severity||'WATCH'
                    }))
                : []
          },
          simulatorRequirements:{
            nextStage:
              'V23_21_SHADOW_POLICY_SIMULATOR',
            compareAgainst:
              'CURRENT_V22_LIFECYCLE',
            sameFrozenAnchors:true,
            sameCompletedOutcomes:true,
            reportFPFN:true,
            reportMissedPositiveOpportunity:true,
            reportAffectedRate:true,
            reportBrierAndLogLoss:true
          },
          controls:{
            applicationAllowed:false,
            automaticPromotion:false,
            ownerApprovalRequired:true,
            simulationRequired:true,
            scoreMutation:false,
            stateMutation:false,
            buySellMutation:false,
            settingsMutation:false
          },
          impactClaim:{
            quantitativePolicyImpactKnown:false,
            reason:
              'V23_19_VALIDATES_ERROR_AWARE_FORECASTING_NOT_THIS_POLICY_RULE; V23_21_SIMULATION_REQUIRED'
          }
        };
      }

      const result={
        version:
          'MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20',
        shadowOnly:true,
        authority:
          'CANDIDATE_ONLY',
        targetHorizonMs:
          TARGET_HORIZON_MS,
        ready,
        status:
          ready
            ? 'CANDIDATE_READY_FOR_SIMULATION'
            : 'CANDIDATE_BLOCKED',
        blockers,
        gates,
        candidate,
        controls:{
          applicationAllowed:false,
          automaticPromotion:false,
          ownerApprovalRequired:true,
          simulationRequired:true,
          scoreMutation:false,
          stateMutation:false,
          buySellMutation:false,
          settingsMutation:false
        }
      };

      builds++;

      if(ready){
        readyBuilds++;
      }

      last=result;

      return result;
    }catch{
      errors++;

      const result={
        version:
          'MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20',
        shadowOnly:true,
        authority:
          'CANDIDATE_ONLY',
        targetHorizonMs:
          TARGET_HORIZON_MS,
        ready:false,
        status:'CANDIDATE_ERROR',
        blockers:['BUILDER_ERROR'],
        gates:[],
        candidate:null,
        controls:{
          applicationAllowed:false,
          automaticPromotion:false,
          ownerApprovalRequired:true,
          simulationRequired:true,
          scoreMutation:false,
          stateMutation:false,
          buySellMutation:false,
          settingsMutation:false
        }
      };

      last=result;
      return result;
    }
  }

  function status(){
    return {
      version:
        'MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20',
      shadowOnly:true,
      authority:
        'CANDIDATE_ONLY',
      targetHorizonMs:
        TARGET_HORIZON_MS,
      builds,
      readyBuilds,
      errors,
      last:
        last||build()
    };
  }

  return {
    build,
    status
  };
}
