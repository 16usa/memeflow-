#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="66e2bf5ac90ffa6979c5a8779ed63d3aa27fd8e1"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
CALIBRATION="memeflow-app/src/shadow-outcome-calibration-v23_11.mjs"
TEST="memeflow-app/tests/shadow-outcome-calibration-v23_11.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$CALIBRATION" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW OUTCOME CALIBRATION V23.11 ==="

clear_lock(){
  if [[ -e .git/index.lock ]]; then
    active=""

    for proc in /proc/[0-9]*; do
      [[ -r "$proc/comm" ]] || continue

      comm="$(cat "$proc/comm" 2>/dev/null || true)"

      case "$comm" in
        git|git-*)
          cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"

          if [[ "$cwd" == "$ROOT" || "$cwd" == "$ROOT/"* ]]; then
            active="$proc:$comm:$cwd"
            break
          fi
        ;;
      esac
    done

    if [[ -n "$active" ]]; then
      echo "V23.11 REFUSED: active git process with index.lock"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.11 REFUSED: wrong branch"
  echo "expected: $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.11 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.11 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.11 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.11 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.11 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/outcome-calibration-v23-11-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.11 FAILED - RESTORING ==="

    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
    done

    for f in "${NEW_FILES[@]}"; do
      rm -f "$f"
    done

    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true

    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi

  exit "$rc"
}

trap rollback EXIT INT TERM

cat > "$CALIBRATION" <<'EOF_CALIBRATION'
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

EOF_CALIBRATION

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowOutcomeCalibrationV23_11
} from '../src/shadow-outcome-calibration-v23_11.mjs';

const tmp=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-v23-11-')
);

function anchor({mint,at,probability,confidence=70}){
  return {
    mint,
    at,
    features:{
      shadowEvidenceSynthesis:{
        ready:true,
        status:'SYNTHESIS_MODERATE',
        synthesisProbabilityPositivePct:probability,
        synthesisConfidencePct:confidence
      }
    }
  };
}

function outcome({mint,at,horizonMs=300_000,positive=true}){
  return {
    mint,
    observedAt:at+horizonMs,
    horizonMs,
    returnPct:positive?35:-30,
    maxFavorableExcursionPct:positive?55:5,
    maxAdverseExcursionPct:positive?-8:-35,
    dead:false
  };
}

try{
  const calibration=createShadowOutcomeCalibrationV23_11({
    dataDir:tmp
  });

  const base=1_801_200_000_000;

  for(let i=0;i<30;i++){
    const mint=`B7_${i}`;
    const at=base+i*1000;

    assert.ok(
      calibration.recordOutcome({
        anchor:anchor({mint,at,probability:75}),
        outcome:outcome({mint,at,positive:i<21})
      })
    );
  }

  for(let i=0;i<20;i++){
    const mint=`B8_${i}`;
    const at=base+40_000+i*1000;

    assert.ok(
      calibration.recordOutcome({
        anchor:anchor({mint,at,probability:85}),
        outcome:outcome({mint,at,positive:i<10})
      })
    );
  }

  for(const horizonMs of [15_000,30_000,60_000,180_000]){
    const mint=`H_${horizonMs}`;
    const at=base+100_000+horizonMs;

    calibration.recordOutcome({
      anchor:anchor({mint,at,probability:70}),
      outcome:outcome({mint,at,horizonMs,positive:true})
    });
  }

  const now=base+1_000_000;

  const calibrated=calibration.predict(
    {
      mint:'CURRENT',
      observedAt:now,
      shadowEvidenceSynthesis:{
        ready:true,
        status:'SYNTHESIS_MODERATE',
        synthesisProbabilityPositivePct:85,
        synthesisConfidencePct:80
      }
    },
    {
      mint:'CURRENT',
      at:now
    }
  );

  assert.equal(calibrated.ready,true);
  assert.equal(calibrated.reliabilitySampleCount,50);
  assert.equal(calibrated.bucketCount,20);

  assert.ok(
    calibrated.calibratedProbabilityPositivePct<
    calibrated.rawProbabilityPositivePct
  );

  assert.ok(
    calibrated.calibratedConfidencePct<
    calibrated.rawConfidencePct
  );

  assert.ok(calibrated.globalEcePct!==null);
  assert.ok(calibrated.globalBrier!==null);
  assert.ok(calibrated.globalLogLoss!==null);

  calibration.recordOutcome({
    anchor:anchor({
      mint:'CURRENT',
      at:base+200_000,
      probability:85
    }),
    outcome:outcome({
      mint:'CURRENT',
      at:base+200_000,
      positive:true
    })
  });

  const sameMintExcluded=calibration.predict(
    {
      mint:'CURRENT',
      observedAt:now+100_000,
      shadowEvidenceSynthesis:{
        ready:true,
        status:'SYNTHESIS_MODERATE',
        synthesisProbabilityPositivePct:85,
        synthesisConfidencePct:80
      }
    },
    {
      mint:'CURRENT',
      at:now+100_000
    }
  );

  assert.equal(
    sameMintExcluded.reliabilitySampleCount,
    50
  );

  const report=calibration.horizonReport();

  assert.ok(
    report.some(
      row=>row.horizonMs===300_000&&row.scored>=50
    )
  );

  assert.ok(
    report.some(
      row=>row.horizonMs===60_000
    )
  );

  const buckets=calibration.bucketReport({
    horizonMs:300_000
  });

  assert.equal(buckets.length,10);
  assert.equal(buckets[8].count,21);

  assert.equal(await calibration.flush(),true);

  const restored=createShadowOutcomeCalibrationV23_11({
    dataDir:tmp
  });

  assert.ok(restored.status().rowsLoaded>=50);

  assert.equal(typeof calibration.buy,'undefined');
  assert.equal(typeof calibration.sell,'undefined');
  assert.equal(typeof calibration.execute,'undefined');

  // Project wiring / strict SHADOW contract.
  const shadow=fs.readFileSync(
    'src/token-intelligence-shadow-v23.mjs',
    'utf8'
  );

  const app=fs.readFileSync(
    'app-server.mjs',
    'utf8'
  );

  assert.match(
    shadow,
    /createShadowOutcomeCalibrationV23_11/
  );

  assert.match(
    shadow,
    /shadowOutcomeCalibration\.predict/
  );

  assert.match(
    shadow,
    /shadowOutcomeCalibration\.recordOutcome/
  );

  assert.match(
    shadow,
    /shadowOutcomeCalibration:shadowOutcomeCalibration\.status\(\)/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/outcome-calibration/
  );

  assert.match(
    app,
    /outcomeCalibrationHorizonReport/
  );

  const source=fs.readFileSync(
    'src/shadow-outcome-calibration-v23_11.mjs',
    'utf8'
  );

  assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
  assert.doesNotMatch(source,/openPosition\s*\(/);
  assert.doesNotMatch(source,/closePosition\s*\(/);
  assert.doesNotMatch(source,/setSettings\s*\(/);
  assert.doesNotMatch(source,/tradeEligible/);
  assert.doesNotMatch(source,/decisionScore/);
  assert.doesNotMatch(source,/calibrationScore/);

  console.log('shadow outcome calibration v23.11 ok');
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}

EOF_TEST

python3 - <<'PY'
from pathlib import Path

for name in [
    "memeflow-app/src/shadow-outcome-calibration-v23_11.mjs",
    "memeflow-app/tests/shadow-outcome-calibration-v23_11.mjs"
]:
    p=Path(name)

    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_11_EOF_NORMALIZATION_OK")
PY

python3 - <<'PY'
from pathlib import Path

sp=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
ap=Path("memeflow-app/app-server.mjs")

s=sp.read_text(encoding="utf-8")
a=ap.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)

    if n!=1:
        raise SystemExit(
            f"V23.11 REFUSED: {label}: expected 1 exact match, got {n}"
        )

    return text.replace(old,new,1)

old="""import {
  createShadowEvidenceSynthesisV23_10
} from './shadow-evidence-synthesis-v23_10.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowOutcomeCalibrationV23_11
} from './shadow-outcome-calibration-v23_11.mjs';""",
    "calibration import"
)

old="""  const shadowEvidenceSynthesis=
    createShadowEvidenceSynthesisV23_10();"""

s=once(
    s,
    old,
    old+"""

  const shadowOutcomeCalibration=
    createShadowOutcomeCalibrationV23_11({
      dataDir
    });""",
    "calibration construction"
)

old="""      snapshot.shadowEvidenceSynthesis=
        shadowEvidenceSynthesis.predict(
          snapshot,
          {
            mint,
            at:snapshot.observedAt
          }
        );
"""

s=once(
    s,
    old,
    old+"""
      // MEMEFLOW_OUTCOME_CALIBRATION_V23_11
      // Historical reliability only. Computed after V23.10 and before the
      // anchor freezes this forecast for later outcome auditing.
      snapshot.shadowOutcomeCalibration=
        shadowOutcomeCalibration.predict(
          snapshot,
          {
            mint,
            at:snapshot.observedAt
          }
        );
""",
    "calibration prediction"
)

old="""        shadowTokenPatternMemory.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
"""

s=once(
    s,
    old,
    old+"""
        shadowOutcomeCalibration.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
""",
    "calibration outcome"
)

old="""          shadowEvidenceSynthesis:{
            status:
              snap?.shadowEvidenceSynthesis
                ?.status||'SYNTHESIS_COLD_START',
            ready:
              snap?.shadowEvidenceSynthesis
                ?.ready===true,
            direction:
              snap?.shadowEvidenceSynthesis
                ?.direction||'UNKNOWN',
            synthesisProbabilityPositivePct:
              snap?.shadowEvidenceSynthesis
                ?.synthesisProbabilityPositivePct??null,
            synthesisConfidencePct:
              snap?.shadowEvidenceSynthesis
                ?.synthesisConfidencePct??0,
            crossSourceDisagreementPct:
              snap?.shadowEvidenceSynthesis
                ?.crossSourceDisagreementPct??null,
            blockers:
              snap?.shadowEvidenceSynthesis
                ?.blockers||[]
          },
"""

s=once(
    s,
    old,
    old+"""          shadowOutcomeCalibration:{
            status:
              snap?.shadowOutcomeCalibration
                ?.status||'CALIBRATION_COLD_START',
            ready:
              snap?.shadowOutcomeCalibration
                ?.ready===true,
            rawProbabilityPositivePct:
              snap?.shadowOutcomeCalibration
                ?.rawProbabilityPositivePct??null,
            calibratedProbabilityPositivePct:
              snap?.shadowOutcomeCalibration
                ?.calibratedProbabilityPositivePct??null,
            calibratedConfidencePct:
              snap?.shadowOutcomeCalibration
                ?.calibratedConfidencePct??0,
            reliabilitySampleCount:
              snap?.shadowOutcomeCalibration
                ?.reliabilitySampleCount??0,
            globalEcePct:
              snap?.shadowOutcomeCalibration
                ?.globalEcePct??null,
            globalBrier:
              snap?.shadowOutcomeCalibration
                ?.globalBrier??null
          },
""",
    "calibration list summary"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_10'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_11'",
    "network version"
)

old="""      shadowTokenPatternMemory:shadowTokenPatternMemory.status(),
      shadowEvidenceSynthesis:shadowEvidenceSynthesis.status()
"""

s=once(
    s,
    old,
    """      shadowTokenPatternMemory:shadowTokenPatternMemory.status(),
      shadowEvidenceSynthesis:shadowEvidenceSynthesis.status(),
      shadowOutcomeCalibration:shadowOutcomeCalibration.status()
""",
    "calibration status"
)

old="""    listEvidenceSynthesisPredictions:
      options=>shadowEvidenceSynthesis.listRecent(options),
    status
"""

s=once(
    s,
    old,
    """    listEvidenceSynthesisPredictions:
      options=>shadowEvidenceSynthesis.listRecent(options),
    outcomeCalibrationStatus:
      ()=>shadowOutcomeCalibration.status(),
    outcomeCalibrationHorizonReport:
      ()=>shadowOutcomeCalibration.horizonReport(),
    outcomeCalibrationBucketReport:
      options=>shadowOutcomeCalibration.bucketReport(options),
    listOutcomeCalibrationPredictions:
      options=>shadowOutcomeCalibration.listRecent(options),
    flushOutcomeCalibration:
      ()=>shadowOutcomeCalibration.flush(),
    status
""",
    "calibration API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_OUTCOME_CALIBRATION_MONITOR_V23_11
 * Owner-only, read-only reliability diagnostics.
 */
 if(
   url.pathname==='/api/owner/intelligence/outcome-calibration' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(
       200,
       Number(
         url.searchParams.get('limit')||50
       )
     )
   );

   const status=String(
     url.searchParams.get('status')||''
   ).trim().toUpperCase();

   const horizonMs=Math.max(
     1,
     Number(
       url.searchParams.get('horizonMs')||300000
     )
   );

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     calibration:
       tokenIntelligenceShadowV23
         .outcomeCalibrationStatus(),
     horizons:
       tokenIntelligenceShadowV23
         .outcomeCalibrationHorizonReport(),
     buckets:
       tokenIntelligenceShadowV23
         .outcomeCalibrationBucketReport({
           horizonMs
         }),
     predictions:
       tokenIntelligenceShadowV23
         .listOutcomeCalibrationPredictions({
           limit,
           status:status||null
         })
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "calibration owner route"
)

ap.write_text(a,encoding="utf-8")

print("V23_11_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")

d=json.loads(
    p.read_text(
        encoding="utf-8"
    )
)

s=d["scripts"]["test:core"]

needle="node tests/shadow-evidence-synthesis-v23_10.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-evidence-synthesis-v23_10.mjs && node tests/shadow-outcome-calibration-v23_11.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.11 REFUSED: package test anchor changed"
    )

if "shadow-outcome-calibration-v23_11.mjs" in s:
    raise SystemExit(
        "V23.11 REFUSED: calibration test already installed"
    )

d["scripts"]["test:core"] = s.replace(
    needle,
    replacement,
    1
)

p.write_text(
    json.dumps(d,indent=2)+"\n",
    encoding="utf-8"
)

print("PACKAGE_TRANSFORM_OK")

PY

echo
echo "=== V23.11 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$CALIBRATION"
node --check "$TEST"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.11 TARGETED TESTS ==="

(
  cd memeflow-app

  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/wallet-reputation-shadow-v23_2.mjs
  node tests/learning-dataset-shadow-v23_3.mjs
  node tests/shadow-math-brain-v23_4.mjs
  node tests/shadow-model-arena-v23_5.mjs
  node tests/shadow-drift-regime-v23_6.mjs
  node tests/shadow-confidence-governor-v23_7.mjs
  node tests/shadow-token-trajectory-v23_8.mjs
  node tests/shadow-token-pattern-memory-v23_9.mjs
  node tests/shadow-evidence-synthesis-v23_10.mjs
  node tests/shadow-outcome-calibration-v23_11.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.11 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.11 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
    "memeflow-app/src/shadow-outcome-calibration-v23_11.mjs"
).read_text(encoding="utf-8")

s=Path(
    "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text(encoding="utf-8")

a=Path(
    "memeflow-app/app-server.mjs"
).read_text(encoding="utf-8")

pkg=Path(
    "memeflow-app/package.json"
).read_text(encoding="utf-8")

errors=[]

for marker in [
    "MEMEFLOW_OUTCOME_CALIBRATION_V23_11",
    "CALIBRATION_COLD_START",
    "CALIBRATION_HEALTHY",
    "CALIBRATION_WATCH",
    "CALIBRATION_MISALIGNED",
    "ONLINE_RELIABILITY_BINS_WITH_CONSERVATIVE_EMPIRICAL_SHRINKAGE",
    "outcome-calibration-v23-11.jsonl",
    "TARGET_HORIZON_MS=300_000"
]:
    if marker not in m:
        errors.append("calibration marker missing: "+marker)

for forbidden in [
    "from './evaluate.mjs'",
    'from "./evaluate.mjs"',
    "openPosition(",
    "closePosition(",
    "setSettings(",
    "tradeEligible",
    "decisionScore",
    "calibrationScore"
]:
    if forbidden in m:
        errors.append("forbidden authority: "+forbidden)

for marker in [
    "createShadowOutcomeCalibrationV23_11",
    "shadowOutcomeCalibration.predict",
    "shadowOutcomeCalibration.recordOutcome",
    "shadowOutcomeCalibration:shadowOutcomeCalibration.status()",
    "outcomeCalibrationStatus",
    "outcomeCalibrationHorizonReport",
    "outcomeCalibrationBucketReport",
    "listOutcomeCalibrationPredictions",
    "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_11"
]:
    if marker not in s:
        errors.append("wiring missing: "+marker)

pos=s.find("snapshot.shadowOutcomeCalibration=")
q=s.find("snapshot.shadowEvidenceSynthesis=")

if q<0 or pos<0 or q>=pos:
    errors.append("calibration must run after synthesis")

for marker in [
    "/api/owner/intelligence/outcome-calibration",
    "MEMEFLOW_OUTCOME_CALIBRATION_MONITOR_V23_11",
    "outcomeCalibrationHorizonReport"
]:
    if marker not in a:
        errors.append("monitor missing: "+marker)

if "shadow-outcome-calibration-v23_11.mjs" not in pkg:
    errors.append("V23.11 test missing from package")

for marker in [
    "row.mint!==mint",
    "Number(row.observedAt)<beforeAt"
]:
    if marker not in m:
        errors.append("anti-leakage missing: "+marker)

for marker in [
    "shadowMathBrain.predict",
    "shadowModelArena.predict",
    "shadowDriftRegime.predict",
    "shadowConfidenceGovernor.predict",
    "shadowTokenTrajectory.observe",
    "shadowTokenPatternMemory.predict",
    "shadowEvidenceSynthesis.predict"
]:
    if marker not in s:
        errors.append("backward compatibility missing: "+marker)

if errors:
    raise SystemExit(
        "V23_11_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_11_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.11 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/shadow-outcome-calibration-v23_11\.mjs|tests/shadow-outcome-calibration-v23_11\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.11 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.11 STAGED ==="

git diff --cached --stat

git commit -m "feat: add shadow outcome calibration v23.11"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.11 CONTRACT:"
echo "  V22 evaluate remains the only trading authority"
echo "  V23.10 synthesis probability is audited against completed outcomes"
echo "  15s/30s/1m/3m/5m quality is measured; 5m is the calibration target"
echo "  Brier, log-loss, accuracy and ECE are tracked"
echo "  reliability bins conservatively calibrate probability only after evidence accumulates"
echo "  same-token and future-outcome leakage are excluded from live calibration"
echo "  calibrated probability/confidence remain SHADOW diagnostics only"
echo "  no Score/State/BUY/SELL mutation"
