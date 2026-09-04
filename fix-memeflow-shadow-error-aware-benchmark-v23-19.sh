#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="e4de88c8216a8f904e7fec2361c77510c973bf90"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
MODULE="memeflow-app/src/shadow-error-aware-benchmark-v23_19.mjs"
TEST="memeflow-app/tests/shadow-error-aware-benchmark-v23_19.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$MODULE" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW ERROR-AWARE BENCHMARK V23.19 ==="

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
      echo "V23.19 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.19 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.19 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.19 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.19 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.19 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.19 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-error-aware-benchmark-v23-19-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.19 FAILED - RESTORING ==="

    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] &&
        cp "$BACKUP/$f" "$f" ||
        true
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

cat > "$MODULE" <<'EOF_MODULE'
import fs from 'node:fs';
import path from 'node:path';

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

      fs.readSync(
        fd,
        buf,
        0,
        maxBytes,
        st.size-maxBytes
      );

      let text=buf.toString('utf8');
      const nl=text.indexOf('\n');

      if(nl>=0){
        text=text.slice(nl+1);
      }

      return text;
    }finally{
      fs.closeSync(fd);
    }
  }catch{
    return '';
  }
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

  function load(){
    if(!file)return;

    const text=
      readTailUtf8(file);

    for(const line of text.split('\n')){
      if(!line.trim())continue;

      try{
        const row=JSON.parse(line);

        if(
          row?.type===
          'error-aware-benchmark-outcome'
        ){
          const before=rows.length;

          addRow(
            row,
            {persist:false}
          );

          if(rows.length>before){
            rowsLoaded++;
          }
        }
      }catch{
        loadErrors++;
      }
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
      file
    };
  }

  load();

  return {
    recordOutcome,
    report,
    horizonReport,
    listRecent,
    status,
    flush
  };
}

EOF_MODULE

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowErrorAwareBenchmarkV23_19
} from '../src/shadow-error-aware-benchmark-v23_19.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'mf-v23-19-'
    )
  );

function anchor({
  mint,
  at,
  probability,
  rawConfidence=80,
  adjustedConfidence=40,
  penalty=50
}){
  return {
    mint,
    at,
    features:{
      shadowErrorAwareConfidence:{
        status:
          penalty>0
            ? 'PENALTY_APPLIED'
            : 'NO_PATTERN_MATCH',
        probabilityPositivePct:
          probability,
        rawConfidencePct:
          rawConfidence,
        adjustedConfidencePct:
          adjustedConfidence,
        penaltyPct:
          penalty,
        forecastSource:
          'V23_11_CALIBRATED'
      }
    }
  };
}

function outcome({
  mint,
  at,
  positive,
  horizonMs=300_000
}){
  return {
    mint,
    observedAt:
      at+horizonMs,
    horizonMs,
    returnPct:
      positive
        ? 35
        : -35,
    maxFavorableExcursionPct:
      positive
        ? 55
        : 5,
    maxAdverseExcursionPct:
      positive
        ? -5
        : -40,
    dead:false
  };
}

try{
  const bench=
    createShadowErrorAwareBenchmarkV23_19({
      dataDir:tmp
    });

  const base=
    1_801_700_000_000;

  // 120 paired rows, 60 positive / 60 negative.
  // Raw V23 is deliberately overconfident; challenger shrinks toward 50.
  for(let i=0;i<120;i++){
    const positive=i<60;
    const wrong=
      i%5<2;

    const probability=
      positive
        ? (wrong?20:80)
        : (wrong?80:20);

    const at=
      base+i*1000;

    const a=
      anchor({
        mint:`MINT_${i}`,
        at,
        probability,
        rawConfidence:85,
        adjustedConfidence:42.5,
        penalty:50
      });

    const o=
      outcome({
        mint:`MINT_${i}`,
        at,
        positive
      });

    const row=
      bench.recordOutcome({
        anchor:a,
        outcome:o
      });

    assert.ok(row);
    assert.equal(
      row.rawProbabilityPct,
      probability
    );
    assert.ok(
      Math.abs(
        row.challengerProbabilityPct-(
          50+(probability-50)*0.5
        )
      )<1e-9
    );
  }

  const report=
    bench.report({
      horizonMs:300_000
    });

  assert.equal(
    report.pairedRows,
    120
  );

  assert.equal(
    report.positive,
    60
  );

  assert.equal(
    report.negative,
    60
  );

  assert.ok(
    report.challenger.meanBrier<
    report.raw.meanBrier
  );

  assert.ok(
    report.challenger.meanLogLoss<
    report.raw.meanLogLoss
  );

  assert.ok(
    report.delta.ecePct>=0
  );

  assert.equal(
    report.liveProbabilityMutation,
    false
  );

  assert.equal(
    report.benchmarkDerivedProbabilityOnly,
    true
  );

  assert.equal(
    report.autoPromotion,
    false
  );

  assert.equal(
    report.verdict.status,
    'ERROR_AWARE_CHALLENGER_WINS'
  );

  assert.equal(
    report.verdict.reviewEligible,
    true
  );

  assert.equal(
    await bench.flush(),
    true
  );

  const restored=
    createShadowErrorAwareBenchmarkV23_19({
      dataDir:tmp
    });

  assert.equal(
    restored.status().rowsLoaded,
    120
  );

  const source=
    fs.readFileSync(
      'src/shadow-error-aware-benchmark-v23_19.mjs',
      'utf8'
    );

  assert.doesNotMatch(
    source,
    /from ['"]\.\/evaluate\.mjs['"]/
  );

  assert.doesNotMatch(
    source,
    /openPosition\s*\(/
  );

  assert.doesNotMatch(
    source,
    /closePosition\s*\(/
  );

  assert.doesNotMatch(
    source,
    /setSettings\s*\(/
  );

  assert.doesNotMatch(
    source,
    /tradeEligible/
  );

  assert.doesNotMatch(
    source,
    /decisionScore/
  );

  const shadow=
    fs.readFileSync(
      'src/token-intelligence-shadow-v23.mjs',
      'utf8'
    );

  const app=
    fs.readFileSync(
      'app-server.mjs',
      'utf8'
    );

  const html=
    fs.readFileSync(
      'owner-intelligence.html',
      'utf8'
    );

  const js=
    fs.readFileSync(
      'owner-intelligence.js',
      'utf8'
    );

  assert.match(
    shadow,
    /createShadowErrorAwareBenchmarkV23_19/
  );

  assert.match(
    shadow,
    /shadowErrorAwareBenchmark\.recordOutcome/
  );

  assert.match(
    shadow,
    /errorAwareBenchmarkStatus/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/error-aware-benchmark/
  );

  assert.match(
    html,
    /id="errorAwareBenchmarkVerdict"/
  );

  assert.match(
    js,
    /loadErrorAwareBenchmark/
  );

  console.log(
    'shadow error-aware benchmark v23.19 ok'
  );
}finally{
  fs.rmSync(
    tmp,
    {
      recursive:true,
      force:true
    }
  );
}

EOF_TEST

python3 - <<'PY'
from pathlib import Path

sp=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
ap=Path("memeflow-app/app-server.mjs")
hp=Path("memeflow-app/owner-intelligence.html")
jp=Path("memeflow-app/owner-intelligence.js")
cp=Path("memeflow-app/owner-intelligence.css")

s=sp.read_text(encoding="utf-8")
a=ap.read_text(encoding="utf-8")
h=hp.read_text(encoding="utf-8")
j=jp.read_text(encoding="utf-8")
c=cp.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)

    if n!=1:
        raise SystemExit(
            f"V23.19 REFUSED: {label}: expected 1 exact match, got {n}"
        )

    return text.replace(old,new,1)

old="""import {
  createShadowErrorAwareConfidenceV23_18
} from './shadow-error-aware-confidence-v23_18.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowErrorAwareBenchmarkV23_19
} from './shadow-error-aware-benchmark-v23_19.mjs';""",
    "benchmark import"
)

old="""  const shadowErrorAwareConfidence=
    createShadowErrorAwareConfidenceV23_18({
      errorPatternLearner:
        shadowErrorPatternLearner
    });"""

s=once(
    s,
    old,
    old+"""

  const shadowErrorAwareBenchmark=
    createShadowErrorAwareBenchmarkV23_19({
      dataDir
    });""",
    "benchmark construction"
)

old="""        shadowChampionBenchmark.recordOutcome({
          anchor:cell.anchor,
          outcome
        });

        const outcomeReview=
"""

s=once(
    s,
    old,
    """        shadowChampionBenchmark.recordOutcome({
          anchor:cell.anchor,
          outcome
        });

        // MEMEFLOW_SHADOW_ERROR_AWARE_BENCHMARK_V23_19
        // Paired benchmark only. Challenger probability is derived
        // inside the benchmark from frozen V23.18 confidence.
        shadowErrorAwareBenchmark.recordOutcome({
          anchor:cell.anchor,
          outcome
        });

        const outcomeReview=
""",
    "benchmark outcome wiring"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_18'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_19'",
    "network version"
)

old="""      shadowErrorPatternLearner:shadowErrorPatternLearner.status(),
      shadowErrorAwareConfidence:shadowErrorAwareConfidence.status()
"""

s=once(
    s,
    old,
    """      shadowErrorPatternLearner:shadowErrorPatternLearner.status(),
      shadowErrorAwareConfidence:shadowErrorAwareConfidence.status(),
      shadowErrorAwareBenchmark:shadowErrorAwareBenchmark.status()
""",
    "benchmark status"
)

old="""    listErrorAwareConfidence:
      options=>shadowErrorAwareConfidence.listRecent(options),
    status
"""

s=once(
    s,
    old,
    """    listErrorAwareConfidence:
      options=>shadowErrorAwareConfidence.listRecent(options),
    errorAwareBenchmarkStatus:
      ()=>shadowErrorAwareBenchmark.status(),
    errorAwareBenchmarkReport:
      options=>shadowErrorAwareBenchmark.report(options),
    errorAwareBenchmarkHorizonReport:
      ()=>shadowErrorAwareBenchmark.horizonReport(),
    listErrorAwareBenchmarkRows:
      options=>shadowErrorAwareBenchmark.listRecent(options),
    flushErrorAwareBenchmark:
      ()=>shadowErrorAwareBenchmark.flush(),
    status
""",
    "benchmark API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_SHADOW_ERROR_AWARE_BENCHMARK_MONITOR_V23_19
 * Owner-only paired validation of raw V23 vs benchmark-only
 * confidence-shrunk challenger. No live probability mutation.
 */
 if(
   url.pathname==='/api/owner/intelligence/error-aware-benchmark' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const horizonMs=Math.max(
     1,
     Number(
       url.searchParams.get('horizonMs')||300000
     )
   );

   const limit=Math.max(
     1,
     Math.min(
       200,
       Number(
         url.searchParams.get('limit')||30
       )
     )
   );

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     liveProbabilityMutation:false,
     benchmarkDerivedProbabilityOnly:true,
     autoPromotion:false,
     status:
       tokenIntelligenceShadowV23
         .errorAwareBenchmarkStatus(),
     report:
       tokenIntelligenceShadowV23
         .errorAwareBenchmarkReport({
           horizonMs
         }),
     recent:
       tokenIntelligenceShadowV23
         .listErrorAwareBenchmarkRows({
           limit
         })
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "benchmark owner route"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      <!-- MEMEFLOW_SHADOW_ERROR_AWARE_BENCHMARK_V23_19_UI -->
      <section
        id="errorAwareBenchmarkMonitor"
        class="oi-panel oi-error-aware-benchmark"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              PAIRED 5M VALIDATION · SHADOW
            </span>
            <h2>V23.18 Challenger Benchmark</h2>
            <p>
              Raw V23 is compared against a benchmark-only probability
              shrunk toward 50% according to V23.18 confidence.
              The live V23 probability is never changed.
            </p>
          </div>

          <span
            id="errorAwareBenchmarkVerdict"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>PAIRED 5M</span>
            <strong id="errorAwareBenchmarkPaired">—</strong>
            <small>target 100</small>
          </article>

          <article class="oi-stat">
            <span>CLASS BALANCE</span>
            <strong id="errorAwareBenchmarkBalance">—</strong>
            <small>positive / negative</small>
          </article>

          <article class="oi-stat">
            <span>BRIER Δ</span>
            <strong id="errorAwareBenchmarkBrier">—</strong>
            <small>positive favors challenger</small>
          </article>

          <article class="oi-stat">
            <span>LOG-LOSS Δ</span>
            <strong id="errorAwareBenchmarkLogLoss">—</strong>
            <small>positive favors challenger</small>
          </article>
        </div>

        <div class="oi-grid oi-grid-2">
          <div>
            <h3>Raw V23</h3>
            <div
              id="errorAwareBenchmarkRaw"
              class="oi-list"
            ></div>
          </div>

          <div>
            <h3>Error-aware challenger</h3>
            <div
              id="errorAwareBenchmarkChallenger"
              class="oi-list"
            ></div>
          </div>
        </div>

        <div
          id="errorAwareBenchmarkReason"
          class="oi-promotion-blocker"
          data-state="blocked"
        >
          Waiting for paired 5m outcomes.
        </div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "benchmark UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

js_block=r"""/* MEMEFLOW_SHADOW_ERROR_AWARE_BENCHMARK_V23_19_UI_JS */
function renderErrorAwareBenchmark(payload={}){
  const report=payload?.report||{};
  const raw=report?.raw||{};
  const challenger=report?.challenger||{};
  const delta=report?.delta||{};
  const verdict=report?.verdict||{};

  const badge=$('errorAwareBenchmarkVerdict');

  if(badge){
    const status=
      String(verdict?.status||'COLD START');

    badge.className=
      'oi-ai-status '+
      (
        status==='ERROR_AWARE_CHALLENGER_WINS'
          ? 'online'
          : (
              status==='RAW_V23_WINS'
                ? 'offline'
                : ''
            )
      );

    badge.textContent=
      status.replaceAll('_',' ');
  }

  $('errorAwareBenchmarkPaired').textContent=
    `${num(report?.pairedRows,0)} / ${num(report?.requirements?.paired5m||100,0)}`;

  $('errorAwareBenchmarkBalance').textContent=
    `${num(report?.positive,0)} / ${num(report?.negative,0)}`;

  $('errorAwareBenchmarkBrier').textContent=
    num(delta?.brier,6);

  $('errorAwareBenchmarkLogLoss').textContent=
    num(delta?.logLoss,6);

  $('errorAwareBenchmarkRaw').innerHTML=[
    ['Brier',num(raw?.meanBrier,6)],
    ['Log-loss',num(raw?.meanLogLoss,6)],
    ['Accuracy',pct(raw?.accuracyPct)],
    ['ECE',pct(raw?.ecePct)],
    [
      'High-conf miss rate',
      pct(raw?.highConfidenceMissRatePct)
    ],
    [
      'FP / FN',
      `${num(raw?.falsePositives,0)} / ${num(raw?.falseNegatives,0)}`
    ]
  ].map(([name,value])=>`
    <div class="oi-row">
      <span>${esc(name)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  $('errorAwareBenchmarkChallenger').innerHTML=[
    ['Brier',num(challenger?.meanBrier,6)],
    ['Log-loss',num(challenger?.meanLogLoss,6)],
    ['Accuracy',pct(challenger?.accuracyPct)],
    ['ECE',pct(challenger?.ecePct)],
    [
      'High-conf miss rate',
      pct(challenger?.highConfidenceMissRatePct)
    ],
    [
      'FP / FN',
      `${num(challenger?.falsePositives,0)} / ${num(challenger?.falseNegatives,0)}`
    ],
    [
      'Paired wins',
      `${num(report?.pairedWins?.challenger,0)} / ${num(report?.pairedWins?.raw,0)}`
    ]
  ].map(([name,value])=>`
    <div class="oi-row">
      <span>${esc(name)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  const reason=$('errorAwareBenchmarkReason');

  if(reason){
    reason.dataset.state=
      verdict?.reviewEligible===true
        ? 'ready'
        : 'blocked';

    reason.textContent=
      verdict?.reviewEligible===true
        ? 'ERROR-AWARE CHALLENGER PASSED THE PAIRED SHADOW BENCHMARK. Manual review only; no automatic promotion occurred.'
        : String(
            verdict?.reason||
            'Waiting for additional paired evidence.'
          ).replaceAll('_',' ');
  }
}

async function loadErrorAwareBenchmark(){
  try{
    const payload=await api(
      '/api/owner/intelligence/error-aware-benchmark?horizonMs=300000'
    );

    renderErrorAwareBenchmark(payload);
  }catch(error){
    const badge=$('errorAwareBenchmarkVerdict');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const reason=$('errorAwareBenchmarkReason');

    if(reason){
      reason.dataset.state='blocked';
      reason.textContent=
        `Benchmark unavailable: ${error.message}`;
    }
  }
}

/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

j=once(
    j,
    js_anchor,
    js_block,
    "benchmark UI JS"
)

old="""    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards(),
      loadOutcomeReviews(),
      loadErrorPatterns(),
      loadErrorAwareConfidence()
    ]);
"""

j=once(
    j,
    old,
    """    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards(),
      loadOutcomeReviews(),
      loadErrorPatterns(),
      loadErrorAwareConfidence(),
      loadErrorAwareBenchmark()
    ]);
""",
    "benchmark load"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_SHADOW_ERROR_AWARE_BENCHMARK_V23_19
   ========================================================== */

.oi-error-aware-benchmark
.oi-grid-2{
  margin-top:12px;
}

.oi-error-aware-benchmark
.oi-list{
  margin-top:7px;
}

/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

c=once(
    c,
    css_anchor,
    css_block,
    "benchmark CSS"
)

cp.write_text(c,encoding="utf-8")

print("V23_19_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/shadow-error-aware-confidence-v23_18.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-error-aware-confidence-v23_18.mjs && node tests/shadow-error-aware-benchmark-v23_19.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.19 REFUSED: package test anchor changed"
    )

if "shadow-error-aware-benchmark-v23_19.mjs" in s:
    raise SystemExit(
        "V23.19 REFUSED: benchmark test already installed"
    )

d["scripts"]["test:core"]=s.replace(
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

python3 - <<'PY'
from pathlib import Path

for name in [
 "memeflow-app/app-server.mjs",
 "memeflow-app/src/token-intelligence-shadow-v23.mjs",
 "memeflow-app/package.json",
 "memeflow-app/owner-intelligence.html",
 "memeflow-app/owner-intelligence.js",
 "memeflow-app/owner-intelligence.css",
 "memeflow-app/src/shadow-error-aware-benchmark-v23_19.mjs",
 "memeflow-app/tests/shadow-error-aware-benchmark-v23_19.mjs"
]:
    p=Path(name)

    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_19_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V23.19 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$MODULE"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.19 TARGETED TESTS ==="

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
  node tests/shadow-champion-benchmark-v23_12.mjs
  node tests/shadow-promotion-gate-v23_13.mjs
  node tests/shadow-promotion-report-v23_14.mjs
  node tests/token-intelligence-scorecard-v23_15.mjs
  node tests/shadow-outcome-review-v23_16.mjs
  node tests/shadow-error-pattern-learner-v23_17.mjs
  node tests/shadow-error-aware-confidence-v23_18.mjs
  node tests/shadow-error-aware-benchmark-v23_19.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.19 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.19 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
 "memeflow-app/src/shadow-error-aware-benchmark-v23_19.mjs"
).read_text()

s=Path(
 "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()

a=Path(
 "memeflow-app/app-server.mjs"
).read_text()

h=Path(
 "memeflow-app/owner-intelligence.html"
).read_text()

j=Path(
 "memeflow-app/owner-intelligence.js"
).read_text()

c=Path(
 "memeflow-app/owner-intelligence.css"
).read_text()

p=Path(
 "memeflow-app/package.json"
).read_text()

errors=[]

for x in [
 "MEMEFLOW_SHADOW_ERROR_AWARE_BENCHMARK_V23_19",
 "liveProbabilityMutation:false",
 "benchmarkDerivedProbabilityOnly:true",
 "autoPromotion:false",
 "MIN_PAIRED=100",
 "MIN_POSITIVE=20",
 "MIN_NEGATIVE=20",
 "MIN_BRIER_EDGE=0.0025",
 "MIN_LOGLOSS_EDGE=0.005",
 "HIGH_CONFIDENCE_PCT=70",
 "ECE_BINS=10",
 "ERROR_AWARE_CHALLENGER_WINS"
]:
    if x not in m:
        errors.append("benchmark marker missing: "+x)

for x in [
 "from './evaluate.mjs'",
 "openPosition(",
 "closePosition(",
 "setSettings(",
 "tradeEligible",
 "decisionScore"
]:
    if x in m:
        errors.append("forbidden authority: "+x)

for x in [
 "createShadowErrorAwareBenchmarkV23_19",
 "shadowErrorAwareBenchmark.recordOutcome",
 "shadowErrorAwareBenchmark:shadowErrorAwareBenchmark.status()",
 "errorAwareBenchmarkStatus",
 "errorAwareBenchmarkReport",
 "listErrorAwareBenchmarkRows",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_19"
]:
    if x not in s:
        errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/error-aware-benchmark",
 "liveProbabilityMutation:false",
 "benchmarkDerivedProbabilityOnly:true",
 "autoPromotion:false"
]:
    if x not in a:
        errors.append("route missing: "+x)

for x in [
 'id="errorAwareBenchmarkVerdict"',
 'id="errorAwareBenchmarkPaired"',
 'id="errorAwareBenchmarkBalance"',
 'id="errorAwareBenchmarkBrier"',
 'id="errorAwareBenchmarkLogLoss"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "loadErrorAwareBenchmark",
 "renderErrorAwareBenchmark",
 "/api/owner/intelligence/error-aware-benchmark"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

if ".oi-error-aware-benchmark" not in c:
    errors.append("UI CSS missing")

if "shadow-error-aware-benchmark-v23_19.mjs" not in p:
    errors.append("V23.19 test missing from package")

for x in [
 "shadowMathBrain.predict",
 "shadowModelArena.predict",
 "shadowDriftRegime.predict",
 "shadowConfidenceGovernor.predict",
 "shadowTokenTrajectory.observe",
 "shadowTokenPatternMemory.predict",
 "shadowEvidenceSynthesis.predict",
 "shadowOutcomeCalibration.predict",
 "shadowChampionBenchmark.recordOutcome",
 "shadowPromotionGate.status",
 "shadowPromotionReport.status",
 "tokenIntelligenceScorecard.status",
 "shadowOutcomeReview.recordOutcome",
 "shadowErrorPatternLearner.observeReview",
 "shadowErrorAwareConfidence.predict"
]:
    if x not in s:
        errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit(
        "V23_19_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_19_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.19 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|src/token-intelligence-shadow-v23\.mjs|src/shadow-error-aware-benchmark-v23_19\.mjs|tests/shadow-error-aware-benchmark-v23_19\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.19 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.19 STAGED ==="

git diff --cached --stat

git commit -m "feat: benchmark error-aware shadow confidence v23.19"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.19 CONTRACT:"
echo "  raw V23 and error-aware challenger are evaluated on identical frozen anchors/outcomes"
echo "  challenger probability exists ONLY inside benchmark evaluation"
echo "  live V23 probability remains unchanged"
echo "  benchmark tracks Brier/log-loss/accuracy/ECE/high-confidence misses/FP/FN/paired wins"
echo "  review eligibility requires >=100 paired 5m, >=20 positive, >=20 negative"
echo "  challenger must improve Brier + log-loss without high-confidence-miss regression"
echo "  no automatic promotion"
echo "  V22 remains the only trading authority"
echo "  no Score/State/BUY/SELL mutation"
