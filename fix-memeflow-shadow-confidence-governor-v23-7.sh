#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside the MEMEFLOW Git repository"
  exit 1
}
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="4c91f09cc4e4c2cfd9abc40347e5e860c5930a7f"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
GOVERNOR="memeflow-app/src/shadow-confidence-governor-v23_7.mjs"
TEST="memeflow-app/tests/shadow-confidence-governor-v23_7.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$GOVERNOR" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW CONFIDENCE GOVERNOR V23.7 ==="

mf_git_process_in_repo(){
  local root_real
  root_real="$(readlink -f "$ROOT" 2>/dev/null || printf '%s' "$ROOT")"

  local proc pid comm cwd

  for proc in /proc/[0-9]*; do
    [[ -r "$proc/comm" ]] || continue

    pid="${proc##*/}"
    [[ "$pid" == "$$" ]] && continue

    comm="$(cat "$proc/comm" 2>/dev/null || true)"

    case "$comm" in
      git|git-*) ;;
      *) continue ;;
    esac

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
    echo "V23.7 REFUSED: .git/index.lock exists and active git is running:"
    echo "$active"
    return 1
  fi

  echo "V23.7: removing stale .git/index.lock"
  rm -f -- "$lock"

  [[ ! -e "$lock" ]] || {
    echo "V23.7 REFUSED: unable to remove stale .git/index.lock"
    return 1
  }
}

mf_clear_stale_index_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.7 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.7 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.7 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.7 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.7 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.7 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-confidence-governor-v23-7-$STAMP"
mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.7 FAILED - RESTORING ==="

    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
    done

    for f in "${NEW_FILES[@]}"; do
      rm -f "$f"
    done

    mf_clear_stale_index_lock >/dev/null 2>&1 || true
    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true

    if [[ "$(git rev-parse HEAD 2>/dev/null || true)" != "$EXPECTED_HEAD" ]]; then
      git reset --hard "$EXPECTED_HEAD" >/dev/null 2>&1 || true
    fi

    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi

  exit "$rc"
}

trap rollback EXIT INT TERM

cat > "$GOVERNOR" <<'EOF_GOVERNOR'
// MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7
//
// SHADOW ONLY.
// Combines existing diagnostics into one meta-confidence view.
// It NEVER owns MEMEFLOW Score/State/settings/trade execution.
//
// Important: Math Brain / Arena / Regime are correlated because they share
// MEMEFLOW evidence. V23.7 therefore applies a correlation haircut instead of
// pretending that every model vote is independent.

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

function makeSource({
  name,
  probability,
  confidence,
  validated,
  ready,
  family
}){
  const p=finite(probability);
  const c=finite(confidence);

  const usable=
    ready===true &&
    p!==null &&
    c!==null &&
    c>0;

  return {
    name,
    family,
    probabilityPositivePct:p,
    confidencePct:
      c===null
        ? 0
        : clamp(c,0,100),
    validated:validated===true,
    usable
  };
}

function smartMoneySource(snapshot={}){
  const sm=
    snapshot?.specialists
      ?.smartMoneyMemory||{};

  const ready=
    sm.reputationReady===true &&
    Number(sm.readyWallets||0)>0;

  return makeSource({
    name:'SMART_MONEY',
    family:'WALLET_MEMORY',
    probability:
      sm.weightedPositiveProbabilityPct,
    confidence:
      sm.historicalConfidencePct,
    validated:ready,
    ready
  });
}

function collectSources(snapshot={}){
  const brain=snapshot?.shadowMathBrain||{};
  const arena=snapshot?.shadowModelArena||{};
  const regime=snapshot?.shadowDriftRegime||{};

  return [
    makeSource({
      name:'MATH_BRAIN',
      family:'MODEL_FAMILY',
      probability:
        brain.probabilityPositivePct,
      confidence:
        brain.modelConfidencePct,
      validated:
        brain.validated===true,
      ready:
        brain.modelReady===true
    }),
    makeSource({
      name:'MODEL_ARENA',
      family:'MODEL_FAMILY',
      probability:
        arena.calibratedProbabilityPositivePct,
      confidence:
        arena.modelConfidencePct,
      validated:
        arena.validated===true,
      ready:
        arena.modelReady===true
    }),
    makeSource({
      name:'REGIME_MODEL',
      family:'MODEL_FAMILY',
      probability:
        regime.probabilityPositivePct,
      confidence:
        regime.modelConfidencePct,
      validated:
        regime.regimeModelValidated===true,
      ready:
        regime.regimeModelReady===true
    }),
    smartMoneySource(snapshot)
  ];
}

function weightedConsensus(rows=[]){
  let weightSum=0;
  let weightedProbability=0;

  for(const row of rows){
    const validatedMultiplier=
      row.validated===true
        ? 1
        : 0.55;

    const weight=
      clamp(
        row.confidencePct/100,
        0.05,
        1
      ) *
      validatedMultiplier;

    weightSum+=weight;
    weightedProbability+=
      row.probabilityPositivePct*
      weight;
  }

  if(weightSum<=0){
    return {
      probability:null,
      disagreement:null
    };
  }

  const probability=
    weightedProbability/weightSum;

  let weightedVariance=0;

  for(const row of rows){
    const validatedMultiplier=
      row.validated===true
        ? 1
        : 0.55;

    const weight=
      clamp(
        row.confidencePct/100,
        0.05,
        1
      ) *
      validatedMultiplier;

    weightedVariance+=
      weight*
      (
        row.probabilityPositivePct-
        probability
      )**2;
  }

  weightedVariance/=
    Math.max(weightSum,1e-9);

  return {
    probability,
    disagreement:
      clamp(
        Math.sqrt(weightedVariance),
        0,
        50
      )
  };
}

function correlationHaircut(rows=[]){
  const modelFamilyCount=
    rows.filter(
      row=>row.family==='MODEL_FAMILY'
    ).length;

  // Three related model outputs are NOT three independent observations.
  if(modelFamilyCount>=3)return 0.72;
  if(modelFamilyCount===2)return 0.84;
  return 1;
}

export function createShadowConfidenceGovernorV23_7(){
  let predictions=0;
  let errors=0;
  const recent=[];

  function remember(row){
    recent.unshift(row);
    if(recent.length>200){
      recent.length=200;
    }
  }

  function predict(snapshot={},meta={}){
    try{
      const sources=
        collectSources(snapshot);

      const usable=
        sources.filter(
          row=>row.usable===true
        );

      const validated=
        usable.filter(
          row=>row.validated===true
        );

      // Prefer validated sources once at least two exist.
      const contributing=
        validated.length>=2
          ? validated
          : usable;

      const driftStatus=
        String(
          snapshot?.shadowDriftRegime
            ?.driftStatus||
          'COLD_START'
        ).toUpperCase();

      if(contributing.length<2){
        const cold={
          version:'MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7',
          shadowOnly:true,
          status:'INSUFFICIENT_EVIDENCE',
          ready:false,
          consensusProbabilityPositivePct:null,
          ensembleConfidencePct:0,
          disagreementPct:null,
          agreementPct:null,
          driftStatus,
          sourceCount:usable.length,
          validatedSourceCount:
            validated.length,
          effectiveSourceCount:0,
          correlationHaircutPct:100,
          contributingSources:[],
          sources,
          mint:
            meta?.mint||
            snapshot?.mint||
            null,
          observedAt:Date.now()
        };

        remember(cold);
        return cold;
      }

      const consensus=
        weightedConsensus(contributing);

      const disagreement=
        consensus.disagreement??50;

      const agreement=
        clamp(
          100-disagreement*2,
          0,
          100
        );

      const meanConfidence=
        contributing.reduce(
          (sum,row)=>
            sum+row.confidencePct,
          0
        )/
        contributing.length;

      const familySet=
        new Set(
          contributing.map(
            row=>row.family
          )
        );

      const correlation=
        correlationHaircut(
          contributing
        );

      const breadth=
        clamp(
          familySet.size/2,
          0,
          1
        );

      const validationRatio=
        validated.length/
        Math.max(
          1,
          usable.length
        );

      const driftMultiplier=
        driftStatus==='DRIFT'
          ? 0.20
          : driftStatus==='WATCH'
            ? 0.60
            : driftStatus==='STABLE'
              ? 1
              : 0.75;

      const ensembleConfidence=
        clamp(
          meanConfidence *
          (0.55+0.45*breadth) *
          (0.60+0.40*validationRatio) *
          (0.35+0.65*agreement/100) *
          correlation *
          driftMultiplier,
          0,
          100
        );

      const effectiveSourceCount=
        round(
          contributing.length*
          correlation,
          2
        );

      const status=
        driftStatus==='DRIFT'
          ? 'DRIFT_SUPPRESSED'
          : disagreement>=20
            ? 'HIGH_DISAGREEMENT'
            : ensembleConfidence>=70 &&
              validated.length>=2
              ? 'HIGH_CONFIDENCE_CONSENSUS'
              : ensembleConfidence>=40
                ? 'MODERATE_CONFIDENCE'
                : 'LOW_CONFIDENCE';

      const result={
        version:'MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7',
        shadowOnly:true,
        status,
        ready:true,
        consensusProbabilityPositivePct:
          round(
            consensus.probability,
            2
          ),
        ensembleConfidencePct:
          round(
            ensembleConfidence,
            2
          ),
        disagreementPct:
          round(
            disagreement,
            2
          ),
        agreementPct:
          round(
            agreement,
            2
          ),
        driftStatus,
        sourceCount:
          usable.length,
        validatedSourceCount:
          validated.length,
        effectiveSourceCount,
        correlationHaircutPct:
          round(
            correlation*100,
            2
          ),
        contributingSources:
          contributing.map(
            row=>row.name
          ),
        sources,
        mint:
          meta?.mint||
          snapshot?.mint||
          null,
        observedAt:Date.now()
      };

      predictions++;
      remember(result);
      return result;
    }catch{
      errors++;

      const failed={
        version:'MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7',
        shadowOnly:true,
        status:'ERROR',
        ready:false,
        consensusProbabilityPositivePct:null,
        ensembleConfidencePct:0,
        disagreementPct:null,
        agreementPct:null,
        driftStatus:'ERROR',
        sourceCount:0,
        validatedSourceCount:0,
        effectiveSourceCount:0,
        correlationHaircutPct:null,
        contributingSources:[],
        sources:[],
        mint:
          meta?.mint||
          snapshot?.mint||
          null,
        observedAt:Date.now()
      };

      remember(failed);
      return failed;
    }
  }

  function listRecent({limit=50}={}){
    const safeLimit=
      Math.max(
        1,
        Math.min(
          200,
          Number(limit)||50
        )
      );

    return recent.slice(
      0,
      safeLimit
    );
  }

  function status(){
    return {
      version:'MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      inputs:[
        'MATH_BRAIN',
        'MODEL_ARENA',
        'REGIME_MODEL',
        'SMART_MONEY'
      ],
      correlationAware:true,
      predictions,
      recentPredictions:
        recent.length,
      errors
    };
  }

  return {
    predict,
    status,
    listRecent
  };
}

EOF_GOVERNOR

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowConfidenceGovernorV23_7
} from '../src/shadow-confidence-governor-v23_7.mjs';

const governor=
  createShadowConfidenceGovernorV23_7();

const base={
  mint:'V23_7_GOOD',
  specialists:{
    smartMoneyMemory:{
      reputationReady:true,
      readyWallets:4,
      weightedPositiveProbabilityPct:76,
      historicalConfidencePct:72
    }
  },
  shadowMathBrain:{
    modelReady:true,
    validated:true,
    probabilityPositivePct:78,
    modelConfidencePct:80
  },
  shadowModelArena:{
    modelReady:true,
    validated:true,
    calibratedProbabilityPositivePct:74,
    modelConfidencePct:82
  },
  shadowDriftRegime:{
    regimeModelReady:true,
    regimeModelValidated:true,
    probabilityPositivePct:80,
    modelConfidencePct:70,
    driftStatus:'STABLE'
  }
};

const good=
  governor.predict(
    base,
    {mint:'V23_7_GOOD'}
  );

assert.equal(good.shadowOnly,true);
assert.equal(good.ready,true);
assert.ok(
  good.consensusProbabilityPositivePct>70
);
assert.ok(
  good.ensembleConfidencePct>0
);
assert.equal(good.sourceCount,4);
assert.equal(
  good.validatedSourceCount,
  4
);
assert.ok(
  good.correlationHaircutPct<100
);
assert.ok(
  good.effectiveSourceCount<
  good.sourceCount
);

const conflict=
  structuredClone(base);

conflict.shadowMathBrain
  .probabilityPositivePct=95;

conflict.shadowModelArena
  .calibratedProbabilityPositivePct=5;

conflict.shadowDriftRegime
  .probabilityPositivePct=90;

conflict.specialists
  .smartMoneyMemory
  .weightedPositiveProbabilityPct=10;

const disagreement=
  governor.predict(conflict);

assert.equal(
  disagreement.status,
  'HIGH_DISAGREEMENT'
);
assert.ok(
  disagreement.disagreementPct>=20
);

const drift=
  structuredClone(base);

drift.shadowDriftRegime
  .driftStatus='DRIFT';

const drifted=
  governor.predict(drift);

assert.equal(
  drifted.status,
  'DRIFT_SUPPRESSED'
);
assert.ok(
  drifted.ensembleConfidencePct<
  good.ensembleConfidencePct
);

const cold=
  governor.predict({
    shadowMathBrain:{
      modelReady:false
    },
    shadowModelArena:{
      modelReady:false
    },
    shadowDriftRegime:{
      regimeModelReady:false
    }
  });

assert.equal(cold.ready,false);
assert.equal(
  cold.status,
  'INSUFFICIENT_EVIDENCE'
);
assert.equal(
  cold.consensusProbabilityPositivePct,
  null
);

const api=governor;
assert.equal(
  typeof api.execute,
  'undefined'
);
assert.equal(
  typeof api.buy,
  'undefined'
);
assert.equal(
  typeof api.sell,
  'undefined'
);

// Project wiring contract.
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
  /createShadowConfidenceGovernorV23_7/
);
assert.match(
  shadow,
  /shadowConfidenceGovernor\.predict/
);
assert.match(
  shadow,
  /shadowConfidenceGovernor:shadowConfidenceGovernor\.status\(\)/
);
assert.match(
  app,
  /\/api\/owner\/intelligence\/shadow-confidence-governor/
);
assert.match(
  app,
  /shadowConfidenceGovernorStatus/
);
assert.match(
  app,
  /listShadowConfidenceGovernorPredictions/
);

const source=fs.readFileSync(
  'src/shadow-confidence-governor-v23_7.mjs',
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
assert.doesNotMatch(
  source,
  /governorScore/
);

console.log(
  'shadow confidence governor v23.7 ok'
);

EOF_TEST

python3 - <<'PY'
from pathlib import Path

shadow_path=Path(
    "memeflow-app/src/token-intelligence-shadow-v23.mjs"
)
app_path=Path(
    "memeflow-app/app-server.mjs"
)

shadow=shadow_path.read_text(
    encoding="utf-8"
)
app=app_path.read_text(
    encoding="utf-8"
)

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(
            f"V23.7 REFUSED: {label}: expected 1 exact match, got {count}"
        )
    return text.replace(old,new,1)

# Import.
old="""import {
  createShadowDriftRegimeV23_6
} from './shadow-drift-regime-v23_6.mjs';"""
new=old+"""
import {
  createShadowConfidenceGovernorV23_7
} from './shadow-confidence-governor-v23_7.mjs';"""
shadow=once(
    shadow,
    old,
    new,
    "governor import"
)

# Construction.
old="""  const shadowDriftRegime=
    createShadowDriftRegimeV23_6({
      learningDataset
    });"""
new=old+"""

  const shadowConfidenceGovernor=
    createShadowConfidenceGovernorV23_7();"""
shadow=once(
    shadow,
    old,
    new,
    "governor construction"
)

# Prediction after all three model layers.
old="""      snapshot.shadowDriftRegime=
        shadowDriftRegime.predict(
          snapshot,
          {mint}
        );
"""
new=old+"""
      // MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7
      // Meta-confidence only. No evaluate()/V22/execution authority.
      snapshot.shadowConfidenceGovernor=
        shadowConfidenceGovernor.predict(
          snapshot,
          {mint}
        );
"""
shadow=once(
    shadow,
    old,
    new,
    "governor prediction wiring"
)

# Compact cell summary.
old="""          shadowDriftRegime:{
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
"""
new=old+"""          shadowConfidenceGovernor:{
            status:
              snap?.shadowConfidenceGovernor?.status||'COLD_START',
            ready:
              snap?.shadowConfidenceGovernor?.ready===true,
            consensusProbabilityPositivePct:
              snap?.shadowConfidenceGovernor
                ?.consensusProbabilityPositivePct??null,
            ensembleConfidencePct:
              snap?.shadowConfidenceGovernor
                ?.ensembleConfidencePct??0,
            disagreementPct:
              snap?.shadowConfidenceGovernor
                ?.disagreementPct??null,
            agreementPct:
              snap?.shadowConfidenceGovernor
                ?.agreementPct??null,
            sourceCount:
              snap?.shadowConfidenceGovernor
                ?.sourceCount??0,
            validatedSourceCount:
              snap?.shadowConfidenceGovernor
                ?.validatedSourceCount??0,
            effectiveSourceCount:
              snap?.shadowConfidenceGovernor
                ?.effectiveSourceCount??0
          },
"""
shadow=once(
    shadow,
    old,
    new,
    "governor cell summary"
)

# Network version.
shadow=once(
    shadow,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_6'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_7'",
    "network version"
)

# Status.
old="""      shadowMathBrain:shadowMathBrain.status(),
      shadowModelArena:shadowModelArena.status(),
      shadowDriftRegime:shadowDriftRegime.status()
"""
new="""      shadowMathBrain:shadowMathBrain.status(),
      shadowModelArena:shadowModelArena.status(),
      shadowDriftRegime:shadowDriftRegime.status(),
      shadowConfidenceGovernor:shadowConfidenceGovernor.status()
"""
shadow=once(
    shadow,
    old,
    new,
    "governor status"
)

# Public read-only methods.
old="""    shadowDriftRegimeStatus:
      ()=>shadowDriftRegime.status(),
    listShadowDriftRegimePredictions:
      options=>shadowDriftRegime.listRecent(options),
    status
"""
new="""    shadowDriftRegimeStatus:
      ()=>shadowDriftRegime.status(),
    listShadowDriftRegimePredictions:
      options=>shadowDriftRegime.listRecent(options),
    shadowConfidenceGovernorStatus:
      ()=>shadowConfidenceGovernor.status(),
    listShadowConfidenceGovernorPredictions:
      options=>shadowConfidenceGovernor.listRecent(options),
    status
"""
shadow=once(
    shadow,
    old,
    new,
    "governor monitor methods"
)

shadow_path.write_text(
    shadow,
    encoding="utf-8"
)

# Owner-only monitor route before the public-agent route anchor.
anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_MONITOR_V23_7
 * Owner-only and read-only. It cannot mutate trade state.
 */
 if(
   url.pathname==='/api/owner/intelligence/shadow-confidence-governor' &&
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

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     governor:
       tokenIntelligenceShadowV23
         .shadowConfidenceGovernorStatus(),
     predictions:
       tokenIntelligenceShadowV23
         .listShadowConfidenceGovernorPredictions({
           limit
         })
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

app=once(
    app,
    anchor,
    route,
    "governor owner route"
)

app_path.write_text(
    app,
    encoding="utf-8"
)

print("V23_7_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

path=Path("memeflow-app/package.json")
data=json.loads(
    path.read_text(encoding="utf-8")
)

script=data["scripts"]["test:core"]

needle="node tests/shadow-drift-regime-v23_6.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-drift-regime-v23_6.mjs && node tests/shadow-confidence-governor-v23_7.mjs && node tests/assist-fresh-decision-v22.mjs"

if script.count(needle)!=1:
    raise SystemExit(
        "V23.7 REFUSED: package test anchor changed"
    )

if "shadow-confidence-governor-v23_7.mjs" in script:
    raise SystemExit(
        "V23.7 REFUSED: governor test already installed"
    )

data["scripts"]["test:core"] = script.replace(
    needle,
    replacement,
    1
)

path.write_text(
    json.dumps(
        data,
        indent=2
    )+"\n",
    encoding="utf-8"
)

print("PACKAGE_TRANSFORM_OK")

PY

echo
echo "=== V23.7 PRECHECK ==="
grep -q "MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7" "$GOVERNOR"
grep -q "createShadowConfidenceGovernorV23_7" "$SHADOW"
grep -q "shadowConfidenceGovernor.predict" "$SHADOW"
grep -q "MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_MONITOR_V23_7" "$APP"
grep -q "shadow-confidence-governor-v23_7.mjs" "$PKG"
echo "PRECHECK_OK"

echo
echo "=== V23.7 SYNTAX ==="
node --check "$APP"
node --check "$SHADOW"
node --check "$GOVERNOR"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo
echo "=== V23.7 TARGETED TESTS ==="
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
  node tests/opportunity-engine.mjs
  node tests/canonical-live-score-pipeline-v20_8_8.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V23.7 FULL PROJECT TEST SUITE ==="
(
  cd memeflow-app
  npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.7 STATIC CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path

governor=Path(
    "memeflow-app/src/shadow-confidence-governor-v23_7.mjs"
).read_text(encoding="utf-8")

shadow=Path(
    "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text(encoding="utf-8")

app=Path(
    "memeflow-app/app-server.mjs"
).read_text(encoding="utf-8")

pkg=Path(
    "memeflow-app/package.json"
).read_text(encoding="utf-8")

errors=[]

for marker in [
    "MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7",
    "correlationHaircut",
    "HIGH_DISAGREEMENT",
    "DRIFT_SUPPRESSED",
    "HIGH_CONFIDENCE_CONSENSUS",
    "INSUFFICIENT_EVIDENCE",
    "effectiveSourceCount"
]:
    if marker not in governor:
        errors.append(
            f"governor marker missing: {marker}"
        )

for forbidden in [
    "from './evaluate.mjs'",
    'from "./evaluate.mjs"',
    "openPosition(",
    "closePosition(",
    "setSettings(",
    "tradeEligible",
    "decisionScore",
    "governorScore"
]:
    if forbidden in governor:
        errors.append(
            f"forbidden trading authority: {forbidden}"
        )

for marker in [
    "createShadowConfidenceGovernorV23_7",
    "shadowConfidenceGovernor.predict",
    "shadowConfidenceGovernor:shadowConfidenceGovernor.status()",
    "shadowConfidenceGovernorStatus",
    "listShadowConfidenceGovernorPredictions",
    "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_7"
]:
    if marker not in shadow:
        errors.append(
            f"shadow wiring missing: {marker}"
        )

pos=shadow.find(
    "snapshot.shadowConfidenceGovernor="
)

for marker in [
    "snapshot.shadowMathBrain=",
    "snapshot.shadowModelArena=",
    "snapshot.shadowDriftRegime="
]:
    marker_pos=shadow.find(marker)
    if marker_pos<0 or pos<0 or marker_pos>=pos:
        errors.append(
            f"governor ordering invalid: {marker}"
        )

for marker in [
    "/api/owner/intelligence/shadow-confidence-governor",
    "MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_MONITOR_V23_7",
    "shadowConfidenceGovernorStatus",
    "listShadowConfidenceGovernorPredictions"
]:
    if marker not in app:
        errors.append(
            f"owner monitor missing: {marker}"
        )

if "shadow-confidence-governor-v23_7.mjs" not in pkg:
    errors.append(
        "governor regression missing from package test:core"
    )

# Prior V23 layers must still exist.
for marker in [
    "walletReputation.recordOutcome",
    "learningDataset.recordOutcome",
    "shadowMathBrain.predict",
    "shadowModelArena.predict",
    "shadowDriftRegime.predict"
]:
    if marker not in shadow:
        errors.append(
            f"backward compatibility missing: {marker}"
        )

if errors:
    raise SystemExit(
        "V23_7_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_7_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.7 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

mf_clear_stale_index_lock
git reset >/dev/null
mf_clear_stale_index_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/shadow-confidence-governor-v23_7\.mjs|tests/shadow-confidence-governor-v23_7\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.7 STAGED ==="
git diff --cached --stat

git commit -m "feat: add correlation-aware shadow confidence governor v23.7"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline --decorate

echo
echo "V23.7 CONTRACT:"
echo "  evaluate()/V22 remains the only trading authority"
echo "  Math Brain / Arena / Regime / Smart Money feed one meta-confidence view"
echo "  correlated model outputs receive an explicit confidence haircut"
echo "  disagreement reduces confidence"
echo "  WATCH/DRIFT reduce or suppress trust"
echo "  fewer than two usable sources => no ensemble opinion"
echo "  no Score/State/BUY/SELL mutation"
