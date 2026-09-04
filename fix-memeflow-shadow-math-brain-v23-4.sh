#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="8e0712b8cd295c95383e940511776371603abea9"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
LEARNING="memeflow-app/src/learning-dataset-shadow-v23_3.mjs"
BRAIN="memeflow-app/src/shadow-math-brain-v23_4.mjs"
PKG="memeflow-app/package.json"
TEST="memeflow-app/tests/shadow-math-brain-v23_4.mjs"

MODIFIED=("$APP" "$SHADOW" "$LEARNING" "$PKG")
NEW_FILES=("$BRAIN" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW MATHEMATICAL BRAIN V23.4 ==="

mf_git_process_in_repo(){
  local root_real
  root_real="$(readlink -f "$ROOT" 2>/dev/null || printf '%s' "$ROOT")"
  local proc pid comm cwd
  for proc in /proc/[0-9]*; do
    [[ -r "$proc/comm" ]] || continue
    pid="${proc##*/}"
    [[ "$pid" == "$$" ]] && continue
    comm="$(cat "$proc/comm" 2>/dev/null || true)"
    case "$comm" in git|git-*) ;; *) continue ;; esac
    cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"
    [[ -n "$cwd" ]] || continue
    if [[ "$cwd" == "$root_real" || "$cwd" == "$root_real/"* ]]; then
      printf '%s\n' "$pid:$comm:$cwd"
      return 0
    fi
  done
  return 1
}

mf_clear_stale_index_lock(){
  local lock="$ROOT/.git/index.lock"
  [[ -e "$lock" ]] || return 0
  local active=""
  active="$(mf_git_process_in_repo || true)"
  if [[ -n "$active" ]]; then
    echo "V23.4 REFUSED: .git/index.lock exists and active git is running:"
    echo "$active"
    echo "Nothing changed."
    return 1
  fi
  echo "V23.4: removing stale .git/index.lock"
  rm -f -- "$lock"
  [[ ! -e "$lock" ]] || {
    echo "V23.4 REFUSED: unable to remove stale .git/index.lock"
    return 1
  }
}

mf_clear_stale_index_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.4 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.4 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "V23.4 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V23.4 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V23.4 REFUSED: staged changes in $f"; exit 1; }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || { echo "V23.4 REFUSED: $f already exists"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path

checks={
"memeflow-app/src/token-intelligence-shadow-v23.mjs":[
 "createLearningDatasetShadowV23_3",
 "      const snapshot=cell.observe(event,token,Date.now(),walletReputation);",
 "        learningDataset.recordOutcome({",
 "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_3',",
 "      learningDataset:learningDataset.status()",
 "    learningFeatureReport:",
 "    flushLearningDataset:"
],
"memeflow-app/src/learning-dataset-shadow-v23_3.mjs":[
 "MEMEFLOW_LEARNING_DATASET_V23_3",
 "  function recent({",
 "  function status(){",
 "    featureReport,",
 "    recent,",
 "    status,",
 "    flush"
],
"memeflow-app/app-server.mjs":[
 "/api/owner/intelligence/learning-dataset",
 "/api/owner/intelligence/learning-features",
 "/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */"
],
"memeflow-app/package.json":[
 "node tests/learning-dataset-shadow-v23_3.mjs",
 "\"test:core\":"
]
}

for file,markers in checks.items():
    text=Path(file).read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            raise SystemExit(
                f"V23.4 REFUSED: audited marker missing in {file}: {marker}"
            )

all_text="\n".join(
    Path(p).read_text(encoding="utf-8")
    for p in [
        "memeflow-app/src/token-intelligence-shadow-v23.mjs",
        "memeflow-app/app-server.mjs"
    ]
)

for forbidden in [
    "MEMEFLOW_SHADOW_MATH_BRAIN_V23_4",
    "shadow-math-brain-v23_4.mjs",
    "/api/owner/intelligence/shadow-brain"
]:
    if forbidden in all_text:
        raise SystemExit(
            f"V23.4 REFUSED: feature already appears installed: {forbidden}"
        )

print("AUDITED_V23_4_INPUT_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-math-brain-v23-4-$STAMP"
mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.4 FAILED — RESTORING ==="
    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
    done
    for f in "${NEW_FILES[@]}"; do rm -f "$f"; done
    mf_clear_stale_index_lock >/dev/null 2>&1 || true
    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

cat > "$BRAIN" <<'EOF_BRAIN'
import {
  LEARNING_FEATURES_V23_3
} from './learning-dataset-shadow-v23_3.mjs';

// MEMEFLOW_SHADOW_MATH_BRAIN_V23_4
//
// SHADOW ONLY.
// This module estimates P(POSITIVE outcome at 5m) from historical CLEAN
// MEMEFLOW learning examples.
//
// It NEVER:
// - changes canonical MEMEFLOW Score/State,
// - opens/closes/reduces positions,
// - changes settings,
// - decides trade eligibility.
//
// Safety/rigor:
// - only 5-minute clean labels are used (no correlated multi-horizon inflation),
// - chronological token holdout is kept out of fitting,
// - normalization is learned from training rows only,
// - L2-regularized logistic regression,
// - model must beat a base-rate holdout baseline before "validated=true",
// - cold-start / insufficient-data states return no probability authority.

const TARGET_HORIZON_MS=300_000;

export const SHADOW_BRAIN_FEATURES_V23_4=Object.freeze([
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

const safeLog=p=>Math.log(clamp(p,1e-9,1-1e-9));

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

  for(const name of SHADOW_BRAIN_FEATURES_V23_4){
    const pathStr=LEARNING_FEATURES_V23_3[name];
    out[name]=pathStr
      ? nested(snapshot,pathStr)
      : null;
  }

  return out;
}

function rowVector(row={}){
  const source=row.features||{};
  const out={};

  for(const name of SHADOW_BRAIN_FEATURES_V23_4){
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
  // One 5m clean row per token/anchor is the target learning unit.
  // If duplicated historical rows exist, keep newest per mint+anchor.
  const dedup=new Map();

  for(const row of rows){
    if(row?.quality?.clean!==true)continue;
    if(Number(row?.horizonMs)!==TARGET_HORIZON_MS)continue;

    const y=labelOf(row);
    if(y===null)continue;

    const mint=String(row?.mint||'');
    const anchorAt=Number(row?.anchorAt||0);
    if(!mint||!(anchorAt>0))continue;

    dedup.set(
      `${mint}:${anchorAt}`,
      {
        mint,
        anchorAt,
        y,
        x:rowVector(row)
      }
    );
  }

  return [...dedup.values()]
    .sort(
      (a,b)=>
        a.anchorAt-b.anchorAt ||
        a.mint.localeCompare(b.mint)
    );
}

function splitByToken(rows=[]){
  const tokens=[];
  const seen=new Set();

  for(const row of rows){
    if(seen.has(row.mint))continue;
    seen.add(row.mint);
    tokens.push(row.mint);
  }

  if(tokens.length<10){
    return {train:[],validation:[]};
  }

  const validationTokenCount=Math.max(
    4,
    Math.ceil(tokens.length*0.20)
  );

  const validationTokens=new Set(
    tokens.slice(-validationTokenCount)
  );

  return {
    train:rows.filter(
      row=>!validationTokens.has(row.mint)
    ),
    validation:rows.filter(
      row=>validationTokens.has(row.mint)
    )
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

function fitScaler(rows=[]){
  const scaler={};

  for(const name of SHADOW_BRAIN_FEATURES_V23_4){
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

function scaledVector(x={},scaler={}){
  const values=[];
  let present=0;
  let available=0;

  for(const name of SHADOW_BRAIN_FEATURES_V23_4){
    const s=scaler[name];

    if(!s?.observed){
      values.push(0);
      continue;
    }

    available++;
    const raw=finite(x[name]);

    if(raw===null){
      // Mean imputation after scaling = 0.
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
        : 0,
    availableFeatures:available,
    presentFeatures:present
  };
}

function fitLogistic(train=[],scaler={}){
  const p=SHADOW_BRAIN_FEATURES_V23_4.length;
  const weights=new Array(p).fill(0);

  const counts=classCounts(train);
  const prior=clamp(
    counts.positive/Math.max(1,counts.total),
    0.05,
    0.95
  );

  let intercept=Math.log(prior/(1-prior));

  const learningRate=0.045;
  const l2=0.025;
  const iterations=320;

  for(let iter=0;iter<iterations;iter++){
    let gradB=0;
    const gradW=new Array(p).fill(0);

    for(const row of train){
      const x=scaledVector(row.x,scaler).values;
      let z=intercept;

      for(let j=0;j<p;j++){
        z+=weights[j]*x[j];
      }

      const error=sigmoid(z)-row.y;
      gradB+=error;

      for(let j=0;j<p;j++){
        gradW[j]+=error*x[j];
      }
    }

    const n=Math.max(1,train.length);
    intercept-=learningRate*(gradB/n);

    for(let j=0;j<p;j++){
      const gradient=
        gradW[j]/n +
        l2*weights[j];

      weights[j]-=learningRate*gradient;
      weights[j]=clamp(weights[j],-4,4);
    }
  }

  return {
    intercept,
    weights,
    prior
  };
}

function predictModel(model,scaler,x){
  const scaled=scaledVector(x,scaler);
  let z=model.intercept;

  for(let j=0;j<model.weights.length;j++){
    z+=model.weights[j]*scaled.values[j];
  }

  return {
    probability:sigmoid(z),
    ...scaled
  };
}

function metrics(rows,model,scaler,baselineProbability){
  if(!rows.length)return null;

  let brier=0;
  let logLoss=0;
  let correct=0;
  let baselineBrier=0;
  let baselineLogLoss=0;

  for(const row of rows){
    const p=predictModel(
      model,
      scaler,
      row.x
    ).probability;

    const y=row.y;

    brier+=(p-y)**2;
    logLoss+=-(y*safeLog(p)+(1-y)*safeLog(1-p));
    correct+=(p>=0.5?1:0)===y?1:0;

    const bp=clamp(
      baselineProbability,
      0.01,
      0.99
    );

    baselineBrier+=(bp-y)**2;
    baselineLogLoss+=-(
      y*safeLog(bp)+
      (1-y)*safeLog(1-bp)
    );
  }

  const n=rows.length;

  return {
    rows:n,
    brier:brier/n,
    logLoss:logLoss/n,
    accuracyPct:correct/n*100,
    baselineBrier:baselineBrier/n,
    baselineLogLoss:baselineLogLoss/n,
    brierLift:
      baselineBrier/n-brier/n,
    logLossLift:
      baselineLogLoss/n-logLoss/n
  };
}

function publicCoefficients(model,scaler){
  if(!model||!scaler)return [];

  return SHADOW_BRAIN_FEATURES_V23_4
    .map((feature,index)=>({
      feature,
      coefficient:round(
        model.weights[index],
        5
      ),
      trainingMean:round(
        scaler[feature]?.mean,
        5
      ),
      trainingStd:round(
        scaler[feature]?.std,
        5
      ),
      observed:
        scaler[feature]?.observed===true
    }))
    .sort(
      (a,b)=>
        Math.abs(b.coefficient||0)-
        Math.abs(a.coefficient||0)
    );
}

export function createShadowMathBrainV23_4({
  learningDataset=null,
  minimumTrainRows=40,
  minimumValidationRows=10,
  minimumClassRows=8,
  maxTrainingRows=1200
}={}){
  let fitted=null;
  let scaler=null;
  let validation=null;
  let trainedSignature=null;
  let trainingMeta=null;
  let retrains=0;
  let predictions=0;
  let errors=0;
  const recentPredictions=[];

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

  function rebuildIfNeeded(){
    const signature=datasetSignature();

    if(signature===trainedSignature){
      return;
    }

    trainedSignature=signature;
    fitted=null;
    scaler=null;
    validation=null;
    trainingMeta=null;

    let source=[];

    try{
      source=
        learningDataset?.trainingRows?.({
          limit:maxTrainingRows,
          horizonMs:TARGET_HORIZON_MS
        }) || [];
    }catch{
      errors++;
      return;
    }

    const prepared=prepareRows(source);
    const split=splitByToken(prepared);
    const trainCounts=classCounts(split.train);
    const validationCounts=classCounts(split.validation);

    trainingMeta={
      sourceRows:source.length,
      preparedRows:prepared.length,
      trainRows:split.train.length,
      validationRows:split.validation.length,
      trainCounts,
      validationCounts,
      distinctTokens:
        new Set(prepared.map(row=>row.mint)).size
    };

    const enough=
      split.train.length>=minimumTrainRows &&
      split.validation.length>=minimumValidationRows &&
      trainCounts.positive>=minimumClassRows &&
      trainCounts.negative>=minimumClassRows &&
      validationCounts.positive>=3 &&
      validationCounts.negative>=3;

    if(!enough)return;

    scaler=fitScaler(split.train);
    fitted=fitLogistic(split.train,scaler);
    validation=metrics(
      split.validation,
      fitted,
      scaler,
      fitted.prior
    );
    retrains++;
  }

  function validationPassed(){
    if(!validation)return false;

    // Must beat the chronological base-rate baseline on BOTH proper scoring
    // rules. Tiny epsilon avoids declaring victory on floating noise.
    return (
      validation.brier+0.002 <
        validation.baselineBrier &&
      validation.logLoss+0.002 <
        validation.baselineLogLoss
    );
  }

  function modelConfidencePct(coveragePct){
    if(!validation||!trainingMeta)return 0;

    const sampleConfidence=
      Math.min(
        1,
        trainingMeta.validationRows/50
      );

    const brierImprovement=
      validation.baselineBrier>0
        ? clamp(
            validation.brierLift/
            validation.baselineBrier,
            0,
            1
          )
        : 0;

    return clamp(
      100 *
      sampleConfidence *
      (0.35+0.65*brierImprovement) *
      clamp(coveragePct/100,0,1),
      0,
      100
    );
  }

  function predict(snapshot={},meta={}){
    try{
      rebuildIfNeeded();

      if(!fitted||!scaler||!validation){
        const cold={
          version:'MEMEFLOW_SHADOW_MATH_BRAIN_V23_4',
          shadowOnly:true,
          status:'COLD_START',
          modelReady:false,
          validated:false,
          targetHorizonMs:TARGET_HORIZON_MS,
          probabilityPositivePct:null,
          modelConfidencePct:0,
          featureCoveragePct:null,
          mint:meta?.mint||snapshot?.mint||null,
          observedAt:Date.now()
        };

        remember(cold);
        return cold;
      }

      const x=snapshotVector(snapshot);
      const prediction=predictModel(
        fitted,
        scaler,
        x
      );

      const validated=validationPassed();
      const coveragePct=prediction.coveragePct;

      const result={
        version:'MEMEFLOW_SHADOW_MATH_BRAIN_V23_4',
        shadowOnly:true,
        status:
          coveragePct<50
            ? 'INSUFFICIENT_FEATURES'
            : validated
              ? 'SHADOW_VALIDATED'
              : 'SHADOW_UNVALIDATED',
        modelReady:true,
        validated,
        targetHorizonMs:TARGET_HORIZON_MS,
        probabilityPositivePct:
          round(prediction.probability*100,2),
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
        version:'MEMEFLOW_SHADOW_MATH_BRAIN_V23_4',
        shadowOnly:true,
        status:'ERROR',
        modelReady:false,
        validated:false,
        targetHorizonMs:TARGET_HORIZON_MS,
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

  function remember(row){
    recentPredictions.unshift(row);
    if(recentPredictions.length>200){
      recentPredictions.length=200;
    }
  }

  function listRecent({limit=50}={}){
    const safe=Math.max(
      1,
      Math.min(200,Number(limit)||50)
    );
    return recentPredictions.slice(0,safe);
  }

  function status(){
    rebuildIfNeeded();

    return {
      version:'MEMEFLOW_SHADOW_MATH_BRAIN_V23_4',
      shadowOnly:true,
      target:'P(POSITIVE_5M)',
      targetHorizonMs:TARGET_HORIZON_MS,
      modelType:'L2_LOGISTIC_REGRESSION',
      split:'CHRONOLOGICAL_TOKEN_HOLDOUT',
      modelReady:Boolean(fitted&&scaler&&validation),
      validated:validationPassed(),
      datasetSignature:trainedSignature,
      training:trainingMeta,
      validation:validation
        ? {
            rows:validation.rows,
            brier:round(validation.brier,6),
            logLoss:round(validation.logLoss,6),
            accuracyPct:round(validation.accuracyPct,2),
            baselineBrier:round(validation.baselineBrier,6),
            baselineLogLoss:round(validation.baselineLogLoss,6),
            brierLift:round(validation.brierLift,6),
            logLossLift:round(validation.logLossLift,6)
          }
        : null,
      coefficients:
        publicCoefficients(fitted,scaler),
      configuredFeatures:
        SHADOW_BRAIN_FEATURES_V23_4.length,
      retrains,
      predictions,
      recentPredictions:recentPredictions.length,
      errors
    };
  }

  return {
    predict,
    status,
    listRecent
  };
}
EOF_BRAIN

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowMathBrainV23_4,
  SHADOW_BRAIN_FEATURES_V23_4
} from '../src/shadow-math-brain-v23_4.mjs';

function learningRow({
  i,
  positive,
  mint
}){
  const sign=positive?1:-1;
  return {
    type:'learning-example',
    mint,
    anchorAt:1_800_500_000_000+i*1_000,
    horizonMs:300_000,
    classification:positive?'POSITIVE':'NEGATIVE',
    quality:{clean:true},
    features:{
      netFlow5s:sign*(0.4+(i%5)*0.02),
      netFlow15s:sign*(0.8+(i%7)*0.02),
      tradesPerSecond5s:positive?3.5:0.8,
      priceReturn15s:positive?20+(i%4):-(15+(i%4)),
      priceVolatility15s:positive?0.03:0.06,
      priceEfficiency15s:positive?0.75:-0.45,
      uniqueBuyers15s:positive?14:4,
      buyPressure15s:positive?4.2:0.7,
      holderDelta:positive?25+(i%3):-(8+(i%3)),
      top10Pct:positive?16:34,
      developerPct:positive?2:8,
      mcToLiquidity:positive?8:25,
      drawdownFromPeakPct:positive?4:30,
      bundlePct:positive?2:18,
      suspectedRiskyWalletsPct:positive?3:22,
      buyerConcentrationHhi:positive?0.12:0.40,
      sameSlotBuySharePct:positive?8:65,
      smartMoneyStrongWalletSharePct:positive?35:4,
      smartMoneyPositiveProbabilityPct:positive?72:35,
      smartMoneyHistoricalConfidencePct:positive?60:20
    }
  };
}

// Alternating labels across time keep both classes represented in the
// chronological holdout while maintaining a very learnable synthetic signal.
const rows=[];
for(let i=0;i<120;i++){
  const positive=i%2===0;
  rows.push(
    learningRow({
      i,
      positive,
      mint:`MINT_${i}`
    })
  );
}

let acceptedRows=rows.length;
const dataset={
  status(){
    return {
      acceptedRows,
      cleanRows:acceptedRows
    };
  },
  trainingRows({limit=1200,horizonMs=300_000}={}){
    assert.equal(horizonMs,300_000);
    return rows.slice(-limit);
  }
};

const brain=createShadowMathBrainV23_4({
  learningDataset:dataset,
  minimumTrainRows:40,
  minimumValidationRows:10,
  minimumClassRows:8,
  maxTrainingRows:1200
});

function currentSnapshot(positive){
  const row=learningRow({
    i:999,
    positive,
    mint:'CURRENT'
  });

  const f=row.features;

  return {
    mint:'CURRENT',
    windows:{
      '15000':{
        price:{
          returnPct:f.priceReturn15s,
          volatility:f.priceVolatility15s,
          efficiency:f.priceEfficiency15s
        },
        flow:{
          uniqueBuyers:f.uniqueBuyers15s,
          buyPressure:f.buyPressure15s
        }
      }
    },
    specialists:{
      wallet:{
        buyerConcentrationHhi:f.buyerConcentrationHhi
      },
      coordination:{
        sameSlotBuySharePct:f.sameSlotBuySharePct
      },
      smartMoneyMemory:{
        strongWalletSharePct:f.smartMoneyStrongWalletSharePct,
        weightedPositiveProbabilityPct:
          f.smartMoneyPositiveProbabilityPct,
        historicalConfidencePct:
          f.smartMoneyHistoricalConfidencePct
      }
    },
    evidence:{
      flowAcceleration:{
        tradesPerSecond5s:f.tradesPerSecond5s,
        netFlow5s:f.netFlow5s,
        netFlow15s:f.netFlow15s
      },
      holders:{
        holderDelta:f.holderDelta,
        top10Pct:f.top10Pct,
        developerPct:f.developerPct
      },
      liquidity:{
        mcToLiquidity:f.mcToLiquidity
      },
      risk:{
        drawdownFromPeakPct:f.drawdownFromPeakPct,
        bundlePct:f.bundlePct,
        suspectedRiskyWalletsPct:
          f.suspectedRiskyWalletsPct
      },
      dataQuality:{
        completenessPct:100
      }
    }
  };
}

const status=brain.status();
assert.equal(status.shadowOnly,true);
assert.equal(status.modelReady,true);
assert.equal(status.validated,true);
assert.equal(status.target,'P(POSITIVE_5M)');
assert.equal(status.modelType,'L2_LOGISTIC_REGRESSION');
assert.equal(
  status.configuredFeatures,
  SHADOW_BRAIN_FEATURES_V23_4.length
);
assert.ok(status.validation.brier<status.validation.baselineBrier);
assert.ok(status.validation.logLoss<status.validation.baselineLogLoss);

const good=brain.predict(currentSnapshot(true));
const bad=brain.predict(currentSnapshot(false));

assert.equal(good.shadowOnly,true);
assert.equal(good.modelReady,true);
assert.equal(good.validated,true);
assert.equal(good.status,'SHADOW_VALIDATED');
assert.ok(good.probabilityPositivePct>70);
assert.ok(good.featureCoveragePct>=80);

assert.equal(bad.status,'SHADOW_VALIDATED');
assert.ok(bad.probabilityPositivePct<30);
assert.ok(good.probabilityPositivePct>bad.probabilityPositivePct);

assert.equal(brain.listRecent({limit:10}).length,2);

// Cold-start must return no probability authority.
const cold=createShadowMathBrainV23_4({
  learningDataset:{
    status:()=>({acceptedRows:2,cleanRows:2}),
    trainingRows:()=>rows.slice(0,2)
  }
});

const coldPrediction=cold.predict(currentSnapshot(true));
assert.equal(coldPrediction.status,'COLD_START');
assert.equal(coldPrediction.modelReady,false);
assert.equal(coldPrediction.probabilityPositivePct,null);

// Project wiring and shadow isolation contracts.
const shadow=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs',
  'utf8'
);
const app=fs.readFileSync(
  'app-server.mjs',
  'utf8'
);
const learning=fs.readFileSync(
  'src/learning-dataset-shadow-v23_3.mjs',
  'utf8'
);

assert.match(shadow,/createShadowMathBrainV23_4/);
assert.match(shadow,/shadowMathBrain\.predict/);
assert.match(shadow,/shadowMathBrain:shadowMathBrain\.status\(\)/);
assert.match(learning,/function trainingRows\(/);

assert.match(
  app,
  /\/api\/owner\/intelligence\/shadow-brain/
);
assert.match(
  app,
  /shadowBrainStatus/
);
assert.match(
  app,
  /listShadowBrainPredictions/
);

const source=fs.readFileSync(
  'src/shadow-math-brain-v23_4.mjs',
  'utf8'
);

assert.doesNotMatch(
  source,
  /from ['"]\.\/evaluate\.mjs['"]/
);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/setSettings\s*\(/);
assert.doesNotMatch(source,/tradeEligible/);
assert.doesNotMatch(source,/decisionScore/);
assert.doesNotMatch(source,/brainScore/);

console.log('shadow mathematical brain v23.4 ok');
EOF_TEST

python3 - <<'PY'
from pathlib import Path

shadow_path=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
learning_path=Path("memeflow-app/src/learning-dataset-shadow-v23_3.mjs")
app_path=Path("memeflow-app/app-server.mjs")
pkg_path=Path("memeflow-app/package.json")

shadow=shadow_path.read_text(encoding="utf-8")
learning=learning_path.read_text(encoding="utf-8")
app=app_path.read_text(encoding="utf-8")
pkg=pkg_path.read_text(encoding="utf-8")

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(
            f"V23.4 REFUSED: {label}: expected 1 exact match, got {count}"
        )
    return text.replace(old,new,1)

# ---------------------------------------------------------------
# Learning dataset gets an INTERNAL bounded training-row accessor.
# ---------------------------------------------------------------
learning=once(
    learning,
    """  function status(){
    const horizons=[...horizonStats.values()]
""",
    """  function trainingRows({
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
""",
    "trainingRows insertion"
)

learning=once(
    learning,
    """    featureReport,
    recent,
    status,
    flush
  };
}
""",
    """    featureReport,
    recent,
    // Internal model-training view. Owner HTTP routes do not expose an
    // unbounded dataset dump.
    trainingRows,
    status,
    flush
  };
}
""",
    "trainingRows return"
)

learning_path.write_text(learning,encoding="utf-8")

# ---------------------------------------------------------------
# Token Intelligence consumes the mathematical brain in strict SHADOW mode.
# ---------------------------------------------------------------
shadow=once(
    shadow,
    """import {
  createLearningDatasetShadowV23_3
} from './learning-dataset-shadow-v23_3.mjs';""",
    """import {
  createLearningDatasetShadowV23_3
} from './learning-dataset-shadow-v23_3.mjs';
import {
  createShadowMathBrainV23_4
} from './shadow-math-brain-v23_4.mjs';""",
    "brain import"
)

shadow=once(
    shadow,
    """  const learningDataset=
    createLearningDatasetShadowV23_3({
      dataDir
    });

  const metrics={
""",
    """  const learningDataset=
    createLearningDatasetShadowV23_3({
      dataDir
    });

  const shadowMathBrain=
    createShadowMathBrainV23_4({
      learningDataset
    });

  const metrics={
""",
    "brain construction"
)

shadow=once(
    shadow,
    """      const snapshot=cell.observe(event,token,Date.now(),walletReputation);

      if(cell.maybeAnchor(token,snapshot,journal)){
""",
    """      const snapshot=cell.observe(event,token,Date.now(),walletReputation);

      // MEMEFLOW_SHADOW_MATH_BRAIN_V23_4
      // Diagnostic probability only. It is intentionally attached AFTER
      // canonical evidence generation and cannot alter evaluate()/V22.
      snapshot.shadowMathBrain=
        shadowMathBrain.predict(
          snapshot,
          {mint}
        );

      if(cell.maybeAnchor(token,snapshot,journal)){
""",
    "brain prediction wiring"
)

shadow=once(
    shadow,
    """          smartMoneyMemory:{
            reputationReady:
""",
    """          shadowMathBrain:{
            status:
              snap?.shadowMathBrain?.status||'COLD_START',
            modelReady:
              snap?.shadowMathBrain?.modelReady===true,
            validated:
              snap?.shadowMathBrain?.validated===true,
            probabilityPositivePct:
              snap?.shadowMathBrain
                ?.probabilityPositivePct??null,
            modelConfidencePct:
              snap?.shadowMathBrain
                ?.modelConfidencePct??0
          },
          smartMoneyMemory:{
            reputationReady:
""",
    "brain cell summary"
)

shadow=once(
    shadow,
    "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_3',",
    "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_4',",
    "network version"
)

shadow=once(
    shadow,
    """      walletReputation:walletReputation.status(),
      learningDataset:learningDataset.status()
    };
""",
    """      walletReputation:walletReputation.status(),
      learningDataset:learningDataset.status(),
      shadowMathBrain:shadowMathBrain.status()
    };
""",
    "brain status"
)

shadow=once(
    shadow,
    """    flushLearningDataset:
      ()=>learningDataset.flush(),
    status
  };
}
""",
    """    flushLearningDataset:
      ()=>learningDataset.flush(),
    shadowBrainStatus:
      ()=>shadowMathBrain.status(),
    listShadowBrainPredictions:
      options=>shadowMathBrain.listRecent(options),
    status
  };
}
""",
    "brain monitor API"
)

shadow_path.write_text(shadow,encoding="utf-8")

# ---------------------------------------------------------------
# Owner-only read-only brain monitor.
# ---------------------------------------------------------------
route_anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

routes=r"""/* MEMEFLOW_SHADOW_MATH_BRAIN_MONITOR_V23_4
 * Owner-only and read-only. Probability diagnostics NEVER modify trade state.
 */
 if(
   url.pathname==='/api/owner/intelligence/shadow-brain' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(200,Number(url.searchParams.get('limit')||50))
   );

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     brain:
       tokenIntelligenceShadowV23
         .shadowBrainStatus(),
     predictions:
       tokenIntelligenceShadowV23
         .listShadowBrainPredictions({
           limit
         })
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

app=once(
    app,
    route_anchor,
    routes,
    "brain monitor route"
)
app_path.write_text(app,encoding="utf-8")

# Full suite includes V23.4.
needle="node tests/learning-dataset-shadow-v23_3.mjs && "
if pkg.count(needle)!=1:
    raise SystemExit(
        f"V23.4 REFUSED: package insertion anchor count={pkg.count(needle)}"
    )

pkg=pkg.replace(
    needle,
    "node tests/learning-dataset-shadow-v23_3.mjs && node tests/shadow-math-brain-v23_4.mjs && ",
    1
)

pkg_path.write_text(pkg,encoding="utf-8")

print("V23_4_TRANSFORM_OK")
PY

echo
echo "=== V23.4 PRECHECK ==="
grep -q "MEMEFLOW_SHADOW_MATH_BRAIN_V23_4" "$BRAIN"
grep -q "shadow-math-brain-v23_4.mjs" "$SHADOW"
grep -q "shadowMathBrain.predict" "$SHADOW"
grep -q "function trainingRows" "$LEARNING"
grep -q "MEMEFLOW_SHADOW_MATH_BRAIN_MONITOR_V23_4" "$APP"
grep -q "shadow-math-brain-v23_4.mjs" "$PKG"
echo "PRECHECK_OK"

echo
echo "=== V23.4 SYNTAX ==="
node --check "$APP"
node --check "$SHADOW"
node --check "$LEARNING"
node --check "$BRAIN"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo
echo "=== V23.4 TARGETED TESTS ==="
(
  cd memeflow-app
  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/wallet-reputation-shadow-v23_2.mjs
  node tests/learning-dataset-shadow-v23_3.mjs
  node tests/shadow-math-brain-v23_4.mjs
  node tests/opportunity-engine.mjs
  node tests/canonical-live-score-pipeline-v20_8_8.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V23.4 FULL PROJECT TEST SUITE ==="
(
  cd memeflow-app
  npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.4 CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path

brain=Path(
    "memeflow-app/src/shadow-math-brain-v23_4.mjs"
).read_text()

shadow=Path(
    "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()

learning=Path(
    "memeflow-app/src/learning-dataset-shadow-v23_3.mjs"
).read_text()

app=Path("memeflow-app/app-server.mjs").read_text()
pkg=Path("memeflow-app/package.json").read_text()

errors=[]

for marker in [
    "MEMEFLOW_SHADOW_MATH_BRAIN_V23_4",
    "TARGET_HORIZON_MS=300_000",
    "L2_LOGISTIC_REGRESSION",
    "CHRONOLOGICAL_TOKEN_HOLDOUT",
    "fitScaler",
    "fitLogistic",
    "baselineBrier",
    "baselineLogLoss",
    "SHADOW_UNVALIDATED",
    "SHADOW_VALIDATED",
    "COLD_START",
    "modelConfidencePct"
]:
    if marker not in brain:
        errors.append(f"brain marker missing: {marker}")

for forbidden in [
    "from './evaluate.mjs'",
    'from "./evaluate.mjs"',
    "openPosition(",
    "closePosition(",
    "setSettings(",
    "tradeEligible",
    "decisionScore",
    "brainScore"
]:
    if forbidden in brain:
        errors.append(
            f"brain trading authority forbidden: {forbidden}"
        )

for marker in [
    "createShadowMathBrainV23_4",
    "shadowMathBrain.predict",
    "shadowMathBrain:shadowMathBrain.status()",
    "shadowBrainStatus",
    "listShadowBrainPredictions",
    "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_4"
]:
    if marker not in shadow:
        errors.append(f"shadow brain wiring missing: {marker}")

if "function trainingRows" not in learning:
    errors.append("internal trainingRows missing")

for marker in [
    "/api/owner/intelligence/shadow-brain",
    "MEMEFLOW_SHADOW_MATH_BRAIN_MONITOR_V23_4",
    "shadowBrainStatus",
    "listShadowBrainPredictions"
]:
    if marker not in app:
        errors.append(f"brain monitor missing: {marker}")

if "shadow-math-brain-v23_4.mjs" not in pkg:
    errors.append("V23.4 regression not in full suite")

# Old contracts must remain intact.
for marker in [
    "smartMoneySeed:{",
    "reputationReady:false",
    "walletReputation.recordOutcome",
    "learningDataset.recordOutcome"
]:
    if marker not in shadow:
        errors.append(f"backward compatibility missing: {marker}")

if errors:
    raise SystemExit(
        "V23_4_CONTRACT_FAILED:\n- " +
        "\n- ".join(errors)
    )

print("V23_4_CONTRACT_OK")
PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.4 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

mf_clear_stale_index_lock
git reset >/dev/null
mf_clear_stale_index_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/learning-dataset-shadow-v23_3\.mjs|src/shadow-math-brain-v23_4\.mjs|tests/shadow-math-brain-v23_4\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"

if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.4 STAGED ==="
git diff --cached --stat

git commit -m "feat: add validated shadow mathematical brain v23.4"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "V23.4 CONTRACT:"
echo "  evaluate()/V22 remains the only trading authority"
echo "  brain targets P(POSITIVE outcome at 5m), not a second MEMEFLOW Score"
echo "  only clean 5m examples enter fitting"
echo "  chronological token holdout prevents training/validation overlap"
echo "  train-only normalization + L2 logistic regression"
echo "  brain is validated only if it beats base-rate Brier AND log-loss"
echo "  cold/unvalidated predictions cannot influence BUY/SELL"
echo "  owner-only monitor exposes model health and recent shadow probabilities"
