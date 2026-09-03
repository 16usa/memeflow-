import {
  LEARNING_FEATURES_V23_3
} from './learning-dataset-shadow-v23_3.mjs';

// MEMEFLOW_SHADOW_MODEL_ARENA_V23_5
//
// SHADOW ONLY.
//
// V23.5 compares multiple probability models and calibrates them without
// touching canonical MEMEFLOW Score/State/trading.
//
// Chronological token partitions:
//   TRAIN       -> fit candidate models
//   CALIBRATION -> fit Platt probability calibration
//   SELECTION   -> choose champion
//   FINAL       -> independent champion validation
//
// Candidate models:
//   1) FULL_LOGISTIC  : broader evidence set
//   2) CORE_LOGISTIC  : smaller robust feature set
//   3) GAUSSIAN_NB    : independent probabilistic family
//
// A champion is "validated" only if its calibrated probability beats the
// train base-rate baseline on BOTH Brier score and log-loss on FINAL holdout.

const TARGET_HORIZON_MS=300_000;

export const ARENA_FULL_FEATURES_V23_5=Object.freeze([
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

export const ARENA_CORE_FEATURES_V23_5=Object.freeze([
  'netFlow5s',
  'netFlow15s',
  'priceReturn15s',
  'priceEfficiency15s',
  'uniqueBuyers15s',
  'holderDelta',
  'mcToLiquidity',
  'drawdownFromPeakPct',
  'buyerConcentrationHhi',
  'smartMoneyPositiveProbabilityPct'
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

const logit=p=>{
  const q=clamp(p,1e-6,1-1e-6);
  return Math.log(q/(1-q));
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

function snapshotVector(snapshot={},features=[]){
  const out={};
  for(const name of features){
    const pathStr=LEARNING_FEATURES_V23_3[name];
    out[name]=pathStr?nested(snapshot,pathStr):null;
  }
  return out;
}

function rowVector(row={},features=[]){
  const source=row.features||{};
  const out={};
  for(const name of features){
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
  const dedup=new Map();

  for(const row of rows){
    if(row?.quality?.clean!==true)continue;
    if(Number(row?.horizonMs)!==TARGET_HORIZON_MS)continue;

    const y=labelOf(row);
    if(y===null)continue;

    const mint=String(row?.mint||'');
    const anchorAt=Number(row?.anchorAt||0);
    if(!mint||!(anchorAt>0))continue;

    dedup.set(`${mint}:${anchorAt}`,{
      mint,
      anchorAt,
      y,
      raw:row
    });
  }

  return [...dedup.values()].sort(
    (a,b)=>
      a.anchorAt-b.anchorAt ||
      a.mint.localeCompare(b.mint)
  );
}

function uniqueTokens(rows=[]){
  const seen=new Set();
  const out=[];
  for(const row of rows){
    if(seen.has(row.mint))continue;
    seen.add(row.mint);
    out.push(row.mint);
  }
  return out;
}

function partitionChronologically(rows=[]){
  const tokens=uniqueTokens(rows);

  if(tokens.length<32){
    return {
      train:[],
      calibration:[],
      selection:[],
      final:[]
    };
  }

  const n=tokens.length;
  const trainEnd=Math.max(1,Math.floor(n*0.55));
  const calibrationEnd=Math.max(
    trainEnd+1,
    Math.floor(n*0.70)
  );
  const selectionEnd=Math.max(
    calibrationEnd+1,
    Math.floor(n*0.85)
  );

  const trainTokens=new Set(tokens.slice(0,trainEnd));
  const calibrationTokens=new Set(
    tokens.slice(trainEnd,calibrationEnd)
  );
  const selectionTokens=new Set(
    tokens.slice(calibrationEnd,selectionEnd)
  );
  const finalTokens=new Set(tokens.slice(selectionEnd));

  return {
    train:rows.filter(row=>trainTokens.has(row.mint)),
    calibration:rows.filter(row=>calibrationTokens.has(row.mint)),
    selection:rows.filter(row=>selectionTokens.has(row.mint)),
    final:rows.filter(row=>finalTokens.has(row.mint))
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

function withVectors(rows,features){
  return rows.map(row=>({
    ...row,
    x:rowVector(row.raw,features)
  }));
}

function fitScaler(rows=[],features=[]){
  const scaler={};

  for(const name of features){
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

function scaledVector(x={},features=[],scaler={}){
  const values=[];
  let present=0;
  let available=0;

  for(const name of features){
    const s=scaler[name];

    if(!s?.observed){
      values.push(0);
      continue;
    }

    available++;
    const raw=finite(x[name]);

    if(raw===null){
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
        : 0
  };
}

function fitLogistic(rows,features,{
  learningRate=0.045,
  l2=0.03,
  iterations=320
}={}){
  const scaler=fitScaler(rows,features);
  const counts=classCounts(rows);
  const prior=clamp(
    counts.positive/Math.max(1,counts.total),
    0.05,
    0.95
  );

  const weights=new Array(features.length).fill(0);
  let intercept=logit(prior);

  for(let iter=0;iter<iterations;iter++){
    let gradB=0;
    const gradW=new Array(features.length).fill(0);

    for(const row of rows){
      const x=scaledVector(
        row.x,
        features,
        scaler
      ).values;

      let z=intercept;
      for(let j=0;j<weights.length;j++){
        z+=weights[j]*x[j];
      }

      const err=sigmoid(z)-row.y;
      gradB+=err;

      for(let j=0;j<weights.length;j++){
        gradW[j]+=err*x[j];
      }
    }

    const n=Math.max(1,rows.length);
    intercept-=learningRate*(gradB/n);

    for(let j=0;j<weights.length;j++){
      const g=gradW[j]/n+l2*weights[j];
      weights[j]-=learningRate*g;
      weights[j]=clamp(weights[j],-4,4);
    }
  }

  return {
    type:'LOGISTIC',
    features,
    scaler,
    weights,
    intercept,
    prior,
    predict(x){
      const scaled=scaledVector(x,features,scaler);
      let z=intercept;
      for(let j=0;j<weights.length;j++){
        z+=weights[j]*scaled.values[j];
      }
      return {
        probability:sigmoid(z),
        coveragePct:scaled.coveragePct
      };
    }
  };
}

function meanVariance(values=[]){
  if(!values.length){
    return {mean:0,variance:1};
  }

  const mean=
    values.reduce((sum,v)=>sum+v,0)/
    values.length;

  const variance=
    values.length>1
      ? values.reduce(
          (sum,v)=>sum+(v-mean)**2,
          0
        )/(values.length-1)
      : 1;

  return {
    mean,
    variance:Math.max(variance,1e-6)
  };
}

function fitGaussianNB(rows,features){
  const counts=classCounts(rows);
  const priorPositive=clamp(
    counts.positive/Math.max(1,counts.total),
    0.05,
    0.95
  );

  const stats={};

  for(const name of features){
    const positive=rows
      .filter(row=>row.y===1)
      .map(row=>finite(row.x[name]))
      .filter(Number.isFinite);

    const negative=rows
      .filter(row=>row.y===0)
      .map(row=>finite(row.x[name]))
      .filter(Number.isFinite);

    stats[name]={
      positive:meanVariance(positive),
      negative:meanVariance(negative),
      observed:
        positive.length>=3&&negative.length>=3
    };
  }

  const logGaussian=(x,{mean,variance})=>
    -0.5*Math.log(2*Math.PI*variance)-
    ((x-mean)**2)/(2*variance);

  return {
    type:'GAUSSIAN_NB',
    features,
    prior:priorPositive,
    stats,
    predict(x){
      let lp=Math.log(priorPositive);
      let ln=Math.log(1-priorPositive);
      let available=0;
      let present=0;

      for(const name of features){
        const s=stats[name];
        if(!s?.observed)continue;

        available++;
        const raw=finite(x[name]);
        if(raw===null)continue;
        present++;

        lp+=logGaussian(raw,s.positive);
        ln+=logGaussian(raw,s.negative);
      }

      const delta=clamp(lp-ln,-30,30);

      return {
        probability:sigmoid(delta),
        coveragePct:
          available>0
            ? present/available*100
            : 0
      };
    }
  };
}

function fitPlatt(rows,model,features){
  let a=1;
  let b=0;
  const lr=0.03;
  const l2=0.01;

  for(let iter=0;iter<240;iter++){
    let ga=0,gb=0;

    for(const row of rows){
      const raw=model.predict(row.x).probability;
      const z=logit(raw);
      const p=sigmoid(a*z+b);
      const err=p-row.y;

      ga+=err*z;
      gb+=err;
    }

    const n=Math.max(1,rows.length);

    a-=lr*(ga/n+l2*(a-1));
    b-=lr*(gb/n);

    a=clamp(a,-5,5);
    b=clamp(b,-5,5);
  }

  return {
    a,
    b,
    apply(rawProbability){
      return sigmoid(
        a*logit(rawProbability)+b
      );
    }
  };
}

function ece(rows,predict,bins=10){
  const buckets=Array.from({length:bins},()=>({
    n:0,
    p:0,
    y:0
  }));

  for(const row of rows){
    const p=clamp(predict(row),0,1);
    const i=Math.min(
      bins-1,
      Math.floor(p*bins)
    );
    buckets[i].n++;
    buckets[i].p+=p;
    buckets[i].y+=row.y;
  }

  const total=Math.max(
    1,
    buckets.reduce((sum,b)=>sum+b.n,0)
  );

  let value=0;

  for(const b of buckets){
    if(!b.n)continue;
    const meanP=b.p/b.n;
    const meanY=b.y/b.n;
    value+=b.n/total*Math.abs(meanP-meanY);
  }

  return value;
}

function metrics(rows,predict,baselineProbability){
  if(!rows.length)return null;

  let brier=0;
  let logLoss=0;
  let correct=0;
  let baselineBrier=0;
  let baselineLogLoss=0;

  const baseline=clamp(
    baselineProbability,
    0.01,
    0.99
  );

  for(const row of rows){
    const p=clamp(predict(row),1e-9,1-1e-9);
    const y=row.y;

    brier+=(p-y)**2;
    logLoss+=-(y*safeLog(p)+(1-y)*safeLog(1-p));
    correct+=(p>=0.5?1:0)===y?1:0;

    baselineBrier+=(baseline-y)**2;
    baselineLogLoss+=-(
      y*safeLog(baseline)+
      (1-y)*safeLog(1-baseline)
    );
  }

  const n=rows.length;

  return {
    rows:n,
    brier:brier/n,
    logLoss:logLoss/n,
    accuracyPct:correct/n*100,
    ece:ece(rows,predict),
    baselineBrier:baselineBrier/n,
    baselineLogLoss:baselineLogLoss/n,
    brierLift:baselineBrier/n-brier/n,
    logLossLift:baselineLogLoss/n-logLoss/n
  };
}

function publicMetrics(m){
  if(!m)return null;
  return {
    rows:m.rows,
    brier:round(m.brier,6),
    logLoss:round(m.logLoss,6),
    accuracyPct:round(m.accuracyPct,2),
    ece:round(m.ece,6),
    baselineBrier:round(m.baselineBrier,6),
    baselineLogLoss:round(m.baselineLogLoss,6),
    brierLift:round(m.brierLift,6),
    logLossLift:round(m.logLossLift,6)
  };
}

function candidateQuality(m){
  if(!m)return -Infinity;

  // Lower proper scores are better. ECE is a smaller tie-breaker.
  return (
    -m.brier -
    0.35*m.logLoss -
    0.15*m.ece
  );
}

export function createShadowModelArenaV23_5({
  learningDataset=null,
  minimumTrainRows=70,
  minimumPartitionRows=10,
  minimumClassRows=12,
  maxTrainingRows=2000
}={}){
  let arena=null;
  let signature=null;
  let retrains=0;
  let predictions=0;
  let errors=0;
  const recent=[];

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

  function build(){
    const nextSignature=datasetSignature();

    if(nextSignature===signature){
      return;
    }

    signature=nextSignature;
    arena=null;

    let source=[];

    try{
      source=
        learningDataset?.trainingRows?.({
          limit:maxTrainingRows,
          horizonMs:TARGET_HORIZON_MS
        })||[];
    }catch{
      errors++;
      return;
    }

    const prepared=prepareRows(source);
    const parts=partitionChronologically(prepared);

    const trainCounts=classCounts(parts.train);
    const calibrationCounts=classCounts(parts.calibration);
    const selectionCounts=classCounts(parts.selection);
    const finalCounts=classCounts(parts.final);

    const enough=
      parts.train.length>=minimumTrainRows &&
      parts.calibration.length>=minimumPartitionRows &&
      parts.selection.length>=minimumPartitionRows &&
      parts.final.length>=minimumPartitionRows &&
      trainCounts.positive>=minimumClassRows &&
      trainCounts.negative>=minimumClassRows &&
      calibrationCounts.positive>=3 &&
      calibrationCounts.negative>=3 &&
      selectionCounts.positive>=3 &&
      selectionCounts.negative>=3 &&
      finalCounts.positive>=3 &&
      finalCounts.negative>=3;

    const meta={
      sourceRows:source.length,
      preparedRows:prepared.length,
      distinctTokens:uniqueTokens(prepared).length,
      trainRows:parts.train.length,
      calibrationRows:parts.calibration.length,
      selectionRows:parts.selection.length,
      finalRows:parts.final.length,
      trainCounts,
      calibrationCounts,
      selectionCounts,
      finalCounts
    };

    if(!enough){
      arena={
        ready:false,
        validated:false,
        meta,
        candidates:[],
        champion:null
      };
      return;
    }

    const trainFull=withVectors(
      parts.train,
      ARENA_FULL_FEATURES_V23_5
    );
    const calFull=withVectors(
      parts.calibration,
      ARENA_FULL_FEATURES_V23_5
    );
    const selFull=withVectors(
      parts.selection,
      ARENA_FULL_FEATURES_V23_5
    );
    const finalFull=withVectors(
      parts.final,
      ARENA_FULL_FEATURES_V23_5
    );

    const trainCore=withVectors(
      parts.train,
      ARENA_CORE_FEATURES_V23_5
    );
    const calCore=withVectors(
      parts.calibration,
      ARENA_CORE_FEATURES_V23_5
    );
    const selCore=withVectors(
      parts.selection,
      ARENA_CORE_FEATURES_V23_5
    );
    const finalCore=withVectors(
      parts.final,
      ARENA_CORE_FEATURES_V23_5
    );

    const candidates=[
      {
        name:'FULL_LOGISTIC',
        features:ARENA_FULL_FEATURES_V23_5,
        train:trainFull,
        calibration:calFull,
        selection:selFull,
        final:finalFull,
        model:fitLogistic(
          trainFull,
          ARENA_FULL_FEATURES_V23_5,
          {l2:0.03}
        )
      },
      {
        name:'CORE_LOGISTIC',
        features:ARENA_CORE_FEATURES_V23_5,
        train:trainCore,
        calibration:calCore,
        selection:selCore,
        final:finalCore,
        model:fitLogistic(
          trainCore,
          ARENA_CORE_FEATURES_V23_5,
          {l2:0.04}
        )
      },
      {
        name:'GAUSSIAN_NB',
        features:ARENA_CORE_FEATURES_V23_5,
        train:trainCore,
        calibration:calCore,
        selection:selCore,
        final:finalCore,
        model:fitGaussianNB(
          trainCore,
          ARENA_CORE_FEATURES_V23_5
        )
      }
    ];

    const trainPrior=clamp(
      trainCounts.positive/
      Math.max(1,trainCounts.total),
      0.05,
      0.95
    );

    for(const c of candidates){
      c.calibrator=fitPlatt(
        c.calibration,
        c.model,
        c.features
      );

      const calibrated=row=>
        c.calibrator.apply(
          c.model.predict(row.x).probability
        );

      c.selectionMetrics=metrics(
        c.selection,
        calibrated,
        trainPrior
      );
      c.finalMetrics=metrics(
        c.final,
        calibrated,
        trainPrior
      );
      c.selectionQuality=candidateQuality(
        c.selectionMetrics
      );
    }

    candidates.sort(
      (a,b)=>
        b.selectionQuality-
        a.selectionQuality
    );

    const champion=candidates[0];
    const fm=champion.finalMetrics;

    const validated=Boolean(
      fm &&
      fm.brier+0.002<fm.baselineBrier &&
      fm.logLoss+0.002<fm.baselineLogLoss
    );

    arena={
      ready:true,
      validated,
      meta,
      trainPrior,
      champion,
      candidates
    };

    retrains++;
  }

  function modelConfidencePct(coveragePct){
    if(!arena?.ready||!arena?.champion)return 0;

    const fm=arena.champion.finalMetrics;
    if(!fm)return 0;

    const sampleConfidence=Math.min(
      1,
      arena.meta.finalRows/40
    );

    const relativeBrierLift=
      fm.baselineBrier>0
        ? clamp(
            fm.brierLift/fm.baselineBrier,
            0,
            1
          )
        : 0;

    const calibrationConfidence=
      clamp(1-fm.ece/0.25,0,1);

    return clamp(
      100 *
      sampleConfidence *
      (0.35+0.65*relativeBrierLift) *
      calibrationConfidence *
      clamp(coveragePct/100,0,1),
      0,
      100
    );
  }

  function remember(row){
    recent.unshift(row);
    if(recent.length>200)recent.length=200;
  }

  function predict(snapshot={},meta={}){
    try{
      build();

      if(!arena?.ready||!arena?.champion){
        const cold={
          version:'MEMEFLOW_SHADOW_MODEL_ARENA_V23_5',
          shadowOnly:true,
          status:'COLD_START',
          modelReady:false,
          validated:false,
          champion:null,
          targetHorizonMs:TARGET_HORIZON_MS,
          calibratedProbabilityPositivePct:null,
          modelConfidencePct:0,
          featureCoveragePct:null,
          mint:meta?.mint||snapshot?.mint||null,
          observedAt:Date.now()
        };
        remember(cold);
        return cold;
      }

      const c=arena.champion;
      const x=snapshotVector(
        snapshot,
        c.features
      );
      const raw=c.model.predict(x);
      const calibrated=c.calibrator.apply(
        raw.probability
      );

      const coveragePct=raw.coveragePct;
      const validated=arena.validated;

      const result={
        version:'MEMEFLOW_SHADOW_MODEL_ARENA_V23_5',
        shadowOnly:true,
        status:
          coveragePct<50
            ? 'INSUFFICIENT_FEATURES'
            : validated
              ? 'ARENA_VALIDATED'
              : 'ARENA_UNVALIDATED',
        modelReady:true,
        validated,
        champion:c.name,
        targetHorizonMs:TARGET_HORIZON_MS,
        rawProbabilityPositivePct:
          round(raw.probability*100,2),
        calibratedProbabilityPositivePct:
          round(calibrated*100,2),
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
        version:'MEMEFLOW_SHADOW_MODEL_ARENA_V23_5',
        shadowOnly:true,
        status:'ERROR',
        modelReady:false,
        validated:false,
        champion:null,
        targetHorizonMs:TARGET_HORIZON_MS,
        calibratedProbabilityPositivePct:null,
        modelConfidencePct:0,
        featureCoveragePct:null,
        mint:meta?.mint||snapshot?.mint||null,
        observedAt:Date.now()
      };
      remember(failed);
      return failed;
    }
  }

  function listRecent({limit=50}={}){
    const safe=Math.max(
      1,
      Math.min(200,Number(limit)||50)
    );
    return recent.slice(0,safe);
  }

  function status(){
    build();

    const candidates=
      arena?.candidates?.map(c=>({
        name:c.name,
        featureCount:c.features.length,
        platt:{
          a:round(c.calibrator?.a,5),
          b:round(c.calibrator?.b,5)
        },
        selection:publicMetrics(c.selectionMetrics),
        final:publicMetrics(c.finalMetrics),
        selected:
          arena?.champion?.name===c.name
      }))||[];

    return {
      version:'MEMEFLOW_SHADOW_MODEL_ARENA_V23_5',
      shadowOnly:true,
      target:'P(POSITIVE_5M)',
      targetHorizonMs:TARGET_HORIZON_MS,
      partition:
        'CHRONOLOGICAL_TRAIN_CALIBRATION_SELECTION_FINAL',
      calibration:'PLATT_SCALING',
      candidateModels:[
        'FULL_LOGISTIC',
        'CORE_LOGISTIC',
        'GAUSSIAN_NB'
      ],
      modelReady:arena?.ready===true,
      validated:arena?.validated===true,
      champion:arena?.champion?.name||null,
      datasetSignature:signature,
      training:arena?.meta||null,
      candidates,
      retrains,
      predictions,
      recentPredictions:recent.length,
      errors
    };
  }

  return {
    predict,
    status,
    listRecent
  };
}
