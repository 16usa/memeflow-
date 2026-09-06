import fs from 'node:fs';
import path from 'node:path';
import {
  enqueueHistoryHydration,
  parseJsonlCooperatively,
  readBoundedJsonlTail
} from './shadow-history-hydration-v23.mjs';

// MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_V23_12
// SHADOW ONLY. No Score/State/settings/BUY/SELL authority.
// Paired predictive benchmark on the exact same frozen anchor/outcome.
// V22 baseline = canonical Score / 100 signal (explicitly not calibrated probability / not PnL).
// V23 challenger = V23.11 calibrated probability when ready, else V23.10 synthesis.

const TARGET_HORIZON_MS=300_000;

const finite=v=>{
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const round=(v,d=2)=>{
  const n=finite(v);
  if(n===null)return null;
  const p=10**d;
  return Math.round(n*p)/p;
};
const upper=v=>String(v||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

function classifyOutcome(outcome={}){
  if(outcome.dead===true)return 'NEGATIVE';
  const ret=finite(outcome.returnPct);
  const mfe=finite(outcome.maxFavorableExcursionPct);
  const mae=finite(outcome.maxAdverseExcursionPct);

  if(
    (ret!==null&&ret>=20) ||
    (mfe!==null&&mfe>=50&&(mae===null||mae>-25))
  )return 'POSITIVE';

  if(
    (ret!==null&&ret<=-20) ||
    (mae!==null&&mae<=-25)
  )return 'NEGATIVE';

  return 'NEUTRAL';
}

function safeLogLoss(p,y){
  p=clamp(Number(p),1e-6,1-1e-6);
  return -(y*Math.log(p)+(1-y)*Math.log(1-p));
}

function summarize(rows=[]){
  const scored=rows.filter(row=>
    row.scored===true &&
    finite(row.v22SignalPct)!==null &&
    finite(row.v23ProbabilityPct)!==null
  );

  if(!scored.length){
    return {
      pairedRows:0,
      positive:0,
      negative:0,
      v22:{meanBrier:null,meanLogLoss:null,accuracyPct:null},
      v23:{meanBrier:null,meanLogLoss:null,accuracyPct:null},
      delta:{brier:null,logLoss:null,accuracyPct:null},
      pairedWins:{v22:0,v23:0,ties:0}
    };
  }

  let positive=0,negative=0;
  let v22Brier=0,v23Brier=0,v22LogLoss=0,v23LogLoss=0;
  let v22Correct=0,v23Correct=0,v22Wins=0,v23Wins=0,ties=0;

  for(const row of scored){
    const y=row.classification==='POSITIVE'?1:0;
    if(y)positive++; else negative++;

    const p22=clamp(Number(row.v22SignalPct)/100,0,1);
    const p23=clamp(Number(row.v23ProbabilityPct)/100,0,1);

    const b22=(p22-y)**2;
    const b23=(p23-y)**2;

    v22Brier+=b22;
    v23Brier+=b23;
    v22LogLoss+=safeLogLoss(p22,y);
    v23LogLoss+=safeLogLoss(p23,y);

    if((p22>=0.5?1:0)===y)v22Correct++;
    if((p23>=0.5?1:0)===y)v23Correct++;

    if(Math.abs(b22-b23)<=1e-9)ties++;
    else if(b23<b22)v23Wins++;
    else v22Wins++;
  }

  const n=scored.length;
  const mb22=v22Brier/n, mb23=v23Brier/n;
  const ml22=v22LogLoss/n, ml23=v23LogLoss/n;
  const a22=v22Correct/n*100, a23=v23Correct/n*100;

  return {
    pairedRows:n,
    positive,
    negative,
    v22:{
      meanBrier:round(mb22,6),
      meanLogLoss:round(ml22,6),
      accuracyPct:round(a22,2)
    },
    v23:{
      meanBrier:round(mb23,6),
      meanLogLoss:round(ml23,6),
      accuracyPct:round(a23,2)
    },
    delta:{
      brier:round(mb22-mb23,6),
      logLoss:round(ml22-ml23,6),
      accuracyPct:round(a23-a22,2)
    },
    pairedWins:{v22:v22Wins,v23:v23Wins,ties}
  };
}

function verdict(report){
  const n=Number(report?.pairedRows||0);
  const positive=Number(report?.positive||0);
  const negative=Number(report?.negative||0);

  if(n<50){
    return {
      status:'BENCHMARK_COLD_START',
      promotionEligible:false,
      reason:'NEED_AT_LEAST_50_PAIRED_5M_OUTCOMES'
    };
  }

  if(positive<10||negative<10){
    return {
      status:'BENCHMARK_CLASS_IMBALANCE',
      promotionEligible:false,
      reason:'NEED_AT_LEAST_10_POSITIVE_AND_10_NEGATIVE'
    };
  }

  const brier=finite(report?.delta?.brier)??0;
  const logLoss=finite(report?.delta?.logLoss)??0;
  const accuracy=finite(report?.delta?.accuracyPct)??0;

  if(brier>=0.005&&logLoss>=0.01&&accuracy>=-2){
    return {
      status:'V23_CHALLENGER_WINS',
      promotionEligible:true,
      reason:'V23_BEATS_V22_ON_BRIER_AND_LOG_LOSS'
    };
  }

  if(brier<=-0.005&&logLoss<=-0.01){
    return {
      status:'V22_BASELINE_WINS',
      promotionEligible:false,
      reason:'V22_BEATS_V23_ON_BRIER_AND_LOG_LOSS'
    };
  }

  return {
    status:'BENCHMARK_INCONCLUSIVE',
    promotionEligible:false,
    reason:'MIXED_OR_TOO_SMALL_PERFORMANCE_DELTA'
  };
}

export function createShadowChampionBenchmarkV23_12({
  dataDir=null,
  maxRows=10_000
}={}){
  const file=dataDir
    ? path.join(dataDir,'shadow-champion-benchmark-v23-12.jsonl')
    : null;

  const rows=[];
  const recent=[];
  const queue=[];

  let draining=false;
  let rowsLoaded=0,rowsWritten=0,loadErrors=0,writeErrors=0;
  let outcomesRecorded=0,duplicatesRejected=0;
  let hydrating=Boolean(file),hydrationComplete=!file;

  if(file){
    try{fs.mkdirSync(path.dirname(file),{recursive:true});}catch{}
  }

  function kick(){
    if(draining||!queue.length||!file)return;
    draining=true;

    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=queue.splice(0,200);
          await fs.promises.appendFile(
            file,
            batch.map(row=>JSON.stringify(row)).join('\n')+'\n',
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

  function append(row){
    if(!file)return;
    queue.push(row);
    if(queue.length>10_000)queue.splice(0,queue.length-10_000);
    kick();
  }

  async function flush(){
    if(!file)return true;
    kick();
    const started=Date.now();

    while(draining||queue.length){
      if(Date.now()-started>5_000)return false;
      await new Promise(resolve=>setTimeout(resolve,5));
    }
    return true;
  }

  function addRow(raw,{persist=false}={}){
    const mint=String(raw?.mint||'');
    const anchorAt=Number(raw?.anchorAt||0);
    const horizonMs=Number(raw?.horizonMs||0);

    if(!mint||!(anchorAt>0)||!(horizonMs>0))return null;

    const key=[mint,anchorAt,horizonMs].join(':');

    if(rows.some(row=>row.key===key)){
      duplicatesRejected++;
      return null;
    }

    const row={
      type:'champion-benchmark-outcome',
      version:'MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_ROW_V23_12',
      shadowOnly:true,
      key,
      mint,
      anchorAt,
      observedAt:Number(raw?.observedAt||0)||null,
      horizonMs,
      classification:upper(raw?.classification),
      scored:raw?.scored===true,
      v22SignalPct:finite(raw?.v22SignalPct),
      v23ProbabilityPct:finite(raw?.v23ProbabilityPct),
      v23ProbabilitySource:String(raw?.v23ProbabilitySource||'NONE'),
      v23ConfidencePct:finite(raw?.v23ConfidencePct),
      v23CalibrationReady:raw?.v23CalibrationReady===true,
      synthesisStatus:upper(raw?.synthesisStatus),
      calibrationStatus:upper(raw?.calibrationStatus)
    };

    rows.push(row);

    const limit=Math.max(500,Number(maxRows)||10_000);
    if(rows.length>limit)rows.splice(0,rows.length-limit);

    recent.unshift(row);
    if(recent.length>200)recent.length=200;

    if(persist)append(row);

    return row;
  }

  async function load(){
    try{
      const text=await readBoundedJsonlTail(file,20*1024*1024);
      await parseJsonlCooperatively(text,(row,parseError)=>{
        if(parseError){loadErrors++;return;}
        if(row?.type==='champion-benchmark-outcome'){
          const before=rows.length;
          addRow(row,{persist:false});
          if(rows.length>before)rowsLoaded++;
        }
      });
    }catch{
      loadErrors++;
    }finally{
      hydrating=false;hydrationComplete=true;
    }
  }

  function recordOutcome({anchor,outcome}={}){
    const mint=String(anchor?.mint||outcome?.mint||'');

    if(!mint||!anchor||!outcome)return null;

    const v22SignalPct=finite(anchor?.canonicalScore);
    const features=anchor?.features||{};

    const synthesis=features?.shadowEvidenceSynthesis||{};
    const calibration=features?.shadowOutcomeCalibration||{};

    const calibratedP=calibration.ready===true
      ? finite(calibration.calibratedProbabilityPositivePct)
      : null;

    const synthesisP=synthesis.ready===true
      ? finite(synthesis.synthesisProbabilityPositivePct)
      : null;

    const v23ProbabilityPct=calibratedP!==null?calibratedP:synthesisP;

    if(v22SignalPct===null||v23ProbabilityPct===null)return null;

    const classification=classifyOutcome(outcome);
    const scored=['POSITIVE','NEGATIVE'].includes(classification);

    const row=addRow({
      mint,
      anchorAt:Number(anchor.at)||0,
      observedAt:Number(outcome.observedAt)||null,
      horizonMs:Number(outcome.horizonMs)||0,
      classification,
      scored,
      v22SignalPct:clamp(v22SignalPct,0,100),
      v23ProbabilityPct:clamp(v23ProbabilityPct,0,100),
      v23ProbabilitySource:calibratedP!==null
        ? 'V23_11_CALIBRATED'
        : 'V23_10_SYNTHESIS',
      v23ConfidencePct:calibratedP!==null
        ? finite(calibration.calibratedConfidencePct)
        : finite(synthesis.synthesisConfidencePct),
      v23CalibrationReady:calibration.ready===true,
      synthesisStatus:synthesis.status,
      calibrationStatus:calibration.status
    },{persist:true});

    if(row)outcomesRecorded++;

    return row;
  }

  function report({horizonMs=TARGET_HORIZON_MS}={}){
    const horizon=Number(horizonMs);

    const summary=summarize(
      rows.filter(row=>row.horizonMs===horizon)
    );

    return {
      version:'MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_V23_12',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      comparison:'V22_CANONICAL_SCORE_SIGNAL_VS_V23_PROBABILITY',
      caveat:'V22_SCORE_IS_NOT_A_CALIBRATED_PROBABILITY_AND_THIS_IS_NOT_PNL',
      horizonMs:horizon,
      ...summary,
      verdict:horizon===TARGET_HORIZON_MS
        ? verdict(summary)
        : {
            status:'DIAGNOSTIC_HORIZON_ONLY',
            promotionEligible:false,
            reason:'ONLY_5M_IS_PROMOTION_TARGET'
          }
    };
  }

  function horizonReport(){
    return [...new Set(rows.map(row=>row.horizonMs))]
      .sort((a,b)=>a-b)
      .map(horizonMs=>report({horizonMs}));
  }

  function listRecent({limit=50,source=null}={}){
    const safe=Math.max(1,Math.min(200,Number(limit)||50));
    const wanted=source?String(source).toUpperCase():null;

    return recent
      .filter(row=>
        !wanted ||
        String(row.v23ProbabilitySource).toUpperCase()===wanted
      )
      .slice(0,safe);
  }

  function status(){
    const target=report({horizonMs:TARGET_HORIZON_MS});

    return {
      version:'MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_V23_12',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      targetHorizonMs:TARGET_HORIZON_MS,
      comparison:target.comparison,
      caveat:target.caveat,
      target:{
        pairedRows:target.pairedRows,
        positive:target.positive,
        negative:target.negative,
        v22:target.v22,
        v23:target.v23,
        delta:target.delta,
        pairedWins:target.pairedWins,
        verdict:target.verdict
      },
      rows:rows.length,
      outcomesRecorded,
      duplicatesRejected,
      rowsLoaded,
      rowsWritten,
      queued:queue.length,
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
    status,
    flush,
    whenHydrated:()=>hydrationPromise
  };
}
