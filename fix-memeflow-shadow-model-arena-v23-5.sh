#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="524d0ef9562fa83b932d9c27788362361071a2a6"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
ARENA="memeflow-app/src/shadow-model-arena-v23_5.mjs"
PKG="memeflow-app/package.json"
TEST="memeflow-app/tests/shadow-model-arena-v23_5.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$ARENA" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW MODEL ARENA / CALIBRATION V23.5 ==="

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
    echo "V23.5 REFUSED: .git/index.lock exists and active git is running:"
    echo "$active"
    echo "Nothing changed."
    return 1
  fi
  echo "V23.5: removing stale .git/index.lock"
  rm -f -- "$lock"
  [[ ! -e "$lock" ]] || {
    echo "V23.5 REFUSED: unable to remove stale .git/index.lock"
    return 1
  }
}

mf_clear_stale_index_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.5 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.5 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "V23.5 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V23.5 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V23.5 REFUSED: staged changes in $f"; exit 1; }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || { echo "V23.5 REFUSED: $f already exists"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path

checks={
"memeflow-app/src/token-intelligence-shadow-v23.mjs":[
 "createShadowMathBrainV23_4",
 "      snapshot.shadowMathBrain=",
 "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_4',",
 "      shadowMathBrain:shadowMathBrain.status()",
 "    shadowBrainStatus:",
 "    listShadowBrainPredictions:"
],
"memeflow-app/app-server.mjs":[
 "/api/owner/intelligence/shadow-brain",
 "/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */"
],
"memeflow-app/package.json":[
 "node tests/shadow-math-brain-v23_4.mjs",
 "\"test:core\":"
]
}

for file,markers in checks.items():
    text=Path(file).read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            raise SystemExit(
                f"V23.5 REFUSED: audited marker missing in {file}: {marker}"
            )

all_text="\n".join(
    Path(p).read_text(encoding="utf-8")
    for p in [
        "memeflow-app/src/token-intelligence-shadow-v23.mjs",
        "memeflow-app/app-server.mjs"
    ]
)

for forbidden in [
    "MEMEFLOW_SHADOW_MODEL_ARENA_V23_5",
    "shadow-model-arena-v23_5.mjs",
    "/api/owner/intelligence/shadow-model-arena"
]:
    if forbidden in all_text:
        raise SystemExit(
            f"V23.5 REFUSED: feature already appears installed: {forbidden}"
        )

print("AUDITED_V23_5_INPUT_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-model-arena-v23-5-$STAMP"
mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.5 FAILED — RESTORING ==="
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

cat > "$ARENA" <<'EOF_ARENA'
import {
  LEARNING_FEATURES_V23_3
} from './learning-dataset-shadow-v23_3.mjs';

// MEMEFLOW_SHADOW_MODEL_ARENA_V23_5
//
// SHADOW ONLY.
//
// V23.5 compares multiple probability models and calibrates them without
// touching canonical MEMEFLOW Score/State/trading.
//
// Chronological token partitions:
//   TRAIN       -> fit candidate models
//   CALIBRATION -> fit Platt probability calibration
//   SELECTION   -> choose champion
//   FINAL       -> independent champion validation
//
// Candidate models:
//   1) FULL_LOGISTIC  : broader evidence set
//   2) CORE_LOGISTIC  : smaller robust feature set
//   3) GAUSSIAN_NB    : independent probabilistic family
//
// A champion is "validated" only if its calibrated probability beats the
// train base-rate baseline on BOTH Brier score and log-loss on FINAL holdout.

const TARGET_HORIZON_MS=300_000;

export const ARENA_FULL_FEATURES_V23_5=Object.freeze([
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

export const ARENA_CORE_FEATURES_V23_5=Object.freeze([
  'netFlow5s',
  'netFlow15s',
  'priceReturn15s',
  'priceEfficiency15s',
  'uniqueBuyers15s',
  'holderDelta',
  'mcToLiquidity',
  'drawdownFromPeakPct',
  'buyerConcentrationHhi',
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

const safeLog=p=>Math.log(clamp(p,1e-9,1-1e-9));

const nested=(obj,pathStr)=>{
  let cur=obj;
  for(const key of String(pathStr).split('.')){
    if(cur===null||cur===undefined)return null;
    cur=cur[key];
  }
  return finite(cur);
};

function snapshotVector(snapshot={},features=[]){
  const out={};
  for(const name of features){
    const pathStr=LEARNING_FEATURES_V23_3[name];
    out[name]=pathStr?nested(snapshot,pathStr):null;
  }
  return out;
}

function rowVector(row={},features=[]){
  const source=row.features||{};
  const out={};
  for(const name of features){
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
  const dedup=new Map();

  for(const row of rows){
    if(row?.quality?.clean!==true)continue;
    if(Number(row?.horizonMs)!==TARGET_HORIZON_MS)continue;

    const y=labelOf(row);
    if(y===null)continue;

    const mint=String(row?.mint||'');
    const anchorAt=Number(row?.anchorAt||0);
    if(!mint||!(anchorAt>0))continue;

    dedup.set(`${mint}:${anchorAt}`,{
      mint,
      anchorAt,
      y,
      raw:row
    });
  }

  return [...dedup.values()].sort(
    (a,b)=>
      a.anchorAt-b.anchorAt ||
      a.mint.localeCompare(b.mint)
  );
}

function uniqueTokens(rows=[]){
  const seen=new Set();
  const out=[];
  for(const row of rows){
    if(seen.has(row.mint))continue;
    seen.add(row.mint);
    out.push(row.mint);
  }
  return out;
}

function partitionChronologically(rows=[]){
  const tokens=uniqueTokens(rows);

  if(tokens.length<32){
    return {
      train:[],
      calibration:[],
      selection:[],
      final:[]
    };
  }

  const n=tokens.length;
  const trainEnd=Math.max(1,Math.floor(n*0.55));
  const calibrationEnd=Math.max(
    trainEnd+1,
    Math.floor(n*0.70)
  );
  const selectionEnd=Math.max(
    calibrationEnd+1,
    Math.floor(n*0.85)
  );

  const trainTokens=new Set(tokens.slice(0,trainEnd));
  const calibrationTokens=new Set(
    tokens.slice(trainEnd,calibrationEnd)
  );
  const selectionTokens=new Set(
    tokens.slice(calibrationEnd,selectionEnd)
  );
  const finalTokens=new Set(tokens.slice(selectionEnd));

  return {
    train:rows.filter(row=>trainTokens.has(row.mint)),
    calibration:rows.filter(row=>calibrationTokens.has(row.mint)),
    selection:rows.filter(row=>selectionTokens.has(row.mint)),
    final:rows.filter(row=>finalTokens.has(row.mint))
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

function withVectors(rows,features){
  return rows.map(row=>({
    ...row,
    x:rowVector(row.raw,features)
  }));
}

function fitScaler(rows=[],features=[]){
  const scaler={};

  for(const name of features){
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

function scaledVector(x={},features=[],scaler={}){
  const values=[];
  let present=0;
  let available=0;

  for(const name of features){
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
        : 0
  };
}

function fitLogistic(rows,features,{
  learningRate=0.045,
  l2=0.03,
  iterations=320
}={}){
  const scaler=fitScaler(rows,features);
  const counts=classCounts(rows);
  const prior=clamp(
    counts.positive/Math.max(1,counts.total),
    0.05,
    0.95
  );

  const weights=new Array(features.length).fill(0);
  let intercept=logit(prior);

  for(let iter=0;iter<iterations;iter++){
    let gradB=0;
    const gradW=new Array(features.length).fill(0);

    for(const row of rows){
      const x=scaledVector(
        row.x,
        features,
        scaler
      ).values;

      let z=intercept;
      for(let j=0;j<weights.length;j++){
        z+=weights[j]*x[j];
      }

      const err=sigmoid(z)-row.y;
      gradB+=err;

      for(let j=0;j<weights.length;j++){
        gradW[j]+=err*x[j];
      }
    }

    const n=Math.max(1,rows.length);
    intercept-=learningRate*(gradB/n);

    for(let j=0;j<weights.length;j++){
      const g=gradW[j]/n+l2*weights[j];
      weights[j]-=learningRate*g;
      weights[j]=clamp(weights[j],-4,4);
    }
  }

  return {
    type:'LOGISTIC',
    features,
    scaler,
    weights,
    intercept,
    prior,
    predict(x){
      const scaled=scaledVector(x,features,scaler);
      let z=intercept;
      for(let j=0;j<weights.length;j++){
        z+=weights[j]*scaled.values[j];
      }
      return {
        probability:sigmoid(z),
        coveragePct:scaled.coveragePct
      };
    }
  };
}

function meanVariance(values=[]){
  if(!values.length){
    return {mean:0,variance:1};
  }

  const mean=
    values.reduce((sum,v)=>sum+v,0)/
    values.length;

  const variance=
    values.length>1
      ? values.reduce(
          (sum,v)=>sum+(v-mean)**2,
          0
        )/(values.length-1)
      : 1;

  return {
    mean,
    variance:Math.max(variance,1e-6)
  };
}

function fitGaussianNB(rows,features){
  const counts=classCounts(rows);
  const priorPositive=clamp(
    counts.positive/Math.max(1,counts.total),
    0.05,
    0.95
  );

  const stats={};

  for(const name of features){
    const positive=rows
      .filter(row=>row.y===1)
      .map(row=>finite(row.x[name]))
      .filter(Number.isFinite);

    const negative=rows
      .filter(row=>row.y===0)
      .map(row=>finite(row.x[name]))
      .filter(Number.isFinite);

    stats[name]={
      positive:meanVariance(positive),
      negative:meanVariance(negative),
      observed:
        positive.length>=3&&negative.length>=3
    };
  }

  const logGaussian=(x,{mean,variance})=>
    -0.5*Math.log(2*Math.PI*variance)-
    ((x-mean)**2)/(2*variance);

  return {
    type:'GAUSSIAN_NB',
    features,
    prior:priorPositive,
    stats,
    predict(x){
      let lp=Math.log(priorPositive);
      let ln=Math.log(1-priorPositive);
      let available=0;
      let present=0;

      for(const name of features){
        const s=stats[name];
        if(!s?.observed)continue;

        available++;
        const raw=finite(x[name]);
        if(raw===null)continue;
        present++;

        lp+=logGaussian(raw,s.positive);
        ln+=logGaussian(raw,s.negative);
      }

      const delta=clamp(lp-ln,-30,30);

      return {
        probability:sigmoid(delta),
        coveragePct:
          available>0
            ? present/available*100
            : 0
      };
    }
  };
}

function fitPlatt(rows,model,features){
  let a=1;
  let b=0;
  const lr=0.03;
  const l2=0.01;

  for(let iter=0;iter<240;iter++){
    let ga=0,gb=0;

    for(const row of rows){
      const raw=model.predict(row.x).probability;
      const z=logit(raw);
      const p=sigmoid(a*z+b);
      const err=p-row.y;

      ga+=err*z;
      gb+=err;
    }

    const n=Math.max(1,rows.length);

    a-=lr*(ga/n+l2*(a-1));
    b-=lr*(gb/n);

    a=clamp(a,-5,5);
    b=clamp(b,-5,5);
  }

  return {
    a,
    b,
    apply(rawProbability){
      return sigmoid(
        a*logit(rawProbability)+b
      );
    }
  };
}

function ece(rows,predict,bins=10){
  const buckets=Array.from({length:bins},()=>({
    n:0,
    p:0,
    y:0
  }));

  for(const row of rows){
    const p=clamp(predict(row),0,1);
    const i=Math.min(
      bins-1,
      Math.floor(p*bins)
    );
    buckets[i].n++;
    buckets[i].p+=p;
    buckets[i].y+=row.y;
  }

  const total=Math.max(
    1,
    buckets.reduce((sum,b)=>sum+b.n,0)
  );

  let value=0;

  for(const b of buckets){
    if(!b.n)continue;
    const meanP=b.p/b.n;
    const meanY=b.y/b.n;
    value+=b.n/total*Math.abs(meanP-meanY);
  }

  return value;
}

function metrics(rows,predict,baselineProbability){
  if(!rows.length)return null;

  let brier=0;
  let logLoss=0;
  let correct=0;
  let baselineBrier=0;
  let baselineLogLoss=0;

  const baseline=clamp(
    baselineProbability,
    0.01,
    0.99
  );

  for(const row of rows){
    const p=clamp(predict(row),1e-9,1-1e-9);
    const y=row.y;

    brier+=(p-y)**2;
    logLoss+=-(y*safeLog(p)+(1-y)*safeLog(1-p));
    correct+=(p>=0.5?1:0)===y?1:0;

    baselineBrier+=(baseline-y)**2;
    baselineLogLoss+=-(
      y*safeLog(baseline)+
      (1-y)*safeLog(1-baseline)
    );
  }

  const n=rows.length;

  return {
    rows:n,
    brier:brier/n,
    logLoss:logLoss/n,
    accuracyPct:correct/n*100,
    ece:ece(rows,predict),
    baselineBrier:baselineBrier/n,
    baselineLogLoss:baselineLogLoss/n,
    brierLift:baselineBrier/n-brier/n,
    logLossLift:baselineLogLoss/n-logLoss/n
  };
}

function publicMetrics(m){
  if(!m)return null;
  return {
    rows:m.rows,
    brier:round(m.brier,6),
    logLoss:round(m.logLoss,6),
    accuracyPct:round(m.accuracyPct,2),
    ece:round(m.ece,6),
    baselineBrier:round(m.baselineBrier,6),
    baselineLogLoss:round(m.baselineLogLoss,6),
    brierLift:round(m.brierLift,6),
    logLossLift:round(m.logLossLift,6)
  };
}

function candidateQuality(m){
  if(!m)return -Infinity;

  // Lower proper scores are better. ECE is a smaller tie-breaker.
  return (
    -m.brier -
    0.35*m.logLoss -
    0.15*m.ece
  );
}

export function createShadowModelArenaV23_5({
  learningDataset=null,
  minimumTrainRows=70,
  minimumPartitionRows=10,
  minimumClassRows=12,
  maxTrainingRows=2000
}={}){
  let arena=null;
  let signature=null;
  let retrains=0;
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

  function build(){
    const nextSignature=datasetSignature();

    if(nextSignature===signature){
      return;
    }

    signature=nextSignature;
    arena=null;

    let source=[];

    try{
      source=
        learningDataset?.trainingRows?.({
          limit:maxTrainingRows,
          horizonMs:TARGET_HORIZON_MS
        })||[];
    }catch{
      errors++;
      return;
    }

    const prepared=prepareRows(source);
    const parts=partitionChronologically(prepared);

    const trainCounts=classCounts(parts.train);
    const calibrationCounts=classCounts(parts.calibration);
    const selectionCounts=classCounts(parts.selection);
    const finalCounts=classCounts(parts.final);

    const enough=
      parts.train.length>=minimumTrainRows &&
      parts.calibration.length>=minimumPartitionRows &&
      parts.selection.length>=minimumPartitionRows &&
      parts.final.length>=minimumPartitionRows &&
      trainCounts.positive>=minimumClassRows &&
      trainCounts.negative>=minimumClassRows &&
      calibrationCounts.positive>=3 &&
      calibrationCounts.negative>=3 &&
      selectionCounts.positive>=3 &&
      selectionCounts.negative>=3 &&
      finalCounts.positive>=3 &&
      finalCounts.negative>=3;

    const meta={
      sourceRows:source.length,
      preparedRows:prepared.length,
      distinctTokens:uniqueTokens(prepared).length,
      trainRows:parts.train.length,
      calibrationRows:parts.calibration.length,
      selectionRows:parts.selection.length,
      finalRows:parts.final.length,
      trainCounts,
      calibrationCounts,
      selectionCounts,
      finalCounts
    };

    if(!enough){
      arena={
        ready:false,
        validated:false,
        meta,
        candidates:[],
        champion:null
      };
      return;
    }

    const trainFull=withVectors(
      parts.train,
      ARENA_FULL_FEATURES_V23_5
    );
    const calFull=withVectors(
      parts.calibration,
      ARENA_FULL_FEATURES_V23_5
    );
    const selFull=withVectors(
      parts.selection,
      ARENA_FULL_FEATURES_V23_5
    );
    const finalFull=withVectors(
      parts.final,
      ARENA_FULL_FEATURES_V23_5
    );

    const trainCore=withVectors(
      parts.train,
      ARENA_CORE_FEATURES_V23_5
    );
    const calCore=withVectors(
      parts.calibration,
      ARENA_CORE_FEATURES_V23_5
    );
    const selCore=withVectors(
      parts.selection,
      ARENA_CORE_FEATURES_V23_5
    );
    const finalCore=withVectors(
      parts.final,
      ARENA_CORE_FEATURES_V23_5
    );

    const candidates=[
      {
        name:'FULL_LOGISTIC',
        features:ARENA_FULL_FEATURES_V23_5,
        train:trainFull,
        calibration:calFull,
        selection:selFull,
        final:finalFull,
        model:fitLogistic(
          trainFull,
          ARENA_FULL_FEATURES_V23_5,
          {l2:0.03}
        )
      },
      {
        name:'CORE_LOGISTIC',
        features:ARENA_CORE_FEATURES_V23_5,
        train:trainCore,
        calibration:calCore,
        selection:selCore,
        final:finalCore,
        model:fitLogistic(
          trainCore,
          ARENA_CORE_FEATURES_V23_5,
          {l2:0.04}
        )
      },
      {
        name:'GAUSSIAN_NB',
        features:ARENA_CORE_FEATURES_V23_5,
        train:trainCore,
        calibration:calCore,
        selection:selCore,
        final:finalCore,
        model:fitGaussianNB(
          trainCore,
          ARENA_CORE_FEATURES_V23_5
        )
      }
    ];

    const trainPrior=clamp(
      trainCounts.positive/
      Math.max(1,trainCounts.total),
      0.05,
      0.95
    );

    for(const c of candidates){
      c.calibrator=fitPlatt(
        c.calibration,
        c.model,
        c.features
      );

      const calibrated=row=>
        c.calibrator.apply(
          c.model.predict(row.x).probability
        );

      c.selectionMetrics=metrics(
        c.selection,
        calibrated,
        trainPrior
      );
      c.finalMetrics=metrics(
        c.final,
        calibrated,
        trainPrior
      );
      c.selectionQuality=candidateQuality(
        c.selectionMetrics
      );
    }

    candidates.sort(
      (a,b)=>
        b.selectionQuality-
        a.selectionQuality
    );

    const champion=candidates[0];
    const fm=champion.finalMetrics;

    const validated=Boolean(
      fm &&
      fm.brier+0.002<fm.baselineBrier &&
      fm.logLoss+0.002<fm.baselineLogLoss
    );

    arena={
      ready:true,
      validated,
      meta,
      trainPrior,
      champion,
      candidates
    };

    retrains++;
  }

  function modelConfidencePct(coveragePct){
    if(!arena?.ready||!arena?.champion)return 0;

    const fm=arena.champion.finalMetrics;
    if(!fm)return 0;

    const sampleConfidence=Math.min(
      1,
      arena.meta.finalRows/40
    );

    const relativeBrierLift=
      fm.baselineBrier>0
        ? clamp(
            fm.brierLift/fm.baselineBrier,
            0,
            1
          )
        : 0;

    const calibrationConfidence=
      clamp(1-fm.ece/0.25,0,1);

    return clamp(
      100 *
      sampleConfidence *
      (0.35+0.65*relativeBrierLift) *
      calibrationConfidence *
      clamp(coveragePct/100,0,1),
      0,
      100
    );
  }

  function remember(row){
    recent.unshift(row);
    if(recent.length>200)recent.length=200;
  }

  function predict(snapshot={},meta={}){
    try{
      build();

      if(!arena?.ready||!arena?.champion){
        const cold={
          version:'MEMEFLOW_SHADOW_MODEL_ARENA_V23_5',
          shadowOnly:true,
          status:'COLD_START',
          modelReady:false,
          validated:false,
          champion:null,
          targetHorizonMs:TARGET_HORIZON_MS,
          calibratedProbabilityPositivePct:null,
          modelConfidencePct:0,
          featureCoveragePct:null,
          mint:meta?.mint||snapshot?.mint||null,
          observedAt:Date.now()
        };
        remember(cold);
        return cold;
      }

      const c=arena.champion;
      const x=snapshotVector(
        snapshot,
        c.features
      );
      const raw=c.model.predict(x);
      const calibrated=c.calibrator.apply(
        raw.probability
      );

      const coveragePct=raw.coveragePct;
      const validated=arena.validated;

      const result={
        version:'MEMEFLOW_SHADOW_MODEL_ARENA_V23_5',
        shadowOnly:true,
        status:
          coveragePct<50
            ? 'INSUFFICIENT_FEATURES'
            : validated
              ? 'ARENA_VALIDATED'
              : 'ARENA_UNVALIDATED',
        modelReady:true,
        validated,
        champion:c.name,
        targetHorizonMs:TARGET_HORIZON_MS,
        rawProbabilityPositivePct:
          round(raw.probability*100,2),
        calibratedProbabilityPositivePct:
          round(calibrated*100,2),
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
        version:'MEMEFLOW_SHADOW_MODEL_ARENA_V23_5',
        shadowOnly:true,
        status:'ERROR',
        modelReady:false,
        validated:false,
        champion:null,
        targetHorizonMs:TARGET_HORIZON_MS,
        calibratedProbabilityPositivePct:null,
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
    build();

    const candidates=
      arena?.candidates?.map(c=>({
        name:c.name,
        featureCount:c.features.length,
        platt:{
          a:round(c.calibrator?.a,5),
          b:round(c.calibrator?.b,5)
        },
        selection:publicMetrics(c.selectionMetrics),
        final:publicMetrics(c.finalMetrics),
        selected:
          arena?.champion?.name===c.name
      }))||[];

    return {
      version:'MEMEFLOW_SHADOW_MODEL_ARENA_V23_5',
      shadowOnly:true,
      target:'P(POSITIVE_5M)',
      targetHorizonMs:TARGET_HORIZON_MS,
      partition:
        'CHRONOLOGICAL_TRAIN_CALIBRATION_SELECTION_FINAL',
      calibration:'PLATT_SCALING',
      candidateModels:[
        'FULL_LOGISTIC',
        'CORE_LOGISTIC',
        'GAUSSIAN_NB'
      ],
      modelReady:arena?.ready===true,
      validated:arena?.validated===true,
      champion:arena?.champion?.name||null,
      datasetSignature:signature,
      training:arena?.meta||null,
      candidates,
      retrains,
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
EOF_ARENA

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowModelArenaV23_5
} from '../src/shadow-model-arena-v23_5.mjs';

function learningRow({i,positive,mint}){
  const sign=positive?1:-1;

  return {
    type:'learning-example',
    mint,
    anchorAt:1_800_600_000_000+i*1_000,
    horizonMs:300_000,
    classification:positive?'POSITIVE':'NEGATIVE',
    quality:{clean:true},
    features:{
      netFlow5s:sign*(0.45+(i%5)*0.01),
      netFlow15s:sign*(0.85+(i%7)*0.01),
      tradesPerSecond5s:positive?3.8:0.7,
      priceReturn15s:positive?22+(i%4):-(18+(i%4)),
      priceVolatility15s:positive?0.025:0.065,
      priceEfficiency15s:positive?0.78:-0.5,
      uniqueBuyers15s:positive?15:3,
      buyPressure15s:positive?4.5:0.6,
      holderDelta:positive?28+(i%3):-(9+(i%3)),
      top10Pct:positive?15:36,
      developerPct:positive?2:9,
      mcToLiquidity:positive?7:27,
      drawdownFromPeakPct:positive?3:32,
      bundlePct:positive?2:20,
      suspectedRiskyWalletsPct:positive?3:24,
      buyerConcentrationHhi:positive?0.10:0.43,
      sameSlotBuySharePct:positive?7:70,
      smartMoneyStrongWalletSharePct:positive?38:3,
      smartMoneyPositiveProbabilityPct:positive?74:32,
      smartMoneyHistoricalConfidencePct:positive?62:18
    }
  };
}

// 200 unique tokens give all four chronological partitions enough examples.
const rows=[];
for(let i=0;i<200;i++){
  rows.push(
    learningRow({
      i,
      positive:i%2===0,
      mint:`ARENA_MINT_${i}`
    })
  );
}

const dataset={
  status(){
    return {
      acceptedRows:rows.length,
      cleanRows:rows.length
    };
  },
  trainingRows({limit=2000,horizonMs=300_000}={}){
    assert.equal(horizonMs,300_000);
    return rows.slice(-limit);
  }
};

const arena=createShadowModelArenaV23_5({
  learningDataset:dataset,
  minimumTrainRows:70,
  minimumPartitionRows:10,
  minimumClassRows:12
});

function snapshot(positive){
  const f=learningRow({
    i:999,
    positive,
    mint:'CURRENT'
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
        strongWalletSharePct:
          f.smartMoneyStrongWalletSharePct,
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
      }
    }
  };
}

const status=arena.status();

assert.equal(status.shadowOnly,true);
assert.equal(status.modelReady,true);
assert.equal(status.validated,true);
assert.ok(status.champion);
assert.equal(status.candidates.length,3);
assert.ok(
  status.candidates.every(
    row=>row.platt&&Number.isFinite(row.platt.a)
  )
);
assert.ok(
  status.candidates.some(
    row=>row.selected===true
  )
);

const champion=status.candidates.find(
  row=>row.selected===true
);

assert.ok(
  champion.final.brier<
  champion.final.baselineBrier
);
assert.ok(
  champion.final.logLoss<
  champion.final.baselineLogLoss
);

const good=arena.predict(snapshot(true));
const bad=arena.predict(snapshot(false));

assert.equal(good.status,'ARENA_VALIDATED');
assert.equal(good.validated,true);
assert.ok(good.champion);
assert.ok(
  good.calibratedProbabilityPositivePct>70
);
assert.ok(
  bad.calibratedProbabilityPositivePct<30
);
assert.ok(
  good.calibratedProbabilityPositivePct>
  bad.calibratedProbabilityPositivePct
);
assert.ok(good.featureCoveragePct>=80);

assert.equal(arena.listRecent({limit:10}).length,2);

// Cold-start contract.
const cold=createShadowModelArenaV23_5({
  learningDataset:{
    status:()=>({acceptedRows:4,cleanRows:4}),
    trainingRows:()=>rows.slice(0,4)
  }
});

const coldPrediction=cold.predict(snapshot(true));
assert.equal(coldPrediction.status,'COLD_START');
assert.equal(coldPrediction.modelReady,false);
assert.equal(
  coldPrediction.calibratedProbabilityPositivePct,
  null
);

// Project wiring and strict SHADOW isolation.
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
  /createShadowModelArenaV23_5/
);
assert.match(
  shadow,
  /shadowModelArena\.predict/
);
assert.match(
  shadow,
  /shadowModelArena:shadowModelArena\.status\(\)/
);
assert.match(
  app,
  /\/api\/owner\/intelligence\/shadow-model-arena/
);
assert.match(
  app,
  /shadowModelArenaStatus/
);
assert.match(
  app,
  /listShadowModelArenaPredictions/
);

const source=fs.readFileSync(
  'src/shadow-model-arena-v23_5.mjs',
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
assert.doesNotMatch(source,/arenaScore/);
assert.doesNotMatch(source,/decisionScore/);

console.log('shadow model arena v23.5 ok');
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
            f"V23.5 REFUSED: {label}: expected 1 exact match, got {count}"
        )
    return text.replace(old,new,1)

shadow=once(
    shadow,
    """import {
  createShadowMathBrainV23_4
} from './shadow-math-brain-v23_4.mjs';""",
    """import {
  createShadowMathBrainV23_4
} from './shadow-math-brain-v23_4.mjs';
import {
  createShadowModelArenaV23_5
} from './shadow-model-arena-v23_5.mjs';""",
    "arena import"
)

shadow=once(
    shadow,
    """  const shadowMathBrain=
    createShadowMathBrainV23_4({
      learningDataset
    });

  const metrics={
""",
    """  const shadowMathBrain=
    createShadowMathBrainV23_4({
      learningDataset
    });

  const shadowModelArena=
    createShadowModelArenaV23_5({
      learningDataset
    });

  const metrics={
""",
    "arena construction"
)

shadow=once(
    shadow,
    """      snapshot.shadowMathBrain=
        shadowMathBrain.predict(
          snapshot,
          {mint}
        );

      if(cell.maybeAnchor(token,snapshot,journal)){
""",
    """      snapshot.shadowMathBrain=
        shadowMathBrain.predict(
          snapshot,
          {mint}
        );

      // MEMEFLOW_SHADOW_MODEL_ARENA_V23_5
      // Calibrated model-comparison probability is diagnostic only.
      snapshot.shadowModelArena=
        shadowModelArena.predict(
          snapshot,
          {mint}
        );

      if(cell.maybeAnchor(token,snapshot,journal)){
""",
    "arena prediction wiring"
)

shadow=once(
    shadow,
    """          shadowMathBrain:{
            status:
              snap?.shadowMathBrain?.status||'COLD_START',
""",
    """          shadowModelArena:{
            status:
              snap?.shadowModelArena?.status||'COLD_START',
            modelReady:
              snap?.shadowModelArena?.modelReady===true,
            validated:
              snap?.shadowModelArena?.validated===true,
            champion:
              snap?.shadowModelArena?.champion||null,
            calibratedProbabilityPositivePct:
              snap?.shadowModelArena
                ?.calibratedProbabilityPositivePct??null,
            modelConfidencePct:
              snap?.shadowModelArena
                ?.modelConfidencePct??0
          },
          shadowMathBrain:{
            status:
              snap?.shadowMathBrain?.status||'COLD_START',
""",
    "arena cell summary"
)

shadow=once(
    shadow,
    "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_4',",
    "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_5',",
    "network version"
)

shadow=once(
    shadow,
    """      learningDataset:learningDataset.status(),
      shadowMathBrain:shadowMathBrain.status()
    };
""",
    """      learningDataset:learningDataset.status(),
      shadowMathBrain:shadowMathBrain.status(),
      shadowModelArena:shadowModelArena.status()
    };
""",
    "arena status"
)

shadow=once(
    shadow,
    """    listShadowBrainPredictions:
      options=>shadowMathBrain.listRecent(options),
    status
  };
}
""",
    """    listShadowBrainPredictions:
      options=>shadowMathBrain.listRecent(options),
    shadowModelArenaStatus:
      ()=>shadowModelArena.status(),
    listShadowModelArenaPredictions:
      options=>shadowModelArena.listRecent(options),
    status
  };
}
""",
    "arena monitor API"
)

shadow_path.write_text(shadow,encoding="utf-8")

route_anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

routes=r"""/* MEMEFLOW_SHADOW_MODEL_ARENA_MONITOR_V23_5
 * Owner-only, read-only model comparison and calibration diagnostics.
 */
 if(
   url.pathname==='/api/owner/intelligence/shadow-model-arena' &&
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
     arena:
       tokenIntelligenceShadowV23
         .shadowModelArenaStatus(),
     predictions:
       tokenIntelligenceShadowV23
         .listShadowModelArenaPredictions({
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
    "arena monitor route"
)
app_path.write_text(app,encoding="utf-8")

needle="node tests/shadow-math-brain-v23_4.mjs && "
if pkg.count(needle)!=1:
    raise SystemExit(
        f"V23.5 REFUSED: package insertion anchor count={pkg.count(needle)}"
    )

pkg=pkg.replace(
    needle,
    "node tests/shadow-math-brain-v23_4.mjs && node tests/shadow-model-arena-v23_5.mjs && ",
    1
)
pkg_path.write_text(pkg,encoding="utf-8")

print("V23_5_TRANSFORM_OK")
PY

echo
echo "=== V23.5 PRECHECK ==="
grep -q "MEMEFLOW_SHADOW_MODEL_ARENA_V23_5" "$ARENA"
grep -q "shadow-model-arena-v23_5.mjs" "$SHADOW"
grep -q "shadowModelArena.predict" "$SHADOW"
grep -q "MEMEFLOW_SHADOW_MODEL_ARENA_MONITOR_V23_5" "$APP"
grep -q "shadow-model-arena-v23_5.mjs" "$PKG"
echo "PRECHECK_OK"

echo
echo "=== V23.5 SYNTAX ==="
node --check "$APP"
node --check "$SHADOW"
node --check "$ARENA"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo
echo "=== V23.5 TARGETED TESTS ==="
(
  cd memeflow-app
  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/wallet-reputation-shadow-v23_2.mjs
  node tests/learning-dataset-shadow-v23_3.mjs
  node tests/shadow-math-brain-v23_4.mjs
  node tests/shadow-model-arena-v23_5.mjs
  node tests/opportunity-engine.mjs
  node tests/canonical-live-score-pipeline-v20_8_8.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V23.5 FULL PROJECT TEST SUITE ==="
(
  cd memeflow-app
  npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.5 CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path

arena=Path(
    "memeflow-app/src/shadow-model-arena-v23_5.mjs"
).read_text()

shadow=Path(
    "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()

app=Path("memeflow-app/app-server.mjs").read_text()
pkg=Path("memeflow-app/package.json").read_text()

errors=[]

for marker in [
    "MEMEFLOW_SHADOW_MODEL_ARENA_V23_5",
    "FULL_LOGISTIC",
    "CORE_LOGISTIC",
    "GAUSSIAN_NB",
    "PLATT_SCALING",
    "partitionChronologically",
    "fitPlatt",
    "CHRONOLOGICAL_TRAIN_CALIBRATION_SELECTION_FINAL",
    "baselineBrier",
    "baselineLogLoss",
    "ARENA_VALIDATED",
    "ARENA_UNVALIDATED",
    "COLD_START"
]:
    if marker not in arena:
        errors.append(f"arena marker missing: {marker}")

for forbidden in [
    "from './evaluate.mjs'",
    'from "./evaluate.mjs"',
    "openPosition(",
    "closePosition(",
    "setSettings(",
    "tradeEligible",
    "arenaScore",
    "decisionScore"
]:
    if forbidden in arena:
        errors.append(
            f"arena trading authority forbidden: {forbidden}"
        )

for marker in [
    "createShadowModelArenaV23_5",
    "shadowModelArena.predict",
    "shadowModelArena:shadowModelArena.status()",
    "shadowModelArenaStatus",
    "listShadowModelArenaPredictions",
    "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_5"
]:
    if marker not in shadow:
        errors.append(f"shadow arena wiring missing: {marker}")

for marker in [
    "/api/owner/intelligence/shadow-model-arena",
    "MEMEFLOW_SHADOW_MODEL_ARENA_MONITOR_V23_5",
    "shadowModelArenaStatus",
    "listShadowModelArenaPredictions"
]:
    if marker not in app:
        errors.append(f"arena monitor missing: {marker}")

if "shadow-model-arena-v23_5.mjs" not in pkg:
    errors.append("V23.5 regression not in full suite")

# All prior layers must remain alive.
for marker in [
    "walletReputation.recordOutcome",
    "learningDataset.recordOutcome",
    "shadowMathBrain.predict"
]:
    if marker not in shadow:
        errors.append(f"backward compatibility missing: {marker}")

if errors:
    raise SystemExit(
        "V23_5_CONTRACT_FAILED:\n- " +
        "\n- ".join(errors)
    )

print("V23_5_CONTRACT_OK")
PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.5 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

mf_clear_stale_index_lock
git reset >/dev/null
mf_clear_stale_index_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/shadow-model-arena-v23_5\.mjs|tests/shadow-model-arena-v23_5\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"

if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.5 STAGED ==="
git diff --cached --stat

git commit -m "feat: add calibrated shadow model arena v23.5"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "V23.5 CONTRACT:"
echo "  evaluate()/V22 remains the only trading authority"
echo "  arena compares FULL_LOGISTIC / CORE_LOGISTIC / GAUSSIAN_NB"
echo "  chronological TRAIN/CALIBRATION/SELECTION/FINAL partitions are isolated"
echo "  Platt scaling calibrates candidate probabilities"
echo "  champion is selected before FINAL validation"
echo "  champion validates only if FINAL Brier AND log-loss beat base-rate"
echo "  arena probability remains SHADOW diagnostic only"
