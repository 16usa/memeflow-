import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_OUTCOME_CALIBRATION_V23_11
// SHADOW ONLY. No Score/State/settings/BUY/SELL authority.

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

function readTailUtf8(file,maxBytes=20*1024*1024){
  try{
    if(!file||!fs.existsSync(file))return '';

    const st=fs.statSync(file);
    if(!(st.size>0))return '';

    if(st.size<=maxBytes){
      return fs.readFileSync(file,'utf8');
    }

    const fd=fs.openSync(file,'r');

    try{
      const buf=Buffer.allocUnsafe(maxBytes);
      fs.readSync(fd,buf,0,maxBytes,st.size-maxBytes);

      let text=buf.toString('utf8');
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

function bucketIndex(probabilityPct){
  const p=clamp(finite(probabilityPct)??50,0,100);

  if(p>=100)return 9;

  return Math.max(0,Math.min(9,Math.floor(p/10)));
}

function safeLogLoss(probability,target){
  const p=clamp(Number(probability),1e-6,1-1e-6);

  return -(
    target*Math.log(p)+
    (1-target)*Math.log(1-p)
  );
}

function quality(rows=[]){
  const scored=rows.filter(
    row=>
      row.scored===true &&
      finite(row.rawProbabilityPositivePct)!==null
  );

  if(!scored.length){
    return {
      scored:0,
      positive:0,
      negative:0,
      accuracyPct:null,
      meanBrier:null,
      meanLogLoss:null,
      ecePct:null
    };
  }

  let correct=0;
  let positive=0;
  let negative=0;
  let brier=0;
  let logLoss=0;

  const buckets=Array.from(
    {length:10},
    (_,index)=>({index,rows:[]})
  );

  for(const row of scored){
    const target=row.classification==='POSITIVE'?1:0;
    const p=clamp(Number(row.rawProbabilityPositivePct)/100,0,1);

    if((p>=0.5?1:0)===target)correct++;

    if(target===1)positive++;
    else negative++;

    brier+=(p-target)**2;
    logLoss+=safeLogLoss(p,target);

    buckets[bucketIndex(row.rawProbabilityPositivePct)].rows.push(row);
  }

  let ece=0;

  for(const bucket of buckets){
    if(!bucket.rows.length)continue;

    const n=bucket.rows.length;
    const meanP=bucket.rows.reduce(
      (sum,row)=>sum+Number(row.rawProbabilityPositivePct)/100,
      0
    )/n;

    const actual=bucket.rows.reduce(
      (sum,row)=>sum+(row.classification==='POSITIVE'?1:0),
      0
    )/n;

    ece+=Math.abs(meanP-actual)*n/scored.length;
  }

  return {
    scored:scored.length,
    positive,
    negative,
    accuracyPct:round(correct/scored.length*100,2),
    meanBrier:round(brier/scored.length,6),
    meanLogLoss:round(logLoss/scored.length,6),
    ecePct:round(ece*100,2)
  };
}

function bucketStats(rows=[],index){
  const bucketRows=rows.filter(
    row=>
      row.scored===true &&
      bucketIndex(row.rawProbabilityPositivePct)===index
  );

  if(!bucketRows.length){
    return {
      count:0,
      positive:0,
      empiricalPositivePct:null,
      meanForecastPct:null
    };
  }

  const positive=bucketRows.filter(
    row=>row.classification==='POSITIVE'
  ).length;

  const meanForecast=bucketRows.reduce(
    (sum,row)=>sum+Number(row.rawProbabilityPositivePct),
    0
  )/bucketRows.length;

  return {
    count:bucketRows.length,
    positive,
    empiricalPositivePct:round(positive/bucketRows.length*100,2),
    meanForecastPct:round(meanForecast,2)
  };
}

function calibrationStatus(report){
  const n=Number(report?.scored||0);
  const ece=finite(report?.ecePct);

  if(n<20)return 'CALIBRATION_COLD_START';
  if(n<50)return 'CALIBRATION_LEARNING';
  if(ece===null)return 'CALIBRATION_LEARNING';
  if(ece<=10)return 'CALIBRATION_HEALTHY';
  if(ece<=15)return 'CALIBRATION_WATCH';
  return 'CALIBRATION_MISALIGNED';
}

export function createShadowOutcomeCalibrationV23_11({
  dataDir=null,
  maxRows=10_000
}={}){
  const file=dataDir
    ? path.join(dataDir,'outcome-calibration-v23-11.jsonl')
    : null;

  const rows=[];
  const recent=[];
  const queue=[];

  let draining=false;
  let rowsLoaded=0;
  let rowsWritten=0;
  let loadErrors=0;
  let writeErrors=0;
  let predictions=0;
  let outcomesRecorded=0;
  let duplicatesRejected=0;

  if(file){
    try{
      fs.mkdirSync(path.dirname(file),{recursive:true});
    }catch{}
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

    if(queue.length>10_000){
      queue.splice(0,queue.length-10_000);
    }

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

  function bound(){
    const limit=Math.max(500,Number(maxRows)||10_000);

    if(rows.length>limit){
      rows.splice(0,rows.length-limit);
    }
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
      type:'calibration-outcome',
      version:'MEMEFLOW_CALIBRATION_OUTCOME_V23_11',
      shadowOnly:true,
      key,
      mint,
      anchorAt,
      observedAt:Number(raw?.observedAt||0)||null,
      horizonMs,
      classification:upper(raw?.classification),
      scored:raw?.scored===true,
      rawProbabilityPositivePct:finite(raw?.rawProbabilityPositivePct),
      rawConfidencePct:finite(raw?.rawConfidencePct),
      synthesisStatus:upper(raw?.synthesisStatus)
    };

    rows.push(row);
    bound();

    if(persist)append(row);

    return row;
  }

  function load(){
    if(!file)return;

    const text=readTailUtf8(file);

    for(const line of text.split('\n')){
      if(!line.trim())continue;

      try{
        const row=JSON.parse(line);

        if(row?.type==='calibration-outcome'){
          const before=rows.length;

          addRow(row,{persist:false});

          if(rows.length>before)rowsLoaded++;
        }
      }catch{
        loadErrors++;
      }
    }
  }

  function historicalRows({horizonMs,mint=null,before=null}={}){
    const horizon=Number(horizonMs||0);
    const beforeAt=Number(before||0);

    return rows.filter(
      row=>
        row.horizonMs===horizon &&
        (!mint||row.mint!==mint) &&
        (
          !beforeAt ||
          !row.observedAt ||
          Number(row.observedAt)<beforeAt
        )
    );
  }

  function predict(snapshot={},meta={}){
    const mint=String(meta?.mint||snapshot?.mint||'');
    const now=Number(meta?.at||snapshot?.observedAt||Date.now());
    const synthesis=snapshot?.shadowEvidenceSynthesis||{};

    const rawP=finite(synthesis.synthesisProbabilityPositivePct);
    const rawC=finite(synthesis.synthesisConfidencePct);

    const eligible=historicalRows({
      horizonMs:TARGET_HORIZON_MS,
      mint,
      before:now
    });

    const report=quality(eligible);
    const status=calibrationStatus(report);

    if(synthesis.ready!==true||rawP===null){
      const cold={
        version:'MEMEFLOW_OUTCOME_CALIBRATION_V23_11',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        status:'CALIBRATION_NO_SYNTHESIS',
        ready:false,
        targetHorizonMs:TARGET_HORIZON_MS,
        rawProbabilityPositivePct:rawP,
        calibratedProbabilityPositivePct:null,
        calibrationDeltaPct:null,
        rawConfidencePct:rawC??0,
        calibratedConfidencePct:0,
        bucket:null,
        bucketCount:0,
        bucketEmpiricalPositivePct:null,
        reliabilitySampleCount:report.scored,
        globalEcePct:report.ecePct,
        globalBrier:report.meanBrier,
        globalLogLoss:report.meanLogLoss,
        mint:mint||null,
        observedAt:now
      };

      recent.unshift(cold);
      if(recent.length>200)recent.length=200;

      return cold;
    }

    const index=bucketIndex(rawP);
    const bucket=bucketStats(eligible,index);

    let calibrated=rawP;
    let blendWeight=0;

    if(bucket.count>0&&bucket.empiricalPositivePct!==null){
      // Conservative empirical reliability correction.
      // Even with large samples the empirical bucket gets max 75% weight.
      blendWeight=clamp(
        bucket.count/(bucket.count+30),
        0,
        0.75
      );

      calibrated=
        rawP*(1-blendWeight)+
        Number(bucket.empiricalPositivePct)*blendWeight;
    }

    calibrated=clamp(calibrated,0,100);

    const ecePenalty=report.ecePct===null
      ? 0.70
      : clamp(1-Number(report.ecePct)/40,0.35,1);

    const sampleFactor=clamp(report.scored/100,0.25,1);
    const bucketFactor=clamp(bucket.count/30,0.35,1);

    const calibratedConfidence=clamp(
      Number(rawC??0)*
      ecePenalty*
      sampleFactor*
      bucketFactor,
      0,
      100
    );

    const result={
      version:'MEMEFLOW_OUTCOME_CALIBRATION_V23_11',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      status,
      ready:report.scored>=20,
      targetHorizonMs:TARGET_HORIZON_MS,
      rawProbabilityPositivePct:round(rawP,2),
      calibratedProbabilityPositivePct:round(calibrated,2),
      calibrationDeltaPct:round(calibrated-rawP,2),
      rawConfidencePct:round(rawC??0,2),
      calibratedConfidencePct:round(calibratedConfidence,2),
      bucket:{
        index,
        lowerPct:index*10,
        upperPct:index===9?100:(index+1)*10
      },
      bucketCount:bucket.count,
      bucketEmpiricalPositivePct:bucket.empiricalPositivePct,
      bucketMeanForecastPct:bucket.meanForecastPct,
      bucketBlendWeightPct:round(blendWeight*100,2),
      reliabilitySampleCount:report.scored,
      globalAccuracyPct:report.accuracyPct,
      globalEcePct:report.ecePct,
      globalBrier:report.meanBrier,
      globalLogLoss:report.meanLogLoss,
      mint:mint||null,
      observedAt:now
    };

    predictions++;
    recent.unshift(result);

    if(recent.length>200)recent.length=200;

    return result;
  }

  function recordOutcome({anchor,outcome}={}){
    const mint=String(anchor?.mint||outcome?.mint||'');

    if(!mint||!anchor||!outcome)return null;

    const synthesis=anchor?.features?.shadowEvidenceSynthesis||{};

    const rawProbabilityPositivePct=
      finite(synthesis.synthesisProbabilityPositivePct);

    if(synthesis.ready!==true||rawProbabilityPositivePct===null){
      return null;
    }

    const classification=classifyOutcome(outcome);
    const scored=['POSITIVE','NEGATIVE'].includes(classification);

    const row=addRow(
      {
        mint,
        anchorAt:Number(anchor.at)||0,
        observedAt:Number(outcome.observedAt)||null,
        horizonMs:Number(outcome.horizonMs)||0,
        classification,
        scored,
        rawProbabilityPositivePct,
        rawConfidencePct:finite(synthesis.synthesisConfidencePct),
        synthesisStatus:synthesis.status
      },
      {persist:true}
    );

    if(row)outcomesRecorded++;

    return row;
  }

  function horizonReport(){
    const horizons=[...new Set(rows.map(row=>row.horizonMs))]
      .sort((a,b)=>a-b);

    return horizons.map(horizonMs=>{
      const report=quality(
        rows.filter(row=>row.horizonMs===horizonMs)
      );

      return {
        horizonMs,
        ...report,
        status:calibrationStatus(report)
      };
    });
  }

  function bucketReport({horizonMs=TARGET_HORIZON_MS}={}){
    const source=rows.filter(
      row=>row.horizonMs===Number(horizonMs)
    );

    return Array.from(
      {length:10},
      (_,index)=>({
        index,
        lowerPct:index*10,
        upperPct:index===9?100:(index+1)*10,
        ...bucketStats(source,index)
      })
    );
  }

  function listRecent({limit=50,status=null}={}){
    const safe=Math.max(1,Math.min(200,Number(limit)||50));
    const wanted=status?upper(status):null;

    return recent
      .filter(row=>!wanted||row.status===wanted)
      .slice(0,safe);
  }

  function status(){
    const targetRows=rows.filter(
      row=>row.horizonMs===TARGET_HORIZON_MS
    );

    const targetQuality=quality(targetRows);

    return {
      version:'MEMEFLOW_OUTCOME_CALIBRATION_V23_11',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      targetHorizonMs:TARGET_HORIZON_MS,
      method:'ONLINE_RELIABILITY_BINS_WITH_CONSERVATIVE_EMPIRICAL_SHRINKAGE',
      rows:rows.length,
      targetScoredRows:targetQuality.scored,
      targetStatus:calibrationStatus(targetQuality),
      targetAccuracyPct:targetQuality.accuracyPct,
      targetEcePct:targetQuality.ecePct,
      targetBrier:targetQuality.meanBrier,
      targetLogLoss:targetQuality.meanLogLoss,
      predictions,
      outcomesRecorded,
      duplicatesRejected,
      rowsLoaded,
      rowsWritten,
      queued:queue.length,
      draining,
      loadErrors,
      writeErrors,
      file
    };
  }

  load();

  return {
    predict,
    recordOutcome,
    horizonReport,
    bucketReport,
    listRecent,
    status,
    flush
  };
}
