import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_LEARNING_DATASET_V23_3
//
// SHADOW ONLY.
//
// Purpose:
// 1. Freeze feature values at the Token Cell anchor.
// 2. Join them later with future outcome labels.
// 3. Reject/flag low-quality or late labels.
// 4. Build bounded online feature statistics.
// 5. NEVER produce MEMEFLOW Score, State, position size, or a trade decision.
//
// This is training/validation infrastructure, not a trading model.

export const LEARNING_HORIZON_WEIGHTS_V23_3=Object.freeze({
  15000:0.15,
  30000:0.25,
  60000:0.40,
  180000:0.70,
  300000:1.00
});

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const round=(value,digits=3)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

const get=(obj,pathStr)=>{
  let cur=obj;
  for(const key of String(pathStr).split('.')){
    if(cur===null||cur===undefined)return null;
    cur=cur[key];
  }
  return finite(cur);
};

export const LEARNING_FEATURES_V23_3=Object.freeze({
  canonicalScore:'evidence.sourceSignals.canonicalScore',
  opportunityScore:'evidence.sourceSignals.opportunityScore',
  dataCompletenessPct:'evidence.dataQuality.completenessPct',

  tradesPerSecond1s:'evidence.flowAcceleration.tradesPerSecond1s',
  tradesPerSecond5s:'evidence.flowAcceleration.tradesPerSecond5s',
  tradesPerSecond15s:'evidence.flowAcceleration.tradesPerSecond15s',
  netFlow5s:'evidence.flowAcceleration.netFlow5s',
  netFlow15s:'evidence.flowAcceleration.netFlow15s',

  priceReturn5s:'windows.5000.price.returnPct',
  priceReturn15s:'windows.15000.price.returnPct',
  priceVolatility15s:'windows.15000.price.volatility',
  priceEfficiency15s:'windows.15000.price.efficiency',

  uniqueBuyers15s:'windows.15000.flow.uniqueBuyers',
  buyPressure15s:'windows.15000.flow.buyPressure',
  volumeSol15s:'windows.15000.flow.volumeSol',

  holderCount:'evidence.holders.holderCount',
  holderDelta:'evidence.holders.holderDelta',
  top10Pct:'evidence.holders.top10Pct',
  developerPct:'evidence.holders.developerPct',

  liquiditySol:'evidence.liquidity.liquiditySol',
  marketCapSol:'evidence.liquidity.marketCapSol',
  mcToLiquidity:'evidence.liquidity.mcToLiquidity',
  bondingCurvePct:'evidence.liquidity.bondingCurvePct',

  drawdownFromPeakPct:'evidence.risk.drawdownFromPeakPct',
  bundlePct:'evidence.risk.bundlePct',
  sniperPct:'evidence.risk.sniperPct',
  insidersPct:'evidence.risk.insidersPct',
  suspectedRiskyWalletsPct:'evidence.risk.suspectedRiskyWalletsPct',

  uniqueBuyerWallets:'specialists.wallet.uniqueBuyerWallets',
  repeatBuyerWalletRatioPct:'specialists.wallet.repeatBuyerWalletRatioPct',
  topBuyerSolSharePct:'specialists.wallet.topBuyerSolSharePct',
  buyerConcentrationHhi:'specialists.wallet.buyerConcentrationHhi',

  sameSlotBuySharePct:'specialists.coordination.sameSlotBuySharePct',
  maxDistinctBuyers250ms:'specialists.coordination.maxDistinctBuyers250ms',
  similarAmountBuySharePct:'specialists.coordination.similarAmountBuySharePct',

  smartMoneyStrongWalletSharePct:'specialists.smartMoneyMemory.strongWalletSharePct',
  smartMoneyPositiveProbabilityPct:'specialists.smartMoneyMemory.weightedPositiveProbabilityPct',
  smartMoneyHistoricalConfidencePct:'specialists.smartMoneyMemory.historicalConfidencePct'
});

function horizonWeight(horizonMs){
  return (
    LEARNING_HORIZON_WEIGHTS_V23_3[
      String(Number(horizonMs)||0)
    ] ?? 0.1
  );
}

function classifyOutcome(outcome={}){
  if(outcome.dead===true)return 'NEGATIVE';

  const ret=finite(outcome.returnPct);
  const mfe=finite(outcome.maxFavorableExcursionPct);
  const mae=finite(outcome.maxAdverseExcursionPct);

  if(
    (ret!==null&&ret>=20) ||
    (
      mfe!==null &&
      mfe>=50 &&
      (mae===null||mae>-25)
    )
  ){
    return 'POSITIVE';
  }

  if(
    (ret!==null&&ret<=-20) ||
    (mae!==null&&mae<=-25)
  ){
    return 'NEGATIVE';
  }

  return 'NEUTRAL';
}

function featureVector(anchor={}){
  const snapshot=anchor?.features||{};
  const features={};

  for(const [name,pathStr] of Object.entries(
    LEARNING_FEATURES_V23_3
  )){
    features[name]=get(snapshot,pathStr);
  }

  return features;
}

function qualityFor(anchor={},outcome={},features={}){
  const issues=[];

  const completeness=
    finite(features.dataCompletenessPct);

  if(completeness===null){
    issues.push('DATA_COMPLETENESS_UNKNOWN');
  }else if(completeness<50){
    issues.push('DATA_COMPLETENESS_LOW');
  }

  const horizon=Math.max(
    0,
    finite(outcome.horizonMs)??0
  );

  const lag=Math.max(
    0,
    finite(outcome.observationLagMs)??0
  );

  // A label observed wildly after its requested horizon can represent a
  // materially different market state. Keep it for audit, but do not allow
  // it into "clean" feature validation.
  const maxLag=Math.max(
    15_000,
    horizon*0.50
  );

  if(lag>maxLag){
    issues.push('LABEL_LATE');
  }

  if(
    finite(anchor.priceSol)===null ||
    !(Number(anchor.priceSol)>0)
  ){
    issues.push('ANCHOR_PRICE_INVALID');
  }

  if(
    finite(outcome.returnPct)===null ||
    finite(outcome.maxFavorableExcursionPct)===null ||
    finite(outcome.maxAdverseExcursionPct)===null
  ){
    issues.push('OUTCOME_INCOMPLETE');
  }

  const present=Object.values(features)
    .filter(value=>finite(value)!==null)
    .length;

  const featureCoveragePct=
    Object.keys(features).length
      ? present/Object.keys(features).length*100
      : 0;

  if(featureCoveragePct<35){
    issues.push('FEATURE_COVERAGE_LOW');
  }

  return {
    clean:issues.length===0,
    issues,
    featureCoveragePct:round(featureCoveragePct,2),
    dataCompletenessPct:completeness,
    observationLagMs:lag,
    maxAcceptedLagMs:maxLag
  };
}

function emptyGroup(){
  return {
    weight:0,
    sum:0,
    sumSq:0,
    tokens:new Set()
  };
}

function addGroup(group,value,weight,mint){
  if(!Number.isFinite(value)||!(weight>0))return;
  group.weight+=weight;
  group.sum+=value*weight;
  group.sumSq+=value*value*weight;
  if(mint)group.tokens.add(String(mint));
}

function groupView(group){
  if(!(group.weight>0)){
    return {
      effectiveObservations:0,
      distinctTokens:group.tokens.size,
      mean:null,
      stddev:null
    };
  }

  const mean=group.sum/group.weight;
  const variance=Math.max(
    0,
    group.sumSq/group.weight-mean*mean
  );

  return {
    effectiveObservations:round(group.weight,2),
    distinctTokens:group.tokens.size,
    mean:round(mean,4),
    stddev:round(Math.sqrt(variance),4)
  };
}

function emptyFeature(name){
  return {
    name,
    all:emptyGroup(),
    positive:emptyGroup(),
    negative:emptyGroup(),
    neutral:emptyGroup()
  };
}

function readTailUtf8(file,maxBytes=50*1024*1024){
  try{
    if(!file||!fs.existsSync(file))return '';

    const stat=fs.statSync(file);
    if(!(stat.size>0))return '';

    if(stat.size<=maxBytes){
      return fs.readFileSync(file,'utf8');
    }

    const start=stat.size-maxBytes;
    const fd=fs.openSync(file,'r');

    try{
      const buffer=Buffer.allocUnsafe(maxBytes);
      fs.readSync(fd,buffer,0,maxBytes,start);
      let text=buffer.toString('utf8');

      const nl=text.indexOf('\n');
      if(nl>=0)text=text.slice(nl+1);

      return text;
    }finally{
      fs.closeSync(fd);
    }
  }catch{
    return '';
  }
}

export function createLearningDatasetShadowV23_3({
  dataDir=null,
  maxRows=100_000
}={}){
  const file=
    dataDir
      ? path.join(
          dataDir,
          'learning-dataset-v23-3.jsonl'
        )
      : null;

  const rows=[];
  const seenKeys=new Set();
  const featureStats=new Map();

  const horizonStats=new Map();
  const qualityIssues=new Map();

  const queue=[];
  let draining=false;
  let writeErrors=0;
  let loadErrors=0;
  let rowsWritten=0;
  let rowsLoaded=0;
  let acceptedRows=0;
  let cleanRows=0;

  if(file){
    try{
      fs.mkdirSync(
        path.dirname(file),
        {recursive:true}
      );
    }catch{}
  }

  function horizonBucket(horizonMs){
    const key=String(Number(horizonMs)||0);
    let row=horizonStats.get(key);

    if(!row){
      row={
        horizonMs:Number(horizonMs)||0,
        rows:0,
        cleanRows:0,
        positive:0,
        negative:0,
        neutral:0,
        tokens:new Set()
      };
      horizonStats.set(key,row);
    }

    return row;
  }

  function updateStats(row){
    const horizon=horizonBucket(row.horizonMs);
    horizon.rows++;
    if(row.quality?.clean)horizon.cleanRows++;
    if(row.mint)horizon.tokens.add(row.mint);

    if(row.classification==='POSITIVE')horizon.positive++;
    else if(row.classification==='NEGATIVE')horizon.negative++;
    else horizon.neutral++;

    for(const issue of row.quality?.issues||[]){
      qualityIssues.set(
        issue,
        (qualityIssues.get(issue)||0)+1
      );
    }

    if(!row.quality?.clean)return;

    const weight=Math.max(
      0,
      finite(row.weight)??0
    );

    for(const [name,value] of Object.entries(row.features||{})){
      const n=finite(value);
      if(n===null)continue;

      let stat=featureStats.get(name);
      if(!stat){
        stat=emptyFeature(name);
        featureStats.set(name,stat);
      }

      addGroup(stat.all,n,weight,row.mint);

      if(row.classification==='POSITIVE'){
        addGroup(stat.positive,n,weight,row.mint);
      }else if(row.classification==='NEGATIVE'){
        addGroup(stat.negative,n,weight,row.mint);
      }else{
        addGroup(stat.neutral,n,weight,row.mint);
      }
    }
  }

  function apply(row,{persist=false}={}){
    if(
      !row ||
      row.type!=='learning-example' ||
      !row.key
    ){
      return false;
    }

    const key=String(row.key);
    if(seenKeys.has(key))return false;
    seenKeys.add(key);

    if(seenKeys.size>250_000){
      const remove=seenKeys.size-200_000;
      let n=0;
      for(const old of seenKeys){
        seenKeys.delete(old);
        if(++n>=remove)break;
      }
    }

    rows.push(row);
    if(rows.length>maxRows){
      rows.splice(0,rows.length-maxRows);
    }

    acceptedRows++;
    if(row.quality?.clean)cleanRows++;
    updateStats(row);

    if(persist&&file){
      queue.push(row);
      if(queue.length>20_000){
        queue.splice(0,queue.length-20_000);
      }
      kick();
    }

    return true;
  }

  function load(){
    if(!file)return;

    const text=readTailUtf8(file);
    if(!text)return;

    for(const line of text.split('\n')){
      if(!line.trim())continue;

      try{
        const row=JSON.parse(line);
        if(apply(row,{persist:false})){
          rowsLoaded++;
        }
      }catch{
        loadErrors++;
      }
    }
  }

  function kick(){
    if(draining||!queue.length||!file)return;
    draining=true;

    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=queue.splice(0,250);
          const payload=
            batch.map(row=>JSON.stringify(row)).join('\n')+
            '\n';

          await fs.promises.appendFile(
            file,
            payload,
            'utf8'
          );

          rowsWritten+=batch.length;
        }
      }catch{
        writeErrors++;
      }finally{
        draining=false;
        if(queue.length)kick();
      }
    });
  }

  async function flush(){
    if(!file)return true;
    kick();

    const started=Date.now();

    while(draining||queue.length){
      if(Date.now()-started>5_000)return false;
      await new Promise(
        resolve=>setTimeout(resolve,5)
      );
    }

    return true;
  }

  function recordOutcome({
    anchor,
    outcome
  }={}){
    if(
      !anchor?.mint ||
      !anchor?.features ||
      !outcome
    ){
      return null;
    }

    const features=featureVector(anchor);
    const quality=qualityFor(anchor,outcome,features);
    const classification=classifyOutcome(outcome);
    const weight=horizonWeight(outcome.horizonMs);

    const row={
      type:'learning-example',
      version:'MEMEFLOW_LEARNING_EXAMPLE_V23_3',
      shadowOnly:true,
      key:[
        String(anchor.mint),
        String(anchor.at||0),
        String(outcome.horizonMs||0)
      ].join(':'),
      mint:String(anchor.mint),
      anchorAt:finite(anchor.at),
      observedAt:finite(outcome.observedAt),
      horizonMs:finite(outcome.horizonMs),
      weight,
      stageAtAnchor:anchor.stage||null,
      regimeAtAnchor:
        anchor?.features?.evidence?.regime||null,

      // Reference inputs are retained for validation only.
      canonicalScoreAtAnchor:
        finite(anchor.canonicalScore),
      opportunityScoreAtAnchor:
        finite(anchor.opportunityScore),

      outcome:{
        returnPct:finite(outcome.returnPct),
        maxFavorableExcursionPct:
          finite(outcome.maxFavorableExcursionPct),
        maxAdverseExcursionPct:
          finite(outcome.maxAdverseExcursionPct),
        dead:outcome.dead===true,
        deadReason:outcome.deadReason||null
      },

      classification,
      quality,
      features
    };

    return apply(row,{persist:true})
      ? row
      : null;
  }

  function featureReport({
    limit=100,
    minimumTokens=5
  }={}){
    const safeLimit=Math.max(
      1,
      Math.min(200,Number(limit)||100)
    );

    const minTokens=Math.max(
      1,
      Number(minimumTokens)||5
    );

    return [...featureStats.values()]
      .map(stat=>{
        const all=groupView(stat.all);
        const positive=groupView(stat.positive);
        const negative=groupView(stat.negative);
        const neutral=groupView(stat.neutral);

        const separation=
          positive.mean!==null&&negative.mean!==null
            ? positive.mean-negative.mean
            : null;

        // This is deliberately called "candidate signal", not importance.
        // No feature is trusted before both positive and negative groups have
        // enough independent token coverage.
        const validationReady=
          positive.distinctTokens>=minTokens &&
          negative.distinctTokens>=minTokens;

        return {
          shadowOnly:true,
          feature:stat.name,
          validationReady,
          all,
          positive,
          negative,
          neutral,
          positiveMinusNegativeMean:
            round(separation,4)
        };
      })
      .sort((a,b)=>{
        if(a.validationReady!==b.validationReady){
          return a.validationReady?-1:1;
        }

        return (
          Math.abs(
            Number(b.positiveMinusNegativeMean||0)
          )-
          Math.abs(
            Number(a.positiveMinusNegativeMean||0)
          )
        );
      })
      .slice(0,safeLimit);
  }

  function recent({
    limit=50,
    clean=null,
    horizonMs=null
  }={}){
    const safeLimit=Math.max(
      1,
      Math.min(200,Number(limit)||50)
    );

    const wantedClean=
      clean===true
        ? true
        : clean===false
          ? false
          : null;

    const wantedHorizon=
      finite(horizonMs);

    return [...rows]
      .reverse()
      .filter(
        row=>
          wantedClean===null ||
          row.quality?.clean===wantedClean
      )
      .filter(
        row=>
          wantedHorizon===null ||
          Number(row.horizonMs)===wantedHorizon
      )
      .slice(0,safeLimit);
  }

  function trainingRows({
    limit=1200,
    horizonMs=300_000
  }={}){
    const safeLimit=Math.max(
      1,
      Math.min(5000,Number(limit)||1200)
    );

    const wantedHorizon=finite(horizonMs);

    return rows
      .filter(row=>row.quality?.clean===true)
      .filter(
        row=>
          wantedHorizon===null ||
          Number(row.horizonMs)===wantedHorizon
      )
      .slice(-safeLimit);
  }

  function status(){
    const horizons=[...horizonStats.values()]
      .sort((a,b)=>a.horizonMs-b.horizonMs)
      .map(row=>({
        horizonMs:row.horizonMs,
        rows:row.rows,
        cleanRows:row.cleanRows,
        distinctTokens:row.tokens.size,
        positive:row.positive,
        negative:row.negative,
        neutral:row.neutral
      }));

    const issues=[...qualityIssues.entries()]
      .sort((a,b)=>b[1]-a[1])
      .map(([issue,count])=>({issue,count}));

    const cleanRatePct=
      acceptedRows>0
        ? cleanRows/acceptedRows*100
        : null;

    return {
      version:'MEMEFLOW_LEARNING_DATASET_V23_3',
      shadowOnly:true,
      file,
      rowsInMemory:rows.length,
      acceptedRows,
      cleanRows,
      cleanRatePct:round(cleanRatePct,2),
      trackedFeatures:Object.keys(
        LEARNING_FEATURES_V23_3
      ).length,
      featureStats:featureStats.size,
      horizons,
      qualityIssues:issues,
      rowsLoaded,
      rowsWritten,
      queued:queue.length,
      draining,
      writeErrors,
      loadErrors
    };
  }

  load();

  return {
    recordOutcome,
    featureReport,
    recent,
    // Internal model-training view. Owner HTTP routes do not expose an
    // unbounded dataset dump.
    trainingRows,
    status,
    flush
  };
}
