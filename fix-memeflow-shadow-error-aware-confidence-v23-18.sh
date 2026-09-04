#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="053f5cb02a9c020aef7a32b5f7fc9e2bc5053a88"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
MODULE="memeflow-app/src/shadow-error-aware-confidence-v23_18.mjs"
TEST="memeflow-app/tests/shadow-error-aware-confidence-v23_18.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$MODULE" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW ERROR-AWARE CONFIDENCE V23.18 ==="

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
      echo "V23.18 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.18 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.18 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.18 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.18 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.18 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.18 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-error-aware-confidence-v23-18-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.18 FAILED - RESTORING ==="

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
// MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18
//
// SHADOW ONLY.
//
// Applies a diagnostic confidence haircut when the CURRENT token evidence
// matches MATURE historical V23.17 miss associations.
//
// Important:
// - probability is NEVER changed
// - canonical MEMEFLOW Score is NEVER changed
// - V22 State / BUY / SELL are NEVER changed
// - no automatic model correction or promotion
// - mature error patterns are associations, NOT causal proof
//
// The penalty is correlation-aware: pair patterns are preferred and
// redundant single-tag patterns covered by a selected pair are skipped.

const TARGET_HORIZON_MS=300_000;
const MAX_PENALTY_PCT=40;
const MAX_SELECTED_PATTERNS=3;

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

function safeTag(value){
  return upper(value)
    .replace(/[^A-Z0-9_:-]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,96);
}

function confidenceBand(value){
  const n=finite(value);
  if(n===null)return 'UNKNOWN';
  if(n>=75)return 'HIGH';
  if(n>=50)return 'MEDIUM';
  if(n>=25)return 'LOW';
  return 'VERY_LOW';
}

function forecast(snapshot={}){
  const calibration=
    snapshot?.shadowOutcomeCalibration||{};
  const synthesis=
    snapshot?.shadowEvidenceSynthesis||{};
  const governor=
    snapshot?.shadowConfidenceGovernor||{};
  const arena=
    snapshot?.shadowModelArena||{};
  const brain=
    snapshot?.shadowMathBrain||{};

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

function currentTags(
  snapshot={},
  {
    stage=null,
    currentForecast=null
  }={}
){
  const tags=[];
  const f=currentForecast||forecast(snapshot);
  const synthesis=snapshot?.shadowEvidenceSynthesis||{};
  const governor=snapshot?.shadowConfidenceGovernor||{};
  const trajectory=snapshot?.shadowTokenTrajectory||{};
  const pattern=snapshot?.shadowTokenPattern||{};
  const calibration=snapshot?.shadowOutcomeCalibration||{};
  const drift=snapshot?.shadowDriftRegime||{};
  const specialists=snapshot?.specialists||{};
  const evidence=snapshot?.evidence||{};

  const blockers=
    Array.isArray(synthesis?.blockers)
      ? synthesis.blockers
      : [];

  for(const blocker of blockers.slice(0,6)){
    const tag=safeTag(blocker);

    if(tag){
      tags.push(
        `SYNTHESIS_BLOCKER_${tag}`
      );
    }
  }

  const disagreement=
    finite(synthesis?.crossSourceDisagreementPct) ??
    finite(governor?.disagreementPct);

  if(
    disagreement!==null &&
    disagreement>=45
  ){
    tags.push('HIGH_MODEL_DISAGREEMENT');
  }

  const trajectoryState=
    safeTag(trajectory?.trajectoryState);

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
    safeTag(
      drift?.driftStatus||
      drift?.status
    );

  if(['DRIFT','ERROR'].includes(driftStatus)){
    tags.push(
      `MODEL_${driftStatus}`
    );
  }

  const completeness=
    finite(
      evidence?.dataQuality?.completenessPct
    );

  if(
    completeness!==null &&
    completeness<75
  ){
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
      specialists?.wallet
        ?.topBuyerSolSharePct
    );

  if(
    topBuyer!==null &&
    topBuyer>=35
  ){
    tags.push('HIGH_BUYER_CONCENTRATION');
  }

  const smartP=
    finite(
      specialists?.smartMoneyMemory
        ?.weightedPositiveProbabilityPct
    );

  const forecastP=
    finite(f?.probabilityPct);

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

  const regime=
    safeTag(evidence?.regime);

  if(
    regime &&
    regime!=='UNKNOWN'
  ){
    tags.push(`REGIME_${regime}`);
  }

  const stageTag=
    safeTag(stage);

  if(
    stageTag &&
    stageTag!=='UNKNOWN'
  ){
    tags.push(`STAGE_${stageTag}`);
  }

  const source=
    safeTag(f?.source);

  if(
    source &&
    source!=='NONE' &&
    source!=='UNKNOWN'
  ){
    tags.push(`SOURCE_${source}`);
  }

  const predicted=
    predictedClass(f?.probabilityPct);

  if(predicted!=='UNKNOWN'){
    tags.push(`PREDICTED_${predicted}`);
  }

  const band=
    confidenceBand(f?.confidencePct);

  if(band!=='UNKNOWN'){
    tags.push(`CONFIDENCE_${band}`);
  }

  return [...new Set(tags)]
    .sort()
    .slice(0,24);
}

function patternMatches(pattern={},tagSet=new Set()){
  const tags=
    Array.isArray(pattern?.tags)
      ? pattern.tags
          .map(safeTag)
          .filter(Boolean)
      : [];

  if(!tags.length)return false;

  return tags.every(
    tag=>tagSet.has(tag)
  );
}

function rawPatternPenalty(pattern={}){
  const posterior=
    finite(pattern?.posteriorMissRatePct);

  const baseline=
    finite(pattern?.baselineMissRatePct);

  const lift=
    finite(pattern?.missLift);

  const support=
    Math.max(
      0,
      Number(pattern?.support)||0
    );

  if(
    posterior===null ||
    baseline===null ||
    lift===null ||
    support<=0
  ){
    return 0;
  }

  const riskEdge=
    Math.max(
      0,
      posterior-baseline
    );

  const liftEdge=
    Math.max(
      0,
      lift-1
    );

  const supportReliability=
    clamp(
      Math.sqrt(
        support/50
      ),
      0.35,
      1
    );

  const severityBase=
    upper(pattern?.severity)==='HIGH'
      ? 8
      : 4;

  return clamp(
    (
      severityBase+
      riskEdge*0.20+
      liftEdge*8
    )*
    supportReliability,
    2,
    25
  );
}

function selectNonRedundant(matches=[]){
  const sorted=
    [...matches]
      .sort(
        (a,b)=>
          Number(
            (b?.tags||[]).length
          )-
          Number(
            (a?.tags||[]).length
          ) ||
          Number(b?.penaltyPct||0)-
          Number(a?.penaltyPct||0) ||
          Number(b?.support||0)-
          Number(a?.support||0)
      );

  const selected=[];
  const covered=new Set();

  for(const row of sorted){
    const tags=
      Array.isArray(row?.tags)
        ? row.tags.map(safeTag)
        : [];

    if(!tags.length)continue;

    const fullyCovered=
      tags.every(
        tag=>covered.has(tag)
      );

    if(fullyCovered){
      continue;
    }

    selected.push(row);

    for(const tag of tags){
      covered.add(tag);
    }

    if(
      selected.length>=
      MAX_SELECTED_PATTERNS
    ){
      break;
    }
  }

  return selected;
}

function combinePenalty(rows=[]){
  let survival=1;

  for(const row of rows){
    const p=
      clamp(
        Number(row?.penaltyPct)||0,
        0,
        100
      )/100;

    survival*=(1-p);
  }

  return clamp(
    (1-survival)*100,
    0,
    MAX_PENALTY_PCT
  );
}

export function createShadowErrorAwareConfidenceV23_18({
  errorPatternLearner=null,
  recentLimit=200
}={}){
  const recent=[];
  let predictions=0;
  let penaltiesApplied=0;
  let totalPenaltyPct=0;
  let maxPenaltySeenPct=0;
  let errors=0;

  function predict(
    snapshot={},
    {
      mint='',
      at=Date.now(),
      stage=null
    }={}
  ){
    try{
      const f=forecast(snapshot);

      if(
        finite(f?.probabilityPct)===null ||
        finite(f?.confidencePct)===null
      ){
        const row={
          version:'MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18',
          shadowOnly:true,
          authority:'DIAGNOSTIC_ONLY',
          probabilityMutation:false,
          confidenceOnly:true,
          mint:String(mint||''),
          at:Number(at)||Date.now(),
          status:'NO_FORECAST',
          probabilityPositivePct:null,
          rawConfidencePct:
            round(f?.confidencePct,2),
          adjustedConfidencePct:
            round(f?.confidencePct,2),
          penaltyPct:0,
          forecastSource:
            f?.source||'NONE',
          currentTags:[],
          matchedPatterns:[],
          selectedPatterns:[],
          causalClaims:false,
          tradingMutation:false
        };

        predictions++;
        recent.unshift(row);
        recent.splice(recentLimit);

        return row;
      }

      const report=
        errorPatternLearner
          ?.patternReport?.({
            horizonMs:
              TARGET_HORIZON_MS,
            limit:100,
            includeImmature:false
          })||{};

      const mature=
        Array.isArray(report?.patterns)
          ? report.patterns.filter(
              row=>row?.mature===true
            )
          : [];

      const tags=
        currentTags(
          snapshot,
          {
            stage,
            currentForecast:f
          }
        );

      const tagSet=
        new Set(tags);

      const matched=
        mature
          .filter(
            pattern=>
              patternMatches(
                pattern,
                tagSet
              )
          )
          .map(pattern=>({
            patternId:
              String(
                pattern?.patternId||''
              ),
            tags:
              Array.isArray(pattern?.tags)
                ? pattern.tags
                : [],
            severity:
              upper(pattern?.severity),
            support:
              Number(pattern?.support||0),
            misses:
              Number(pattern?.misses||0),
            posteriorMissRatePct:
              round(
                pattern?.posteriorMissRatePct,
                2
              ),
            baselineMissRatePct:
              round(
                pattern?.baselineMissRatePct,
                2
              ),
            lowerBoundMissRatePct:
              round(
                pattern?.lowerBoundMissRatePct,
                2
              ),
            missLift:
              round(
                pattern?.missLift,
                3
              ),
            penaltyPct:
              round(
                rawPatternPenalty(pattern),
                2
              )
          }));

      const selected=
        selectNonRedundant(
          matched
        );

      const penaltyPct=
        round(
          combinePenalty(selected),
          2
        )??0;

      const rawConfidencePct=
        clamp(
          Number(f.confidencePct)||0,
          0,
          100
        );

      const adjustedConfidencePct=
        round(
          rawConfidencePct*
          (
            1-
            penaltyPct/100
          ),
          2
        );

      let status='NO_MATURE_PATTERNS';

      if(mature.length){
        status=
          selected.length
            ? 'PENALTY_APPLIED'
            : 'NO_PATTERN_MATCH';
      }

      const row={
        version:'MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        probabilityMutation:false,
        confidenceOnly:true,
        mint:String(mint||''),
        at:Number(at)||Date.now(),
        status,
        probabilityPositivePct:
          round(
            f.probabilityPct,
            2
          ),
        rawConfidencePct:
          round(
            rawConfidencePct,
            2
          ),
        adjustedConfidencePct,
        penaltyPct,
        forecastSource:
          f.source,
        currentTags:
          tags,
        maturePatternCount:
          mature.length,
        matchedPatterns:
          matched,
        selectedPatterns:
          selected,
        causalClaims:false,
        tradingMutation:false
      };

      predictions++;

      if(penaltyPct>0){
        penaltiesApplied++;
        totalPenaltyPct+=penaltyPct;
        maxPenaltySeenPct=
          Math.max(
            maxPenaltySeenPct,
            penaltyPct
          );
      }

      recent.unshift(row);
      recent.splice(recentLimit);

      return row;
    }catch{
      errors++;

      return {
        version:'MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        probabilityMutation:false,
        confidenceOnly:true,
        mint:String(mint||''),
        at:Number(at)||Date.now(),
        status:'ERROR',
        probabilityPositivePct:null,
        rawConfidencePct:0,
        adjustedConfidencePct:0,
        penaltyPct:0,
        forecastSource:'NONE',
        currentTags:[],
        matchedPatterns:[],
        selectedPatterns:[],
        causalClaims:false,
        tradingMutation:false
      };
    }
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
    return {
      version:'MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      probabilityMutation:false,
      confidenceOnly:true,
      autoCorrection:false,
      tradingMutation:false,
      targetHorizonMs:
        TARGET_HORIZON_MS,
      predictions,
      penaltiesApplied,
      penaltyRatePct:
        predictions
          ? round(
              penaltiesApplied/
              predictions*
              100,
              2
            )
          : null,
      meanAppliedPenaltyPct:
        penaltiesApplied
          ? round(
              totalPenaltyPct/
              penaltiesApplied,
              2
            )
          : null,
      maxPenaltySeenPct:
        round(
          maxPenaltySeenPct,
          2
        ),
      recent:
        recent.length,
      errors,
      policy:{
        maxPenaltyPct:
          MAX_PENALTY_PCT,
        maxSelectedPatterns:
          MAX_SELECTED_PATTERNS,
        correlationAwareSelection:true,
        maturePatternsOnly:true,
        causalClaims:false,
        probabilityMutation:false,
        confidenceOnly:true,
        autoCorrection:false
      }
    };
  }

  return {
    predict,
    listRecent,
    status
  };
}

EOF_MODULE

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowErrorAwareConfidenceV23_18
} from '../src/shadow-error-aware-confidence-v23_18.mjs';

function snapshot({
  probability=80,
  confidence=80,
  disagreement=52,
  trajectory='FADING',
  regime='EXPANSION',
  stage='DEEP'
}={}){
  return {
    __stage:stage,
    evidence:{
      regime,
      dataQuality:{
        completenessPct:100
      }
    },
    specialists:{
      wallet:{
        topBuyerSolSharePct:20
      },
      coordination:{
        suspectedCoordination:false
      },
      smartMoneyMemory:{
        weightedPositiveProbabilityPct:72
      }
    },
    shadowConfidenceGovernor:{
      ready:true,
      disagreementPct:disagreement,
      consensusProbabilityPositivePct:probability,
      ensembleConfidencePct:confidence
    },
    shadowTokenTrajectory:{
      trajectoryState:trajectory,
      turningPoint:false
    },
    shadowTokenPattern:{
      ready:true,
      patternProbabilityPositivePct:75
    },
    shadowDriftRegime:{
      status:'REGIME_READY',
      driftStatus:'STABLE'
    },
    shadowEvidenceSynthesis:{
      ready:true,
      status:'SYNTHESIS_STRONG',
      direction:'BULLISH',
      synthesisProbabilityPositivePct:probability,
      synthesisConfidencePct:confidence,
      crossSourceDisagreementPct:disagreement,
      blockers:[]
    },
    shadowOutcomeCalibration:{
      ready:true,
      status:'CALIBRATION_HEALTHY',
      calibratedProbabilityPositivePct:probability,
      calibratedConfidencePct:confidence
    }
  };
}

const maturePair={
  patternId:
    'HIGH_MODEL_DISAGREEMENT + TRAJECTORY_FADING',
  tags:[
    'HIGH_MODEL_DISAGREEMENT',
    'TRAJECTORY_FADING'
  ],
  support:31,
  misses:24,
  posteriorMissRatePct:71,
  baselineMissRatePct:34,
  lowerBoundMissRatePct:58,
  missLift:1.82,
  mature:true,
  severity:'HIGH'
};

const redundantSingle={
  patternId:'TRAJECTORY_FADING',
  tags:[
    'TRAJECTORY_FADING'
  ],
  support:40,
  misses:25,
  posteriorMissRatePct:63,
  baselineMissRatePct:34,
  lowerBoundMissRatePct:52,
  missLift:1.55,
  mature:true,
  severity:'MEDIUM'
};

const learner={
  patternReport(){
    return {
      patterns:[
        maturePair,
        redundantSingle
      ]
    };
  }
};

const brain=
  createShadowErrorAwareConfidenceV23_18({
    errorPatternLearner:learner
  });

const snap=snapshot();

const row=
  brain.predict(
    snap,
    {
      mint:'MINT_A',
      at:1_801_600_000_000,
      stage:'DEEP'
    }
  );

assert.equal(
  row.status,
  'PENALTY_APPLIED'
);

assert.equal(
  row.probabilityPositivePct,
  80
);

assert.equal(
  row.rawConfidencePct,
  80
);

assert.ok(
  row.adjustedConfidencePct<
  row.rawConfidencePct
);

assert.ok(
  row.penaltyPct>0
);

assert.ok(
  row.penaltyPct<=40
);

assert.ok(
  row.currentTags.includes(
    'HIGH_MODEL_DISAGREEMENT'
  )
);

assert.ok(
  row.currentTags.includes(
    'TRAJECTORY_FADING'
  )
);

// Correlation guard: the single tag is redundant after the pair.
assert.equal(
  row.selectedPatterns.length,
  1
);

assert.equal(
  row.selectedPatterns[0].patternId,
  maturePair.patternId
);

assert.equal(
  row.probabilityMutation,
  false
);

assert.equal(
  row.tradingMutation,
  false
);

const noMatch=
  brain.predict(
    snapshot({
      disagreement:10,
      trajectory:'RISING'
    }),
    {
      mint:'MINT_B',
      at:1_801_600_001_000,
      stage:'DEEP'
    }
  );

assert.equal(
  noMatch.status,
  'NO_PATTERN_MATCH'
);

assert.equal(
  noMatch.penaltyPct,
  0
);

assert.equal(
  noMatch.adjustedConfidencePct,
  noMatch.rawConfidencePct
);

const empty=
  createShadowErrorAwareConfidenceV23_18({
    errorPatternLearner:{
      patternReport(){
        return {
          patterns:[]
        };
      }
    }
  });

const cold=
  empty.predict(
    snapshot(),
    {
      mint:'MINT_C',
      at:1_801_600_002_000,
      stage:'DEEP'
    }
  );

assert.equal(
  cold.status,
  'NO_MATURE_PATTERNS'
);

assert.equal(
  cold.penaltyPct,
  0
);

assert.ok(
  brain.status().penaltiesApplied>=1
);

assert.equal(
  brain.status().probabilityMutation,
  false
);

assert.equal(
  brain.status().confidenceOnly,
  true
);

const source=
  fs.readFileSync(
    'src/shadow-error-aware-confidence-v23_18.mjs',
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
  /createShadowErrorAwareConfidenceV23_18/
);

assert.match(
  shadow,
  /snapshot\.shadowErrorAwareConfidence/
);

assert.match(
  shadow,
  /errorAwareConfidenceStatus/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/error-aware-confidence/
);

assert.match(
  html,
  /id="errorAwareConfidenceList"/
);

assert.match(
  js,
  /loadErrorAwareConfidence/
);

console.log(
  'shadow error-aware confidence v23.18 ok'
);

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
            f"V23.18 REFUSED: {label}: expected 1 exact match, got {n}"
        )
    return text.replace(old,new,1)

old="""import {
  createShadowErrorPatternLearnerV23_17
} from './shadow-error-pattern-learner-v23_17.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowErrorAwareConfidenceV23_18
} from './shadow-error-aware-confidence-v23_18.mjs';""",
    "error-aware import"
)

old="""  const shadowErrorPatternLearner=
    createShadowErrorPatternLearnerV23_17({
      dataDir
    });"""

s=once(
    s,
    old,
    old+"""

  const shadowErrorAwareConfidence=
    createShadowErrorAwareConfidenceV23_18({
      errorPatternLearner:
        shadowErrorPatternLearner
    });""",
    "error-aware construction"
)

old="""      snapshot.shadowOutcomeCalibration=
        shadowOutcomeCalibration.predict(
          snapshot,
          {
            mint,
            at:snapshot.observedAt
          }
        );

      if(cell.maybeAnchor(token,snapshot,journal)){
"""

s=once(
    s,
    old,
    """      snapshot.shadowOutcomeCalibration=
        shadowOutcomeCalibration.predict(
          snapshot,
          {
            mint,
            at:snapshot.observedAt
          }
        );

      // MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18
      // Mature V23.17 miss associations may reduce SHADOW confidence only.
      // Probability, V22 Score/State and BUY/SELL remain untouched.
      snapshot.shadowErrorAwareConfidence=
        shadowErrorAwareConfidence.predict(
          snapshot,
          {
            mint,
            at:snapshot.observedAt,
            stage:cell.stage
          }
        );

      if(cell.maybeAnchor(token,snapshot,journal)){
""",
    "error-aware prediction"
)

old="""          shadowOutcomeCalibration:{
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
          shadowModelArena:{
"""

s=once(
    s,
    old,
    """          shadowOutcomeCalibration:{
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
          shadowErrorAwareConfidence:{
            status:
              snap?.shadowErrorAwareConfidence
                ?.status||'NO_FORECAST',
            probabilityPositivePct:
              snap?.shadowErrorAwareConfidence
                ?.probabilityPositivePct??null,
            rawConfidencePct:
              snap?.shadowErrorAwareConfidence
                ?.rawConfidencePct??0,
            adjustedConfidencePct:
              snap?.shadowErrorAwareConfidence
                ?.adjustedConfidencePct??0,
            penaltyPct:
              snap?.shadowErrorAwareConfidence
                ?.penaltyPct??0,
            forecastSource:
              snap?.shadowErrorAwareConfidence
                ?.forecastSource||'NONE',
            matchedPatterns:
              snap?.shadowErrorAwareConfidence
                ?.matchedPatterns||[],
            selectedPatterns:
              snap?.shadowErrorAwareConfidence
                ?.selectedPatterns||[]
          },
          shadowModelArena:{
""",
    "listCells error-aware projection"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_17'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_18'",
    "network version"
)

old="""      shadowOutcomeReview:shadowOutcomeReview.status(),
      shadowErrorPatternLearner:shadowErrorPatternLearner.status()
"""

s=once(
    s,
    old,
    """      shadowOutcomeReview:shadowOutcomeReview.status(),
      shadowErrorPatternLearner:shadowErrorPatternLearner.status(),
      shadowErrorAwareConfidence:shadowErrorAwareConfidence.status()
""",
    "error-aware status"
)

old="""    flushErrorPatternLearner:
      ()=>shadowErrorPatternLearner.flush(),
    status
"""

s=once(
    s,
    old,
    """    flushErrorPatternLearner:
      ()=>shadowErrorPatternLearner.flush(),
    errorAwareConfidenceStatus:
      ()=>shadowErrorAwareConfidence.status(),
    listErrorAwareConfidence:
      options=>shadowErrorAwareConfidence.listRecent(options),
    status
""",
    "error-aware API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_MONITOR_V23_18
 * Owner-only, read-only confidence haircut diagnostics.
 * Probability and trading authority are never changed.
 */
 if(
   url.pathname==='/api/owner/intelligence/error-aware-confidence' &&
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

   const penalizedOnly=
     String(
       url.searchParams.get('penalizedOnly')||''
     ).toLowerCase()==='true';

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     probabilityMutation:false,
     confidenceOnly:true,
     autoCorrection:false,
     status:
       tokenIntelligenceShadowV23
         .errorAwareConfidenceStatus(),
     recent:
       tokenIntelligenceShadowV23
         .listErrorAwareConfidence({
           limit,
           penalizedOnly
         })
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "error-aware owner route"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      <!-- MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18_UI -->
      <section
        id="errorAwareConfidenceMonitor"
        class="oi-panel oi-error-aware-monitor"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              ERROR-AWARE TRUST · SHADOW ONLY
            </span>
            <h2>V23 Confidence Penalty</h2>
            <p>
              Mature V23.17 miss associations can reduce confidence
              in the current shadow forecast. Probability is unchanged;
              V22 remains the only trading authority.
            </p>
          </div>

          <span
            id="errorAwareConfidenceStatus"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>PREDICTIONS</span>
            <strong id="errorAwarePredictions">—</strong>
            <small>evaluated for known error patterns</small>
          </article>

          <article class="oi-stat">
            <span>PENALIZED</span>
            <strong id="errorAwarePenalized">—</strong>
            <small>matched mature patterns</small>
          </article>

          <article class="oi-stat">
            <span>MEAN PENALTY</span>
            <strong id="errorAwareMeanPenalty">—</strong>
            <small>confidence haircut only</small>
          </article>

          <article class="oi-stat">
            <span>MAX PENALTY</span>
            <strong id="errorAwareMaxPenalty">—</strong>
            <small>hard cap 40%</small>
          </article>
        </div>

        <div class="oi-divider"></div>

        <div class="oi-promotion-check-head">
          <h3>Recent error-aware confidence</h3>
          <span>probability unchanged · no auto-correction</span>
        </div>

        <div
          id="errorAwareConfidenceList"
          class="oi-error-aware-list"
        ></div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "error-aware UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

js_block=r"""/* MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18_UI_JS */
function renderErrorAwareConfidence(payload={}){
  const status=payload?.status||{};
  const recent=
    Array.isArray(payload?.recent)
      ? payload.recent
      : [];

  const badge=$('errorAwareConfidenceStatus');

  if(badge){
    badge.className=
      'oi-ai-status '+
      (
        Number(status?.penaltiesApplied||0)>0
          ? 'online'
          : ''
      );

    badge.textContent=
      Number(status?.predictions||0)>0
        ? 'ACTIVE'
        : 'COLD START';
  }

  $('errorAwarePredictions').textContent=
    num(status?.predictions,0);

  $('errorAwarePenalized').textContent=
    num(status?.penaltiesApplied,0);

  $('errorAwareMeanPenalty').textContent=
    pct(status?.meanAppliedPenaltyPct);

  $('errorAwareMaxPenalty').textContent=
    pct(status?.maxPenaltySeenPct);

  $('errorAwareConfidenceList').innerHTML=
    recent.length
      ? recent.slice(0,15).map(row=>{
          const selected=
            Array.isArray(row?.selectedPatterns)
              ? row.selectedPatterns
              : [];

          return `
            <div
              class="oi-error-aware-row ${Number(row?.penaltyPct||0)>0?'penalized':''}"
            >
              <div class="oi-error-aware-head">
                <strong>${esc(row?.mint||'UNKNOWN')}</strong>
                <span>${esc(String(row?.status||'UNKNOWN').replaceAll('_',' '))}</span>
              </div>

              <div class="oi-error-aware-metrics">
                <span>
                  P+ ${Number.isFinite(Number(row?.probabilityPositivePct))
                    ? `${num(row.probabilityPositivePct,1)}%`
                    : '—'}
                </span>
                <span>
                  confidence ${pct(row?.rawConfidencePct)}
                  → ${pct(row?.adjustedConfidencePct)}
                </span>
                <span>
                  penalty ${pct(row?.penaltyPct)}
                </span>
              </div>

              <div class="oi-error-aware-patterns">
                ${
                  selected.length
                    ? selected.map(pattern=>`
                        <span>
                          ${esc(
                            (Array.isArray(pattern?.tags)
                              ? pattern.tags
                              : []
                            )
                              .map(x=>String(x).replaceAll('_',' '))
                              .join(' + ')
                          )}
                          · ${num(pattern?.missLift,2)}×
                        </span>
                      `).join('')
                    : '<span class="clear">NO MATURE ERROR MATCH</span>'
                }
              </div>
            </div>
          `;
        }).join('')
      : `
          <div class="oi-empty">
            No V23.18 confidence observations yet.
          </div>
        `;
}

async function loadErrorAwareConfidence(){
  try{
    const payload=await api(
      '/api/owner/intelligence/error-aware-confidence?limit=30'
    );

    renderErrorAwareConfidence(payload);
  }catch(error){
    const badge=$('errorAwareConfidenceStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const list=$('errorAwareConfidenceList');

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
    "error-aware UI JS"
)

old="""    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards(),
      loadOutcomeReviews(),
      loadErrorPatterns()
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
      loadErrorAwareConfidence()
    ]);
""",
    "error-aware load"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18
   ========================================================== */

.oi-error-aware-list{
  display:grid;
  gap:8px;
  margin-top:9px;
}

.oi-error-aware-row{
  padding:10px 11px;
  border:1px solid rgba(38,56,69,.68);
  border-radius:11px;
  background:rgba(255,255,255,.012);
}

.oi-error-aware-row.penalized{
  border-color:rgba(239,200,106,.24);
  background:rgba(239,200,106,.02);
}

.oi-error-aware-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}

.oi-error-aware-head strong{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:var(--mf-type-meta);
}

.oi-error-aware-head span{
  color:var(--muted);
  font-size:var(--mf-type-micro);
  font-weight:800;
}

.oi-error-aware-row.penalized
.oi-error-aware-head span{
  color:var(--amber);
}

.oi-error-aware-metrics{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-top:7px;
  color:var(--muted);
  font-size:var(--mf-type-micro);
}

.oi-error-aware-patterns{
  display:flex;
  flex-wrap:wrap;
  gap:5px;
  margin-top:7px;
}

.oi-error-aware-patterns span{
  padding:4px 6px;
  border:1px solid rgba(239,200,106,.18);
  border-radius:999px;
  color:var(--amber);
  font-size:var(--mf-type-micro);
}

.oi-error-aware-patterns span.clear{
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
    "error-aware CSS"
)

cp.write_text(c,encoding="utf-8")

print("V23_18_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/shadow-error-pattern-learner-v23_17.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-error-pattern-learner-v23_17.mjs && node tests/shadow-error-aware-confidence-v23_18.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.18 REFUSED: package test anchor changed"
    )

if "shadow-error-aware-confidence-v23_18.mjs" in s:
    raise SystemExit(
        "V23.18 REFUSED: error-aware test already installed"
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
 "memeflow-app/src/shadow-error-aware-confidence-v23_18.mjs",
 "memeflow-app/tests/shadow-error-aware-confidence-v23_18.mjs"
]:
    p=Path(name)

    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_18_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V23.18 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$MODULE"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.18 TARGETED TESTS ==="

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
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.18 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.18 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
 "memeflow-app/src/shadow-error-aware-confidence-v23_18.mjs"
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
 "MEMEFLOW_SHADOW_ERROR_AWARE_CONFIDENCE_V23_18",
 "probabilityMutation:false",
 "confidenceOnly:true",
 "MAX_PENALTY_PCT=40",
 "MAX_SELECTED_PATTERNS=3",
 "maturePatternsOnly:true",
 "correlationAwareSelection:true",
 "PENALTY_APPLIED",
 "NO_PATTERN_MATCH",
 "NO_MATURE_PATTERNS"
]:
    if x not in m:
        errors.append("V23.18 marker missing: "+x)

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
 "createShadowErrorAwareConfidenceV23_18",
 "snapshot.shadowErrorAwareConfidence",
 "shadowErrorAwareConfidence:shadowErrorAwareConfidence.status()",
 "errorAwareConfidenceStatus",
 "listErrorAwareConfidence",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_18"
]:
    if x not in s:
        errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/error-aware-confidence",
 "probabilityMutation:false",
 "confidenceOnly:true",
 "autoCorrection:false"
]:
    if x not in a:
        errors.append("route missing: "+x)

for x in [
 'id="errorAwareConfidenceList"',
 'id="errorAwarePredictions"',
 'id="errorAwarePenalized"',
 'id="errorAwareMeanPenalty"',
 'id="errorAwareMaxPenalty"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "loadErrorAwareConfidence",
 "renderErrorAwareConfidence",
 "/api/owner/intelligence/error-aware-confidence"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

for x in [
 ".oi-error-aware-list",
 ".oi-error-aware-row",
 ".oi-error-aware-patterns"
]:
    if x not in c:
        errors.append("UI CSS missing: "+x)

if "shadow-error-aware-confidence-v23_18.mjs" not in p:
    errors.append("V23.18 test missing from package")

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
 "shadowErrorPatternLearner.observeReview"
]:
    if x not in s:
        errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit(
        "V23_18_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_18_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.18 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|src/token-intelligence-shadow-v23\.mjs|src/shadow-error-aware-confidence-v23_18\.mjs|tests/shadow-error-aware-confidence-v23_18\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.18 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.18 STAGED ==="

git diff --cached --stat

git commit -m "feat: add shadow error-aware confidence penalty v23.18"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.18 CONTRACT:"
echo "  mature V23.17 error associations can reduce SHADOW confidence only"
echo "  probability is unchanged"
echo "  redundant single-tag patterns covered by a selected pair are skipped"
echo "  combined penalty is capped at 40%"
echo "  no automatic model correction or promotion"
echo "  V22 remains the only trading authority"
echo "  no Score/State/BUY/SELL mutation"
