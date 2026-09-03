// MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10
// SHADOW ONLY. No MEMEFLOW Score/State/settings/BUY/SELL authority.
//
// Governor already contains Math Brain / Arena / Regime / Smart Money.
// V23.10 therefore does NOT re-count those sources independently.
// It combines Governor + Pattern Memory, while Trajectory/Risk act only
// as confidence/direction modifiers.

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const clamp=(value,min,max)=>
  Math.max(min,Math.min(max,Number(value)||0));

const round=(value,digits=2)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

const upper=value=>
  String(value||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

function trajectoryModifier(state){
  switch(upper(state)){
    case 'RISING':
      return {probabilityShift:4,confidenceMultiplier:1.08,reason:'TRAJECTORY_RISING'};
    case 'BUILDING':
      return {probabilityShift:2,confidenceMultiplier:1.05,reason:'TRAJECTORY_BUILDING'};
    case 'FADING':
      return {probabilityShift:-5,confidenceMultiplier:0.82,reason:'TRAJECTORY_FADING'};
    case 'CONFLICTED':
      return {probabilityShift:0,confidenceMultiplier:0.55,reason:'TRAJECTORY_CONFLICTED'};
    case 'DRIFTED':
      return {probabilityShift:0,confidenceMultiplier:0.25,reason:'TRAJECTORY_DRIFTED'};
    case 'REGIME_SHIFT':
      return {probabilityShift:0,confidenceMultiplier:0.68,reason:'TRAJECTORY_REGIME_SHIFT'};
    case 'COLD':
      return {probabilityShift:0,confidenceMultiplier:0.72,reason:'TRAJECTORY_COLD'};
    default:
      return {probabilityShift:0,confidenceMultiplier:1,reason:'TRAJECTORY_STABLE'};
  }
}

function dataQualityMultiplier(snapshot={}){
  const completeness=finite(snapshot?.evidence?.dataQuality?.completenessPct);
  if(completeness===null)return 0.80;
  if(completeness>=95)return 1;
  if(completeness>=80)return 0.90;
  if(completeness>=60)return 0.72;
  return 0.50;
}

function coordinationMultiplier(snapshot={}){
  return snapshot?.specialists?.coordination?.suspectedCoordination===true
    ? 0.72
    : 1;
}

function smartMoneyConsistency(snapshot={},probability=null){
  const sm=snapshot?.specialists?.smartMoneyMemory||{};
  const p=finite(sm.weightedPositiveProbabilityPct);
  const confidence=finite(sm.historicalConfidencePct);

  if(sm.reputationReady!==true||p===null||probability===null){
    return {
      available:false,
      probabilityPositivePct:p,
      confidencePct:confidence,
      deltaPct:null,
      multiplier:1,
      reason:'SMART_MONEY_UNAVAILABLE'
    };
  }

  const delta=Math.abs(p-probability);

  return {
    available:true,
    probabilityPositivePct:p,
    confidencePct:confidence,
    deltaPct:delta,
    multiplier:delta>=30?0.70:delta>=20?0.84:1,
    reason:delta>=30
      ? 'SMART_MONEY_MAJOR_CONFLICT'
      : delta>=20
        ? 'SMART_MONEY_CONFLICT'
        : 'SMART_MONEY_ALIGNED'
  };
}

export function createShadowEvidenceSynthesisV23_10(){
  let predictions=0;
  let coldStarts=0;
  let conflicts=0;
  let errors=0;
  const recent=[];

  function remember(row){
    recent.unshift(row);
    if(recent.length>200)recent.length=200;
  }

  function predict(snapshot={},meta={}){
    try{
      const governor=snapshot?.shadowConfidenceGovernor||{};
      const pattern=snapshot?.shadowTokenPattern||{};
      const trajectory=snapshot?.shadowTokenTrajectory||{};

      const governorP=finite(governor.consensusProbabilityPositivePct);
      const governorC=finite(governor.ensembleConfidencePct);

      const governorReady=
        governor.ready===true &&
        governorP!==null &&
        governorC!==null &&
        governorC>0;

      if(!governorReady){
        coldStarts++;

        const cold={
          version:'MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10',
          shadowOnly:true,
          authority:'DIAGNOSTIC_ONLY',
          status:'SYNTHESIS_COLD_START',
          ready:false,
          direction:'UNKNOWN',
          synthesisProbabilityPositivePct:null,
          synthesisConfidencePct:0,
          governorProbabilityPositivePct:governorP,
          governorConfidencePct:governorC??0,
          patternProbabilityPositivePct:null,
          patternConfidencePct:0,
          patternWeightPct:0,
          governorWeightPct:100,
          crossSourceDisagreementPct:null,
          trajectoryState:upper(trajectory.trajectoryState),
          modifiers:[],
          blockers:['GOVERNOR_NOT_READY'],
          mint:meta?.mint||snapshot?.mint||null,
          observedAt:Number(meta?.at||snapshot?.observedAt||Date.now())
        };

        remember(cold);
        return cold;
      }

      const patternP=finite(pattern.patternProbabilityPositivePct);
      const patternC=finite(pattern.matchConfidencePct);

      const patternReady=
        pattern.ready===true &&
        patternP!==null &&
        patternC!==null &&
        Number(pattern.neighbourCount||0)>=3;

      // Pattern overlaps current evidence through its signature, therefore
      // its blend weight is deliberately capped at 35%.
      const patternWeight=patternReady
        ? clamp((patternC/100)*0.35,0,0.35)
        : 0;

      const governorWeight=1-patternWeight;

      let probability=governorP*governorWeight;

      if(patternReady){
        probability+=patternP*patternWeight;
      }

      const crossSourceDisagreement=patternReady
        ? Math.abs(governorP-patternP)
        : null;

      const disagreementMultiplier=
        crossSourceDisagreement===null
          ? 1
          : crossSourceDisagreement>=35
            ? 0.45
            : crossSourceDisagreement>=25
              ? 0.62
              : crossSourceDisagreement>=15
                ? 0.82
                : 1;

      const patternSupportMultiplier=patternReady
        ? 0.90+0.10*clamp(patternC/100,0,1)
        : 0.78;

      const trajectoryEffect=trajectoryModifier(trajectory.trajectoryState);

      probability=clamp(
        probability+trajectoryEffect.probabilityShift,
        0,
        100
      );

      const smartMoney=smartMoneyConsistency(snapshot,probability);

      let confidence=
        governorC *
        patternSupportMultiplier *
        disagreementMultiplier *
        trajectoryEffect.confidenceMultiplier *
        dataQualityMultiplier(snapshot) *
        coordinationMultiplier(snapshot) *
        smartMoney.multiplier;

      const driftStatus=upper(snapshot?.shadowDriftRegime?.driftStatus);

      if(driftStatus==='DRIFT'){
        confidence*=0.25;
      }else if(driftStatus==='WATCH'){
        confidence*=0.65;
      }

      confidence=clamp(confidence,0,100);

      const blockers=[];
      const modifiers=[trajectoryEffect.reason,smartMoney.reason];

      if(!patternReady){
        modifiers.push('PATTERN_NOT_READY_CONFIDENCE_CAP');
      }

      if(crossSourceDisagreement!==null&&crossSourceDisagreement>=25){
        blockers.push('GOVERNOR_PATTERN_CONFLICT');
        conflicts++;
      }

      if(upper(trajectory.trajectoryState)==='CONFLICTED'){
        blockers.push('TRAJECTORY_CONFLICT');
      }

      if(
        upper(trajectory.trajectoryState)==='DRIFTED' ||
        driftStatus==='DRIFT'
      ){
        blockers.push('DRIFT');
      }

      if(snapshot?.specialists?.coordination?.suspectedCoordination===true){
        blockers.push('COORDINATION_RISK');
      }

      const direction=
        probability>=62
          ? 'POSITIVE'
          : probability<=38
            ? 'NEGATIVE'
            : 'NEUTRAL';

      const status=
        blockers.includes('DRIFT')
          ? 'SYNTHESIS_DRIFT_SUPPRESSED'
          : blockers.includes('GOVERNOR_PATTERN_CONFLICT') ||
            blockers.includes('TRAJECTORY_CONFLICT')
            ? 'SYNTHESIS_CONFLICT'
            : confidence>=70&&direction!=='NEUTRAL'
              ? 'SYNTHESIS_HIGH_CONVICTION'
              : confidence>=45
                ? 'SYNTHESIS_MODERATE'
                : 'SYNTHESIS_LOW_CONFIDENCE';

      const result={
        version:'MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        status,
        ready:true,
        direction,
        synthesisProbabilityPositivePct:round(probability,2),
        synthesisConfidencePct:round(confidence,2),
        governorProbabilityPositivePct:round(governorP,2),
        governorConfidencePct:round(governorC,2),
        patternProbabilityPositivePct:patternReady?round(patternP,2):null,
        patternConfidencePct:patternReady?round(patternC,2):0,
        patternWeightPct:round(patternWeight*100,2),
        governorWeightPct:round(governorWeight*100,2),
        crossSourceDisagreementPct:round(crossSourceDisagreement,2),
        trajectoryState:upper(trajectory.trajectoryState),
        driftStatus,
        smartMoneyConsistency:{
          available:smartMoney.available,
          probabilityPositivePct:round(smartMoney.probabilityPositivePct,2),
          confidencePct:round(smartMoney.confidencePct,2),
          deltaPct:round(smartMoney.deltaPct,2)
        },
        modifiers,
        blockers,
        mint:meta?.mint||snapshot?.mint||null,
        observedAt:Number(meta?.at||snapshot?.observedAt||Date.now())
      };

      predictions++;
      remember(result);
      return result;
    }catch{
      errors++;

      const failed={
        version:'MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        status:'SYNTHESIS_ERROR',
        ready:false,
        direction:'UNKNOWN',
        synthesisProbabilityPositivePct:null,
        synthesisConfidencePct:0,
        governorProbabilityPositivePct:null,
        governorConfidencePct:0,
        patternProbabilityPositivePct:null,
        patternConfidencePct:0,
        patternWeightPct:0,
        governorWeightPct:100,
        crossSourceDisagreementPct:null,
        trajectoryState:'UNKNOWN',
        modifiers:[],
        blockers:['SYNTHESIS_ERROR'],
        mint:meta?.mint||snapshot?.mint||null,
        observedAt:Date.now()
      };

      remember(failed);
      return failed;
    }
  }

  function listRecent({limit=50,status=null}={}){
    const safeLimit=Math.max(1,Math.min(200,Number(limit)||50));
    const wanted=status?upper(status):null;

    return recent
      .filter(row=>!wanted||row.status===wanted)
      .slice(0,safeLimit);
  }

  function status(){
    return {
      version:'MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      method:'GOVERNOR_PATTERN_SYNTHESIS_WITH_TEMPORAL_RISK_MODIFIERS',
      doubleCountingGuard:
        'MATH_BRAIN_ARENA_REGIME_SMART_MONEY_NOT_RECOUNTED_OUTSIDE_GOVERNOR',
      patternWeightCapPct:35,
      predictions,
      coldStarts,
      conflicts,
      errors,
      recentPredictions:recent.length
    };
  }

  return {predict,listRecent,status};
}
