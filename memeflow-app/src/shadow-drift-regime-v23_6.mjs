import {
  LEARNING_FEATURES_V23_3
} from './learning-dataset-shadow-v23_3.mjs';

// MEMEFLOW_DRIFT_REGIME_V23_6
//
// SHADOW ONLY.
//
// Two jobs:
// 1) detect data/concept drift between historical baseline and recent clean
//    5m examples;
// 2) maintain per-regime logistic models when each regime has enough evidence.
//
// This module NEVER mutates MEMEFLOW Score/State/settings/trade execution.

const TARGET_HORIZON_MS=300_000;

export const DRIFT_FEATURES_V23_6=Object.freeze([
  'netFlow5s',
  'netFlow15s',
  'priceReturn15s',
  'priceVolatility15s',
  'priceEfficiency15s',
  'uniqueBuyers15s',
  'holderDelta',
  'mcToLiquidity',
  'drawdownFromPeakPct',
  'buyerConcentrationHhi',
  'sameSlotBuySharePct',
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

const safeRegime=value=>{
  const s=String(value||'UNKNOWN').trim().toUpperCase();
  return s||'UNKNOWN';
};

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
  for(const name of DRIFT_FEATURES_V23_6){
    const pathStr=LEARNING_FEATURES_V23_3[name];
    out[name]=pathStr?nested(snapshot,pathStr):null;
  }
  return out;
}

function rowVector(row={}){
  const out={};
  const src=row.features||{};
  for(const name of DRIFT_FEATURES_V23_6){
    out[name]=finite(src[name]);
  }
  return out;
}

function label(row){
  if(row?.classification==='POSITIVE')return 1;
  if(row?.classification==='NEGATIVE')return 0;
  return null;
}

function prepare(rows=[]){
  const dedup=new Map();

  for(const row of rows){
    if(row?.quality?.clean!==true)continue;
    if(Number(row?.horizonMs)!==TARGET_HORIZON_MS)continue;

    const y=label(row);
    if(y===null)continue;

    const mint=String(row?.mint||'');
    const anchorAt=Number(row?.anchorAt||0);
    if(!mint||!(anchorAt>0))continue;

    dedup.set(`${mint}:${anchorAt}`,{
      mint,
      anchorAt,
      regime:safeRegime(row?.regimeAtAnchor),
      y,
      x:rowVector(row)
    });
  }

  return [...dedup.values()].sort(
    (a,b)=>
      a.anchorAt-b.anchorAt ||
      a.mint.localeCompare(b.mint)
  );
}

function stats(values=[]){
  const xs=values.filter(Number.isFinite);
  if(!xs.length)return null;

  const mean=xs.reduce((s,v)=>s+v,0)/xs.length;
  const variance=
    xs.length>1
      ? xs.reduce((s,v)=>s+(v-mean)**2,0)/(xs.length-1)
      : 0;

  return {
    n:xs.length,
    mean,
    std:Math.sqrt(Math.max(0,variance))
  };
}

function standardizedShift(base,recent){
  if(!base||!recent)return null;
  const pooled=Math.max(
    1e-9,
    Math.sqrt(
      (base.std**2+recent.std**2)/2
    )
  );
  return Math.abs(recent.mean-base.mean)/pooled;
}

function driftReport(rows=[]){
  if(rows.length<40){
    return {
      status:'COLD_START',
      ready:false,
      rows:rows.length,
      baselineRows:0,
      recentRows:0,
      baseRateShiftPct:null,
      maxFeatureShift:null,
      meanFeatureShift:null,
      driftedFeatures:[]
    };
  }

  const recentCount=Math.max(
    12,
    Math.floor(rows.length*0.25)
  );

  const baseline=rows.slice(0,-recentCount);
  const recent=rows.slice(-recentCount);

  if(baseline.length<20||recent.length<12){
    return {
      status:'COLD_START',
      ready:false,
      rows:rows.length,
      baselineRows:baseline.length,
      recentRows:recent.length,
      baseRateShiftPct:null,
      maxFeatureShift:null,
      meanFeatureShift:null,
      driftedFeatures:[]
    };
  }

  const baseRate=a=>
    a.reduce((s,row)=>s+row.y,0)/
    Math.max(1,a.length);

  const basePositive=baseRate(baseline);
  const recentPositive=baseRate(recent);

  const shifts=[];

  for(const feature of DRIFT_FEATURES_V23_6){
    const b=stats(
      baseline.map(row=>finite(row.x[feature]))
    );
    const r=stats(
      recent.map(row=>finite(row.x[feature]))
    );

    if(!b||!r||b.n<8||r.n<6)continue;

    const shift=standardizedShift(b,r);
    if(shift===null)continue;

    shifts.push({
      feature,
      standardizedMeanShift:shift,
      baselineMean:b.mean,
      recentMean:r.mean
    });
  }

  shifts.sort(
    (a,b)=>
      b.standardizedMeanShift-
      a.standardizedMeanShift
  );

  const maxShift=shifts[0]?.standardizedMeanShift??0;
  const meanShift=
    shifts.length
      ? shifts.reduce(
          (s,row)=>s+row.standardizedMeanShift,
          0
        )/shifts.length
      : 0;

  const baseRateShiftPct=
    Math.abs(recentPositive-basePositive)*100;

  const severe=
    maxShift>=1.25 ||
    meanShift>=0.75 ||
    baseRateShiftPct>=25;

  const watch=
    maxShift>=0.75 ||
    meanShift>=0.45 ||
    baseRateShiftPct>=15;

  return {
    status:severe?'DRIFT':watch?'WATCH':'STABLE',
    ready:true,
    rows:rows.length,
    baselineRows:baseline.length,
    recentRows:recent.length,
    baselinePositiveRatePct:round(basePositive*100,2),
    recentPositiveRatePct:round(recentPositive*100,2),
    baseRateShiftPct:round(baseRateShiftPct,2),
    maxFeatureShift:round(maxShift,4),
    meanFeatureShift:round(meanShift,4),
    driftedFeatures:shifts
      .filter(row=>row.standardizedMeanShift>=0.75)
      .slice(0,8)
      .map(row=>({
        feature:row.feature,
        standardizedMeanShift:
          round(row.standardizedMeanShift,4),
        baselineMean:round(row.baselineMean,5),
        recentMean:round(row.recentMean,5)
      }))
  };
}

function classCounts(rows=[]){
  let positive=0,negative=0;
  for(const row of rows){
    if(row.y===1)positive++;
    else negative++;
  }
  return {
    positive,
    negative,
    total:positive+negative
  };
}

function fitScaler(rows=[]){
  const scaler={};

  for(const name of DRIFT_FEATURES_V23_6){
    const s=stats(
      rows.map(row=>finite(row.x[name]))
    );

    scaler[name]=s&&s.n>=3
      ? {
          mean:s.mean,
          std:Math.max(s.std,1e-9),
          observed:true
        }
      : {
          mean:0,
          std:1,
          observed:false
        };
  }

  return scaler;
}

function scaled(x,scaler){
  const values=[];
  let available=0,present=0;

  for(const name of DRIFT_FEATURES_V23_6){
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
      clamp((raw-s.mean)/s.std,-5,5)
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

function fitLogistic(rows=[]){
  const scaler=fitScaler(rows);
  const counts=classCounts(rows);
  const prior=clamp(
    counts.positive/Math.max(1,counts.total),
    0.05,
    0.95
  );

  const weights=new Array(
    DRIFT_FEATURES_V23_6.length
  ).fill(0);

  let intercept=logit(prior);
  const lr=0.04;
  const l2=0.04;

  for(let iter=0;iter<280;iter++){
    let gb=0;
    const gw=new Array(weights.length).fill(0);

    for(const row of rows){
      const x=scaled(row.x,scaler).values;
      let z=intercept;

      for(let j=0;j<weights.length;j++){
        z+=weights[j]*x[j];
      }

      const err=sigmoid(z)-row.y;
      gb+=err;

      for(let j=0;j<weights.length;j++){
        gw[j]+=err*x[j];
      }
    }

    const n=Math.max(1,rows.length);
    intercept-=lr*(gb/n);

    for(let j=0;j<weights.length;j++){
      weights[j]-=
        lr*(gw[j]/n+l2*weights[j]);
      weights[j]=clamp(weights[j],-4,4);
    }
  }

  return {
    scaler,
    weights,
    intercept,
    prior,
    predict(x){
      const sv=scaled(x,scaler);
      let z=intercept;

      for(let j=0;j<weights.length;j++){
        z+=weights[j]*sv.values[j];
      }

      return {
        probability:sigmoid(z),
        coveragePct:sv.coveragePct
      };
    }
  };
}

function evaluate(rows,model,baseline){
  if(!rows.length)return null;

  let brier=0,logLoss=0,baseBrier=0,baseLogLoss=0;

  const bp=clamp(baseline,0.01,0.99);

  for(const row of rows){
    const p=clamp(
      model.predict(row.x).probability,
      1e-9,
      1-1e-9
    );
    const y=row.y;

    brier+=(p-y)**2;
    logLoss+=-(
      y*Math.log(p)+(1-y)*Math.log(1-p)
    );

    baseBrier+=(bp-y)**2;
    baseLogLoss+=-(
      y*Math.log(bp)+(1-y)*Math.log(1-bp)
    );
  }

  const n=rows.length;

  return {
    rows:n,
    brier:brier/n,
    logLoss:logLoss/n,
    baselineBrier:baseBrier/n,
    baselineLogLoss:baseLogLoss/n
  };
}

function buildRegimeModels(rows=[]){
  const groups=new Map();

  for(const row of rows){
    const regime=safeRegime(row.regime);
    const list=groups.get(regime)||[];
    list.push(row);
    groups.set(regime,list);
  }

  const models=new Map();
  const publicRows=[];

  for(const [regime,list] of groups){
    const n=list.length;

    if(n<30){
      publicRows.push({
        regime,
        ready:false,
        validated:false,
        rows:n
      });
      continue;
    }

    const split=Math.max(
      20,
      Math.floor(n*0.80)
    );

    const train=list.slice(0,split);
    const holdout=list.slice(split);
    const counts=classCounts(train);
    const holdoutCounts=classCounts(holdout);

    const enough=
      train.length>=20 &&
      holdout.length>=6 &&
      counts.positive>=6 &&
      counts.negative>=6 &&
      holdoutCounts.positive>=2 &&
      holdoutCounts.negative>=2;

    if(!enough){
      publicRows.push({
        regime,
        ready:false,
        validated:false,
        rows:n,
        trainRows:train.length,
        holdoutRows:holdout.length,
        trainCounts:counts,
        holdoutCounts
      });
      continue;
    }

    const model=fitLogistic(train);
    const metrics=evaluate(
      holdout,
      model,
      model.prior
    );

    const validated=Boolean(
      metrics &&
      metrics.brier+0.002<
        metrics.baselineBrier &&
      metrics.logLoss+0.002<
        metrics.baselineLogLoss
    );

    models.set(regime,{
      regime,
      model,
      metrics,
      validated,
      trainRows:train.length,
      holdoutRows:holdout.length,
      counts,
      holdoutCounts
    });

    publicRows.push({
      regime,
      ready:true,
      validated,
      rows:n,
      trainRows:train.length,
      holdoutRows:holdout.length,
      trainCounts:counts,
      holdoutCounts,
      brier:round(metrics.brier,6),
      baselineBrier:
        round(metrics.baselineBrier,6),
      logLoss:round(metrics.logLoss,6),
      baselineLogLoss:
        round(metrics.baselineLogLoss,6)
    });
  }

  publicRows.sort((a,b)=>{
    if(a.validated!==b.validated){
      return a.validated?-1:1;
    }
    return Number(b.rows||0)-Number(a.rows||0);
  });

  return {
    models,
    publicRows
  };
}

export function createShadowDriftRegimeV23_6({
  learningDataset=null,
  maxTrainingRows=2500
}={}){
  let signature=null;
  let prepared=[];
  let drift=null;
  let regimeModels=new Map();
  let publicRegimes=[];
  let rebuilds=0;
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

  function rebuild(){
    const next=datasetSignature();
    if(next===signature)return;

    signature=next;
    prepared=[];
    drift=null;
    regimeModels=new Map();
    publicRegimes=[];

    try{
      const source=
        learningDataset?.trainingRows?.({
          limit:maxTrainingRows,
          horizonMs:TARGET_HORIZON_MS
        })||[];

      prepared=prepare(source);
      drift=driftReport(prepared);

      const built=buildRegimeModels(prepared);
      regimeModels=built.models;
      publicRegimes=built.publicRows;
      rebuilds++;
    }catch{
      errors++;
      drift={
        status:'ERROR',
        ready:false,
        rows:0,
        driftedFeatures:[]
      };
    }
  }

  function remember(row){
    recent.unshift(row);
    if(recent.length>200)recent.length=200;
  }

  function predict(snapshot={},meta={}){
    try{
      rebuild();

      const regime=safeRegime(
        snapshot?.evidence?.regime
      );

      const entry=regimeModels.get(regime);

      if(!entry){
        const cold={
          version:'MEMEFLOW_DRIFT_REGIME_V23_6',
          shadowOnly:true,
          status:
            drift?.status==='DRIFT'
              ? 'DRIFT_NO_REGIME_MODEL'
              : 'REGIME_COLD_START',
          driftStatus:drift?.status||'COLD_START',
          currentRegime:regime,
          regimeModelReady:false,
          regimeModelValidated:false,
          probabilityPositivePct:null,
          modelConfidencePct:0,
          featureCoveragePct:null,
          mint:meta?.mint||snapshot?.mint||null,
          observedAt:Date.now()
        };
        remember(cold);
        return cold;
      }

      const p=entry.model.predict(
        snapshotVector(snapshot)
      );

      const driftStatus=drift?.status||'COLD_START';

      // Drift does not change trading. It only degrades trust in this shadow
      // diagnostic until enough recent evidence rebuilds the regime model.
      const trustMultiplier=
        driftStatus==='DRIFT'
          ? 0.25
          : driftStatus==='WATCH'
            ? 0.60
            : 1.00;

      const validated=
        entry.validated===true &&
        driftStatus!=='DRIFT';

      const result={
        version:'MEMEFLOW_DRIFT_REGIME_V23_6',
        shadowOnly:true,
        status:
          driftStatus==='DRIFT'
            ? 'REGIME_DRIFTED'
            : validated
              ? 'REGIME_VALIDATED'
              : 'REGIME_UNVALIDATED',
        driftStatus,
        currentRegime:regime,
        regimeModelReady:true,
        regimeModelValidated:validated,
        probabilityPositivePct:
          round(p.probability*100,2),
        modelConfidencePct:
          round(
            Math.min(
              100,
              entry.holdoutRows/20*100
            ) *
            trustMultiplier *
            clamp(p.coveragePct/100,0,1),
            2
          ),
        featureCoveragePct:
          round(p.coveragePct,2),
        mint:meta?.mint||snapshot?.mint||null,
        observedAt:Date.now()
      };

      predictions++;
      remember(result);
      return result;
    }catch{
      errors++;
      const failed={
        version:'MEMEFLOW_DRIFT_REGIME_V23_6',
        shadowOnly:true,
        status:'ERROR',
        driftStatus:'ERROR',
        currentRegime:'UNKNOWN',
        regimeModelReady:false,
        regimeModelValidated:false,
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

  function listRecent({limit=50}={}){
    const safe=Math.max(
      1,
      Math.min(200,Number(limit)||50)
    );
    return recent.slice(0,safe);
  }

  function status(){
    rebuild();

    return {
      version:'MEMEFLOW_DRIFT_REGIME_V23_6',
      shadowOnly:true,
      target:'P(POSITIVE_5M)',
      targetHorizonMs:TARGET_HORIZON_MS,
      detector:'RECENT_VS_BASELINE_STANDARDIZED_SHIFT',
      drift,
      regimes:publicRegimes,
      preparedRows:prepared.length,
      datasetSignature:signature,
      rebuilds,
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
