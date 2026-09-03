// MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18
//
// SHADOW ONLY.
//
// Applies a diagnostic confidence haircut when the CURRENT token evidence
// matches MATURE historical V23.17 miss associations.
//
// Important:
// - probability is NEVER changed
// - canonical MEMEFLOW Score is NEVER changed
// - V22 State / BUY / SELL are NEVER changed
// - no automatic model correction or promotion
// - mature error patterns are associations, NOT causal proof
//
// The penalty is correlation-aware: pair patterns are preferred and
// redundant single-tag patterns covered by a selected pair are skipped.

const TARGET_HORIZON_MS=300_000;
const MAX_PENALTY_PCT=40;
const MAX_SELECTED_PATTERNS=3;

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

function safeTag(value){
  return upper(value)
    .replace(/[^A-Z0-9_:-]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,96);
}

function confidenceBand(value){
  const n=finite(value);
  if(n===null)return 'UNKNOWN';
  if(n>=75)return 'HIGH';
  if(n>=50)return 'MEDIUM';
  if(n>=25)return 'LOW';
  return 'VERY_LOW';
}

function forecast(snapshot={}){
  const calibration=
    snapshot?.shadowOutcomeCalibration||{};
  const synthesis=
    snapshot?.shadowEvidenceSynthesis||{};
  const governor=
    snapshot?.shadowConfidenceGovernor||{};
  const arena=
    snapshot?.shadowModelArena||{};
  const brain=
    snapshot?.shadowMathBrain||{};

  if(
    calibration?.ready===true &&
    finite(calibration?.calibratedProbabilityPositivePct)!==null
  ){
    return {
      probabilityPct:
        finite(calibration.calibratedProbabilityPositivePct),
      confidencePct:
        finite(calibration.calibratedConfidencePct)??0,
      source:'V23_11_CALIBRATED'
    };
  }

  if(
    synthesis?.ready===true &&
    finite(synthesis?.synthesisProbabilityPositivePct)!==null
  ){
    return {
      probabilityPct:
        finite(synthesis.synthesisProbabilityPositivePct),
      confidencePct:
        finite(synthesis.synthesisConfidencePct)??0,
      source:'V23_10_SYNTHESIS'
    };
  }

  if(
    governor?.ready===true &&
    finite(governor?.consensusProbabilityPositivePct)!==null
  ){
    return {
      probabilityPct:
        finite(governor.consensusProbabilityPositivePct),
      confidencePct:
        finite(governor.ensembleConfidencePct)??0,
      source:'V23_7_GOVERNOR'
    };
  }

  if(
    finite(arena?.calibratedProbabilityPositivePct)!==null
  ){
    return {
      probabilityPct:
        finite(arena.calibratedProbabilityPositivePct),
      confidencePct:
        finite(arena.modelConfidencePct)??0,
      source:'V23_5_ARENA'
    };
  }

  if(
    finite(brain?.probabilityPositivePct)!==null
  ){
    return {
      probabilityPct:
        finite(brain.probabilityPositivePct),
      confidencePct:
        finite(brain.modelConfidencePct)??0,
      source:'V23_4_MATH_BRAIN'
    };
  }

  return {
    probabilityPct:null,
    confidencePct:0,
    source:'NONE'
  };
}

function predictedClass(probabilityPct){
  const p=finite(probabilityPct);
  if(p===null)return 'UNKNOWN';
  if(p>=62)return 'POSITIVE';
  if(p<=38)return 'NEGATIVE';
  return 'NEUTRAL';
}

function currentTags(
  snapshot={},
  {
    stage=null,
    currentForecast=null
  }={}
){
  const tags=[];
  const f=currentForecast||forecast(snapshot);
  const synthesis=snapshot?.shadowEvidenceSynthesis||{};
  const governor=snapshot?.shadowConfidenceGovernor||{};
  const trajectory=snapshot?.shadowTokenTrajectory||{};
  const pattern=snapshot?.shadowTokenPattern||{};
  const calibration=snapshot?.shadowOutcomeCalibration||{};
  const drift=snapshot?.shadowDriftRegime||{};
  const specialists=snapshot?.specialists||{};
  const evidence=snapshot?.evidence||{};

  const blockers=
    Array.isArray(synthesis?.blockers)
      ? synthesis.blockers
      : [];

  for(const blocker of blockers.slice(0,6)){
    const tag=safeTag(blocker);

    if(tag){
      tags.push(
        `SYNTHESIS_BLOCKER_${tag}`
      );
    }
  }

  const disagreement=
    finite(synthesis?.crossSourceDisagreementPct) ??
    finite(governor?.disagreementPct);

  if(
    disagreement!==null &&
    disagreement>=45
  ){
    tags.push('HIGH_MODEL_DISAGREEMENT');
  }

  const trajectoryState=
    safeTag(trajectory?.trajectoryState);

  if(
    ['FADING','DRIFTED','CONFLICTED']
      .includes(trajectoryState)
  ){
    tags.push(
      `TRAJECTORY_${trajectoryState}`
    );
  }

  if(trajectory?.turningPoint===true){
    tags.push('TRAJECTORY_TURNING_POINT');
  }

  const driftStatus=
    safeTag(
      drift?.driftStatus||
      drift?.status
    );

  if(['DRIFT','ERROR'].includes(driftStatus)){
    tags.push(
      `MODEL_${driftStatus}`
    );
  }

  const completeness=
    finite(
      evidence?.dataQuality?.completenessPct
    );

  if(
    completeness!==null &&
    completeness<75
  ){
    tags.push('LOW_DATA_COMPLETENESS');
  }

  if(
    specialists?.coordination
      ?.suspectedCoordination===true
  ){
    tags.push('SUSPECTED_WALLET_COORDINATION');
  }

  const topBuyer=
    finite(
      specialists?.wallet
        ?.topBuyerSolSharePct
    );

  if(
    topBuyer!==null &&
    topBuyer>=35
  ){
    tags.push('HIGH_BUYER_CONCENTRATION');
  }

  const smartP=
    finite(
      specialists?.smartMoneyMemory
        ?.weightedPositiveProbabilityPct
    );

  const forecastP=
    finite(f?.probabilityPct);

  if(
    smartP!==null &&
    forecastP!==null &&
    Math.abs(smartP-forecastP)>=25
  ){
    tags.push('SMART_MONEY_DISAGREEMENT');
  }

  const patternP=
    finite(
      pattern?.patternProbabilityPositivePct
    );

  if(
    pattern?.ready===true &&
    patternP!==null &&
    forecastP!==null &&
    Math.abs(patternP-forecastP)>=25
  ){
    tags.push('PATTERN_DISAGREEMENT');
  }

  if(
    upper(calibration?.status)===
    'CALIBRATION_MISALIGNED'
  ){
    tags.push('CALIBRATION_MISALIGNED');
  }

  const regime=
    safeTag(evidence?.regime);

  if(
    regime &&
    regime!=='UNKNOWN'
  ){
    tags.push(`REGIME_${regime}`);
  }

  const stageTag=
    safeTag(stage);

  if(
    stageTag &&
    stageTag!=='UNKNOWN'
  ){
    tags.push(`STAGE_${stageTag}`);
  }

  const source=
    safeTag(f?.source);

  if(
    source &&
    source!=='NONE' &&
    source!=='UNKNOWN'
  ){
    tags.push(`SOURCE_${source}`);
  }

  const predicted=
    predictedClass(f?.probabilityPct);

  if(predicted!=='UNKNOWN'){
    tags.push(`PREDICTED_${predicted}`);
  }

  const band=
    confidenceBand(f?.confidencePct);

  if(band!=='UNKNOWN'){
    tags.push(`CONFIDENCE_${band}`);
  }

  return [...new Set(tags)]
    .sort()
    .slice(0,24);
}

function patternMatches(pattern={},tagSet=new Set()){
  const tags=
    Array.isArray(pattern?.tags)
      ? pattern.tags
          .map(safeTag)
          .filter(Boolean)
      : [];

  if(!tags.length)return false;

  return tags.every(
    tag=>tagSet.has(tag)
  );
}

function rawPatternPenalty(pattern={}){
  const posterior=
    finite(pattern?.posteriorMissRatePct);

  const baseline=
    finite(pattern?.baselineMissRatePct);

  const lift=
    finite(pattern?.missLift);

  const support=
    Math.max(
      0,
      Number(pattern?.support)||0
    );

  if(
    posterior===null ||
    baseline===null ||
    lift===null ||
    support<=0
  ){
    return 0;
  }

  const riskEdge=
    Math.max(
      0,
      posterior-baseline
    );

  const liftEdge=
    Math.max(
      0,
      lift-1
    );

  const supportReliability=
    clamp(
      Math.sqrt(
        support/50
      ),
      0.35,
      1
    );

  const severityBase=
    upper(pattern?.severity)==='HIGH'
      ? 8
      : 4;

  return clamp(
    (
      severityBase+
      riskEdge*0.20+
      liftEdge*8
    )*
    supportReliability,
    2,
    25
  );
}

function selectNonRedundant(matches=[]){
  const sorted=
    [...matches]
      .sort(
        (a,b)=>
          Number(
            (b?.tags||[]).length
          )-
          Number(
            (a?.tags||[]).length
          ) ||
          Number(b?.penaltyPct||0)-
          Number(a?.penaltyPct||0) ||
          Number(b?.support||0)-
          Number(a?.support||0)
      );

  const selected=[];
  const covered=new Set();

  for(const row of sorted){
    const tags=
      Array.isArray(row?.tags)
        ? row.tags.map(safeTag)
        : [];

    if(!tags.length)continue;

    const fullyCovered=
      tags.every(
        tag=>covered.has(tag)
      );

    if(fullyCovered){
      continue;
    }

    selected.push(row);

    for(const tag of tags){
      covered.add(tag);
    }

    if(
      selected.length>=
      MAX_SELECTED_PATTERNS
    ){
      break;
    }
  }

  return selected;
}

function combinePenalty(rows=[]){
  let survival=1;

  for(const row of rows){
    const p=
      clamp(
        Number(row?.penaltyPct)||0,
        0,
        100
      )/100;

    survival*=(1-p);
  }

  return clamp(
    (1-survival)*100,
    0,
    MAX_PENALTY_PCT
  );
}

export function createShadowErrorAwareConfidenceV23_18({
  errorPatternLearner=null,
  recentLimit=200
}={}){
  const recent=[];
  let predictions=0;
  let penaltiesApplied=0;
  let totalPenaltyPct=0;
  let maxPenaltySeenPct=0;
  let errors=0;

  function predict(
    snapshot={},
    {
      mint='',
      at=Date.now(),
      stage=null
    }={}
  ){
    try{
      const f=forecast(snapshot);

      if(
        finite(f?.probabilityPct)===null ||
        finite(f?.confidencePct)===null
      ){
        const row={
          version:'MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18',
          shadowOnly:true,
          authority:'DIAGNOSTIC_ONLY',
          probabilityMutation:false,
          confidenceOnly:true,
          mint:String(mint||''),
          at:Number(at)||Date.now(),
          status:'NO_FORECAST',
          probabilityPositivePct:null,
          rawConfidencePct:
            round(f?.confidencePct,2),
          adjustedConfidencePct:
            round(f?.confidencePct,2),
          penaltyPct:0,
          forecastSource:
            f?.source||'NONE',
          currentTags:[],
          matchedPatterns:[],
          selectedPatterns:[],
          causalClaims:false,
          tradingMutation:false
        };

        predictions++;
        recent.unshift(row);
        recent.splice(recentLimit);

        return row;
      }

      const report=
        errorPatternLearner
          ?.patternReport?.({
            horizonMs:
              TARGET_HORIZON_MS,
            limit:100,
            includeImmature:false
          })||{};

      const mature=
        Array.isArray(report?.patterns)
          ? report.patterns.filter(
              row=>row?.mature===true
            )
          : [];

      const tags=
        currentTags(
          snapshot,
          {
            stage,
            currentForecast:f
          }
        );

      const tagSet=
        new Set(tags);

      const matched=
        mature
          .filter(
            pattern=>
              patternMatches(
                pattern,
                tagSet
              )
          )
          .map(pattern=>({
            patternId:
              String(
                pattern?.patternId||''
              ),
            tags:
              Array.isArray(pattern?.tags)
                ? pattern.tags
                : [],
            severity:
              upper(pattern?.severity),
            support:
              Number(pattern?.support||0),
            misses:
              Number(pattern?.misses||0),
            posteriorMissRatePct:
              round(
                pattern?.posteriorMissRatePct,
                2
              ),
            baselineMissRatePct:
              round(
                pattern?.baselineMissRatePct,
                2
              ),
            lowerBoundMissRatePct:
              round(
                pattern?.lowerBoundMissRatePct,
                2
              ),
            missLift:
              round(
                pattern?.missLift,
                3
              ),
            penaltyPct:
              round(
                rawPatternPenalty(pattern),
                2
              )
          }));

      const selected=
        selectNonRedundant(
          matched
        );

      const penaltyPct=
        round(
          combinePenalty(selected),
          2
        )??0;

      const rawConfidencePct=
        clamp(
          Number(f.confidencePct)||0,
          0,
          100
        );

      const adjustedConfidencePct=
        round(
          rawConfidencePct*
          (
            1-
            penaltyPct/100
          ),
          2
        );

      let status='NO_MATURE_PATTERNS';

      if(mature.length){
        status=
          selected.length
            ? 'PENALTY_APPLIED'
            : 'NO_PATTERN_MATCH';
      }

      const row={
        version:'MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        probabilityMutation:false,
        confidenceOnly:true,
        mint:String(mint||''),
        at:Number(at)||Date.now(),
        status,
        probabilityPositivePct:
          round(
            f.probabilityPct,
            2
          ),
        rawConfidencePct:
          round(
            rawConfidencePct,
            2
          ),
        adjustedConfidencePct,
        penaltyPct,
        forecastSource:
          f.source,
        currentTags:
          tags,
        maturePatternCount:
          mature.length,
        matchedPatterns:
          matched,
        selectedPatterns:
          selected,
        causalClaims:false,
        tradingMutation:false
      };

      predictions++;

      if(penaltyPct>0){
        penaltiesApplied++;
        totalPenaltyPct+=penaltyPct;
        maxPenaltySeenPct=
          Math.max(
            maxPenaltySeenPct,
            penaltyPct
          );
      }

      recent.unshift(row);
      recent.splice(recentLimit);

      return row;
    }catch{
      errors++;

      return {
        version:'MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        probabilityMutation:false,
        confidenceOnly:true,
        mint:String(mint||''),
        at:Number(at)||Date.now(),
        status:'ERROR',
        probabilityPositivePct:null,
        rawConfidencePct:0,
        adjustedConfidencePct:0,
        penaltyPct:0,
        forecastSource:'NONE',
        currentTags:[],
        matchedPatterns:[],
        selectedPatterns:[],
        causalClaims:false,
        tradingMutation:false
      };
    }
  }

  function listRecent({
    limit=50,
    penalizedOnly=false
  }={}){
    const safe=
      Math.max(
        1,
        Math.min(
          200,
          Number(limit)||50
        )
      );

    return recent
      .filter(
        row=>
          penalizedOnly!==true ||
          Number(row?.penaltyPct||0)>0
      )
      .slice(
        0,
        safe
      );
  }

  function status(){
    return {
      version:'MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      probabilityMutation:false,
      confidenceOnly:true,
      autoCorrection:false,
      tradingMutation:false,
      targetHorizonMs:
        TARGET_HORIZON_MS,
      predictions,
      penaltiesApplied,
      penaltyRatePct:
        predictions
          ? round(
              penaltiesApplied/
              predictions*
              100,
              2
            )
          : null,
      meanAppliedPenaltyPct:
        penaltiesApplied
          ? round(
              totalPenaltyPct/
              penaltiesApplied,
              2
            )
          : null,
      maxPenaltySeenPct:
        round(
          maxPenaltySeenPct,
          2
        ),
      recent:
        recent.length,
      errors,
      policy:{
        maxPenaltyPct:
          MAX_PENALTY_PCT,
        maxSelectedPatterns:
          MAX_SELECTED_PATTERNS,
        correlationAwareSelection:true,
        maturePatternsOnly:true,
        causalClaims:false,
        probabilityMutation:false,
        confidenceOnly:true,
        autoCorrection:false
      }
    };
  }

  return {
    predict,
    listRecent,
    status
  };
}
