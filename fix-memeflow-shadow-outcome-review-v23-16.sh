#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="0ecea686d95d4a835f18913992d9cc03aba2f076"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
REVIEW="memeflow-app/src/shadow-outcome-review-v23_16.mjs"
TEST="memeflow-app/tests/shadow-outcome-review-v23_16.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$REVIEW" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW OUTCOME REVIEW V23.16 ==="

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
      echo "V23.16 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.16 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.16 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.16 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.16 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.16 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.16 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-outcome-review-v23-16-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.16 FAILED - RESTORING ==="

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

cat > "$REVIEW" <<'EOF_REVIEW'
import fs from 'node:fs';
import path from 'node:path';

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

  function load(){
    if(!file)return;

    const text=readTailUtf8(file);

    for(const line of text.split('\n')){
      if(!line.trim())continue;

      try{
        const row=JSON.parse(line);

        if(
          row?.type===
          'shadow-outcome-review'
        ){
          if(
            add(
              row,
              {persist:false}
            )
          ){
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
      file
    };
  }

  load();

  return {
    recordOutcome,
    recent,
    summary,
    status,
    flush
  };
}

EOF_REVIEW

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowOutcomeReviewV23_16
} from '../src/shadow-outcome-review-v23_16.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'mf-v23-16-'
    )
  );

function anchor({
  mint,
  at,
  probability=80,
  confidence=80,
  trajectory='RISING',
  disagreement=10,
  coordination=false,
  completeness=100
}){
  return {
    mint,
    at,
    stage:'DEEP',
    canonicalScore:70,
    priceSol:1,
    features:{
      evidence:{
        regime:'EXPANSION',
        dataQuality:{
          completenessPct:
            completeness
        }
      },
      specialists:{
        wallet:{
          topBuyerSolSharePct:20
        },
        coordination:{
          suspectedCoordination:
            coordination
        },
        smartMoneyMemory:{
          reputationReady:true,
          weightedPositiveProbabilityPct:
            72
        }
      },
      shadowTokenTrajectory:{
        trajectoryState:
          trajectory,
        turningPoint:false
      },
      shadowTokenPattern:{
        ready:true,
        patternProbabilityPositivePct:
          75
      },
      shadowDriftRegime:{
        status:'REGIME_READY',
        driftStatus:'STABLE'
      },
      shadowConfidenceGovernor:{
        ready:true,
        disagreementPct:
          disagreement,
        consensusProbabilityPositivePct:
          probability,
        ensembleConfidencePct:
          confidence
      },
      shadowEvidenceSynthesis:{
        ready:true,
        status:'SYNTHESIS_STRONG',
        direction:'BULLISH',
        synthesisProbabilityPositivePct:
          probability,
        synthesisConfidencePct:
          confidence,
        crossSourceDisagreementPct:
          disagreement,
        blockers:[]
      },
      shadowOutcomeCalibration:{
        ready:true,
        status:'CALIBRATION_HEALTHY',
        calibratedProbabilityPositivePct:
          probability,
        calibratedConfidencePct:
          confidence
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
        ? 40
        : -35,
    maxFavorableExcursionPct:
      positive
        ? 60
        : 5,
    maxAdverseExcursionPct:
      positive
        ? -5
        : -40,
    dead:false
  };
}

try{
  const review=
    createShadowOutcomeReviewV23_16({
      dataDir:tmp
    });

  const base=
    1_801_400_000_000;

  const hit=
    review.recordOutcome({
      anchor:
        anchor({
          mint:'HIT',
          at:base,
          probability:82,
          confidence:78
        }),
      outcome:
        outcome({
          mint:'HIT',
          at:base,
          positive:true
        })
    });

  assert.equal(
    hit.resultType,
    'TRUE_POSITIVE'
  );

  assert.equal(
    hit.hit,
    true
  );

  const miss=
    review.recordOutcome({
      anchor:
        anchor({
          mint:'MISS',
          at:base+1000,
          probability:84,
          confidence:82,
          trajectory:'FADING',
          disagreement:52,
          coordination:true,
          completeness:50
        }),
      outcome:
        outcome({
          mint:'MISS',
          at:base+1000,
          positive:false
        })
    });

  assert.equal(
    miss.resultType,
    'FALSE_POSITIVE'
  );

  assert.equal(
    miss.miss,
    true
  );

  assert.equal(
    miss.highConfidenceMiss,
    true
  );

  assert.ok(
    miss.attributionTags.includes(
      'HIGH_MODEL_DISAGREEMENT'
    )
  );

  assert.ok(
    miss.attributionTags.includes(
      'TRAJECTORY_FADING'
    )
  );

  assert.ok(
    miss.attributionTags.includes(
      'SUSPECTED_WALLET_COORDINATION'
    )
  );

  assert.ok(
    miss.attributionTags.includes(
      'LOW_DATA_COMPLETENESS'
    )
  );

  assert.ok(
    miss.attributionTags.includes(
      'HIGH_CONFIDENCE_MISS'
    )
  );

  const summary=
    review.summary({
      horizonMs:300_000
    });

  assert.equal(
    summary.scored,
    2
  );

  assert.equal(
    summary.hits,
    1
  );

  assert.equal(
    summary.misses,
    1
  );

  assert.equal(
    summary.falsePositives,
    1
  );

  assert.equal(
    summary.highConfidenceMisses,
    1
  );

  assert.equal(
    review.recent({
      missesOnly:true
    }).length,
    1
  );

  assert.equal(
    await review.flush(),
    true
  );

  const restored=
    createShadowOutcomeReviewV23_16({
      dataDir:tmp
    });

  assert.equal(
    restored.status().rowsLoaded,
    2
  );

  const source=
    fs.readFileSync(
      'src/shadow-outcome-review-v23_16.mjs',
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
    /createShadowOutcomeReviewV23_16/
  );

  assert.match(
    shadow,
    /shadowOutcomeReview\.recordOutcome/
  );

  assert.match(
    shadow,
    /outcomeReviewStatus/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/outcome-reviews/
  );

  assert.match(
    html,
    /id="outcomeReviewList"/
  );

  assert.match(
    js,
    /loadOutcomeReviews/
  );

  console.log(
    'shadow outcome review v23.16 ok'
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
            f"V23.16 REFUSED: {label}: expected 1 exact match, got {n}"
        )
    return text.replace(old,new,1)

old="""import {
  createTokenIntelligenceScorecardV23_15
} from './token-intelligence-scorecard-v23_15.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowOutcomeReviewV23_16
} from './shadow-outcome-review-v23_16.mjs';""",
    "outcome review import"
)

old="""  const tokenIntelligenceScorecard=
    createTokenIntelligenceScorecardV23_15({
      inspectToken:mint=>inspect(mint),
      listTokenCells:options=>listCells(options)
    });"""

s=once(
    s,
    old,
    old+"""

  const shadowOutcomeReview=
    createShadowOutcomeReviewV23_16({
      dataDir
    });""",
    "outcome review construction"
)

old="""        shadowChampionBenchmark.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
"""

s=once(
    s,
    old,
    old+"""
        shadowOutcomeReview.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
""",
    "outcome review record"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_15'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_16'",
    "network version"
)

old="""      shadowPromotionReport:shadowPromotionReport.status(),
      tokenIntelligenceScorecard:tokenIntelligenceScorecard.status()
"""

s=once(
    s,
    old,
    """      shadowPromotionReport:shadowPromotionReport.status(),
      tokenIntelligenceScorecard:tokenIntelligenceScorecard.status(),
      shadowOutcomeReview:shadowOutcomeReview.status()
""",
    "outcome review status"
)

old="""    inspectTokenScorecard:
      mint=>tokenIntelligenceScorecard.inspect(mint),
    status
"""

s=once(
    s,
    old,
    """    inspectTokenScorecard:
      mint=>tokenIntelligenceScorecard.inspect(mint),
    outcomeReviewStatus:
      ()=>shadowOutcomeReview.status(),
    outcomeReviewSummary:
      options=>shadowOutcomeReview.summary(options),
    listOutcomeReviews:
      options=>shadowOutcomeReview.recent(options),
    flushOutcomeReviews:
      ()=>shadowOutcomeReview.flush(),
    status
""",
    "outcome review API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_SHADOW_OUTCOME_REVIEW_MONITOR_V23_16
 * Owner-only, read-only retrospective V23 review.
 * Attribution tags are diagnostic associations, not causal proof.
 */
 if(
   url.pathname==='/api/owner/intelligence/outcome-reviews' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(
       200,
       Number(
         url.searchParams.get('limit')||30
       )
     )
   );

   const horizonMs=Math.max(
     1,
     Number(
       url.searchParams.get('horizonMs')||300000
     )
   );

   const missesOnly=
     String(
       url.searchParams.get('missesOnly')||''
     ).toLowerCase()==='true';

   const highConfidenceOnly=
     String(
       url.searchParams.get('highConfidenceOnly')||''
     ).toLowerCase()==='true';

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     attributionDisclaimer:
       'TAGS_ARE_DIAGNOSTIC_ASSOCIATIONS_NOT_CAUSAL_PROOF',
     status:
       tokenIntelligenceShadowV23
         .outcomeReviewStatus(),
     summary:
       tokenIntelligenceShadowV23
         .outcomeReviewSummary({
           horizonMs
         }),
     reviews:
       tokenIntelligenceShadowV23
         .listOutcomeReviews({
           limit,
           horizonMs,
           missesOnly,
           highConfidenceOnly
         })
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "outcome review owner route"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      <!-- MEMEFLOW_SHADOW_OUTCOME_REVIEW_V23_16_UI -->
      <section
        id="outcomeReviewMonitor"
        class="oi-panel oi-outcome-review"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              5M POSTMORTEM · SHADOW ONLY
            </span>
            <h2>V23 Outcome Review</h2>
            <p>
              Shows where the shadow forecast was right or wrong and
              which evidence was present at the frozen anchor.
              Attribution tags are diagnostic hints, not causal proof.
            </p>
          </div>

          <span
            id="outcomeReviewStatus"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>REVIEWED 5M</span>
            <strong id="outcomeReviewScored">—</strong>
            <small>directional outcomes</small>
          </article>

          <article class="oi-stat">
            <span>HIT RATE</span>
            <strong id="outcomeReviewHitRate">—</strong>
            <small>shadow forecast only</small>
          </article>

          <article class="oi-stat">
            <span>FALSE + / FALSE −</span>
            <strong id="outcomeReviewErrors">—</strong>
            <small>miss type balance</small>
          </article>

          <article class="oi-stat">
            <span>HIGH-CONF MISSES</span>
            <strong id="outcomeReviewHighMiss">—</strong>
            <small>priority review queue</small>
          </article>
        </div>

        <div class="oi-grid oi-grid-2">
          <div>
            <h3>Top miss associations</h3>
            <div
              id="outcomeReviewTags"
              class="oi-list"
            ></div>
          </div>

          <div>
            <h3>Recent 5m reviews</h3>
            <div
              id="outcomeReviewList"
              class="oi-outcome-review-list"
            ></div>
          </div>
        </div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "outcome review UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

js_block=r"""/* MEMEFLOW_SHADOW_OUTCOME_REVIEW_V23_16_UI_JS */
function outcomeReviewTone(type=''){
  const t=String(type||'').toUpperCase();

  if(
    t==='TRUE_POSITIVE' ||
    t==='TRUE_NEGATIVE'
  ){
    return 'hit';
  }

  if(
    t==='FALSE_POSITIVE' ||
    t==='FALSE_NEGATIVE'
  ){
    return 'miss';
  }

  return 'neutral';
}

function renderOutcomeReviews(payload={}){
  const summary=payload?.summary||{};
  const reviews=
    Array.isArray(payload?.reviews)
      ? payload.reviews
      : [];

  const badge=$('outcomeReviewStatus');

  if(badge){
    badge.className=
      'oi-ai-status '+
      (Number(summary?.scored||0)>0
        ? 'online'
        : '');

    badge.textContent=
      Number(summary?.scored||0)>0
        ? 'LEARNING'
        : 'COLD START';
  }

  $('outcomeReviewScored').textContent=
    num(summary?.scored,0);

  $('outcomeReviewHitRate').textContent=
    pct(summary?.hitRatePct);

  $('outcomeReviewErrors').textContent=
    `${num(summary?.falsePositives,0)} / ${num(summary?.falseNegatives,0)}`;

  $('outcomeReviewHighMiss').textContent=
    num(summary?.highConfidenceMisses,0);

  const tags=
    Array.isArray(summary?.topMissTags)
      ? summary.topMissTags
      : [];

  $('outcomeReviewTags').innerHTML=
    tags.length
      ? tags.map(row=>`
          <div class="oi-row">
            <span>
              ${esc(String(row?.tag||'UNKNOWN').replaceAll('_',' '))}
            </span>
            <strong>${esc(row?.count??0)}</strong>
          </div>
        `).join('')
      : `
          <div class="oi-row">
            <span>No miss associations yet</span>
            <strong>—</strong>
          </div>
        `;

  $('outcomeReviewList').innerHTML=
    reviews.length
      ? reviews.slice(0,12).map(row=>{
          const tags=
            Array.isArray(row?.attributionTags)
              ? row.attributionTags.slice(0,3)
              : [];

          return `
            <div class="oi-outcome-review-row ${outcomeReviewTone(row?.resultType)}">
              <div class="oi-outcome-review-head">
                <strong>${esc(row?.mint||'UNKNOWN')}</strong>
                <span>
                  ${esc(String(row?.resultType||'UNKNOWN').replaceAll('_',' '))}
                </span>
              </div>

              <div class="oi-outcome-review-metrics">
                <span>
                  P+ ${Number.isFinite(Number(row?.forecast?.probabilityPositivePct))
                    ? `${num(row.forecast.probabilityPositivePct,1)}%`
                    : '—'}
                </span>
                <span>
                  conf ${Number.isFinite(Number(row?.forecast?.confidencePct))
                    ? `${num(row.forecast.confidencePct,1)}%`
                    : '—'}
                </span>
                <span>
                  return ${Number.isFinite(Number(row?.outcome?.returnPct))
                    ? `${num(row.outcome.returnPct,1)}%`
                    : '—'}
                </span>
              </div>

              <div class="oi-outcome-review-tags">
                ${
                  tags.length
                    ? tags.map(tag=>`
                        <span>
                          ${esc(String(tag).replaceAll('_',' '))}
                        </span>
                      `).join('')
                    : '<span class="clear">NO ASSOCIATION TAGS</span>'
                }
              </div>
            </div>
          `;
        }).join('')
      : `
          <div class="oi-empty">
            No completed 5m shadow reviews yet.
          </div>
        `;
}

async function loadOutcomeReviews(){
  try{
    const payload=await api(
      '/api/owner/intelligence/outcome-reviews?limit=30&horizonMs=300000'
    );

    renderOutcomeReviews(payload);
  }catch(error){
    const badge=$('outcomeReviewStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const list=$('outcomeReviewList');

    if(list){
      list.innerHTML=`
        <div class="oi-empty">
          ${esc(error.message)}
        </div>
      `;
    }
  }
}

/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

j=once(
    j,
    js_anchor,
    js_block,
    "outcome review UI JS"
)

old="""    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards()
    ]);
"""

j=once(
    j,
    old,
    """    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards(),
      loadOutcomeReviews()
    ]);
""",
    "outcome review load"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_SHADOW_OUTCOME_REVIEW_V23_16
   ========================================================== */

.oi-outcome-review-list{
  display:grid;
  gap:7px;
}

.oi-outcome-review-row{
  padding:9px 10px;
  border:1px solid rgba(38,56,69,.64);
  border-radius:10px;
  background:rgba(255,255,255,.012);
}

.oi-outcome-review-row.hit{
  border-color:rgba(81,231,168,.18);
}

.oi-outcome-review-row.miss{
  border-color:rgba(255,104,120,.22);
}

.oi-outcome-review-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}

.oi-outcome-review-head strong{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:var(--mf-type-meta);
}

.oi-outcome-review-head span{
  color:var(--muted);
  font-size:var(--mf-type-micro);
  font-weight:800;
}

.oi-outcome-review-row.hit
.oi-outcome-review-head span{
  color:var(--green);
}

.oi-outcome-review-row.miss
.oi-outcome-review-head span{
  color:#ff9daa;
}

.oi-outcome-review-metrics{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-top:6px;
  color:var(--muted);
  font-size:var(--mf-type-micro);
}

.oi-outcome-review-tags{
  display:flex;
  flex-wrap:wrap;
  gap:5px;
  margin-top:7px;
}

.oi-outcome-review-tags span{
  padding:4px 6px;
  border:1px solid rgba(255,104,120,.16);
  border-radius:999px;
  color:#ff9daa;
  font-size:var(--mf-type-micro);
}

.oi-outcome-review-tags span.clear{
  border-color:rgba(81,231,168,.18);
  color:var(--green);
}

/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

c=once(
    c,
    css_anchor,
    css_block,
    "outcome review CSS"
)

cp.write_text(c,encoding="utf-8")

print("V23_16_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/token-intelligence-scorecard-v23_15.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/token-intelligence-scorecard-v23_15.mjs && node tests/shadow-outcome-review-v23_16.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.16 REFUSED: package test anchor changed"
    )

if "shadow-outcome-review-v23_16.mjs" in s:
    raise SystemExit(
        "V23.16 REFUSED: outcome review test already installed"
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
 "memeflow-app/src/shadow-outcome-review-v23_16.mjs",
 "memeflow-app/tests/shadow-outcome-review-v23_16.mjs"
]:
    p=Path(name)
    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_16_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V23.16 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$REVIEW"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.16 TARGETED TESTS ==="

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
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.16 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.16 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
 "memeflow-app/src/shadow-outcome-review-v23_16.mjs"
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
 "MEMEFLOW_SHADOW_OUTCOME_REVIEW_V23_16",
 "FALSE_POSITIVE",
 "FALSE_NEGATIVE",
 "TRUE_POSITIVE",
 "TRUE_NEGATIVE",
 "HIGH_CONFIDENCE_MISS",
 "TAGS_ARE_DIAGNOSTIC_ASSOCIATIONS_NOT_CAUSAL_PROOF",
 "shadow-outcome-review-v23-16.jsonl",
 "TARGET_HORIZON_MS=300_000"
]:
    if x not in m:
        errors.append("review marker missing: "+x)

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
 "createShadowOutcomeReviewV23_16",
 "shadowOutcomeReview.recordOutcome",
 "shadowOutcomeReview:shadowOutcomeReview.status()",
 "outcomeReviewStatus",
 "outcomeReviewSummary",
 "listOutcomeReviews",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_16"
]:
    if x not in s:
        errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/outcome-reviews",
 "TAGS_ARE_DIAGNOSTIC_ASSOCIATIONS_NOT_CAUSAL_PROOF"
]:
    if x not in a:
        errors.append("route missing: "+x)

for x in [
 'id="outcomeReviewList"',
 'id="outcomeReviewScored"',
 'id="outcomeReviewHitRate"',
 'id="outcomeReviewErrors"',
 'id="outcomeReviewHighMiss"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "loadOutcomeReviews",
 "renderOutcomeReviews",
 "/api/owner/intelligence/outcome-reviews"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

for x in [
 ".oi-outcome-review-list",
 ".oi-outcome-review-row",
 ".oi-outcome-review-tags"
]:
    if x not in c:
        errors.append("UI CSS missing: "+x)

if "shadow-outcome-review-v23_16.mjs" not in p:
    errors.append("V23.16 test missing from package")

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
 "tokenIntelligenceScorecard.status"
]:
    if x not in s:
        errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit(
        "V23_16_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_16_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.16 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|src/token-intelligence-shadow-v23\.mjs|src/shadow-outcome-review-v23_16\.mjs|tests/shadow-outcome-review-v23_16\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.16 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.16 STAGED ==="

git diff --cached --stat

git commit -m "feat: add shadow outcome review and miss attribution v23.16"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.16 CONTRACT:"
echo "  every completed outcome can be retrospectively reviewed against the frozen V23 forecast"
echo "  5m summary tracks hits, misses, false positives, false negatives and high-confidence misses"
echo "  recurring miss associations are exposed to Owner Intelligence"
echo "  attribution tags are diagnostic associations, NOT causal proof"
echo "  V22 remains the only trading authority"
echo "  no Score/State/BUY/SELL mutation"
