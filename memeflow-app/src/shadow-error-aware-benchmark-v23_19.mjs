import fs from 'node:fs';
import path from 'node:path';
import {
  enqueueHistoryHydration,
  parseJsonlCooperatively,
  readBoundedJsonlTail
} from './shadow-history-hydration-v23.mjs';

// MEMEFLOW_SHADOW_ERROR_AWARE_BENCHMARK_V23_19
//
// SHADOW ONLY.
//
// Paired benchmark of:
//   RAW V23 probability/confidence
//   vs
//   a BENCHMARK-ONLY confidence-shrunk probability derived from V23.18.
//
// IMPORTANT:
// - live V23 probability is never mutated
// - benchmark challenger probability exists only inside this evaluator
// - V22 remains the only trading authority
// - no auto-promotion or policy mutation

const TARGET_HORIZON_MS=300_000;
const MIN_PAIRED=100;
const MIN_POSITIVE=20;
const MIN_NEGATIVE=20;
const MIN_BRIER_EDGE=0.0025;
const MIN_LOGLOSS_EDGE=0.005;
const HIGH_CONFIDENCE_PCT=70;
const ECE_BINS=10;

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

function classifyOutcome(outcome={}){
  if(outcome?.dead===true)return 'NEGATIVE';

  const ret=finite(outcome?.returnPct);
  const mfe=finite(outcome?.maxFavorableExcursionPct);
  const mae=finite(outcome?.maxAdverseExcursionPct);

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

function safeLogLoss(p,y){
  const x=
    clamp(
      Number(p),
      1e-6,
      1-1e-6
    );

  return -(
    y*Math.log(x)+
    (1-y)*Math.log(1-x)
  );
}

function ece(rows=[],probabilityField){
  if(!rows.length)return null;

  const bins=
    Array.from(
      {length:ECE_BINS},
      ()=>({
        count:0,
        probability:0,
        positive:0
      })
    );

  for(const row of rows){
    const p=
      clamp(
        Number(row?.[probabilityField])/100,
        0,
        1
      );

    const y=
      row.classification==='POSITIVE'
        ? 1
        : 0;

    const index=
      Math.min(
        ECE_BINS-1,
        Math.floor(
          p*ECE_BINS
        )
      );

    bins[index].count++;
    bins[index].probability+=p;
    bins[index].positive+=y;
  }

  let total=0;

  for(const bin of bins){
    if(!bin.count)continue;

    const avgP=
      bin.probability/bin.count;

    const avgY=
      bin.positive/bin.count;

    total+=
      bin.count/rows.length*
      Math.abs(avgP-avgY);
  }

  return total*100;
}

function benchmarkProbability({
  rawProbabilityPct,
  rawConfidencePct,
  adjustedConfidencePct
}={}){
  const p=
    finite(rawProbabilityPct);

  if(p===null)return null;

  const raw=
    clamp(
      Number(rawConfidencePct)||0,
      0,
      100
    );

  const adjusted=
    clamp(
      Number(adjustedConfidencePct)||0,
      0,
      100
    );

  const trustRatio=
    raw>0
      ? clamp(adjusted/raw,0,1)
      : 1;

  return clamp(
    50+
    (p-50)*trustRatio,
    0,
    100
  );
}

function summarize(rows=[]){
  const scored=
    rows.filter(
      row=>
        row?.scored===true &&
        finite(row?.rawProbabilityPct)!==null &&
        finite(row?.challengerProbabilityPct)!==null
    );

  if(!scored.length){
    return {
      pairedRows:0,
      positive:0,
      negative:0,
      raw:{
        meanBrier:null,
        meanLogLoss:null,
        accuracyPct:null,
        ecePct:null,
        highConfidenceMissRatePct:null,
        falsePositives:0,
        falseNegatives:0
      },
      challenger:{
        meanBrier:null,
        meanLogLoss:null,
        accuracyPct:null,
        ecePct:null,
        highConfidenceMissRatePct:null,
        falsePositives:0,
        falseNegatives:0
      },
      delta:{
        brier:null,
        logLoss:null,
        accuracyPct:null,
        ecePct:null,
        highConfidenceMissRatePct:null
      },
      pairedWins:{
        raw:0,
        challenger:0,
        ties:0
      }
    };
  }

  let positive=0;
  let negative=0;

  let rawBrier=0;
  let challengerBrier=0;
  let rawLogLoss=0;
  let challengerLogLoss=0;
  let rawCorrect=0;
  let challengerCorrect=0;

  let rawFalsePositives=0;
  let rawFalseNegatives=0;
  let challengerFalsePositives=0;
  let challengerFalseNegatives=0;

  let rawHighConfidence=0;
  let rawHighConfidenceMiss=0;
  let challengerHighConfidence=0;
  let challengerHighConfidenceMiss=0;

  let rawWins=0;
  let challengerWins=0;
  let ties=0;

  for(const row of scored){
    const y=
      row.classification==='POSITIVE'
        ? 1
        : 0;

    if(y)positive++;
    else negative++;

    const rawP=
      clamp(
        Number(row.rawProbabilityPct)/100,
        0,
        1
      );

    const challengerP=
      clamp(
        Number(row.challengerProbabilityPct)/100,
        0,
        1
      );

    const rb=(rawP-y)**2;
    const cb=(challengerP-y)**2;

    rawBrier+=rb;
    challengerBrier+=cb;

    rawLogLoss+=
      safeLogLoss(rawP,y);

    challengerLogLoss+=
      safeLogLoss(challengerP,y);

    const rawPrediction=
      rawP>=0.5
        ? 1
        : 0;

    const challengerPrediction=
      challengerP>=0.5
        ? 1
        : 0;

    if(rawPrediction===y){
      rawCorrect++;
    }else if(rawPrediction===1){
      rawFalsePositives++;
    }else{
      rawFalseNegatives++;
    }

    if(challengerPrediction===y){
      challengerCorrect++;
    }else if(challengerPrediction===1){
      challengerFalsePositives++;
    }else{
      challengerFalseNegatives++;
    }

    if(
      Number(row.rawConfidencePct)>=
      HIGH_CONFIDENCE_PCT
    ){
      rawHighConfidence++;

      if(rawPrediction!==y){
        rawHighConfidenceMiss++;
      }
    }

    if(
      Number(row.adjustedConfidencePct)>=
      HIGH_CONFIDENCE_PCT
    ){
      challengerHighConfidence++;

      if(challengerPrediction!==y){
        challengerHighConfidenceMiss++;
      }
    }

    if(Math.abs(rb-cb)<=1e-12){
      ties++;
    }else if(cb<rb){
      challengerWins++;
    }else{
      rawWins++;
    }
  }

  const n=scored.length;

  const rawMetrics={
    meanBrier:
      round(rawBrier/n,6),
    meanLogLoss:
      round(rawLogLoss/n,6),
    accuracyPct:
      round(rawCorrect/n*100,2),
    ecePct:
      round(
        ece(
          scored,
          'rawProbabilityPct'
        ),
        2
      ),
    highConfidenceMissRatePct:
      rawHighConfidence
        ? round(
            rawHighConfidenceMiss/
            rawHighConfidence*
            100,
            2
          )
        : null,
    highConfidenceRows:
      rawHighConfidence,
    highConfidenceMisses:
      rawHighConfidenceMiss,
    falsePositives:
      rawFalsePositives,
    falseNegatives:
      rawFalseNegatives
  };

  const challengerMetrics={
    meanBrier:
      round(challengerBrier/n,6),
    meanLogLoss:
      round(challengerLogLoss/n,6),
    accuracyPct:
      round(challengerCorrect/n*100,2),
    ecePct:
      round(
        ece(
          scored,
          'challengerProbabilityPct'
        ),
        2
      ),
    highConfidenceMissRatePct:
      challengerHighConfidence
        ? round(
            challengerHighConfidenceMiss/
            challengerHighConfidence*
            100,
            2
          )
        : null,
    highConfidenceRows:
      challengerHighConfidence,
    highConfidenceMisses:
      challengerHighConfidenceMiss,
    falsePositives:
      challengerFalsePositives,
    falseNegatives:
      challengerFalseNegatives
  };

  return {
    pairedRows:n,
    positive,
    negative,
    raw:rawMetrics,
    challenger:challengerMetrics,
    delta:{
      brier:
        round(
          rawMetrics.meanBrier-
          challengerMetrics.meanBrier,
          6
        ),
      logLoss:
        round(
          rawMetrics.meanLogLoss-
          challengerMetrics.meanLogLoss,
          6
        ),
      accuracyPct:
        round(
          challengerMetrics.accuracyPct-
          rawMetrics.accuracyPct,
          2
        ),
      ecePct:
        (
          finite(rawMetrics.ecePct)!==null &&
          finite(challengerMetrics.ecePct)!==null
        )
          ? round(
              rawMetrics.ecePct-
              challengerMetrics.ecePct,
              2
            )
          : null,
      highConfidenceMissRatePct:
        (
          finite(rawMetrics.highConfidenceMissRatePct)!==null &&
          finite(challengerMetrics.highConfidenceMissRatePct)!==null
        )
          ? round(
              rawMetrics.highConfidenceMissRatePct-
              challengerMetrics.highConfidenceMissRatePct,
              2
            )
          : null
    },
    pairedWins:{
      raw:rawWins,
      challenger:challengerWins,
      ties
    }
  };
}

function verdict(summary={}){
  const paired=
    Number(summary?.pairedRows||0);

  const positive=
    Number(summary?.positive||0);

  const negative=
    Number(summary?.negative||0);

  if(paired<MIN_PAIRED){
    return {
      status:'BENCHMARK_COLD_START',
      challengerWins:false,
      reviewEligible:false,
      reason:'NEED_AT_LEAST_100_PAIRED_5M_OUTCOMES'
    };
  }

  if(
    positive<MIN_POSITIVE ||
    negative<MIN_NEGATIVE
  ){
    return {
      status:'BENCHMARK_CLASS_IMBALANCE',
      challengerWins:false,
      reviewEligible:false,
      reason:'NEED_AT_LEAST_20_POSITIVE_AND_20_NEGATIVE'
    };
  }

  const brier=
    finite(summary?.delta?.brier)??0;

  const logLoss=
    finite(summary?.delta?.logLoss)??0;

  const hcDelta=
    finite(
      summary?.delta
        ?.highConfidenceMissRatePct
    );

  const noHighConfidenceRegression=
    hcDelta===null ||
    hcDelta>=-0.01;

  if(
    brier>=MIN_BRIER_EDGE &&
    logLoss>=MIN_LOGLOSS_EDGE &&
    noHighConfidenceRegression
  ){
    return {
      status:'ERROR_AWARE_CHALLENGER_WINS',
      challengerWins:true,
      reviewEligible:true,
      reason:'CHALLENGER_BEATS_RAW_ON_BRIER_AND_LOGLOSS_WITHOUT_HIGH_CONFIDENCE_REGRESSION'
    };
  }

  if(
    brier<=-MIN_BRIER_EDGE &&
    logLoss<=-MIN_LOGLOSS_EDGE
  ){
    return {
      status:'RAW_V23_WINS',
      challengerWins:false,
      reviewEligible:false,
      reason:'RAW_V23_BEATS_ERROR_AWARE_CHALLENGER'
    };
  }

  return {
    status:'BENCHMARK_INCONCLUSIVE',
    challengerWins:false,
    reviewEligible:false,
    reason:'MIXED_OR_TOO_SMALL_PAIRED_EDGE'
  };
}

export function createShadowErrorAwareBenchmarkV23_19({
  dataDir=null,
  maxRows=10_000
}={}){
  const file=
    dataDir
      ? path.join(
          dataDir,
          'shadow-error-aware-benchmark-v23-19.jsonl'
        )
      : null;

  const rows=[];
  const recent=[];
  const queue=[];

  let draining=false;
  let rowsLoaded=0;
  let rowsWritten=0;
  let loadErrors=0;
  let writeErrors=0;
  let outcomesRecorded=0;
  let duplicatesRejected=0;
  let hydrating=Boolean(file);
  let hydrationComplete=!file;

  if(file){
    try{
      fs.mkdirSync(
        path.dirname(file),
        {recursive:true}
      );
    }catch{}
  }

  function kick(){
    if(
      draining ||
      !queue.length ||
      !file
    ){
      return;
    }

    draining=true;

    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=
            queue.splice(0,200);

          await fs.promises.appendFile(
            file,
            batch
              .map(row=>JSON.stringify(row))
              .join('\n')+
              '\n',
            'utf8'
          );

          rowsWritten+=batch.length;
        }
      }catch{
        writeErrors++;
      }finally{
        draining=false;

        if(queue.length){
          kick();
        }
      }
    });
  }

  function append(row){
    if(!file)return;

    queue.push(row);

    if(queue.length>10_000){
      queue.splice(
        0,
        queue.length-10_000
      );
    }

    kick();
  }

  async function flush(){
    if(!file)return true;

    kick();

    const started=Date.now();

    while(draining||queue.length){
      if(
        Date.now()-started>
        5_000
      ){
        return false;
      }

      await new Promise(
        resolve=>
          setTimeout(resolve,5)
      );
    }

    return true;
  }

  function addRow(raw,{persist=false}={}){
    const mint=
      String(raw?.mint||'');

    const anchorAt=
      Number(raw?.anchorAt||0);

    const horizonMs=
      Number(raw?.horizonMs||0);

    if(
      !mint ||
      !(anchorAt>0) ||
      !(horizonMs>0)
    ){
      return null;
    }

    const key=
      [
        mint,
        anchorAt,
        horizonMs
      ].join(':');

    if(
      rows.some(
        row=>row.key===key
      )
    ){
      duplicatesRejected++;
      return null;
    }

    const row={
      type:'error-aware-benchmark-outcome',
      version:'MEMEFLOW_SHADOW_ERROR_AWARE_BENCHMARK_ROW_V23_19',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      key,
      mint,
      anchorAt,
      observedAt:
        finite(raw?.observedAt),
      horizonMs,
      classification:
        upper(raw?.classification),
      scored:
        raw?.scored===true,
      rawProbabilityPct:
        finite(raw?.rawProbabilityPct),
      challengerProbabilityPct:
        finite(raw?.challengerProbabilityPct),
      rawConfidencePct:
        finite(raw?.rawConfidencePct),
      adjustedConfidencePct:
        finite(raw?.adjustedConfidencePct),
      penaltyPct:
        finite(raw?.penaltyPct),
      forecastSource:
        String(raw?.forecastSource||'NONE'),
      errorAwareStatus:
        upper(raw?.errorAwareStatus)
    };

    rows.push(row);

    const limit=
      Math.max(
        500,
        Number(maxRows)||10_000
      );

    if(rows.length>limit){
      rows.splice(
        0,
        rows.length-limit
      );
    }

    recent.unshift(row);

    if(recent.length>200){
      recent.length=200;
    }

    if(persist){
      append(row);
    }

    return row;
  }

  async function load(){
    try{
      const text=await readBoundedJsonlTail(file,20*1024*1024);
      await parseJsonlCooperatively(text,(row,parseError)=>{
        if(parseError){loadErrors++;return;}
        if(row?.type==='error-aware-benchmark-outcome'){
          const before=rows.length;
          addRow(row,{persist:false});
          if(rows.length>before)rowsLoaded++;
        }
      });
    }catch{
      loadErrors++;
    }finally{
      hydrating=false;
      hydrationComplete=true;
    }
  }

  function recordOutcome({
    anchor,
    outcome
  }={}){
    const mint=
      String(
        anchor?.mint||
        outcome?.mint||
        ''
      );

    if(
      !mint ||
      !anchor ||
      !outcome
    ){
      return null;
    }

    const errorAware=
      anchor?.features
        ?.shadowErrorAwareConfidence||{};

    const rawProbabilityPct=
      finite(
        errorAware?.probabilityPositivePct
      );

    const rawConfidencePct=
      finite(
        errorAware?.rawConfidencePct
      );

    const adjustedConfidencePct=
      finite(
        errorAware?.adjustedConfidencePct
      );

    if(
      rawProbabilityPct===null ||
      rawConfidencePct===null ||
      adjustedConfidencePct===null
    ){
      return null;
    }

    const classification=
      classifyOutcome(outcome);

    const scored=
      ['POSITIVE','NEGATIVE']
        .includes(classification);

    const challengerProbabilityPct=
      benchmarkProbability({
        rawProbabilityPct,
        rawConfidencePct,
        adjustedConfidencePct
      });

    const row=
      addRow(
        {
          mint,
          anchorAt:
            Number(anchor?.at)||0,
          observedAt:
            Number(outcome?.observedAt)||null,
          horizonMs:
            Number(outcome?.horizonMs)||0,
          classification,
          scored,
          rawProbabilityPct:
            clamp(
              rawProbabilityPct,
              0,
              100
            ),
          challengerProbabilityPct,
          rawConfidencePct:
            clamp(
              rawConfidencePct,
              0,
              100
            ),
          adjustedConfidencePct:
            clamp(
              adjustedConfidencePct,
              0,
              100
            ),
          penaltyPct:
            clamp(
              Number(errorAware?.penaltyPct)||0,
              0,
              100
            ),
          forecastSource:
            errorAware?.forecastSource,
          errorAwareStatus:
            errorAware?.status
        },
        {persist:true}
      );

    if(row){
      outcomesRecorded++;
    }

    return row;
  }

  function report({
    horizonMs=TARGET_HORIZON_MS
  }={}){
    const horizon=
      Number(horizonMs);

    const summary=
      summarize(
        rows.filter(
          row=>
            row.horizonMs===horizon
        )
      );

    return {
      version:'MEMEFLOW_SHADOW_ERROR_AWARE_BENCHMARK_V23_19',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      comparison:'RAW_V23_VS_BENCHMARK_ONLY_ERROR_AWARE_SHRINKAGE',
      liveProbabilityMutation:false,
      benchmarkDerivedProbabilityOnly:true,
      autoPromotion:false,
      horizonMs:horizon,
      ...summary,
      verdict:
        horizon===TARGET_HORIZON_MS
          ? verdict(summary)
          : {
              status:'DIAGNOSTIC_HORIZON_ONLY',
              challengerWins:false,
              reviewEligible:false,
              reason:'ONLY_5M_IS_TARGET'
            },
      requirements:{
        paired5m:MIN_PAIRED,
        positive5m:MIN_POSITIVE,
        negative5m:MIN_NEGATIVE,
        minBrierEdge:MIN_BRIER_EDGE,
        minLogLossEdge:MIN_LOGLOSS_EDGE,
        highConfidenceMissRegressionAllowed:false
      }
    };
  }

  function horizonReport(){
    return [
      ...new Set(
        rows.map(
          row=>row.horizonMs
        )
      )
    ]
      .sort((a,b)=>a-b)
      .map(
        horizonMs=>
          report({horizonMs})
      );
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

  function listRows({
    limit=5000,
    horizonMs=null,
    penalizedOnly=false
  }={}){
    const safe=
      Math.max(
        1,
        Math.min(
          10_000,
          Number(limit)||5000
        )
      );

    const horizon=
      horizonMs===null
        ? null
        : Number(horizonMs);

    return rows
      .filter(
        row=>
          (
            horizon===null ||
            row.horizonMs===horizon
          ) &&
          (
            penalizedOnly!==true ||
            Number(row?.penaltyPct||0)>0
          )
      )
      .slice(-safe)
      .reverse();
  }

  function status(){
    const target=
      report({
        horizonMs:
          TARGET_HORIZON_MS
      });

    return {
      version:'MEMEFLOW_SHADOW_ERROR_AWARE_BENCHMARK_V23_19',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      liveProbabilityMutation:false,
      benchmarkDerivedProbabilityOnly:true,
      autoPromotion:false,
      targetHorizonMs:
        TARGET_HORIZON_MS,
      target:{
        pairedRows:
          target.pairedRows,
        positive:
          target.positive,
        negative:
          target.negative,
        raw:
          target.raw,
        challenger:
          target.challenger,
        delta:
          target.delta,
        pairedWins:
          target.pairedWins,
        verdict:
          target.verdict
      },
      rows:
        rows.length,
      outcomesRecorded,
      duplicatesRejected,
      rowsLoaded,
      rowsWritten,
      queued:
        queue.length,
      draining,
      loadErrors,
      writeErrors,
      hydrating,
      hydrationComplete,
      file
    };
  }

  const hydrationPromise=file
    ? enqueueHistoryHydration(load)
    : load();

  return {
    recordOutcome,
    report,
    horizonReport,
    listRecent,
    listRows,
    status,
    flush,
    whenHydrated:()=>hydrationPromise
  };
}
