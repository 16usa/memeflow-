#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="c0d8bca5813263a3924be98a0cc985933ec7b6b0"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
LEARNING="memeflow-app/src/learning-dataset-shadow-v23_3.mjs"
PKG="memeflow-app/package.json"
TEST="memeflow-app/tests/learning-dataset-shadow-v23_3.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$LEARNING" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW LEARNING DATASET / OUTCOME QUALITY V23.3 ==="

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
    echo "V23.3 REFUSED: .git/index.lock exists and active git is running:"
    echo "$active"
    echo "Nothing changed."
    return 1
  fi
  echo "V23.3: removing stale .git/index.lock"
  rm -f -- "$lock"
  [[ ! -e "$lock" ]] || {
    echo "V23.3 REFUSED: unable to remove stale .git/index.lock"
    return 1
  }
}

mf_clear_stale_index_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.3 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.3 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "V23.3 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V23.3 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V23.3 REFUSED: staged changes in $f"; exit 1; }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || { echo "V23.3 REFUSED: $f already exists"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path

checks={
"memeflow-app/src/token-intelligence-shadow-v23.mjs":[
 "createWalletReputationMemoryV23_2",
 "MEMEFLOW_SMART_MONEY_MEMORY_V23_2",
 "      const labels=cell.maybeLabels(token,journal);",
 "        walletReputation.recordOutcome({",
 "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_2',",
 "      walletReputation:walletReputation.status()",
 "    flushWalletReputation:",
 "    status"
],
"memeflow-app/app-server.mjs":[
 "/api/owner/intelligence/wallet-reputations",
 "/api/owner/intelligence/wallet-reputation",
 "/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */"
],
"memeflow-app/package.json":[
 "node tests/wallet-reputation-shadow-v23_2.mjs",
 "\"test:core\":"
]
}

for file,markers in checks.items():
    text=Path(file).read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            raise SystemExit(
                f"V23.3 REFUSED: audited marker missing in {file}: {marker}"
            )

shadow=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs").read_text()
app=Path("memeflow-app/app-server.mjs").read_text()

for forbidden in [
    "MEMEFLOW_LEARNING_DATASET_V23_3",
    "learning-dataset-shadow-v23_3.mjs",
    "/api/owner/intelligence/learning-dataset"
]:
    if forbidden in shadow or forbidden in app:
        raise SystemExit(
            f"V23.3 REFUSED: feature already appears installed: {forbidden}"
        )

print("AUDITED_V23_3_INPUT_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/learning-dataset-v23-3-$STAMP"
mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.3 FAILED — RESTORING ==="
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

cat > "$LEARNING" <<'EOF_LEARNING'
import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_LEARNING_DATASET_V23_3
//
// SHADOW ONLY.
//
// Purpose:
// 1. Freeze feature values at the Token Cell anchor.
// 2. Join them later with future outcome labels.
// 3. Reject/flag low-quality or late labels.
// 4. Build bounded online feature statistics.
// 5. NEVER produce MEMEFLOW Score, State, position size, or a trade decision.
//
// This is training/validation infrastructure, not a trading model.

export const LEARNING_HORIZON_WEIGHTS_V23_3=Object.freeze({
  15000:0.15,
  30000:0.25,
  60000:0.40,
  180000:0.70,
  300000:1.00
});

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const round=(value,digits=3)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

const get=(obj,pathStr)=>{
  let cur=obj;
  for(const key of String(pathStr).split('.')){
    if(cur===null||cur===undefined)return null;
    cur=cur[key];
  }
  return finite(cur);
};

export const LEARNING_FEATURES_V23_3=Object.freeze({
  canonicalScore:'evidence.sourceSignals.canonicalScore',
  opportunityScore:'evidence.sourceSignals.opportunityScore',
  dataCompletenessPct:'evidence.dataQuality.completenessPct',

  tradesPerSecond1s:'evidence.flowAcceleration.tradesPerSecond1s',
  tradesPerSecond5s:'evidence.flowAcceleration.tradesPerSecond5s',
  tradesPerSecond15s:'evidence.flowAcceleration.tradesPerSecond15s',
  netFlow5s:'evidence.flowAcceleration.netFlow5s',
  netFlow15s:'evidence.flowAcceleration.netFlow15s',

  priceReturn5s:'windows.5000.price.returnPct',
  priceReturn15s:'windows.15000.price.returnPct',
  priceVolatility15s:'windows.15000.price.volatility',
  priceEfficiency15s:'windows.15000.price.efficiency',

  uniqueBuyers15s:'windows.15000.flow.uniqueBuyers',
  buyPressure15s:'windows.15000.flow.buyPressure',
  volumeSol15s:'windows.15000.flow.volumeSol',

  holderCount:'evidence.holders.holderCount',
  holderDelta:'evidence.holders.holderDelta',
  top10Pct:'evidence.holders.top10Pct',
  developerPct:'evidence.holders.developerPct',

  liquiditySol:'evidence.liquidity.liquiditySol',
  marketCapSol:'evidence.liquidity.marketCapSol',
  mcToLiquidity:'evidence.liquidity.mcToLiquidity',
  bondingCurvePct:'evidence.liquidity.bondingCurvePct',

  drawdownFromPeakPct:'evidence.risk.drawdownFromPeakPct',
  bundlePct:'evidence.risk.bundlePct',
  sniperPct:'evidence.risk.sniperPct',
  insidersPct:'evidence.risk.insidersPct',
  suspectedRiskyWalletsPct:'evidence.risk.suspectedRiskyWalletsPct',

  uniqueBuyerWallets:'specialists.wallet.uniqueBuyerWallets',
  repeatBuyerWalletRatioPct:'specialists.wallet.repeatBuyerWalletRatioPct',
  topBuyerSolSharePct:'specialists.wallet.topBuyerSolSharePct',
  buyerConcentrationHhi:'specialists.wallet.buyerConcentrationHhi',

  sameSlotBuySharePct:'specialists.coordination.sameSlotBuySharePct',
  maxDistinctBuyers250ms:'specialists.coordination.maxDistinctBuyers250ms',
  similarAmountBuySharePct:'specialists.coordination.similarAmountBuySharePct',

  smartMoneyStrongWalletSharePct:'specialists.smartMoneyMemory.strongWalletSharePct',
  smartMoneyPositiveProbabilityPct:'specialists.smartMoneyMemory.weightedPositiveProbabilityPct',
  smartMoneyHistoricalConfidencePct:'specialists.smartMoneyMemory.historicalConfidencePct'
});

function horizonWeight(horizonMs){
  return (
    LEARNING_HORIZON_WEIGHTS_V23_3[
      String(Number(horizonMs)||0)
    ] ?? 0.1
  );
}

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

function featureVector(anchor={}){
  const snapshot=anchor?.features||{};
  const features={};

  for(const [name,pathStr] of Object.entries(
    LEARNING_FEATURES_V23_3
  )){
    features[name]=get(snapshot,pathStr);
  }

  return features;
}

function qualityFor(anchor={},outcome={},features={}){
  const issues=[];

  const completeness=
    finite(features.dataCompletenessPct);

  if(completeness===null){
    issues.push('DATA_COMPLETENESS_UNKNOWN');
  }else if(completeness<50){
    issues.push('DATA_COMPLETENESS_LOW');
  }

  const horizon=Math.max(
    0,
    finite(outcome.horizonMs)??0
  );

  const lag=Math.max(
    0,
    finite(outcome.observationLagMs)??0
  );

  // A label observed wildly after its requested horizon can represent a
  // materially different market state. Keep it for audit, but do not allow
  // it into "clean" feature validation.
  const maxLag=Math.max(
    15_000,
    horizon*0.50
  );

  if(lag>maxLag){
    issues.push('LABEL_LATE');
  }

  if(
    finite(anchor.priceSol)===null ||
    !(Number(anchor.priceSol)>0)
  ){
    issues.push('ANCHOR_PRICE_INVALID');
  }

  if(
    finite(outcome.returnPct)===null ||
    finite(outcome.maxFavorableExcursionPct)===null ||
    finite(outcome.maxAdverseExcursionPct)===null
  ){
    issues.push('OUTCOME_INCOMPLETE');
  }

  const present=Object.values(features)
    .filter(value=>finite(value)!==null)
    .length;

  const featureCoveragePct=
    Object.keys(features).length
      ? present/Object.keys(features).length*100
      : 0;

  if(featureCoveragePct<35){
    issues.push('FEATURE_COVERAGE_LOW');
  }

  return {
    clean:issues.length===0,
    issues,
    featureCoveragePct:round(featureCoveragePct,2),
    dataCompletenessPct:completeness,
    observationLagMs:lag,
    maxAcceptedLagMs:maxLag
  };
}

function emptyGroup(){
  return {
    weight:0,
    sum:0,
    sumSq:0,
    tokens:new Set()
  };
}

function addGroup(group,value,weight,mint){
  if(!Number.isFinite(value)||!(weight>0))return;
  group.weight+=weight;
  group.sum+=value*weight;
  group.sumSq+=value*value*weight;
  if(mint)group.tokens.add(String(mint));
}

function groupView(group){
  if(!(group.weight>0)){
    return {
      effectiveObservations:0,
      distinctTokens:group.tokens.size,
      mean:null,
      stddev:null
    };
  }

  const mean=group.sum/group.weight;
  const variance=Math.max(
    0,
    group.sumSq/group.weight-mean*mean
  );

  return {
    effectiveObservations:round(group.weight,2),
    distinctTokens:group.tokens.size,
    mean:round(mean,4),
    stddev:round(Math.sqrt(variance),4)
  };
}

function emptyFeature(name){
  return {
    name,
    all:emptyGroup(),
    positive:emptyGroup(),
    negative:emptyGroup(),
    neutral:emptyGroup()
  };
}

function readTailUtf8(file,maxBytes=50*1024*1024){
  try{
    if(!file||!fs.existsSync(file))return '';

    const stat=fs.statSync(file);
    if(!(stat.size>0))return '';

    if(stat.size<=maxBytes){
      return fs.readFileSync(file,'utf8');
    }

    const start=stat.size-maxBytes;
    const fd=fs.openSync(file,'r');

    try{
      const buffer=Buffer.allocUnsafe(maxBytes);
      fs.readSync(fd,buffer,0,maxBytes,start);
      let text=buffer.toString('utf8');

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

export function createLearningDatasetShadowV23_3({
  dataDir=null,
  maxRows=100_000
}={}){
  const file=
    dataDir
      ? path.join(
          dataDir,
          'learning-dataset-v23-3.jsonl'
        )
      : null;

  const rows=[];
  const seenKeys=new Set();
  const featureStats=new Map();

  const horizonStats=new Map();
  const qualityIssues=new Map();

  const queue=[];
  let draining=false;
  let writeErrors=0;
  let loadErrors=0;
  let rowsWritten=0;
  let rowsLoaded=0;
  let acceptedRows=0;
  let cleanRows=0;

  if(file){
    try{
      fs.mkdirSync(
        path.dirname(file),
        {recursive:true}
      );
    }catch{}
  }

  function horizonBucket(horizonMs){
    const key=String(Number(horizonMs)||0);
    let row=horizonStats.get(key);

    if(!row){
      row={
        horizonMs:Number(horizonMs)||0,
        rows:0,
        cleanRows:0,
        positive:0,
        negative:0,
        neutral:0,
        tokens:new Set()
      };
      horizonStats.set(key,row);
    }

    return row;
  }

  function updateStats(row){
    const horizon=horizonBucket(row.horizonMs);
    horizon.rows++;
    if(row.quality?.clean)horizon.cleanRows++;
    if(row.mint)horizon.tokens.add(row.mint);

    if(row.classification==='POSITIVE')horizon.positive++;
    else if(row.classification==='NEGATIVE')horizon.negative++;
    else horizon.neutral++;

    for(const issue of row.quality?.issues||[]){
      qualityIssues.set(
        issue,
        (qualityIssues.get(issue)||0)+1
      );
    }

    if(!row.quality?.clean)return;

    const weight=Math.max(
      0,
      finite(row.weight)??0
    );

    for(const [name,value] of Object.entries(row.features||{})){
      const n=finite(value);
      if(n===null)continue;

      let stat=featureStats.get(name);
      if(!stat){
        stat=emptyFeature(name);
        featureStats.set(name,stat);
      }

      addGroup(stat.all,n,weight,row.mint);

      if(row.classification==='POSITIVE'){
        addGroup(stat.positive,n,weight,row.mint);
      }else if(row.classification==='NEGATIVE'){
        addGroup(stat.negative,n,weight,row.mint);
      }else{
        addGroup(stat.neutral,n,weight,row.mint);
      }
    }
  }

  function apply(row,{persist=false}={}){
    if(
      !row ||
      row.type!=='learning-example' ||
      !row.key
    ){
      return false;
    }

    const key=String(row.key);
    if(seenKeys.has(key))return false;
    seenKeys.add(key);

    if(seenKeys.size>250_000){
      const remove=seenKeys.size-200_000;
      let n=0;
      for(const old of seenKeys){
        seenKeys.delete(old);
        if(++n>=remove)break;
      }
    }

    rows.push(row);
    if(rows.length>maxRows){
      rows.splice(0,rows.length-maxRows);
    }

    acceptedRows++;
    if(row.quality?.clean)cleanRows++;
    updateStats(row);

    if(persist&&file){
      queue.push(row);
      if(queue.length>20_000){
        queue.splice(0,queue.length-20_000);
      }
      kick();
    }

    return true;
  }

  function load(){
    if(!file)return;

    const text=readTailUtf8(file);
    if(!text)return;

    for(const line of text.split('\n')){
      if(!line.trim())continue;

      try{
        const row=JSON.parse(line);
        if(apply(row,{persist:false})){
          rowsLoaded++;
        }
      }catch{
        loadErrors++;
      }
    }
  }

  function kick(){
    if(draining||!queue.length||!file)return;
    draining=true;

    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=queue.splice(0,250);
          const payload=
            batch.map(row=>JSON.stringify(row)).join('\n')+
            '\n';

          await fs.promises.appendFile(
            file,
            payload,
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

  async function flush(){
    if(!file)return true;
    kick();

    const started=Date.now();

    while(draining||queue.length){
      if(Date.now()-started>5_000)return false;
      await new Promise(
        resolve=>setTimeout(resolve,5)
      );
    }

    return true;
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

    const features=featureVector(anchor);
    const quality=qualityFor(anchor,outcome,features);
    const classification=classifyOutcome(outcome);
    const weight=horizonWeight(outcome.horizonMs);

    const row={
      type:'learning-example',
      version:'MEMEFLOW_LEARNING_EXAMPLE_V23_3',
      shadowOnly:true,
      key:[
        String(anchor.mint),
        String(anchor.at||0),
        String(outcome.horizonMs||0)
      ].join(':'),
      mint:String(anchor.mint),
      anchorAt:finite(anchor.at),
      observedAt:finite(outcome.observedAt),
      horizonMs:finite(outcome.horizonMs),
      weight,
      stageAtAnchor:anchor.stage||null,
      regimeAtAnchor:
        anchor?.features?.evidence?.regime||null,

      // Reference inputs are retained for validation only.
      canonicalScoreAtAnchor:
        finite(anchor.canonicalScore),
      opportunityScoreAtAnchor:
        finite(anchor.opportunityScore),

      outcome:{
        returnPct:finite(outcome.returnPct),
        maxFavorableExcursionPct:
          finite(outcome.maxFavorableExcursionPct),
        maxAdverseExcursionPct:
          finite(outcome.maxAdverseExcursionPct),
        dead:outcome.dead===true,
        deadReason:outcome.deadReason||null
      },

      classification,
      quality,
      features
    };

    return apply(row,{persist:true})
      ? row
      : null;
  }

  function featureReport({
    limit=100,
    minimumTokens=5
  }={}){
    const safeLimit=Math.max(
      1,
      Math.min(200,Number(limit)||100)
    );

    const minTokens=Math.max(
      1,
      Number(minimumTokens)||5
    );

    return [...featureStats.values()]
      .map(stat=>{
        const all=groupView(stat.all);
        const positive=groupView(stat.positive);
        const negative=groupView(stat.negative);
        const neutral=groupView(stat.neutral);

        const separation=
          positive.mean!==null&&negative.mean!==null
            ? positive.mean-negative.mean
            : null;

        // This is deliberately called "candidate signal", not importance.
        // No feature is trusted before both positive and negative groups have
        // enough independent token coverage.
        const validationReady=
          positive.distinctTokens>=minTokens &&
          negative.distinctTokens>=minTokens;

        return {
          shadowOnly:true,
          feature:stat.name,
          validationReady,
          all,
          positive,
          negative,
          neutral,
          positiveMinusNegativeMean:
            round(separation,4)
        };
      })
      .sort((a,b)=>{
        if(a.validationReady!==b.validationReady){
          return a.validationReady?-1:1;
        }

        return (
          Math.abs(
            Number(b.positiveMinusNegativeMean||0)
          )-
          Math.abs(
            Number(a.positiveMinusNegativeMean||0)
          )
        );
      })
      .slice(0,safeLimit);
  }

  function recent({
    limit=50,
    clean=null,
    horizonMs=null
  }={}){
    const safeLimit=Math.max(
      1,
      Math.min(200,Number(limit)||50)
    );

    const wantedClean=
      clean===true
        ? true
        : clean===false
          ? false
          : null;

    const wantedHorizon=
      finite(horizonMs);

    return [...rows]
      .reverse()
      .filter(
        row=>
          wantedClean===null ||
          row.quality?.clean===wantedClean
      )
      .filter(
        row=>
          wantedHorizon===null ||
          Number(row.horizonMs)===wantedHorizon
      )
      .slice(0,safeLimit);
  }

  function status(){
    const horizons=[...horizonStats.values()]
      .sort((a,b)=>a.horizonMs-b.horizonMs)
      .map(row=>({
        horizonMs:row.horizonMs,
        rows:row.rows,
        cleanRows:row.cleanRows,
        distinctTokens:row.tokens.size,
        positive:row.positive,
        negative:row.negative,
        neutral:row.neutral
      }));

    const issues=[...qualityIssues.entries()]
      .sort((a,b)=>b[1]-a[1])
      .map(([issue,count])=>({issue,count}));

    const cleanRatePct=
      acceptedRows>0
        ? cleanRows/acceptedRows*100
        : null;

    return {
      version:'MEMEFLOW_LEARNING_DATASET_V23_3',
      shadowOnly:true,
      file,
      rowsInMemory:rows.length,
      acceptedRows,
      cleanRows,
      cleanRatePct:round(cleanRatePct,2),
      trackedFeatures:Object.keys(
        LEARNING_FEATURES_V23_3
      ).length,
      featureStats:featureStats.size,
      horizons,
      qualityIssues:issues,
      rowsLoaded,
      rowsWritten,
      queued:queue.length,
      draining,
      writeErrors,
      loadErrors
    };
  }

  load();

  return {
    recordOutcome,
    featureReport,
    recent,
    status,
    flush
  };
}
EOF_LEARNING

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createLearningDatasetShadowV23_3,
  LEARNING_FEATURES_V23_3
} from '../src/learning-dataset-shadow-v23_3.mjs';

const dir=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-learning-v23-3-')
);

const learning=createLearningDatasetShadowV23_3({
  dataDir:dir,
  maxRows:1000
});

function snapshot({
  canonicalScore=80,
  opportunityScore=75,
  completeness=100,
  net5=0.3,
  net15=0.6,
  buyers=10,
  holderDelta=15,
  coord=5,
  smart=65
}={}){
  return {
    shadowOnly:true,
    windows:{
      '5000':{
        price:{
          returnPct:8,
          volatility:0.02,
          efficiency:0.7
        },
        flow:{
          uniqueBuyers:buyers,
          buyPressure:3,
          volumeSol:0.8
        }
      },
      '15000':{
        price:{
          returnPct:18,
          volatility:0.03,
          efficiency:0.75
        },
        flow:{
          uniqueBuyers:buyers,
          buyPressure:3.5,
          volumeSol:1.4
        }
      }
    },
    specialists:{
      wallet:{
        uniqueBuyerWallets:buyers,
        repeatBuyerWalletRatioPct:20,
        topBuyerSolSharePct:18,
        buyerConcentrationHhi:0.13
      },
      coordination:{
        sameSlotBuySharePct:coord,
        maxDistinctBuyers250ms:2,
        similarAmountBuySharePct:10
      },
      smartMoneyMemory:{
        strongWalletSharePct:25,
        weightedPositiveProbabilityPct:smart,
        historicalConfidencePct:55
      }
    },
    evidence:{
      flowAcceleration:{
        tradesPerSecond1s:4,
        tradesPerSecond5s:2,
        tradesPerSecond15s:1,
        netFlow5s:net5,
        netFlow15s:net15
      },
      regime:'EXPANSION',
      holders:{
        holderCount:150,
        holderDelta,
        top10Pct:18,
        developerPct:2
      },
      liquidity:{
        liquiditySol:10,
        marketCapSol:100,
        mcToLiquidity:10,
        bondingCurvePct:70
      },
      risk:{
        drawdownFromPeakPct:5,
        bundlePct:2,
        sniperPct:3,
        insidersPct:1,
        suspectedRiskyWalletsPct:4
      },
      sourceSignals:{
        canonicalScore,
        opportunityScore
      },
      dataQuality:{
        completenessPct:completeness
      }
    }
  };
}

function anchor(mint,opts={}){
  const features=snapshot(opts);
  return {
    mint,
    at:1_800_400_000_000,
    priceSol:0.001,
    stage:'DEEP',
    canonicalScore:
      features.evidence.sourceSignals.canonicalScore,
    opportunityScore:
      features.evidence.sourceSignals.opportunityScore,
    features
  };
}

function outcome({
  horizonMs=300_000,
  ret=40,
  mfe=70,
  mae=-8,
  lag=1000,
  dead=false
}={}){
  return {
    horizonMs,
    observedAt:1_800_400_300_000,
    observationLagMs:lag,
    returnPct:ret,
    maxFavorableExcursionPct:mfe,
    maxAdverseExcursionPct:mae,
    dead
  };
}

// Build enough independent positive + negative token coverage to make one
// feature report validation-ready.
for(let i=0;i<6;i++){
  const row=learning.recordOutcome({
    anchor:anchor(`POS${i}`,{
      net5:0.5+i*0.02,
      holderDelta:20+i,
      smart:70+i
    }),
    outcome:outcome({
      ret:30+i,
      mfe:60+i,
      mae:-5
    })
  });

  assert.ok(row);
  assert.equal(row.quality.clean,true);
  assert.equal(row.classification,'POSITIVE');
}

for(let i=0;i<6;i++){
  const row=learning.recordOutcome({
    anchor:anchor(`NEG${i}`,{
      net5:-0.4-i*0.02,
      holderDelta:-5-i,
      smart:35-i
    }),
    outcome:outcome({
      ret:-30-i,
      mfe:5,
      mae:-35
    })
  });

  assert.ok(row);
  assert.equal(row.quality.clean,true);
  assert.equal(row.classification,'NEGATIVE');
}

// Low-quality anchor is retained for audit but excluded from clean stats.
const dirty=learning.recordOutcome({
  anchor:anchor('DIRTY',{
    completeness:25
  }),
  outcome:outcome({
    ret:50,
    mfe:70,
    mae:-5
  })
});

assert.ok(dirty);
assert.equal(dirty.quality.clean,false);
assert.ok(
  dirty.quality.issues.includes('DATA_COMPLETENESS_LOW')
);

// Very late label is also auditable but not clean.
const late=learning.recordOutcome({
  anchor:anchor('LATE'),
  outcome:outcome({
    horizonMs:60_000,
    lag:80_000,
    ret:25,
    mfe:40,
    mae:-8
  })
});

assert.ok(late);
assert.equal(late.quality.clean,false);
assert.ok(
  late.quality.issues.includes('LABEL_LATE')
);

// Duplicate mint+anchor+horizon cannot double count.
assert.equal(
  learning.recordOutcome({
    anchor:anchor('POS0',{
      net5:0.5,
      holderDelta:20,
      smart:70
    }),
    outcome:outcome({
      ret:30,
      mfe:60,
      mae:-5
    })
  }),
  null
);

const report=learning.featureReport({
  limit:200,
  minimumTokens:5
});

const netFlow=report.find(
  row=>row.feature==='netFlow5s'
);

assert.ok(netFlow);
assert.equal(netFlow.validationReady,true);
assert.ok(netFlow.positive.mean>0);
assert.ok(netFlow.negative.mean<0);
assert.ok(netFlow.positiveMinusNegativeMean>0);

const status=learning.status();
assert.equal(status.shadowOnly,true);
assert.equal(
  status.trackedFeatures,
  Object.keys(LEARNING_FEATURES_V23_3).length
);
assert.equal(status.acceptedRows,14);
assert.equal(status.cleanRows,12);
assert.ok(status.cleanRatePct<100);
assert.ok(
  status.qualityIssues.some(
    row=>row.issue==='DATA_COMPLETENESS_LOW'
  )
);
assert.ok(
  status.qualityIssues.some(
    row=>row.issue==='LABEL_LATE'
  )
);

assert.equal(
  learning.recent({clean:true,limit:100}).length,
  12
);

assert.equal(await learning.flush(),true);

// Persistence can rebuild the dataset/statistics after restart.
const reloaded=createLearningDatasetShadowV23_3({
  dataDir:dir,
  maxRows:1000
});

assert.equal(
  reloaded.status().acceptedRows,
  status.acceptedRows
);

const reloadedNet=reloaded
  .featureReport({
    limit:200,
    minimumTokens:5
  })
  .find(row=>row.feature==='netFlow5s');

assert.ok(reloadedNet);
assert.equal(
  reloadedNet.positiveMinusNegativeMean,
  netFlow.positiveMinusNegativeMean
);

// Source wiring / strict shadow contract.
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
  /createLearningDatasetShadowV23_3/
);
assert.match(
  shadow,
  /learningDataset\.recordOutcome/
);
assert.match(
  shadow,
  /learningDataset:learningDataset\.status\(\)/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/learning-dataset/
);
assert.match(
  app,
  /\/api\/owner\/intelligence\/learning-features/
);
assert.match(
  app,
  /listLearningRows/
);
assert.match(
  app,
  /learningFeatureReport/
);

const source=fs.readFileSync(
  'src/learning-dataset-shadow-v23_3.mjs',
  'utf8'
);

assert.doesNotMatch(
  source,
  /from ['"]\.\/evaluate\.mjs['"]/
);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/tradeEligible/);
assert.doesNotMatch(source,/learningScore/);

console.log('learning dataset shadow v23.3 ok');
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
            f"V23.3 REFUSED: {label}: expected 1 exact match, got {count}"
        )
    return text.replace(old,new,1)

# ---------------------------------------------------------------
# Token Intelligence -> frozen-anchor learning dataset.
# ---------------------------------------------------------------
shadow=once(
    shadow,
    """import {
  createWalletReputationMemoryV23_2
} from './wallet-reputation-shadow-v23_2.mjs';""",
    """import {
  createWalletReputationMemoryV23_2
} from './wallet-reputation-shadow-v23_2.mjs';
import {
  createLearningDatasetShadowV23_3
} from './learning-dataset-shadow-v23_3.mjs';""",
    "learning dataset import"
)

shadow=once(
    shadow,
    """  const walletReputation=
    createWalletReputationMemoryV23_2({
      dataDir
    });

  const metrics={
""",
    """  const walletReputation=
    createWalletReputationMemoryV23_2({
      dataDir
    });

  const learningDataset=
    createLearningDatasetShadowV23_3({
      dataDir
    });

  const metrics={
""",
    "learning dataset construction"
)

shadow=once(
    shadow,
    """      for(const outcome of labels){
        walletReputation.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
      }

      metrics.labels+=labels.length;
""",
    """      for(const outcome of labels){
        walletReputation.recordOutcome({
          anchor:cell.anchor,
          outcome
        });

        // MEMEFLOW_LEARNING_DATASET_V23_3
        // Anchor features are frozen before the outcome exists. This avoids
        // future-data leakage into the learning dataset.
        learningDataset.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
      }

      metrics.labels+=labels.length;
""",
    "outcome learning wiring"
)

shadow=once(
    shadow,
    "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_2',",
    "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_3',",
    "network version"
)

shadow=once(
    shadow,
    """      journal:journal.status(),
      walletReputation:walletReputation.status()
    };
""",
    """      journal:journal.status(),
      walletReputation:walletReputation.status(),
      learningDataset:learningDataset.status()
    };
""",
    "learning status"
)

shadow=once(
    shadow,
    """    flushWalletReputation:
      ()=>walletReputation.flush(),
    status
  };
}
""",
    """    flushWalletReputation:
      ()=>walletReputation.flush(),
    listLearningRows:
      options=>learningDataset.recent(options),
    learningFeatureReport:
      options=>learningDataset.featureReport(options),
    flushLearningDataset:
      ()=>learningDataset.flush(),
    status
  };
}
""",
    "learning monitor API"
)

shadow_path.write_text(shadow,encoding="utf-8")

# ---------------------------------------------------------------
# Owner-only read-only learning monitor.
# ---------------------------------------------------------------
route_anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

routes=r"""/* MEMEFLOW_LEARNING_DATASET_MONITOR_V23_3
 * Owner-only, read-only learning diagnostics.
 * This endpoint cannot change Score/State/Settings or execute a trade.
 */
 if(
   url.pathname==='/api/owner/intelligence/learning-dataset' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(200,Number(url.searchParams.get('limit')||50))
   );

   const cleanRaw=String(
     url.searchParams.get('clean')||''
   ).trim().toLowerCase();

   const clean=
     cleanRaw==='true'||cleanRaw==='1'
       ? true
       : cleanRaw==='false'||cleanRaw==='0'
         ? false
         : null;

   const horizonRaw=url.searchParams.get('horizonMs');
   const horizonMs=
     horizonRaw===null||horizonRaw===''
       ? null
       : Number(horizonRaw);

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     learning:
       tokenIntelligenceShadowV23
         .status()
         .learningDataset,
     rows:
       tokenIntelligenceShadowV23
         .listLearningRows({
           limit,
           clean,
           horizonMs:
             Number.isFinite(horizonMs)
               ? horizonMs
               : null
         })
   });
 }

 if(
   url.pathname==='/api/owner/intelligence/learning-features' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(200,Number(url.searchParams.get('limit')||100))
   );

   const minimumTokens=Math.max(
     1,
     Math.min(
       1000,
       Number(url.searchParams.get('minimumTokens')||5)
     )
   );

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     learning:
       tokenIntelligenceShadowV23
         .status()
         .learningDataset,
     features:
       tokenIntelligenceShadowV23
         .learningFeatureReport({
           limit,
           minimumTokens
         })
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

app=once(
    app,
    route_anchor,
    routes,
    "learning monitor routes"
)
app_path.write_text(app,encoding="utf-8")

# Full suite includes V23.3.
needle="node tests/wallet-reputation-shadow-v23_2.mjs && "
if pkg.count(needle)!=1:
    raise SystemExit(
        f"V23.3 REFUSED: package insertion anchor count={pkg.count(needle)}"
    )

pkg=pkg.replace(
    needle,
    "node tests/wallet-reputation-shadow-v23_2.mjs && node tests/learning-dataset-shadow-v23_3.mjs && ",
    1
)

pkg_path.write_text(pkg,encoding="utf-8")

print("V23_3_TRANSFORM_OK")
PY

echo
echo "=== V23.3 PRECHECK ==="
grep -q "MEMEFLOW_LEARNING_DATASET_V23_3" "$LEARNING"
grep -q "learning-dataset-shadow-v23_3.mjs" "$SHADOW"
grep -q "learningDataset.recordOutcome" "$SHADOW"
grep -q "MEMEFLOW_LEARNING_DATASET_MONITOR_V23_3" "$APP"
grep -q "learning-dataset-shadow-v23_3.mjs" "$PKG"
echo "PRECHECK_OK"

echo
echo "=== V23.3 SYNTAX ==="
node --check "$APP"
node --check "$SHADOW"
node --check "$LEARNING"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo
echo "=== V23.3 TARGETED TESTS ==="
(
  cd memeflow-app
  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/wallet-reputation-shadow-v23_2.mjs
  node tests/learning-dataset-shadow-v23_3.mjs
  node tests/opportunity-engine.mjs
  node tests/canonical-live-score-pipeline-v20_8_8.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V23.3 FULL PROJECT TEST SUITE ==="
(
  cd memeflow-app
  npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.3 CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path

learning=Path(
    "memeflow-app/src/learning-dataset-shadow-v23_3.mjs"
).read_text()

shadow=Path(
    "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()

app=Path("memeflow-app/app-server.mjs").read_text()
pkg=Path("memeflow-app/package.json").read_text()

errors=[]

for marker in [
    "MEMEFLOW_LEARNING_DATASET_V23_3",
    "LEARNING_FEATURES_V23_3",
    "LEARNING_HORIZON_WEIGHTS_V23_3",
    "qualityFor",
    "FEATURE_COVERAGE_LOW",
    "LABEL_LATE",
    "DATA_COMPLETENESS_LOW",
    "featureReport",
    "validationReady",
    "positiveMinusNegativeMean",
    "learning-dataset-v23-3.jsonl"
]:
    if marker not in learning:
        errors.append(f"learning marker missing: {marker}")

for forbidden in [
    "from './evaluate.mjs'",
    'from "./evaluate.mjs"',
    "openPosition(",
    "closePosition(",
    "setSettings(",
    "tradeEligible",
    "learningScore"
]:
    if forbidden in learning:
        errors.append(
            f"learning trade authority forbidden: {forbidden}"
        )

for marker in [
    "createLearningDatasetShadowV23_3",
    "learningDataset.recordOutcome",
    "learningDataset:learningDataset.status()",
    "listLearningRows",
    "learningFeatureReport",
    "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_3"
]:
    if marker not in shadow:
        errors.append(f"shadow learning wiring missing: {marker}")

for marker in [
    "/api/owner/intelligence/learning-dataset",
    "/api/owner/intelligence/learning-features",
    "MEMEFLOW_LEARNING_DATASET_MONITOR_V23_3",
    "listLearningRows",
    "learningFeatureReport"
]:
    if marker not in app:
        errors.append(f"owner learning monitor missing: {marker}")

if "learning-dataset-shadow-v23_3.mjs" not in pkg:
    errors.append("V23.3 regression not in full suite")

# Backward compatibility from V23.1 / V23.2 must remain.
for marker in [
    "smartMoneySeed:{",
    "reputationReady:false",
    "walletReputation.recordOutcome"
]:
    if marker not in shadow:
        errors.append(f"backward compatibility missing: {marker}")

if errors:
    raise SystemExit(
        "V23_3_CONTRACT_FAILED:\n- " +
        "\n- ".join(errors)
    )

print("V23_3_CONTRACT_OK")
PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.3 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

mf_clear_stale_index_lock
git reset >/dev/null
mf_clear_stale_index_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/learning-dataset-shadow-v23_3\.mjs|tests/learning-dataset-shadow-v23_3\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"

if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.3 STAGED ==="
git diff --cached --stat

git commit -m "feat: add shadow learning dataset and outcome quality v23.3"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "V23.3 CONTRACT:"
echo "  evaluate()/V22 trading authority remains unchanged"
echo "  anchor features are frozen before future outcomes to avoid leakage"
echo "  every learning example carries outcome quality diagnostics"
echo "  late/incomplete labels remain auditable but are excluded from clean stats"
echo "  feature reports require independent positive/negative token coverage"
echo "  feature separation is diagnostics only, never a second Score"
echo "  learning dataset persists through learning-dataset-v23-3.jsonl"
