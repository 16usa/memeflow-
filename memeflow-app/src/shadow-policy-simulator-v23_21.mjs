// MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21
//
// SHADOW ONLY.
//
// Simulates the V23.20 candidate against completed 5m outcomes already
// stored by V23.19. This is an action-policy simulation, not a forecast
// mutation and not live trading.
//
// Baseline in this simulator:
//   CURRENT_POLICY = do not apply the V23.20 error-aware WATCH guard.
//
// Candidate:
//   if V23.20 trigger matches a completed frozen row,
//   simulate DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH.
//
// IMPORTANT:
// - does not mutate V22 Score/State/Settings/BUY/SELL
// - does not change V23 probability/confidence
// - does not auto-promote or auto-apply
// - quantitative impact is derived only from frozen completed outcomes

const TARGET_HORIZON_MS=300_000;
const MIN_EVALUABLE=100;
const MIN_AFFECTED=10;
const MIN_NEGATIVE_PRECISION_PCT=60;
const MAX_POSITIVE_OPPORTUNITY_COST_PCT=12;
const MIN_NEGATIVE_BLOCK_RATE_PCT=15;

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

function safePct(num,den){
  if(!(den>0))return null;
  return round(num/den*100,2);
}

function candidateTriggerMatches(row={},candidate={}){
  const trigger=candidate?.trigger||{};

  if(
    trigger?.requirePenaltyApplied===true &&
    String(row?.errorAwareStatus||'')
      .toUpperCase()!=='PENALTY_APPLIED'
  ){
    return false;
  }

  if(
    trigger?.requireMatureErrorPattern===true &&
    String(row?.errorAwareStatus||'')
      .toUpperCase()!=='PENALTY_APPLIED'
  ){
    // V23.18 can only emit PENALTY_APPLIED from mature V23.17 matches.
    return false;
  }

  const penalty=
    finite(row?.penaltyPct);

  const adjusted=
    finite(row?.adjustedConfidencePct);

  if(
    penalty===null ||
    adjusted===null
  ){
    return false;
  }

  if(
    penalty<
    Number(trigger?.minPenaltyPct||0)
  ){
    return false;
  }

  if(
    adjusted>
    Number(
      trigger?.maxAdjustedConfidencePct??100
    )
  ){
    return false;
  }

  return true;
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

export function createShadowPolicySimulatorV23_21({
  policyCandidateBuilder=null,
  errorAwareBenchmark=null
}={}){
  let runs=0;
  let passRuns=0;
  let errors=0;
  let last=null;

  function simulate(){
    try{
      const built=
        policyCandidateBuilder
          ?.build?.()||{};

      const candidate=
        built?.candidate||null;

      if(
        built?.ready!==true ||
        !candidate
      ){
        const result={
          version:
            'MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21',
          shadowOnly:true,
          authority:'SIMULATION_ONLY',
          ready:false,
          status:'SIMULATION_BLOCKED',
          blockers:[
            'V23_20_CANDIDATE_NOT_READY'
          ],
          candidateId:null,
          metrics:null,
          gates:[],
          verdict:{
            pass:false,
            reviewEligible:false,
            reason:
              'V23_20_CANDIDATE_NOT_READY'
          },
          controls:{
            applicationAllowed:false,
            automaticPromotion:false,
            scoreMutation:false,
            stateMutation:false,
            settingsMutation:false,
            buySellMutation:false,
            forecastMutation:false
          }
        };

        runs++;
        last=result;
        return result;
      }

      const rows=
        errorAwareBenchmark
          ?.listRows?.({
            horizonMs:
              TARGET_HORIZON_MS,
            limit:5000
          })||[];

      const evaluable=
        rows.filter(
          row=>
            row?.scored===true &&
            ['POSITIVE','NEGATIVE']
              .includes(
                String(
                  row?.classification||''
                ).toUpperCase()
              )
        );

      const positive=
        evaluable.filter(
          row=>
            String(
              row.classification
            ).toUpperCase()==='POSITIVE'
        ).length;

      const negative=
        evaluable.length-positive;

      const affected=
        evaluable.filter(
          row=>
            candidateTriggerMatches(
              row,
              candidate
            )
        );

      const preventedNegative=
        affected.filter(
          row=>
            String(
              row.classification
            ).toUpperCase()==='NEGATIVE'
        ).length;

      const missedPositiveOpportunity=
        affected.length-
        preventedNegative;

      const preservedPositive=
        Math.max(
          0,
          positive-
          missedPositiveOpportunity
        );

      const unblockedNegative=
        Math.max(
          0,
          negative-
          preventedNegative
        );

      const metrics={
        evaluableRows:
          evaluable.length,
        positiveRows:
          positive,
        negativeRows:
          negative,
        affectedRows:
          affected.length,
        affectedRatePct:
          safePct(
            affected.length,
            evaluable.length
          ),
        preventedNegative:
          preventedNegative,
        missedPositiveOpportunity:
          missedPositiveOpportunity,
        negativePrecisionPct:
          safePct(
            preventedNegative,
            affected.length
          ),
        negativeBlockRatePct:
          safePct(
            preventedNegative,
            negative
          ),
        positiveOpportunityCostPct:
          safePct(
            missedPositiveOpportunity,
            positive
          ),
        positivePreservationPct:
          safePct(
            preservedPositive,
            positive
          ),
        preservedPositive,
        unblockedNegative,
        netProtectedMinusMissed:
          preventedNegative-
          missedPositiveOpportunity
      };

      const benchmark=
        errorAwareBenchmark
          ?.report?.({
            horizonMs:
              TARGET_HORIZON_MS
          })||{};

      const gates=[
        gate(
          'EVALUABLE_SAMPLE',
          'Policy-evaluable 5m rows',
          evaluable.length>=
            MIN_EVALUABLE,
          evaluable.length,
          `>=${MIN_EVALUABLE}`
        ),
        gate(
          'AFFECTED_SAMPLE',
          'Candidate affects enough rows',
          affected.length>=
            MIN_AFFECTED,
          affected.length,
          `>=${MIN_AFFECTED}`
        ),
        gate(
          'NEGATIVE_PRECISION',
          'Blocked-row negative precision',
          Number(
            metrics
              .negativePrecisionPct||0
          )>=
            MIN_NEGATIVE_PRECISION_PCT,
          metrics
            .negativePrecisionPct,
          `>=${MIN_NEGATIVE_PRECISION_PCT}%`
        ),
        gate(
          'POSITIVE_OPPORTUNITY_COST',
          'Missed positive opportunity cost',
          metrics
            .positiveOpportunityCostPct!==null &&
          Number(
            metrics
              .positiveOpportunityCostPct
          )<=
            MAX_POSITIVE_OPPORTUNITY_COST_PCT,
          metrics
            .positiveOpportunityCostPct,
          `<=${MAX_POSITIVE_OPPORTUNITY_COST_PCT}%`
        ),
        gate(
          'NEGATIVE_BLOCK_RATE',
          'Negative outcomes intercepted',
          Number(
            metrics
              .negativeBlockRatePct||0
          )>=
            MIN_NEGATIVE_BLOCK_RATE_PCT,
          metrics
            .negativeBlockRatePct,
          `>=${MIN_NEGATIVE_BLOCK_RATE_PCT}%`
        ),
        gate(
          'NET_PROTECTION',
          'Prevented negatives exceed missed positives',
          metrics
            .netProtectedMinusMissed>0,
          metrics
            .netProtectedMinusMissed,
          '>0'
        )
      ];

      const blockers=
        gates
          .filter(row=>row.pass!==true)
          .map(row=>row.id);

      const pass=
        blockers.length===0;

      const result={
        version:
          'MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21',
        shadowOnly:true,
        authority:'SIMULATION_ONLY',
        ready:true,
        status:
          pass
            ? 'SIMULATION_PASSES_REVIEW_GATE'
            : 'SIMULATION_DOES_NOT_PASS',
        candidateId:
          candidate.candidateId||null,
        candidateMode:
          candidate.mode||null,
        proposedAction:
          candidate.proposedAction||null,
        trigger:
          candidate.trigger||null,
        metrics,
        gates,
        blockers,
        forecastReference:{
          note:
            'POLICY_ACTION_METRICS_ARE_SEPARATE_FROM_FORECAST_METRICS',
          rawBrier:
            benchmark?.raw?.meanBrier??null,
          challengerBrier:
            benchmark?.challenger?.meanBrier??null,
          brierDelta:
            benchmark?.delta?.brier??null,
          rawLogLoss:
            benchmark?.raw?.meanLogLoss??null,
          challengerLogLoss:
            benchmark?.challenger?.meanLogLoss??null,
          logLossDelta:
            benchmark?.delta?.logLoss??null
        },
        verdict:{
          pass,
          reviewEligible:pass,
          reason:
            pass
              ? 'POLICY_GUARD_SHOWS_POSITIVE_SHADOW_ACTION_IMPACT'
              : (
                  blockers[0]||
                  'POLICY_SIMULATION_INCONCLUSIVE'
                )
        },
        controls:{
          applicationAllowed:false,
          automaticPromotion:false,
          ownerApprovalRequired:true,
          scoreMutation:false,
          stateMutation:false,
          settingsMutation:false,
          buySellMutation:false,
          forecastMutation:false
        }
      };

      runs++;

      if(pass){
        passRuns++;
      }

      last=result;
      return result;
    }catch{
      errors++;

      const result={
        version:
          'MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21',
        shadowOnly:true,
        authority:'SIMULATION_ONLY',
        ready:false,
        status:'SIMULATION_ERROR',
        blockers:['SIMULATOR_ERROR'],
        candidateId:null,
        metrics:null,
        gates:[],
        verdict:{
          pass:false,
          reviewEligible:false,
          reason:'SIMULATOR_ERROR'
        },
        controls:{
          applicationAllowed:false,
          automaticPromotion:false,
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
        'MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21',
      shadowOnly:true,
      authority:'SIMULATION_ONLY',
      targetHorizonMs:
        TARGET_HORIZON_MS,
      runs,
      passRuns,
      errors,
      requirements:{
        minEvaluable:
          MIN_EVALUABLE,
        minAffected:
          MIN_AFFECTED,
        minNegativePrecisionPct:
          MIN_NEGATIVE_PRECISION_PCT,
        maxPositiveOpportunityCostPct:
          MAX_POSITIVE_OPPORTUNITY_COST_PCT,
        minNegativeBlockRatePct:
          MIN_NEGATIVE_BLOCK_RATE_PCT
      },
      last:
        last||simulate()
    };
  }

  return {
    simulate,
    status
  };
}
