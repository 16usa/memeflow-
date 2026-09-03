import {
  LEARNING_FEATURES_V23_3
} from './learning-dataset-shadow-v23_3.mjs';

// MEMEFLOW_SHADOW_MATH_BRAIN_V23_4
//
// SHADOW ONLY.
// This module estimates P(POSITIVE outcome at 5m) from historical CLEAN
// MEMEFLOW learning examples.
//
// It NEVER:
// - changes canonical MEMEFLOW Score/State,
// - opens/closes/reduces positions,
// - changes settings,
// - decides trade eligibility.
//
// Safety/rigor:
// - only 5-minute clean labels are used (no correlated multi-horizon inflation),
// - chronological token holdout is kept out of fitting,
// - normalization is learned from training rows only,
// - L2-regularized logistic regression,
// - model must beat a base-rate holdout baseline before "validated=true",
// - cold-start / insufficient-data states return no probability authority.

const TARGET_HORIZON_MS=300_000;

export const SHADOW_BRAIN_FEATURES_V23_4=Object.freeze([
  'netFlow5s',
  'netFlow15s',
  'tradesPerSecond5s',
  'priceReturn15s',
  'priceVolatility15s',
  'priceEfficiency15s',
  'uniqueBuyers15s',
  'buyPressure15s',
  'holderDelta',
  'top10Pct',
  'developerPct',
  'mcToLiquidity',
  'drawdownFromPeakPct',
  'bundlePct',
  'suspectedRiskyWalletsPct',
  'buyerConcentrationHhi',
  'sameSlotBuySharePct',
  'smartMoneyStrongWalletSharePct',
  'smartMoneyPositiveProbabilityPct',
  'smartMoneyHistoricalConfidencePct'
]);

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const clamp=(value,min,max)=>
  Math.max(min,Math.min(max,Number(value)||0));

const round=(value,digits=4)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

const sigmoid=z=>{
  const x=clamp(z,-30,30);
  return 1/(1+Math.exp(-x));
};

const safeLog=p=>Math.log(clamp(p,1e-9,1-1e-9));

const nested=(obj,pathStr)=>{
  let cur=obj;
  for(const key of String(pathStr).split('.')){
    if(cur===null||cur===undefined)return null;
    cur=cur[key];
  }
  return finite(cur);
};

function snapshotVector(snapshot={}){
  const out={};

  for(const name of SHADOW_BRAIN_FEATURES_V23_4){
    const pathStr=LEARNING_FEATURES_V23_3[name];
    out[name]=pathStr
      ? nested(snapshot,pathStr)
      : null;
  }

  return out;
}

function rowVector(row={}){
  const source=row.features||{};
  const out={};

  for(const name of SHADOW_BRAIN_FEATURES_V23_4){
    out[name]=finite(source[name]);
  }

  return out;
}

function labelOf(row){
  if(row?.classification==='POSITIVE')return 1;
  if(row?.classification==='NEGATIVE')return 0;
  return null;
}

function prepareRows(rows=[]){
  // One 5m clean row per token/anchor is the target learning unit.
  // If duplicated historical rows exist, keep newest per mint+anchor.
  const dedup=new Map();

  for(const row of rows){
    if(row?.quality?.clean!==true)continue;
    if(Number(row?.horizonMs)!==TARGET_HORIZON_MS)continue;

    const y=labelOf(row);
    if(y===null)continue;

    const mint=String(row?.mint||'');
    const anchorAt=Number(row?.anchorAt||0);
    if(!mint||!(anchorAt>0))continue;

    dedup.set(
      `${mint}:${anchorAt}`,
      {
        mint,
        anchorAt,
        y,
        x:rowVector(row)
      }
    );
  }

  return [...dedup.values()]
    .sort(
      (a,b)=>
        a.anchorAt-b.anchorAt ||
        a.mint.localeCompare(b.mint)
    );
}

function splitByToken(rows=[]){
  const tokens=[];
  const seen=new Set();

  for(const row of rows){
    if(seen.has(row.mint))continue;
    seen.add(row.mint);
    tokens.push(row.mint);
  }

  if(tokens.length<10){
    return {train:[],validation:[]};
  }

  const validationTokenCount=Math.max(
    4,
    Math.ceil(tokens.length*0.20)
  );

  const validationTokens=new Set(
    tokens.slice(-validationTokenCount)
  );

  return {
    train:rows.filter(
      row=>!validationTokens.has(row.mint)
    ),
    validation:rows.filter(
      row=>validationTokens.has(row.mint)
    )
  };
}

function classCounts(rows=[]){
  let positive=0,negative=0;
  for(const row of rows){
    if(row.y===1)positive++;
    else if(row.y===0)negative++;
  }
  return {
    positive,
    negative,
    total:positive+negative
  };
}

function fitScaler(rows=[]){
  const scaler={};

  for(const name of SHADOW_BRAIN_FEATURES_V23_4){
    const values=rows
      .map(row=>finite(row.x[name]))
      .filter(Number.isFinite);

    if(values.length<3){
      scaler[name]={
        mean:0,
        std:1,
        observed:false
      };
      continue;
    }

    const mean=
      values.reduce((sum,v)=>sum+v,0)/
      values.length;

    const variance=
      values.reduce(
        (sum,v)=>sum+(v-mean)**2,
        0
      )/
      Math.max(1,values.length-1);

    scaler[name]={
      mean,
      std:Math.max(
        1e-9,
        Math.sqrt(Math.max(0,variance))
      ),
      observed:true
    };
  }

  return scaler;
}

function scaledVector(x={},scaler={}){
  const values=[];
  let present=0;
  let available=0;

  for(const name of SHADOW_BRAIN_FEATURES_V23_4){
    const s=scaler[name];

    if(!s?.observed){
      values.push(0);
      continue;
    }

    available++;
    const raw=finite(x[name]);

    if(raw===null){
      // Mean imputation after scaling = 0.
      values.push(0);
      continue;
    }

    present++;
    values.push(
      clamp(
        (raw-s.mean)/s.std,
        -5,
        5
      )
    );
  }

  return {
    values,
    coveragePct:
      available>0
        ? present/available*100
        : 0,
    availableFeatures:available,
    presentFeatures:present
  };
}

function fitLogistic(train=[],scaler={}){
  const p=SHADOW_BRAIN_FEATURES_V23_4.length;
  const weights=new Array(p).fill(0);

  const counts=classCounts(train);
  const prior=clamp(
    counts.positive/Math.max(1,counts.total),
    0.05,
    0.95
  );

  let intercept=Math.log(prior/(1-prior));

  const learningRate=0.045;
  const l2=0.025;
  const iterations=320;

  for(let iter=0;iter<iterations;iter++){
    let gradB=0;
    const gradW=new Array(p).fill(0);

    for(const row of train){
      const x=scaledVector(row.x,scaler).values;
      let z=intercept;

      for(let j=0;j<p;j++){
        z+=weights[j]*x[j];
      }

      const error=sigmoid(z)-row.y;
      gradB+=error;

      for(let j=0;j<p;j++){
        gradW[j]+=error*x[j];
      }
    }

    const n=Math.max(1,train.length);
    intercept-=learningRate*(gradB/n);

    for(let j=0;j<p;j++){
      const gradient=
        gradW[j]/n +
        l2*weights[j];

      weights[j]-=learningRate*gradient;
      weights[j]=clamp(weights[j],-4,4);
    }
  }

  return {
    intercept,
    weights,
    prior
  };
}

function predictModel(model,scaler,x){
  const scaled=scaledVector(x,scaler);
  let z=model.intercept;

  for(let j=0;j<model.weights.length;j++){
    z+=model.weights[j]*scaled.values[j];
  }

  return {
    probability:sigmoid(z),
    ...scaled
  };
}

function metrics(rows,model,scaler,baselineProbability){
  if(!rows.length)return null;

  let brier=0;
  let logLoss=0;
  let correct=0;
  let baselineBrier=0;
  let baselineLogLoss=0;

  for(const row of rows){
    const p=predictModel(
      model,
      scaler,
      row.x
    ).probability;

    const y=row.y;

    brier+=(p-y)**2;
    logLoss+=-(y*safeLog(p)+(1-y)*safeLog(1-p));
    correct+=(p>=0.5?1:0)===y?1:0;

    const bp=clamp(
      baselineProbability,
      0.01,
      0.99
    );

    baselineBrier+=(bp-y)**2;
    baselineLogLoss+=-(
      y*safeLog(bp)+
      (1-y)*safeLog(1-bp)
    );
  }

  const n=rows.length;

  return {
    rows:n,
    brier:brier/n,
    logLoss:logLoss/n,
    accuracyPct:correct/n*100,
    baselineBrier:baselineBrier/n,
    baselineLogLoss:baselineLogLoss/n,
    brierLift:
      baselineBrier/n-brier/n,
    logLossLift:
      baselineLogLoss/n-logLoss/n
  };
}

function publicCoefficients(model,scaler){
  if(!model||!scaler)return [];

  return SHADOW_BRAIN_FEATURES_V23_4
    .map((feature,index)=>({
      feature,
      coefficient:round(
        model.weights[index],
        5
      ),
      trainingMean:round(
        scaler[feature]?.mean,
        5
      ),
      trainingStd:round(
        scaler[feature]?.std,
        5
      ),
      observed:
        scaler[feature]?.observed===true
    }))
    .sort(
      (a,b)=>
        Math.abs(b.coefficient||0)-
        Math.abs(a.coefficient||0)
    );
}

export function createShadowMathBrainV23_4({
  learningDataset=null,
  minimumTrainRows=40,
  minimumValidationRows=10,
  minimumClassRows=8,
  maxTrainingRows=1200
}={}){
  let fitted=null;
  let scaler=null;
  let validation=null;
  let trainedSignature=null;
  let trainingMeta=null;
  let retrains=0;
  let predictions=0;
  let errors=0;
  const recentPredictions=[];

  function datasetSignature(){
    try{
      const s=learningDataset?.status?.()||{};
      return [
        Number(s.acceptedRows||0),
        Number(s.cleanRows||0)
      ].join(':');
    }catch{
      return '0:0';
    }
  }

  function rebuildIfNeeded(){
    const signature=datasetSignature();

    if(signature===trainedSignature){
      return;
    }

    trainedSignature=signature;
    fitted=null;
    scaler=null;
    validation=null;
    trainingMeta=null;

    let source=[];

    try{
      source=
        learningDataset?.trainingRows?.({
          limit:maxTrainingRows,
          horizonMs:TARGET_HORIZON_MS
        }) || [];
    }catch{
      errors++;
      return;
    }

    const prepared=prepareRows(source);
    const split=splitByToken(prepared);
    const trainCounts=classCounts(split.train);
    const validationCounts=classCounts(split.validation);

    trainingMeta={
      sourceRows:source.length,
      preparedRows:prepared.length,
      trainRows:split.train.length,
      validationRows:split.validation.length,
      trainCounts,
      validationCounts,
      distinctTokens:
        new Set(prepared.map(row=>row.mint)).size
    };

    const enough=
      split.train.length>=minimumTrainRows &&
      split.validation.length>=minimumValidationRows &&
      trainCounts.positive>=minimumClassRows &&
      trainCounts.negative>=minimumClassRows &&
      validationCounts.positive>=3 &&
      validationCounts.negative>=3;

    if(!enough)return;

    scaler=fitScaler(split.train);
    fitted=fitLogistic(split.train,scaler);
    validation=metrics(
      split.validation,
      fitted,
      scaler,
      fitted.prior
    );
    retrains++;
  }

  function validationPassed(){
    if(!validation)return false;

    // Must beat the chronological base-rate baseline on BOTH proper scoring
    // rules. Tiny epsilon avoids declaring victory on floating noise.
    return (
      validation.brier+0.002 <
        validation.baselineBrier &&
      validation.logLoss+0.002 <
        validation.baselineLogLoss
    );
  }

  function modelConfidencePct(coveragePct){
    if(!validation||!trainingMeta)return 0;

    const sampleConfidence=
      Math.min(
        1,
        trainingMeta.validationRows/50
      );

    const brierImprovement=
      validation.baselineBrier>0
        ? clamp(
            validation.brierLift/
            validation.baselineBrier,
            0,
            1
          )
        : 0;

    return clamp(
      100 *
      sampleConfidence *
      (0.35+0.65*brierImprovement) *
      clamp(coveragePct/100,0,1),
      0,
      100
    );
  }

  function predict(snapshot={},meta={}){
    try{
      rebuildIfNeeded();

      if(!fitted||!scaler||!validation){
        const cold={
          version:'MEMEFLOW_SHADOW_MATH_BRAIN_V23_4',
          shadowOnly:true,
          status:'COLD_START',
          modelReady:false,
          validated:false,
          targetHorizonMs:TARGET_HORIZON_MS,
          probabilityPositivePct:null,
          modelConfidencePct:0,
          featureCoveragePct:null,
          mint:meta?.mint||snapshot?.mint||null,
          observedAt:Date.now()
        };

        remember(cold);
        return cold;
      }

      const x=snapshotVector(snapshot);
      const prediction=predictModel(
        fitted,
        scaler,
        x
      );

      const validated=validationPassed();
      const coveragePct=prediction.coveragePct;

      const result={
        version:'MEMEFLOW_SHADOW_MATH_BRAIN_V23_4',
        shadowOnly:true,
        status:
          coveragePct<50
            ? 'INSUFFICIENT_FEATURES'
            : validated
              ? 'SHADOW_VALIDATED'
              : 'SHADOW_UNVALIDATED',
        modelReady:true,
        validated,
        targetHorizonMs:TARGET_HORIZON_MS,
        probabilityPositivePct:
          round(prediction.probability*100,2),
        modelConfidencePct:
          round(modelConfidencePct(coveragePct),2),
        featureCoveragePct:
          round(coveragePct,2),
        mint:meta?.mint||snapshot?.mint||null,
        observedAt:Date.now()
      };

      predictions++;
      remember(result);
      return result;
    }catch{
      errors++;

      const failed={
        version:'MEMEFLOW_SHADOW_MATH_BRAIN_V23_4',
        shadowOnly:true,
        status:'ERROR',
        modelReady:false,
        validated:false,
        targetHorizonMs:TARGET_HORIZON_MS,
        probabilityPositivePct:null,
        modelConfidencePct:0,
        featureCoveragePct:null,
        mint:meta?.mint||snapshot?.mint||null,
        observedAt:Date.now()
      };

      remember(failed);
      return failed;
    }
  }

  function remember(row){
    recentPredictions.unshift(row);
    if(recentPredictions.length>200){
      recentPredictions.length=200;
    }
  }

  function listRecent({limit=50}={}){
    const safe=Math.max(
      1,
      Math.min(200,Number(limit)||50)
    );
    return recentPredictions.slice(0,safe);
  }

  function status(){
    rebuildIfNeeded();

    return {
      version:'MEMEFLOW_SHADOW_MATH_BRAIN_V23_4',
      shadowOnly:true,
      target:'P(POSITIVE_5M)',
      targetHorizonMs:TARGET_HORIZON_MS,
      modelType:'L2_LOGISTIC_REGRESSION',
      split:'CHRONOLOGICAL_TOKEN_HOLDOUT',
      modelReady:Boolean(fitted&&scaler&&validation),
      validated:validationPassed(),
      datasetSignature:trainedSignature,
      training:trainingMeta,
      validation:validation
        ? {
            rows:validation.rows,
            brier:round(validation.brier,6),
            logLoss:round(validation.logLoss,6),
            accuracyPct:round(validation.accuracyPct,2),
            baselineBrier:round(validation.baselineBrier,6),
            baselineLogLoss:round(validation.baselineLogLoss,6),
            brierLift:round(validation.brierLift,6),
            logLossLift:round(validation.logLossLift,6)
          }
        : null,
      coefficients:
        publicCoefficients(fitted,scaler),
      configuredFeatures:
        SHADOW_BRAIN_FEATURES_V23_4.length,
      retrains,
      predictions,
      recentPredictions:recentPredictions.length,
      errors
    };
  }

  return {
    predict,
    status,
    listRecent
  };
}
