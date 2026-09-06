import fs from 'node:fs';
import path from 'node:path';
import {
  enqueueHistoryHydration,
  parseJsonlCooperatively,
  readBoundedJsonlTail
} from './shadow-history-hydration-v23.mjs';

// MEMEFLOW_SHADOW_OUTCOME_REVIEW_V23_16
//
// SHADOW ONLY.
//
// Retrospective diagnostic review of frozen V23 evidence vs completed outcomes.
// Attribution tags are NOT causal claims; they are audit hints for finding
// recurring failure modes.
//
// No Score/State/Settings/BUY/SELL mutation.

const TARGET_HORIZON_MS=300_000;

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

function forecastFromAnchor(anchor={}){
  const features=anchor?.features||{};
  const calibration=
    features?.shadowOutcomeCalibration||{};
  const synthesis=
    features?.shadowEvidenceSynthesis||{};
  const governor=
    features?.shadowConfidenceGovernor||{};
  const arena=
    features?.shadowModelArena||{};
  const brain=
    features?.shadowMathBrain||{};

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

function outcomeType(predicted,actual){
  if(actual==='NEUTRAL')return 'NEUTRAL_OUTCOME';
  if(predicted==='NEUTRAL')return 'ABSTAINED';

  if(
    predicted==='POSITIVE' &&
    actual==='POSITIVE'
  ){
    return 'TRUE_POSITIVE';
  }

  if(
    predicted==='NEGATIVE' &&
    actual==='NEGATIVE'
  ){
    return 'TRUE_NEGATIVE';
  }

  if(
    predicted==='POSITIVE' &&
    actual==='NEGATIVE'
  ){
    return 'FALSE_POSITIVE';
  }

  if(
    predicted==='NEGATIVE' &&
    actual==='POSITIVE'
  ){
    return 'FALSE_NEGATIVE';
  }

  return 'UNKNOWN';
}

function attributionTags(anchor={},forecast={},actual='UNKNOWN'){
  const f=anchor?.features||{};
  const synthesis=f?.shadowEvidenceSynthesis||{};
  const governor=f?.shadowConfidenceGovernor||{};
  const trajectory=f?.shadowTokenTrajectory||{};
  const pattern=f?.shadowTokenPattern||{};
  const calibration=f?.shadowOutcomeCalibration||{};
  const drift=f?.shadowDriftRegime||{};
  const specialists=f?.specialists||{};
  const evidence=f?.evidence||{};
  const tags=[];

  const blockers=
    Array.isArray(synthesis?.blockers)
      ? synthesis.blockers
      : [];

  for(const blocker of blockers.slice(0,6)){
    tags.push(
      `SYNTHESIS_BLOCKER_${upper(blocker)}`
    );
  }

  const disagreement=
    finite(synthesis?.crossSourceDisagreementPct) ??
    finite(governor?.disagreementPct);

  if(disagreement!==null&&disagreement>=45){
    tags.push('HIGH_MODEL_DISAGREEMENT');
  }

  const trajectoryState=
    upper(trajectory?.trajectoryState);

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
    upper(
      drift?.driftStatus||
      drift?.status
    );

  if(['DRIFT','ERROR'].includes(driftStatus)){
    tags.push(
      `MODEL_${driftStatus}`
    );
  }

  const completeness=
    finite(evidence?.dataQuality?.completenessPct);

  if(completeness!==null&&completeness<75){
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
      specialists?.wallet?.topBuyerSolSharePct
    );

  if(topBuyer!==null&&topBuyer>=35){
    tags.push('HIGH_BUYER_CONCENTRATION');
  }

  const smartP=
    finite(
      specialists?.smartMoneyMemory
        ?.weightedPositiveProbabilityPct
    );

  const forecastP=
    finite(forecast?.probabilityPct);

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

  if(
    finite(forecast?.confidencePct)!==null &&
    Number(forecast.confidencePct)>=70 &&
    (
      (forecastP>=62&&actual==='NEGATIVE') ||
      (forecastP<=38&&actual==='POSITIVE')
    )
  ){
    tags.push('HIGH_CONFIDENCE_MISS');
  }

  return [...new Set(tags)];
}

// History reads are shared with the other V23 shadow memories so hydration
// never blocks constructor startup.

export function createShadowOutcomeReviewV23_16({
  dataDir=null,
  maxRows=10_000
}={}){
  const file=
    dataDir
      ? path.join(
          dataDir,
          'shadow-outcome-review-v23-16.jsonl'
        )
      : null;

  const rows=[];
  const seen=new Set();
  const queue=[];
  let draining=false;
  let rowsLoaded=0;
  let rowsWritten=0;
  let loadErrors=0;
  let writeErrors=0;
  let recorded=0;
  let duplicates=0;
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

    while(
      draining ||
      queue.length
    ){
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

  function add(row,{persist=false}={}){
    if(
      !row?.key ||
      !row?.mint
    ){
      return null;
    }

    if(seen.has(row.key)){
      duplicates++;
      return null;
    }

    seen.add(row.key);
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
        if(row?.type==='shadow-outcome-review'&&add(row,{persist:false})){
          rowsLoaded++;
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
    if(
      !anchor?.mint ||
      !anchor?.features ||
      !outcome
    ){
      return null;
    }

    const forecast=
      forecastFromAnchor(anchor);

    const actual=
      classifyOutcome(outcome);

    const predicted=
      predictedClass(
        forecast.probabilityPct
      );

    const resultType=
      outcomeType(
        predicted,
        actual
      );

    const miss=
      [
        'FALSE_POSITIVE',
        'FALSE_NEGATIVE'
      ].includes(resultType);

    const hit=
      [
        'TRUE_POSITIVE',
        'TRUE_NEGATIVE'
      ].includes(resultType);

    const tags=
      attributionTags(
        anchor,
        forecast,
        actual
      );

    const row={
      type:'shadow-outcome-review',
      version:'MEMEFLOW_SHADOW_OUTCOME_REVIEW_ROW_V23_16',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      key:[
        String(anchor.mint),
        String(anchor.at||0),
        String(outcome.horizonMs||0)
      ].join(':'),
      mint:String(anchor.mint),
      anchorAt:
        finite(anchor.at),
      observedAt:
        finite(outcome.observedAt),
      horizonMs:
        finite(outcome.horizonMs),
      stageAtAnchor:
        anchor?.stage||null,
      regimeAtAnchor:
        anchor?.features?.evidence?.regime||null,
      canonicalScoreAtAnchor:
        finite(anchor?.canonicalScore),
      forecast:{
        probabilityPositivePct:
          round(
            forecast.probabilityPct,
            2
          ),
        confidencePct:
          round(
            forecast.confidencePct,
            2
          ),
        source:
          forecast.source,
        predictedClass:
          predicted
      },
      outcome:{
        classification:
          actual,
        returnPct:
          round(
            outcome?.returnPct,
            4
          ),
        maxFavorableExcursionPct:
          round(
            outcome?.maxFavorableExcursionPct,
            4
          ),
        maxAdverseExcursionPct:
          round(
            outcome?.maxAdverseExcursionPct,
            4
          ),
        dead:
          outcome?.dead===true
      },
      resultType,
      hit,
      miss,
      highConfidenceMiss:
        tags.includes(
          'HIGH_CONFIDENCE_MISS'
        ),
      attributionTags:
        tags,
      attributionDisclaimer:
        'TAGS_ARE_DIAGNOSTIC_ASSOCIATIONS_NOT_CAUSAL_PROOF'
    };

    const added=
      add(
        row,
        {persist:true}
      );

    if(added){
      recorded++;
    }

    return added;
  }

  function recent({
    limit=50,
    horizonMs=TARGET_HORIZON_MS,
    missesOnly=false,
    highConfidenceOnly=false
  }={}){
    const safe=
      Math.max(
        1,
        Math.min(
          200,
          Number(limit)||50
        )
      );

    const wantedHorizon=
      finite(horizonMs);

    return [...rows]
      .reverse()
      .filter(
        row=>
          wantedHorizon===null ||
          Number(row.horizonMs)===
          Number(wantedHorizon)
      )
      .filter(
        row=>
          missesOnly!==true ||
          row.miss===true
      )
      .filter(
        row=>
          highConfidenceOnly!==true ||
          row.highConfidenceMiss===true
      )
      .slice(
        0,
        safe
      );
  }

  function summary({
    horizonMs=TARGET_HORIZON_MS
  }={}){
    const horizon=
      finite(horizonMs);

    const source=
      rows.filter(
        row=>
          horizon===null ||
          Number(row.horizonMs)===
          Number(horizon)
      );

    const scored=
      source.filter(
        row=>
          row.hit===true ||
          row.miss===true
      );

    const hits=
      scored.filter(
        row=>row.hit===true
      );

    const misses=
      scored.filter(
        row=>row.miss===true
      );

    const falsePositives=
      misses.filter(
        row=>
          row.resultType===
          'FALSE_POSITIVE'
      ).length;

    const falseNegatives=
      misses.filter(
        row=>
          row.resultType===
          'FALSE_NEGATIVE'
      ).length;

    const tagCounts=new Map();

    for(const row of misses){
      for(const tag of row.attributionTags||[]){
        tagCounts.set(
          tag,
          (tagCounts.get(tag)||0)+1
        );
      }
    }

    const topMissTags=
      [...tagCounts.entries()]
        .map(
          ([tag,count])=>({
            tag,
            count
          })
        )
        .sort(
          (a,b)=>
            b.count-a.count
        )
        .slice(
          0,
          12
        );

    return {
      version:'MEMEFLOW_SHADOW_OUTCOME_REVIEW_V23_16',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      horizonMs:
        horizon,
      reviewed:
        source.length,
      scored:
        scored.length,
      hits:
        hits.length,
      misses:
        misses.length,
      hitRatePct:
        scored.length
          ? round(
              hits.length/
              scored.length*
              100,
              2
            )
          : null,
      falsePositives,
      falseNegatives,
      highConfidenceMisses:
        misses.filter(
          row=>
            row.highConfidenceMiss===true
        ).length,
      topMissTags
    };
  }

  function status(){
    return {
      version:'MEMEFLOW_SHADOW_OUTCOME_REVIEW_V23_16',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      targetHorizonMs:
        TARGET_HORIZON_MS,
      target:
        summary({
          horizonMs:
            TARGET_HORIZON_MS
        }),
      rows:
        rows.length,
      recorded,
      duplicates,
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
    recent,
    summary,
    status,
    flush,
    whenHydrated:()=>hydrationPromise
  };
}
