// MEMEFLOW_V24_PROBATION_EVIDENCE_GATE_V24_2
const MIN_DIRECTIONAL=100;
const MIN_NEGATIVE=40;
const MIN_POSITIVE=20;
const MIN_SHADOW_INTERVENTIONS=50;
const MIN_RESOLUTION_RATE_PCT=75;
const MIN_POINT_NEGATIVE_PRECISION_PCT=65;
const MIN_WILSON_NEGATIVE_PRECISION_PCT=55;
const MAX_POSITIVE_OPPORTUNITY_COST_PCT=35;

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

function pct(num,den){
  if(!(den>0))return null;
  return round(num/den*100,2);
}

function wilsonLower95(success,total){
  if(!(total>0))return null;
  const z=1.959963984540054;
  const p=success/total;
  const z2=z*z;
  const centre=p+z2/(2*total);
  const spread=z*Math.sqrt((p*(1-p)+z2/(4*total))/total);
  const denom=1+z2/total;
  return round(Math.max(0,(centre-spread)/denom)*100,2);
}

function gate(id,label,pass,actual,required,kind='QUALITY'){
  return {id,label,kind,pass:pass===true,actual:actual??null,required};
}

export function createV24ProbationEvidenceGateV24_2({
  telemetryProvider=null,
  readinessProvider=null,
  bridgeStatusProvider=null
}={}){
  let evaluations=0;
  let reviewEligibleCount=0;
  let errors=0;
  let last=null;

  function evaluate(){
    try{
      const telemetry=
        typeof telemetryProvider==='function'?telemetryProvider():null;
      const readiness=
        typeof readinessProvider==='function'?readinessProvider():null;
      const bridge=
        typeof bridgeStatusProvider==='function'?bridgeStatusProvider():null;

      const sample=telemetry?.sample||{};
      const impact=telemetry?.impact||{};
      const probation=telemetry?.probation||{};

      const directional=Number(sample?.directional||0);
      const negative=Number(sample?.negativeOutcomes||0);
      const positive=Number(sample?.positiveOutcomes||0);
      const resolved=Number(sample?.resolved||0);
      const pending=Number(sample?.pending||0);
      const shadowInterventions=Number(sample?.shadowInterventions||0);

      const resolutionRate=pct(resolved,resolved+pending);
      const pointPrecision=finite(impact?.blockedNegativePrecisionPct);
      const opportunityCost=finite(impact?.positiveOpportunityCostPct);
      const wilsonLower=wilsonLower95(negative,directional);

      const architectureFrozen=
        readiness?.architecture?.structuralReady===true;
      const priorActivationEligible=
        readiness?.v24?.controlledActivationEligible===true;

      const bridgeMode=String(bridge?.mode||'OFF').toUpperCase();
      const killSwitch=bridge?.killSwitch===true;
      const alreadyEnforcing=
        bridgeMode==='ENFORCE' && killSwitch!==true;

      const gates=[
        gate('V23_ARCHITECTURE_FROZEN','V23 architecture frozen',
          architectureFrozen,architectureFrozen?'YES':'NO','YES','CHAIN'),
        gate('V23_EVIDENCE_READY','V23 controlled activation evidence ready',
          priorActivationEligible,priorActivationEligible?'YES':'NO','YES','CHAIN'),
        gate('V24_1_BASE_EVIDENCE','V24.1 base probation evidence ready',
          probation?.evidenceReady===true,probation?.verdict||'UNKNOWN',
          'EVIDENCE_READY_FOR_OWNER_REVIEW','CHAIN'),
        gate('DIRECTIONAL_SAMPLE','Resolved directional outcomes',
          directional>=MIN_DIRECTIONAL,directional,`>=${MIN_DIRECTIONAL}`,'SAMPLE'),
        gate('NEGATIVE_SAMPLE','Negative outcomes',
          negative>=MIN_NEGATIVE,negative,`>=${MIN_NEGATIVE}`,'SAMPLE'),
        gate('POSITIVE_SAMPLE','Positive outcomes',
          positive>=MIN_POSITIVE,positive,`>=${MIN_POSITIVE}`,'SAMPLE'),
        gate('SHADOW_PROBATION_SAMPLE','Shadow-mode interventions',
          shadowInterventions>=MIN_SHADOW_INTERVENTIONS,shadowInterventions,
          `>=${MIN_SHADOW_INTERVENTIONS}`,'SAMPLE'),
        gate('RESOLUTION_RATE','Outcome resolution rate',
          resolutionRate!==null&&resolutionRate>=MIN_RESOLUTION_RATE_PCT,
          resolutionRate,`>=${MIN_RESOLUTION_RATE_PCT}%`),
        gate('POINT_NEGATIVE_PRECISION','Blocked-negative precision',
          pointPrecision!==null&&pointPrecision>=MIN_POINT_NEGATIVE_PRECISION_PCT,
          pointPrecision,`>=${MIN_POINT_NEGATIVE_PRECISION_PCT}%`),
        gate('WILSON_NEGATIVE_PRECISION',
          '95% lower bound on blocked-negative precision',
          wilsonLower!==null&&wilsonLower>=MIN_WILSON_NEGATIVE_PRECISION_PCT,
          wilsonLower,`>=${MIN_WILSON_NEGATIVE_PRECISION_PCT}%`),
        gate('POSITIVE_OPPORTUNITY_COST','Positive opportunity cost',
          opportunityCost!==null&&opportunityCost<=MAX_POSITIVE_OPPORTUNITY_COST_PCT,
          opportunityCost,`<=${MAX_POSITIVE_OPPORTUNITY_COST_PCT}%`),
        gate('NOT_ALREADY_ENFORCING','Probation review happens before active ENFORCE',
          !alreadyEnforcing,alreadyEnforcing?'ENFORCE ACTIVE':bridgeMode,
          'not active ENFORCE','SAFETY')
      ];

      const failed=gates.filter(row=>row.pass!==true);
      const blockers=failed.map(row=>row.id);

      const sampleBuilding=
        directional<MIN_DIRECTIONAL ||
        negative<MIN_NEGATIVE ||
        positive<MIN_POSITIVE ||
        shadowInterventions<MIN_SHADOW_INTERVENTIONS;

      let status='V24_PROBATION_REVIEW_BLOCKED';
      let candidateForManualEnforceReview=false;

      if(alreadyEnforcing){
        status='V24_ENFORCE_ALREADY_ACTIVE_REVIEW_REQUIRED';
      }else if(failed.length===0){
        status='V24_CANDIDATE_FOR_MANUAL_ENFORCE_REVIEW';
        candidateForManualEnforceReview=true;
      }else if(sampleBuilding){
        status='V24_PROBATION_EVIDENCE_BUILDING';
      }

      const result={
        version:'MEMEFLOW_V24_PROBATION_EVIDENCE_GATE_V24_2',
        readOnly:true,
        authority:'OWNER_REVIEW_READINESS_ONLY',
        status,
        candidateForManualEnforceReview,
        bridge:{mode:bridgeMode,killSwitch,alreadyEnforcing},
        sample:{
          directional,negative,positive,resolved,pending,shadowInterventions,
          enforcedInterventions:Number(sample?.enforcedInterventions||0),
          resolutionRatePct:resolutionRate
        },
        impact:{
          blockedNegativePrecisionPct:pointPrecision,
          blockedNegativePrecisionWilsonLower95Pct:wilsonLower,
          positiveOpportunityCostPct:opportunityCost,
          affectedRatePct:finite(impact?.affectedRatePct),
          preventedNegativeCount:Number(impact?.preventedNegativeCount||0),
          missedPositiveCount:Number(impact?.missedPositiveCount||0)
        },
        gates,
        blockers,
        reviewPacket:{
          recommendation:candidateForManualEnforceReview
            ?'MANUAL_ENFORCE_REVIEW_ALLOWED'
            :'DO_NOT_ENABLE_ENFORCE_YET',
          automaticModeChange:false,
          livePolicyChanged:false,
          nextAction:candidateForManualEnforceReview
            ?'OWNER_REVIEW_AND_SEPARATE_CONTROLLED_ACTIVATION_STEP'
            :'KEEP_SHADOW_PROBATION_RUNNING_OR_FIX_BLOCKERS'
        },
        controls:{
          readOnly:true,
          applicationAllowed:false,
          modeMutation:false,
          thresholdMutation:false,
          automaticPromotion:false,
          scoreMutation:false,
          stateMutation:false,
          settingsMutation:false,
          buySellMutation:false,
          forecastMutation:false,
          executeTrade:false
        }
      };

      evaluations++;
      if(candidateForManualEnforceReview)reviewEligibleCount++;
      last=result;
      return result;
    }catch(error){
      errors++;
      const result={
        version:'MEMEFLOW_V24_PROBATION_EVIDENCE_GATE_V24_2',
        readOnly:true,
        authority:'OWNER_REVIEW_READINESS_ONLY',
        status:'V24_PROBATION_GATE_ERROR',
        candidateForManualEnforceReview:false,
        gates:[],
        blockers:['V24_PROBATION_GATE_ERROR'],
        reviewPacket:{
          recommendation:'DO_NOT_ENABLE_ENFORCE_YET',
          automaticModeChange:false,
          livePolicyChanged:false,
          nextAction:'FIX_V24_2_GATE_ERROR'
        },
        controls:{
          readOnly:true,
          applicationAllowed:false,
          modeMutation:false,
          thresholdMutation:false,
          automaticPromotion:false,
          scoreMutation:false,
          stateMutation:false,
          settingsMutation:false,
          buySellMutation:false,
          forecastMutation:false,
          executeTrade:false
        },
        error:String(error?.message||error||'V24_PROBATION_GATE_ERROR').slice(0,180)
      };
      last=result;
      return result;
    }
  }

  function status(){
    return {
      version:'MEMEFLOW_V24_PROBATION_EVIDENCE_GATE_V24_2',
      readOnly:true,
      authority:'OWNER_REVIEW_READINESS_ONLY',
      evaluations,
      reviewEligibleCount,
      errors,
      policy:{
        minDirectional:MIN_DIRECTIONAL,
        minNegative:MIN_NEGATIVE,
        minPositive:MIN_POSITIVE,
        minShadowInterventions:MIN_SHADOW_INTERVENTIONS,
        minResolutionRatePct:MIN_RESOLUTION_RATE_PCT,
        minPointNegativePrecisionPct:MIN_POINT_NEGATIVE_PRECISION_PCT,
        minWilsonNegativePrecisionPct:MIN_WILSON_NEGATIVE_PRECISION_PCT,
        maxPositiveOpportunityCostPct:MAX_POSITIVE_OPPORTUNITY_COST_PCT
      },
      last:last||evaluate()
    };
  }

  return {evaluate,status};
}
