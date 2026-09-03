// MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7
//
// SHADOW ONLY.
// Combines existing diagnostics into one meta-confidence view.
// It NEVER owns MEMEFLOW Score/State/settings/trade execution.
//
// Important: Math Brain / Arena / Regime are correlated because they share
// MEMEFLOW evidence. V23.7 therefore applies a correlation haircut instead of
// pretending that every model vote is independent.

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

function makeSource({
  name,
  probability,
  confidence,
  validated,
  ready,
  family
}){
  const p=finite(probability);
  const c=finite(confidence);

  const usable=
    ready===true &&
    p!==null &&
    c!==null &&
    c>0;

  return {
    name,
    family,
    probabilityPositivePct:p,
    confidencePct:
      c===null
        ? 0
        : clamp(c,0,100),
    validated:validated===true,
    usable
  };
}

function smartMoneySource(snapshot={}){
  const sm=
    snapshot?.specialists
      ?.smartMoneyMemory||{};

  const ready=
    sm.reputationReady===true &&
    Number(sm.readyWallets||0)>0;

  return makeSource({
    name:'SMART_MONEY',
    family:'WALLET_MEMORY',
    probability:
      sm.weightedPositiveProbabilityPct,
    confidence:
      sm.historicalConfidencePct,
    validated:ready,
    ready
  });
}

function collectSources(snapshot={}){
  const brain=snapshot?.shadowMathBrain||{};
  const arena=snapshot?.shadowModelArena||{};
  const regime=snapshot?.shadowDriftRegime||{};

  return [
    makeSource({
      name:'MATH_BRAIN',
      family:'MODEL_FAMILY',
      probability:
        brain.probabilityPositivePct,
      confidence:
        brain.modelConfidencePct,
      validated:
        brain.validated===true,
      ready:
        brain.modelReady===true
    }),
    makeSource({
      name:'MODEL_ARENA',
      family:'MODEL_FAMILY',
      probability:
        arena.calibratedProbabilityPositivePct,
      confidence:
        arena.modelConfidencePct,
      validated:
        arena.validated===true,
      ready:
        arena.modelReady===true
    }),
    makeSource({
      name:'REGIME_MODEL',
      family:'MODEL_FAMILY',
      probability:
        regime.probabilityPositivePct,
      confidence:
        regime.modelConfidencePct,
      validated:
        regime.regimeModelValidated===true,
      ready:
        regime.regimeModelReady===true
    }),
    smartMoneySource(snapshot)
  ];
}

function weightedConsensus(rows=[]){
  let weightSum=0;
  let weightedProbability=0;

  for(const row of rows){
    const validatedMultiplier=
      row.validated===true
        ? 1
        : 0.55;

    const weight=
      clamp(
        row.confidencePct/100,
        0.05,
        1
      ) *
      validatedMultiplier;

    weightSum+=weight;
    weightedProbability+=
      row.probabilityPositivePct*
      weight;
  }

  if(weightSum<=0){
    return {
      probability:null,
      disagreement:null
    };
  }

  const probability=
    weightedProbability/weightSum;

  let weightedVariance=0;

  for(const row of rows){
    const validatedMultiplier=
      row.validated===true
        ? 1
        : 0.55;

    const weight=
      clamp(
        row.confidencePct/100,
        0.05,
        1
      ) *
      validatedMultiplier;

    weightedVariance+=
      weight*
      (
        row.probabilityPositivePct-
        probability
      )**2;
  }

  weightedVariance/=
    Math.max(weightSum,1e-9);

  return {
    probability,
    disagreement:
      clamp(
        Math.sqrt(weightedVariance),
        0,
        50
      )
  };
}

function correlationHaircut(rows=[]){
  const modelFamilyCount=
    rows.filter(
      row=>row.family==='MODEL_FAMILY'
    ).length;

  // Three related model outputs are NOT three independent observations.
  if(modelFamilyCount>=3)return 0.72;
  if(modelFamilyCount===2)return 0.84;
  return 1;
}

export function createShadowConfidenceGovernorV23_7(){
  let predictions=0;
  let errors=0;
  const recent=[];

  function remember(row){
    recent.unshift(row);
    if(recent.length>200){
      recent.length=200;
    }
  }

  function predict(snapshot={},meta={}){
    try{
      const sources=
        collectSources(snapshot);

      const usable=
        sources.filter(
          row=>row.usable===true
        );

      const validated=
        usable.filter(
          row=>row.validated===true
        );

      // Prefer validated sources once at least two exist.
      const contributing=
        validated.length>=2
          ? validated
          : usable;

      const driftStatus=
        String(
          snapshot?.shadowDriftRegime
            ?.driftStatus||
          'COLD_START'
        ).toUpperCase();

      if(contributing.length<2){
        const cold={
          version:'MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7',
          shadowOnly:true,
          status:'INSUFFICIENT_EVIDENCE',
          ready:false,
          consensusProbabilityPositivePct:null,
          ensembleConfidencePct:0,
          disagreementPct:null,
          agreementPct:null,
          driftStatus,
          sourceCount:usable.length,
          validatedSourceCount:
            validated.length,
          effectiveSourceCount:0,
          correlationHaircutPct:100,
          contributingSources:[],
          sources,
          mint:
            meta?.mint||
            snapshot?.mint||
            null,
          observedAt:Date.now()
        };

        remember(cold);
        return cold;
      }

      const consensus=
        weightedConsensus(contributing);

      const disagreement=
        consensus.disagreement??50;

      const agreement=
        clamp(
          100-disagreement*2,
          0,
          100
        );

      const meanConfidence=
        contributing.reduce(
          (sum,row)=>
            sum+row.confidencePct,
          0
        )/
        contributing.length;

      const familySet=
        new Set(
          contributing.map(
            row=>row.family
          )
        );

      const correlation=
        correlationHaircut(
          contributing
        );

      const breadth=
        clamp(
          familySet.size/2,
          0,
          1
        );

      const validationRatio=
        validated.length/
        Math.max(
          1,
          usable.length
        );

      const driftMultiplier=
        driftStatus==='DRIFT'
          ? 0.20
          : driftStatus==='WATCH'
            ? 0.60
            : driftStatus==='STABLE'
              ? 1
              : 0.75;

      const ensembleConfidence=
        clamp(
          meanConfidence *
          (0.55+0.45*breadth) *
          (0.60+0.40*validationRatio) *
          (0.35+0.65*agreement/100) *
          correlation *
          driftMultiplier,
          0,
          100
        );

      const effectiveSourceCount=
        round(
          contributing.length*
          correlation,
          2
        );

      const status=
        driftStatus==='DRIFT'
          ? 'DRIFT_SUPPRESSED'
          : disagreement>=20
            ? 'HIGH_DISAGREEMENT'
            : ensembleConfidence>=70 &&
              validated.length>=2
              ? 'HIGH_CONFIDENCE_CONSENSUS'
              : ensembleConfidence>=40
                ? 'MODERATE_CONFIDENCE'
                : 'LOW_CONFIDENCE';

      const result={
        version:'MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7',
        shadowOnly:true,
        status,
        ready:true,
        consensusProbabilityPositivePct:
          round(
            consensus.probability,
            2
          ),
        ensembleConfidencePct:
          round(
            ensembleConfidence,
            2
          ),
        disagreementPct:
          round(
            disagreement,
            2
          ),
        agreementPct:
          round(
            agreement,
            2
          ),
        driftStatus,
        sourceCount:
          usable.length,
        validatedSourceCount:
          validated.length,
        effectiveSourceCount,
        correlationHaircutPct:
          round(
            correlation*100,
            2
          ),
        contributingSources:
          contributing.map(
            row=>row.name
          ),
        sources,
        mint:
          meta?.mint||
          snapshot?.mint||
          null,
        observedAt:Date.now()
      };

      predictions++;
      remember(result);
      return result;
    }catch{
      errors++;

      const failed={
        version:'MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7',
        shadowOnly:true,
        status:'ERROR',
        ready:false,
        consensusProbabilityPositivePct:null,
        ensembleConfidencePct:0,
        disagreementPct:null,
        agreementPct:null,
        driftStatus:'ERROR',
        sourceCount:0,
        validatedSourceCount:0,
        effectiveSourceCount:0,
        correlationHaircutPct:null,
        contributingSources:[],
        sources:[],
        mint:
          meta?.mint||
          snapshot?.mint||
          null,
        observedAt:Date.now()
      };

      remember(failed);
      return failed;
    }
  }

  function listRecent({limit=50}={}){
    const safeLimit=
      Math.max(
        1,
        Math.min(
          200,
          Number(limit)||50
        )
      );

    return recent.slice(
      0,
      safeLimit
    );
  }

  function status(){
    return {
      version:'MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      inputs:[
        'MATH_BRAIN',
        'MODEL_ARENA',
        'REGIME_MODEL',
        'SMART_MONEY'
      ],
      correlationAware:true,
      predictions,
      recentPredictions:
        recent.length,
      errors
    };
  }

  return {
    predict,
    status,
    listRecent
  };
}
