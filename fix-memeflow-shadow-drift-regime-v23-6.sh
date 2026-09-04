#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="15be2a44c3af378eb63322a432dd00f211bfcbf0"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
DRIFT="memeflow-app/src/shadow-drift-regime-v23_6.mjs"
PKG="memeflow-app/package.json"
TEST="memeflow-app/tests/shadow-drift-regime-v23_6.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$DRIFT" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW DRIFT DETECTION / REGIME MODELS V23.6 ==="

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
    echo "V23.6 REFUSED: .git/index.lock exists and active git is running:"
    echo "$active"
    echo "Nothing changed."
    return 1
  fi
  echo "V23.6: removing stale .git/index.lock"
  rm -f -- "$lock"
  [[ ! -e "$lock" ]] || {
    echo "V23.6 REFUSED: unable to remove stale .git/index.lock"
    return 1
  }
}

mf_clear_stale_index_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.6 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.6 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "V23.6 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V23.6 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V23.6 REFUSED: staged changes in $f"; exit 1; }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || { echo "V23.6 REFUSED: $f already exists"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path

checks={
"memeflow-app/src/token-intelligence-shadow-v23.mjs":[
 "createShadowModelArenaV23_5",
 "      snapshot.shadowModelArena=",
 "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_5',",
 "      shadowModelArena:shadowModelArena.status()",
 "    shadowModelArenaStatus:",
 "    listShadowModelArenaPredictions:"
],
"memeflow-app/app-server.mjs":[
 "/api/owner/intelligence/shadow-model-arena",
 "/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */"
],
"memeflow-app/package.json":[
 "node tests/shadow-model-arena-v23_5.mjs",
 "\"test:core\":"
]
}

for file,markers in checks.items():
    text=Path(file).read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            raise SystemExit(
                f"V23.6 REFUSED: audited marker missing in {file}: {marker}"
            )

all_text="\n".join(
    Path(p).read_text(encoding="utf-8")
    for p in [
        "memeflow-app/src/token-intelligence-shadow-v23.mjs",
        "memeflow-app/app-server.mjs"
    ]
)

for forbidden in [
    "MEMEFLOW_DRIFT_REGIME_V23_6",
    "shadow-drift-regime-v23_6.mjs",
    "/api/owner/intelligence/shadow-drift-regime"
]:
    if forbidden in all_text:
        raise SystemExit(
            f"V23.6 REFUSED: feature already appears installed: {forbidden}"
        )

print("AUDITED_V23_6_INPUT_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-drift-regime-v23-6-$STAMP"
mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.6 FAILED — RESTORING ==="
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

cat > "$DRIFT" <<'EOF_DRIFT'
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
EOF_DRIFT

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowDriftRegimeV23_6
} from '../src/shadow-drift-regime-v23_6.mjs';

function row({
  i,
  positive,
  regime='EXPANSION',
  shift=0
}){
  const sign=positive?1:-1;

  return {
    type:'learning-example',
    mint:`R_${regime}_${i}`,
    anchorAt:1_800_700_000_000+i*1000,
    horizonMs:300_000,
    regimeAtAnchor:regime,
    classification:positive?'POSITIVE':'NEGATIVE',
    quality:{clean:true},
    features:{
      netFlow5s:sign*(0.5+shift),
      netFlow15s:sign*(0.9+shift),
      priceReturn15s:sign*(20+shift*10),
      priceVolatility15s:positive?0.03:0.06,
      priceEfficiency15s:positive?0.8:-0.5,
      uniqueBuyers15s:positive?16:4,
      holderDelta:positive?25:-8,
      mcToLiquidity:positive?8:24,
      drawdownFromPeakPct:positive?4:30,
      buyerConcentrationHhi:positive?0.12:0.42,
      sameSlotBuySharePct:positive?8:65,
      smartMoneyPositiveProbabilityPct:
        positive?72:34
    }
  };
}

const stableRows=[];

// Two regimes, each with enough rows and balanced outcomes.
for(let i=0;i<80;i++){
  stableRows.push(
    row({
      i,
      positive:i%2===0,
      regime:'EXPANSION'
    })
  );
}
for(let i=80;i<160;i++){
  stableRows.push(
    row({
      i,
      positive:i%2===0,
      regime:'CHOP'
    })
  );
}

const dataset={
  status:()=>({
    acceptedRows:stableRows.length,
    cleanRows:stableRows.length
  }),
  trainingRows:()=>stableRows
};

const monitor=createShadowDriftRegimeV23_6({
  learningDataset:dataset
});

const status=monitor.status();
assert.equal(status.shadowOnly,true);
assert.equal(status.preparedRows,160);
assert.ok(
  ['STABLE','WATCH'].includes(status.drift.status)
);
assert.ok(
  status.regimes.some(
    r=>r.regime==='EXPANSION'&&r.ready===true
  )
);
assert.ok(
  status.regimes.some(
    r=>r.regime==='CHOP'&&r.ready===true
  )
);

function snapshot(positive=true,regime='EXPANSION'){
  const f=row({
    i:999,
    positive,
    regime
  }).features;

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
          uniqueBuyers:f.uniqueBuyers15s
        }
      }
    },
    specialists:{
      wallet:{
        buyerConcentrationHhi:
          f.buyerConcentrationHhi
      },
      coordination:{
        sameSlotBuySharePct:
          f.sameSlotBuySharePct
      },
      smartMoneyMemory:{
        weightedPositiveProbabilityPct:
          f.smartMoneyPositiveProbabilityPct
      }
    },
    evidence:{
      regime,
      flowAcceleration:{
        netFlow5s:f.netFlow5s,
        netFlow15s:f.netFlow15s
      },
      holders:{
        holderDelta:f.holderDelta
      },
      liquidity:{
        mcToLiquidity:f.mcToLiquidity
      },
      risk:{
        drawdownFromPeakPct:
          f.drawdownFromPeakPct
      }
    }
  };
}

const good=monitor.predict(
  snapshot(true,'EXPANSION')
);
const bad=monitor.predict(
  snapshot(false,'EXPANSION')
);

assert.equal(good.regimeModelReady,true);
assert.ok(good.probabilityPositivePct>bad.probabilityPositivePct);
assert.equal(good.currentRegime,'EXPANSION');
assert.ok(good.featureCoveragePct>=80);

// Unknown regime must never borrow another regime model silently.
const unknown=monitor.predict(
  snapshot(true,'PANIC')
);
assert.equal(unknown.regimeModelReady,false);
assert.equal(
  unknown.probabilityPositivePct,
  null
);

// Synthetic distribution shift should trigger drift.
const driftRows=[];
for(let i=0;i<120;i++){
  driftRows.push(
    row({
      i,
      positive:i%2===0,
      regime:'EXPANSION',
      shift:0
    })
  );
}
for(let i=120;i<160;i++){
  const r=row({
    i,
    positive:i%2===0,
    regime:'EXPANSION',
    shift:4
  });
  // Force obvious recent feature shift regardless of class sign.
  r.features.netFlow5s+=8;
  r.features.netFlow15s+=10;
  r.features.priceReturn15s+=80;
  driftRows.push(r);
}

const driftMonitor=createShadowDriftRegimeV23_6({
  learningDataset:{
    status:()=>({
      acceptedRows:driftRows.length,
      cleanRows:driftRows.length
    }),
    trainingRows:()=>driftRows
  }
});

const driftStatus=driftMonitor.status();
assert.equal(driftStatus.drift.status,'DRIFT');
assert.ok(driftStatus.drift.maxFeatureShift>=1.25);

const driftPrediction=driftMonitor.predict(
  snapshot(true,'EXPANSION')
);

if(driftPrediction.regimeModelReady){
  assert.equal(
    driftPrediction.regimeModelValidated,
    false
  );
  assert.equal(
    driftPrediction.status,
    'REGIME_DRIFTED'
  );
}

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
  /createShadowDriftRegimeV23_6/
);
assert.match(
  shadow,
  /shadowDriftRegime\.predict/
);
assert.match(
  shadow,
  /shadowDriftRegime:shadowDriftRegime\.status\(\)/
);
assert.match(
  app,
  /\/api\/owner\/intelligence\/shadow-drift-regime/
);
assert.match(
  app,
  /shadowDriftRegimeStatus/
);
assert.match(
  app,
  /listShadowDriftRegimePredictions/
);

const source=fs.readFileSync(
  'src/shadow-drift-regime-v23_6.mjs',
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
assert.doesNotMatch(source,/regimeScore/);
assert.doesNotMatch(source,/decisionScore/);

console.log('shadow drift regime v23.6 ok');
EOF_TEST

python3 - <<'PY'
from pathlib import Path

shadow_path=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
app_path=Path("memeflow-app/app-server.mjs")
pkg_path=Path("memeflow-app/package.json")

shadow=shadow_path.read_text(encoding="utf-8")
app=app_path.read_text(encoding="utf-8")
pkg=pkg_path.read_text(encoding="utf-8")

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(
            f"V23.6 REFUSED: {label}: expected 1 exact match, got {count}"
        )
    return text.replace(old,new,1)

shadow=once(
    shadow,
    """import {
  createShadowModelArenaV23_5
} from './shadow-model-arena-v23_5.mjs';""",
    """import {
  createShadowModelArenaV23_5
} from './shadow-model-arena-v23_5.mjs';
import {
  createShadowDriftRegimeV23_6
} from './shadow-drift-regime-v23_6.mjs';""",
    "drift import"
)

shadow=once(
    shadow,
    """  const shadowModelArena=
    createShadowModelArenaV23_5({
      learningDataset
    });

  const metrics={
""",
    """  const shadowModelArena=
    createShadowModelArenaV23_5({
      learningDataset
    });

  const shadowDriftRegime=
    createShadowDriftRegimeV23_6({
      learningDataset
    });

  const metrics={
""",
    "drift construction"
)

shadow=once(
    shadow,
    """      snapshot.shadowModelArena=
        shadowModelArena.predict(
          snapshot,
          {mint}
        );

      if(cell.maybeAnchor(token,snapshot,journal)){
""",
    """      snapshot.shadowModelArena=
        shadowModelArena.predict(
          snapshot,
          {mint}
        );

      // MEMEFLOW_DRIFT_REGIME_V23_6
      // Drift/regime diagnostics are shadow-only and do not mutate V22.
      snapshot.shadowDriftRegime=
        shadowDriftRegime.predict(
          snapshot,
          {mint}
        );

      if(cell.maybeAnchor(token,snapshot,journal)){
""",
    "drift prediction wiring"
)

shadow=once(
    shadow,
    """          shadowModelArena:{
            status:
              snap?.shadowModelArena?.status||'COLD_START',
""",
    """          shadowDriftRegime:{
            status:
              snap?.shadowDriftRegime?.status||'COLD_START',
            driftStatus:
              snap?.shadowDriftRegime?.driftStatus||'COLD_START',
            currentRegime:
              snap?.shadowDriftRegime?.currentRegime||'UNKNOWN',
            regimeModelReady:
              snap?.shadowDriftRegime?.regimeModelReady===true,
            regimeModelValidated:
              snap?.shadowDriftRegime?.regimeModelValidated===true,
            probabilityPositivePct:
              snap?.shadowDriftRegime
                ?.probabilityPositivePct??null,
            modelConfidencePct:
              snap?.shadowDriftRegime
                ?.modelConfidencePct??0
          },
          shadowModelArena:{
            status:
              snap?.shadowModelArena?.status||'COLD_START',
""",
    "drift cell summary"
)

shadow=once(
    shadow,
    "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_5',",
    "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_6',",
    "network version"
)

shadow=once(
    shadow,
    """      shadowMathBrain:shadowMathBrain.status(),
      shadowModelArena:shadowModelArena.status()
    };
""",
    """      shadowMathBrain:shadowMathBrain.status(),
      shadowModelArena:shadowModelArena.status(),
      shadowDriftRegime:shadowDriftRegime.status()
    };
""",
    "drift status"
)

shadow=once(
    shadow,
    """    listShadowModelArenaPredictions:
      options=>shadowModelArena.listRecent(options),
    status
  };
}
""",
    """    listShadowModelArenaPredictions:
      options=>shadowModelArena.listRecent(options),
    shadowDriftRegimeStatus:
      ()=>shadowDriftRegime.status(),
    listShadowDriftRegimePredictions:
      options=>shadowDriftRegime.listRecent(options),
    status
  };
}
""",
    "drift monitor API"
)

shadow_path.write_text(shadow,encoding="utf-8")

route_anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

routes=r"""/* MEMEFLOW_SHADOW_DRIFT_REGIME_MONITOR_V23_6
 * Owner-only, read-only drift and regime-model diagnostics.
 */
 if(
   url.pathname==='/api/owner/intelligence/shadow-drift-regime' &&
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
     driftRegime:
       tokenIntelligenceShadowV23
         .shadowDriftRegimeStatus(),
     predictions:
       tokenIntelligenceShadowV23
         .listShadowDriftRegimePredictions({
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
    "drift monitor route"
)
app_path.write_text(app,encoding="utf-8")

needle="node tests/shadow-model-arena-v23_5.mjs && "
if pkg.count(needle)!=1:
    raise SystemExit(
        f"V23.6 REFUSED: package insertion anchor count={pkg.count(needle)}"
    )

pkg=pkg.replace(
    needle,
    "node tests/shadow-model-arena-v23_5.mjs && node tests/shadow-drift-regime-v23_6.mjs && ",
    1
)
pkg_path.write_text(pkg,encoding="utf-8")

print("V23_6_TRANSFORM_OK")
PY

echo
echo "=== V23.6 PRECHECK ==="
grep -q "MEMEFLOW_DRIFT_REGIME_V23_6" "$DRIFT"
grep -q "shadow-drift-regime-v23_6.mjs" "$SHADOW"
grep -q "shadowDriftRegime.predict" "$SHADOW"
grep -q "MEMEFLOW_SHADOW_DRIFT_REGIME_MONITOR_V23_6" "$APP"
grep -q "shadow-drift-regime-v23_6.mjs" "$PKG"
echo "PRECHECK_OK"

echo
echo "=== V23.6 SYNTAX ==="
node --check "$APP"
node --check "$SHADOW"
node --check "$DRIFT"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo
echo "=== V23.6 TARGETED TESTS ==="
(
  cd memeflow-app
  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/wallet-reputation-shadow-v23_2.mjs
  node tests/learning-dataset-shadow-v23_3.mjs
  node tests/shadow-math-brain-v23_4.mjs
  node tests/shadow-model-arena-v23_5.mjs
  node tests/shadow-drift-regime-v23_6.mjs
  node tests/opportunity-engine.mjs
  node tests/canonical-live-score-pipeline-v20_8_8.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V23.6 FULL PROJECT TEST SUITE ==="
(
  cd memeflow-app
  npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.6 CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path

drift=Path(
    "memeflow-app/src/shadow-drift-regime-v23_6.mjs"
).read_text()
shadow=Path(
    "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()
app=Path("memeflow-app/app-server.mjs").read_text()
pkg=Path("memeflow-app/package.json").read_text()

errors=[]

for marker in [
    "MEMEFLOW_DRIFT_REGIME_V23_6",
    "RECENT_VS_BASELINE_STANDARDIZED_SHIFT",
    "standardizedShift",
    "buildRegimeModels",
    "REGIME_VALIDATED",
    "REGIME_UNVALIDATED",
    "REGIME_DRIFTED",
    "DRIFT_NO_REGIME_MODEL",
    "REGIME_COLD_START",
    "TARGET_HORIZON_MS=300_000"
]:
    if marker not in drift:
        errors.append(f"drift marker missing: {marker}")

for forbidden in [
    "from './evaluate.mjs'",
    'from "./evaluate.mjs"',
    "openPosition(",
    "closePosition(",
    "setSettings(",
    "tradeEligible",
    "regimeScore",
    "decisionScore"
]:
    if forbidden in drift:
        errors.append(
            f"drift trading authority forbidden: {forbidden}"
        )

for marker in [
    "createShadowDriftRegimeV23_6",
    "shadowDriftRegime.predict",
    "shadowDriftRegime:shadowDriftRegime.status()",
    "shadowDriftRegimeStatus",
    "listShadowDriftRegimePredictions",
    "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_6"
]:
    if marker not in shadow:
        errors.append(f"shadow drift wiring missing: {marker}")

for marker in [
    "/api/owner/intelligence/shadow-drift-regime",
    "MEMEFLOW_SHADOW_DRIFT_REGIME_MONITOR_V23_6",
    "shadowDriftRegimeStatus",
    "listShadowDriftRegimePredictions"
]:
    if marker not in app:
        errors.append(f"drift monitor missing: {marker}")

if "shadow-drift-regime-v23_6.mjs" not in pkg:
    errors.append("V23.6 regression not in full suite")

for marker in [
    "walletReputation.recordOutcome",
    "learningDataset.recordOutcome",
    "shadowMathBrain.predict",
    "shadowModelArena.predict"
]:
    if marker not in shadow:
        errors.append(f"backward compatibility missing: {marker}")

if errors:
    raise SystemExit(
        "V23_6_CONTRACT_FAILED:\n- " +
        "\n- ".join(errors)
    )

print("V23_6_CONTRACT_OK")
PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.6 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

mf_clear_stale_index_lock
git reset >/dev/null
mf_clear_stale_index_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/shadow-drift-regime-v23_6\.mjs|tests/shadow-drift-regime-v23_6\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"

if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.6 STAGED ==="
git diff --cached --stat

git commit -m "feat: add shadow drift detection and regime models v23.6"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "V23.6 CONTRACT:"
echo "  evaluate()/V22 remains the only trading authority"
echo "  drift compares recent clean 5m evidence against historical baseline"
echo "  regime models train independently per observed market regime"
echo "  unknown regimes never silently borrow another regime model"
echo "  severe drift disables regime-model validation confidence"
echo "  all drift/regime outputs remain SHADOW diagnostics only"
