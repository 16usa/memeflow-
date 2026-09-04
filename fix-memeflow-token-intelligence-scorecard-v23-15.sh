#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="2e8383e4db8a100b9bbf9c1d3e309d5d586abf6c"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
SCORECARD="memeflow-app/src/token-intelligence-scorecard-v23_15.mjs"
TEST="memeflow-app/tests/token-intelligence-scorecard-v23_15.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$SCORECARD" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW TOKEN INTELLIGENCE SCORECARD V23.15 ==="

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
      echo "V23.15 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.15 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.15 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.15 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.15 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.15 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.15 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/token-intelligence-scorecard-v23-15-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.15 FAILED - RESTORING ==="

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

cat > "$SCORECARD" <<'EOF_SCORECARD'
// MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15
//
// OWNER READ-ONLY PER-TOKEN EXPLAINABILITY.
//
// "Scorecard" is a diagnostic view, NOT a second MEMEFLOW Score.
// It explains the already-existing shadow evidence:
// probability, confidence, trajectory, pattern, wallets, calibration,
// disagreement, drift and blockers.
//
// No Score/State/Settings/BUY/SELL mutation.

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

function readiness(items=[]){
  if(!items.length)return 0;
  return round(
    items.filter(Boolean).length/items.length*100,
    1
  );
}

function directionFromProbability(probability){
  const p=finite(probability);
  if(p===null)return 'UNKNOWN';
  if(p>=62)return 'BULLISH';
  if(p<=38)return 'BEARISH';
  return 'NEUTRAL';
}

function confidenceBand(confidence){
  const c=finite(confidence);
  if(c===null)return 'UNKNOWN';
  if(c>=75)return 'HIGH';
  if(c>=50)return 'MEDIUM';
  if(c>=25)return 'LOW';
  return 'VERY_LOW';
}

function factor({
  key,
  label,
  status='UNKNOWN',
  value=null,
  detail=null,
  ready=false,
  caution=false
}){
  return {
    key,
    label,
    status:upper(status),
    value,
    detail,
    ready:ready===true,
    caution:caution===true
  };
}

function summaryFromInspect(row={}){
  const snap=row?.snapshot||{};
  const specialists=snap?.specialists||{};
  const evidence=snap?.evidence||{};

  return {
    mint:row?.mint,
    stage:row?.stage,
    eventCount:row?.eventCount,
    lastObservedAt:snap?.observedAt||null,
    anchorAt:row?.anchor?.at||null,
    labelsCompleted:row?.labelsCompleted||[],
    regime:evidence?.regime||null,
    dataCompletenessPct:
      evidence?.dataQuality?.completenessPct??null,
    canonicalScore:
      evidence?.sourceSignals?.canonicalScore??null,
    opportunityEvidenceReady:
      evidence?.sourceSignals?.opportunityEvidenceReady===true,
    wallet:{
      uniqueBuyerWallets:
        specialists?.wallet?.uniqueBuyerWallets??0,
      topBuyerSolSharePct:
        specialists?.wallet?.topBuyerSolSharePct??null
    },
    coordination:{
      suspected:
        specialists?.coordination?.suspectedCoordination===true,
      sameSlotBuySharePct:
        specialists?.coordination?.sameSlotBuySharePct??0
    },
    smartMoneyMemory:{
      reputationReady:
        specialists?.smartMoneyMemory?.reputationReady===true,
      knownWallets:
        specialists?.smartMoneyMemory?.knownWallets??0,
      readyWallets:
        specialists?.smartMoneyMemory?.readyWallets??0,
      strongWallets:
        specialists?.smartMoneyMemory?.strongWallets??0,
      strongWalletSharePct:
        specialists?.smartMoneyMemory?.strongWalletSharePct??0,
      weightedPositiveProbabilityPct:
        specialists?.smartMoneyMemory?.weightedPositiveProbabilityPct??null,
      historicalConfidencePct:
        specialists?.smartMoneyMemory?.historicalConfidencePct??null
    },
    shadowDriftRegime:{
      status:
        snap?.shadowDriftRegime?.status||'COLD_START',
      driftStatus:
        snap?.shadowDriftRegime?.driftStatus||'COLD_START',
      currentRegime:
        snap?.shadowDriftRegime?.currentRegime||'UNKNOWN',
      regimeModelReady:
        snap?.shadowDriftRegime?.regimeModelReady===true,
      probabilityPositivePct:
        snap?.shadowDriftRegime?.probabilityPositivePct??null,
      modelConfidencePct:
        snap?.shadowDriftRegime?.modelConfidencePct??0
    },
    shadowConfidenceGovernor:{
      status:
        snap?.shadowConfidenceGovernor?.status||'COLD_START',
      ready:
        snap?.shadowConfidenceGovernor?.ready===true,
      consensusProbabilityPositivePct:
        snap?.shadowConfidenceGovernor?.consensusProbabilityPositivePct??null,
      ensembleConfidencePct:
        snap?.shadowConfidenceGovernor?.ensembleConfidencePct??0,
      disagreementPct:
        snap?.shadowConfidenceGovernor?.disagreementPct??null,
      agreementPct:
        snap?.shadowConfidenceGovernor?.agreementPct??null,
      sourceCount:
        snap?.shadowConfidenceGovernor?.sourceCount??0,
      validatedSourceCount:
        snap?.shadowConfidenceGovernor?.validatedSourceCount??0
    },
    shadowTokenTrajectory:{
      trajectoryState:
        snap?.shadowTokenTrajectory?.trajectoryState||'COLD',
      stateStreak:
        snap?.shadowTokenTrajectory?.stateStreak??1,
      turningPoint:
        snap?.shadowTokenTrajectory?.turningPoint===true,
      probabilityDeltaWindow:
        snap?.shadowTokenTrajectory?.probabilityDeltaWindow??null,
      confidenceDeltaWindow:
        snap?.shadowTokenTrajectory?.confidenceDeltaWindow??null,
      forecastQuality:
        snap?.shadowTokenTrajectory?.forecastQuality||null
    },
    shadowTokenPattern:{
      status:
        snap?.shadowTokenPattern?.status||'PATTERN_COLD_START',
      ready:
        snap?.shadowTokenPattern?.ready===true,
      historicalExamples:
        snap?.shadowTokenPattern?.historicalExamples??0,
      neighbourCount:
        snap?.shadowTokenPattern?.neighbourCount??0,
      patternProbabilityPositivePct:
        snap?.shadowTokenPattern?.patternProbabilityPositivePct??null,
      matchConfidencePct:
        snap?.shadowTokenPattern?.matchConfidencePct??0,
      meanSimilarityPct:
        snap?.shadowTokenPattern?.meanSimilarityPct??0
    },
    shadowEvidenceSynthesis:{
      status:
        snap?.shadowEvidenceSynthesis?.status||'SYNTHESIS_COLD_START',
      ready:
        snap?.shadowEvidenceSynthesis?.ready===true,
      direction:
        snap?.shadowEvidenceSynthesis?.direction||'UNKNOWN',
      synthesisProbabilityPositivePct:
        snap?.shadowEvidenceSynthesis?.synthesisProbabilityPositivePct??null,
      synthesisConfidencePct:
        snap?.shadowEvidenceSynthesis?.synthesisConfidencePct??0,
      crossSourceDisagreementPct:
        snap?.shadowEvidenceSynthesis?.crossSourceDisagreementPct??null,
      blockers:
        snap?.shadowEvidenceSynthesis?.blockers||[]
    },
    shadowOutcomeCalibration:{
      status:
        snap?.shadowOutcomeCalibration?.status||'CALIBRATION_COLD_START',
      ready:
        snap?.shadowOutcomeCalibration?.ready===true,
      rawProbabilityPositivePct:
        snap?.shadowOutcomeCalibration?.rawProbabilityPositivePct??null,
      calibratedProbabilityPositivePct:
        snap?.shadowOutcomeCalibration?.calibratedProbabilityPositivePct??null,
      calibratedConfidencePct:
        snap?.shadowOutcomeCalibration?.calibratedConfidencePct??0,
      reliabilitySampleCount:
        snap?.shadowOutcomeCalibration?.reliabilitySampleCount??0,
      globalEcePct:
        snap?.shadowOutcomeCalibration?.globalEcePct??null,
      globalBrier:
        snap?.shadowOutcomeCalibration?.globalBrier??null
    },
    shadowModelArena:{
      status:
        snap?.shadowModelArena?.status||'COLD_START',
      modelReady:
        snap?.shadowModelArena?.modelReady===true,
      validated:
        snap?.shadowModelArena?.validated===true,
      champion:
        snap?.shadowModelArena?.champion||null,
      calibratedProbabilityPositivePct:
        snap?.shadowModelArena?.calibratedProbabilityPositivePct??null,
      modelConfidencePct:
        snap?.shadowModelArena?.modelConfidencePct??0
    },
    shadowMathBrain:{
      status:
        snap?.shadowMathBrain?.status||'COLD_START',
      modelReady:
        snap?.shadowMathBrain?.modelReady===true,
      validated:
        snap?.shadowMathBrain?.validated===true,
      probabilityPositivePct:
        snap?.shadowMathBrain?.probabilityPositivePct??null,
      modelConfidencePct:
        snap?.shadowMathBrain?.modelConfidencePct??0
    }
  };
}

export function createTokenIntelligenceScorecardV23_15({
  inspectToken=null,
  listTokenCells=null
}={}){
  let generated=0;
  let errors=0;

  function build(input={}){
    try{
      const synthesis=input?.shadowEvidenceSynthesis||{};
      const calibration=input?.shadowOutcomeCalibration||{};
      const governor=input?.shadowConfidenceGovernor||{};
      const pattern=input?.shadowTokenPattern||{};
      const trajectory=input?.shadowTokenTrajectory||{};
      const smart=input?.smartMoneyMemory||{};
      const drift=input?.shadowDriftRegime||{};

      let probabilityPositivePct=null;
      let confidencePct=0;
      let probabilitySource='NONE';

      if(
        calibration?.ready===true &&
        finite(calibration?.calibratedProbabilityPositivePct)!==null
      ){
        probabilityPositivePct=
          finite(calibration.calibratedProbabilityPositivePct);
        confidencePct=
          finite(calibration.calibratedConfidencePct)??0;
        probabilitySource='V23_11_CALIBRATED';
      }else if(
        synthesis?.ready===true &&
        finite(synthesis?.synthesisProbabilityPositivePct)!==null
      ){
        probabilityPositivePct=
          finite(synthesis.synthesisProbabilityPositivePct);
        confidencePct=
          finite(synthesis.synthesisConfidencePct)??0;
        probabilitySource='V23_10_SYNTHESIS';
      }else if(
        governor?.ready===true &&
        finite(governor?.consensusProbabilityPositivePct)!==null
      ){
        probabilityPositivePct=
          finite(governor.consensusProbabilityPositivePct);
        confidencePct=
          finite(governor.ensembleConfidencePct)??0;
        probabilitySource='V23_7_GOVERNOR';
      }else if(
        finite(input?.shadowModelArena?.calibratedProbabilityPositivePct)!==null
      ){
        probabilityPositivePct=
          finite(input.shadowModelArena.calibratedProbabilityPositivePct);
        confidencePct=
          finite(input.shadowModelArena.modelConfidencePct)??0;
        probabilitySource='V23_5_ARENA';
      }else if(
        finite(input?.shadowMathBrain?.probabilityPositivePct)!==null
      ){
        probabilityPositivePct=
          finite(input.shadowMathBrain.probabilityPositivePct);
        confidencePct=
          finite(input.shadowMathBrain.modelConfidencePct)??0;
        probabilitySource='V23_4_MATH_BRAIN';
      }

      const blockers=[
        ...(Array.isArray(synthesis?.blockers)?synthesis.blockers:[])
      ].map(String);

      if(input?.coordination?.suspected===true){
        blockers.push('SUSPECTED_WALLET_COORDINATION');
      }

      const driftStatus=upper(drift?.driftStatus||drift?.status);

      if(['DRIFT','ERROR'].includes(driftStatus)){
        blockers.push(`DRIFT_${driftStatus}`);
      }

      const disagreement=
        finite(synthesis?.crossSourceDisagreementPct) ??
        finite(governor?.disagreementPct);

      if(disagreement!==null&&disagreement>=45){
        blockers.push('HIGH_MODEL_DISAGREEMENT');
      }

      const completeness=
        finite(input?.dataCompletenessPct);

      if(completeness!==null&&completeness<75){
        blockers.push('LOW_DATA_COMPLETENESS');
      }

      const factorRows=[
        factor({
          key:'SYNTHESIS',
          label:'Evidence synthesis',
          status:synthesis?.status,
          value:
            finite(synthesis?.synthesisProbabilityPositivePct),
          detail:
            `${finite(synthesis?.synthesisConfidencePct)??0}% confidence`,
          ready:synthesis?.ready===true
        }),
        factor({
          key:'CALIBRATION',
          label:'Outcome calibration',
          status:calibration?.status,
          value:
            finite(calibration?.calibratedProbabilityPositivePct),
          detail:
            `${Number(calibration?.reliabilitySampleCount||0)} reliability rows`,
          ready:calibration?.ready===true,
          caution:
            upper(calibration?.status)==='CALIBRATION_MISALIGNED'
        }),
        factor({
          key:'TRAJECTORY',
          label:'Token trajectory',
          status:trajectory?.trajectoryState,
          value:
            finite(trajectory?.probabilityDeltaWindow),
          detail:
            trajectory?.turningPoint===true
              ? 'turning point detected'
              : `streak ${Number(trajectory?.stateStreak||0)}`,
          ready:
            upper(trajectory?.trajectoryState)!=='COLD',
          caution:
            ['FADING','DRIFTED','CONFLICTED']
              .includes(upper(trajectory?.trajectoryState))
        }),
        factor({
          key:'PATTERN',
          label:'Pattern memory',
          status:pattern?.status,
          value:
            finite(pattern?.patternProbabilityPositivePct),
          detail:
            `${Number(pattern?.neighbourCount||0)} neighbours · ${round(pattern?.meanSimilarityPct,1)??0}% similarity`,
          ready:pattern?.ready===true
        }),
        factor({
          key:'SMART_MONEY',
          label:'Smart money',
          status:
            smart?.reputationReady===true
              ? 'READY'
              : 'LEARNING',
          value:
            finite(smart?.weightedPositiveProbabilityPct),
          detail:
            `${Number(smart?.strongWallets||0)} strong · ${round(smart?.strongWalletSharePct,1)??0}% share`,
          ready:smart?.reputationReady===true
        }),
        factor({
          key:'DISAGREEMENT',
          label:'Model agreement',
          status:
            disagreement===null
              ? 'UNKNOWN'
              : disagreement<25
                ? 'ALIGNED'
                : disagreement<45
                  ? 'MIXED'
                  : 'CONFLICTED',
          value:
            disagreement,
          detail:
            disagreement===null
              ? 'insufficient sources'
              : `${round(100-disagreement,1)}% agreement`,
          ready:
            disagreement!==null,
          caution:
            disagreement!==null&&disagreement>=45
        }),
        factor({
          key:'DRIFT',
          label:'Market / model drift',
          status:driftStatus,
          value:
            finite(drift?.probabilityPositivePct),
          detail:
            String(drift?.currentRegime||input?.regime||'UNKNOWN'),
          ready:
            drift?.regimeModelReady===true ||
            !['COLD_START','UNKNOWN'].includes(driftStatus),
          caution:
            ['DRIFT','ERROR'].includes(driftStatus)
        }),
        factor({
          key:'DATA',
          label:'Data quality',
          status:
            completeness===null
              ? 'UNKNOWN'
              : completeness>=90
                ? 'STRONG'
                : completeness>=75
                  ? 'USABLE'
                  : 'THIN',
          value:completeness,
          detail:
            `${Number(input?.eventCount||0)} observed events`,
          ready:
            completeness!==null&&completeness>=75,
          caution:
            completeness!==null&&completeness<75
        })
      ];

      const readinessPct=
        readiness(
          factorRows.map(row=>row.ready)
        );

      generated++;

      return {
        version:'MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15',
        ownerOnly:true,
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        secondScore:false,
        mint:String(input?.mint||''),
        stage:upper(input?.stage),
        lastObservedAt:
          Number(input?.lastObservedAt||0)||null,
        anchorAt:
          Number(input?.anchorAt||0)||null,
        labelsCompleted:
          Array.isArray(input?.labelsCompleted)
            ? input.labelsCompleted
            : [],
        canonicalScore:
          finite(input?.canonicalScore),
        opportunityEvidenceReady:
          input?.opportunityEvidenceReady===true,
        probabilityPositivePct:
          round(probabilityPositivePct,2),
        probabilitySource,
        confidencePct:
          round(confidencePct,2),
        confidenceBand:
          confidenceBand(confidencePct),
        direction:
          upper(
            synthesis?.direction||
            directionFromProbability(probabilityPositivePct)
          ),
        evidenceReadinessPct:
          readinessPct,
        regime:
          upper(input?.regime),
        dataCompletenessPct:
          completeness,
        disagreementPct:
          round(disagreement,2),
        blockers:
          [...new Set(blockers)],
        factorRows,
        wallet:{
          uniqueBuyerWallets:
            Number(input?.wallet?.uniqueBuyerWallets||0),
          topBuyerSolSharePct:
            round(input?.wallet?.topBuyerSolSharePct,2),
          suspectedCoordination:
            input?.coordination?.suspected===true,
          smartMoneyReady:
            smart?.reputationReady===true,
          strongWallets:
            Number(smart?.strongWallets||0),
          strongWalletSharePct:
            round(smart?.strongWalletSharePct,2)
        },
        trajectory:{
          state:
            upper(trajectory?.trajectoryState),
          turningPoint:
            trajectory?.turningPoint===true,
          probabilityDeltaWindow:
            round(trajectory?.probabilityDeltaWindow,2),
          confidenceDeltaWindow:
            round(trajectory?.confidenceDeltaWindow,2)
        },
        pattern:{
          ready:
            pattern?.ready===true,
          probabilityPositivePct:
            round(pattern?.patternProbabilityPositivePct,2),
          confidencePct:
            round(pattern?.matchConfidencePct,2),
          neighbours:
            Number(pattern?.neighbourCount||0),
          meanSimilarityPct:
            round(pattern?.meanSimilarityPct,2)
        },
        calibration:{
          ready:
            calibration?.ready===true,
          status:
            upper(calibration?.status),
          reliabilitySampleCount:
            Number(calibration?.reliabilitySampleCount||0),
          ecePct:
            round(calibration?.globalEcePct,2),
          brier:
            round(calibration?.globalBrier,6)
        }
      };
    }catch{
      errors++;

      return {
        version:'MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15',
        ownerOnly:true,
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        secondScore:false,
        mint:String(input?.mint||''),
        stage:'UNKNOWN',
        probabilityPositivePct:null,
        probabilitySource:'NONE',
        confidencePct:0,
        confidenceBand:'UNKNOWN',
        direction:'UNKNOWN',
        evidenceReadinessPct:0,
        blockers:['SCORECARD_ERROR'],
        factorRows:[]
      };
    }
  }

  function inspect(mint){
    const raw=
      inspectToken?.(
        String(mint||'')
      );

    if(!raw)return null;

    return build(
      summaryFromInspect(raw)
    );
  }

  function list({
    limit=20,
    minReadinessPct=0
  }={}){
    const safeLimit=
      Math.max(
        1,
        Math.min(
          100,
          Number(limit)||20
        )
      );

    const minReady=
      clamp(
        Number(minReadinessPct)||0,
        0,
        100
      );

    const rows=
      listTokenCells?.({
        limit:100
      })||[];

    return rows
      .map(build)
      .filter(
        row=>
          row.evidenceReadinessPct>=minReady
      )
      .sort(
        (a,b)=>
          Number(b.evidenceReadinessPct||0)-
          Number(a.evidenceReadinessPct||0) ||
          Number(b.confidencePct||0)-
          Number(a.confidencePct||0) ||
          Number(b.lastObservedAt||0)-
          Number(a.lastObservedAt||0)
      )
      .slice(
        0,
        safeLimit
      );
  }

  function status(){
    const rows=
      list({limit:100});

    const withProbability=
      rows.filter(
        row=>
          finite(row.probabilityPositivePct)!==null
      );

    return {
      version:'MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15',
      ownerOnly:true,
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      secondScore:false,
      tracked:rows.length,
      withProbability:
        withProbability.length,
      highReadiness:
        rows.filter(
          row=>row.evidenceReadinessPct>=75
        ).length,
      averageReadinessPct:
        rows.length
          ? round(
              rows.reduce(
                (sum,row)=>
                  sum+Number(row.evidenceReadinessPct||0),
                0
              )/rows.length,
              2
            )
          : null,
      generated,
      errors
    };
  }

  return {
    build,
    inspect,
    list,
    status
  };
}

EOF_SCORECARD

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createTokenIntelligenceScorecardV23_15
} from '../src/token-intelligence-scorecard-v23_15.mjs';

const summary={
  mint:'MINT_A',
  stage:'DEEP',
  eventCount:30,
  lastObservedAt:1_800_000_000_000,
  anchorAt:1_799_999_900_000,
  labelsCompleted:[15_000,30_000],
  regime:'EXPANSION',
  dataCompletenessPct:100,
  canonicalScore:72,
  opportunityEvidenceReady:true,
  wallet:{
    uniqueBuyerWallets:14,
    topBuyerSolSharePct:18
  },
  coordination:{
    suspected:false,
    sameSlotBuySharePct:8
  },
  smartMoneyMemory:{
    reputationReady:true,
    knownWallets:9,
    readyWallets:7,
    strongWallets:4,
    strongWalletSharePct:36,
    weightedPositiveProbabilityPct:71,
    historicalConfidencePct:68
  },
  shadowDriftRegime:{
    status:'REGIME_READY',
    driftStatus:'STABLE',
    currentRegime:'EXPANSION',
    regimeModelReady:true,
    probabilityPositivePct:69,
    modelConfidencePct:66
  },
  shadowConfidenceGovernor:{
    status:'CONFIDENCE_READY',
    ready:true,
    consensusProbabilityPositivePct:73,
    ensembleConfidencePct:72,
    disagreementPct:14,
    agreementPct:86,
    sourceCount:4,
    validatedSourceCount:3
  },
  shadowTokenTrajectory:{
    trajectoryState:'RISING',
    stateStreak:3,
    turningPoint:false,
    probabilityDeltaWindow:8,
    confidenceDeltaWindow:4
  },
  shadowTokenPattern:{
    status:'PATTERN_READY',
    ready:true,
    historicalExamples:80,
    neighbourCount:12,
    patternProbabilityPositivePct:75,
    matchConfidencePct:70,
    meanSimilarityPct:82
  },
  shadowEvidenceSynthesis:{
    status:'SYNTHESIS_STRONG',
    ready:true,
    direction:'BULLISH',
    synthesisProbabilityPositivePct:76,
    synthesisConfidencePct:74,
    crossSourceDisagreementPct:13,
    blockers:[]
  },
  shadowOutcomeCalibration:{
    status:'CALIBRATION_HEALTHY',
    ready:true,
    rawProbabilityPositivePct:76,
    calibratedProbabilityPositivePct:72,
    calibratedConfidencePct:69,
    reliabilitySampleCount:120,
    globalEcePct:6,
    globalBrier:0.16
  },
  shadowModelArena:{
    status:'ARENA_READY',
    modelReady:true,
    validated:true,
    champion:'FULL_LOGISTIC',
    calibratedProbabilityPositivePct:74,
    modelConfidencePct:67
  },
  shadowMathBrain:{
    status:'BRAIN_READY',
    modelReady:true,
    validated:true,
    probabilityPositivePct:73,
    modelConfidencePct:65
  }
};

const fakeInspect=mint=>{
  if(mint!=='MINT_A')return null;

  return {
    mint:'MINT_A',
    stage:'DEEP',
    eventCount:30,
    labelsCompleted:[15_000,30_000],
    anchor:{at:1_799_999_900_000},
    snapshot:{
      observedAt:1_800_000_000_000,
      evidence:{
        regime:'EXPANSION',
        dataQuality:{
          completenessPct:100
        },
        sourceSignals:{
          canonicalScore:72,
          opportunityEvidenceReady:true
        }
      },
      specialists:{
        wallet:{
          uniqueBuyerWallets:14,
          topBuyerSolSharePct:18
        },
        coordination:{
          suspectedCoordination:false,
          sameSlotBuySharePct:8
        },
        smartMoneyMemory:summary.smartMoneyMemory
      },
      shadowDriftRegime:summary.shadowDriftRegime,
      shadowConfidenceGovernor:summary.shadowConfidenceGovernor,
      shadowTokenTrajectory:summary.shadowTokenTrajectory,
      shadowTokenPattern:summary.shadowTokenPattern,
      shadowEvidenceSynthesis:summary.shadowEvidenceSynthesis,
      shadowOutcomeCalibration:summary.shadowOutcomeCalibration,
      shadowModelArena:summary.shadowModelArena,
      shadowMathBrain:summary.shadowMathBrain
    }
  };
};

const scorecards=
  createTokenIntelligenceScorecardV23_15({
    inspectToken:fakeInspect,
    listTokenCells:()=>[
      summary,
      {
        ...summary,
        mint:'MINT_B',
        dataCompletenessPct:50,
        shadowOutcomeCalibration:{
          ...summary.shadowOutcomeCalibration,
          ready:false,
          calibratedProbabilityPositivePct:null
        },
        shadowEvidenceSynthesis:{
          ...summary.shadowEvidenceSynthesis,
          synthesisProbabilityPositivePct:61,
          synthesisConfidencePct:52,
          blockers:['LOW_DATA']
        }
      }
    ]
  });

const card=scorecards.build(summary);

assert.equal(card.secondScore,false);
assert.equal(card.authority,'DIAGNOSTIC_ONLY');
assert.equal(card.probabilitySource,'V23_11_CALIBRATED');
assert.equal(card.probabilityPositivePct,72);
assert.equal(card.confidencePct,69);
assert.equal(card.direction,'BULLISH');
assert.ok(card.evidenceReadinessPct>=75);
assert.equal(card.wallet.smartMoneyReady,true);
assert.equal(card.pattern.neighbours,12);
assert.equal(card.calibration.ready,true);
assert.equal(card.blockers.length,0);

const fallback=scorecards.build({
  ...summary,
  shadowOutcomeCalibration:{
    ...summary.shadowOutcomeCalibration,
    ready:false,
    calibratedProbabilityPositivePct:null
  },
  shadowEvidenceSynthesis:{
    ...summary.shadowEvidenceSynthesis,
    synthesisProbabilityPositivePct:64,
    synthesisConfidencePct:55
  }
});

assert.equal(
  fallback.probabilitySource,
  'V23_10_SYNTHESIS'
);

assert.equal(
  fallback.probabilityPositivePct,
  64
);

const inspected=
  scorecards.inspect('MINT_A');

assert.equal(
  inspected.mint,
  'MINT_A'
);

assert.equal(
  inspected.probabilityPositivePct,
  72
);

assert.equal(
  scorecards.inspect('MISSING'),
  null
);

const list=
  scorecards.list({
    limit:10
  });

assert.equal(
  list.length,
  2
);

assert.equal(
  list[0].mint,
  'MINT_A'
);

assert.ok(
  scorecards.status().tracked>=2
);

const source=fs.readFileSync(
  'src/token-intelligence-scorecard-v23_15.mjs',
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
  /tokenScore\s*:/
);

const shadow=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs',
  'utf8'
);

const app=fs.readFileSync(
  'app-server.mjs',
  'utf8'
);

const html=fs.readFileSync(
  'owner-intelligence.html',
  'utf8'
);

const js=fs.readFileSync(
  'owner-intelligence.js',
  'utf8'
);

assert.match(
  shadow,
  /createTokenIntelligenceScorecardV23_15/
);

assert.match(
  shadow,
  /tokenScorecardStatus/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/token-scorecards/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/token-scorecard/
);

assert.match(
  html,
  /id="tokenScorecardList"/
);

assert.match(
  html,
  /id="tokenScorecardDetail"/
);

assert.match(
  js,
  /loadTokenScorecards/
);

assert.match(
  js,
  /inspectTokenScorecard/
);

console.log(
  'token intelligence scorecard v23.15 ok'
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
            f"V23.15 REFUSED: {label}: expected 1 exact match, got {n}"
        )
    return text.replace(old,new,1)

old="""import {
  createShadowPromotionReportV23_14
} from './shadow-promotion-report-v23_14.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createTokenIntelligenceScorecardV23_15
} from './token-intelligence-scorecard-v23_15.mjs';""",
    "scorecard import"
)

old="""  const shadowPromotionReport=
    createShadowPromotionReportV23_14({
      promotionGate:shadowPromotionGate,
      championBenchmark:shadowChampionBenchmark,
      outcomeCalibration:shadowOutcomeCalibration,
      driftRegime:shadowDriftRegime,
      evidenceSynthesis:shadowEvidenceSynthesis
    });"""

s=once(
    s,
    old,
    old+"""

  const tokenIntelligenceScorecard=
    createTokenIntelligenceScorecardV23_15({
      inspectToken:mint=>inspect(mint),
      listTokenCells:options=>listCells(options)
    });""",
    "scorecard construction"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_14'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_15'",
    "network version"
)

old="""      shadowPromotionGate:shadowPromotionGate.status(),
      shadowPromotionReport:shadowPromotionReport.status()
"""

s=once(
    s,
    old,
    """      shadowPromotionGate:shadowPromotionGate.status(),
      shadowPromotionReport:shadowPromotionReport.status(),
      tokenIntelligenceScorecard:tokenIntelligenceScorecard.status()
""",
    "scorecard status"
)

old="""    promotionReport:
      ()=>shadowPromotionReport.report(),
    status
"""

s=once(
    s,
    old,
    """    promotionReport:
      ()=>shadowPromotionReport.report(),
    tokenScorecardStatus:
      ()=>tokenIntelligenceScorecard.status(),
    listTokenScorecards:
      options=>tokenIntelligenceScorecard.list(options),
    inspectTokenScorecard:
      mint=>tokenIntelligenceScorecard.inspect(mint),
    status
""",
    "scorecard API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_MONITOR_V23_15
 * Owner-only, read-only per-token V23 explainability.
 * "Scorecard" is not a second MEMEFLOW Score.
 */
 if(
   url.pathname==='/api/owner/intelligence/token-scorecards' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(
       100,
       Number(
         url.searchParams.get('limit')||20
       )
     )
   );

   const minReadinessPct=Math.max(
     0,
     Math.min(
       100,
       Number(
         url.searchParams.get('minReadinessPct')||0
       )
     )
   );

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     secondScore:false,
     status:
       tokenIntelligenceShadowV23
         .tokenScorecardStatus(),
     scorecards:
       tokenIntelligenceShadowV23
         .listTokenScorecards({
           limit,
           minReadinessPct
         })
   });
 }

 if(
   url.pathname==='/api/owner/intelligence/token-scorecard' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const mint=String(
     url.searchParams.get('mint')||''
   ).trim();

   if(!mint){
     return json(res,400,{
       error:'MINT_REQUIRED'
     });
   }

   const scorecard=
     tokenIntelligenceShadowV23
       .inspectTokenScorecard(mint);

   if(!scorecard){
     return json(res,404,{
       error:'TOKEN_SCORECARD_NOT_FOUND',
       mint
     });
   }

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     secondScore:false,
     scorecard
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "scorecard owner routes"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      <!-- MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15_UI -->
      <section
        id="tokenScorecardMonitor"
        class="oi-panel oi-scorecard-monitor"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              PER TOKEN · V23 SHADOW
            </span>
            <h2>Token Intelligence Scorecards</h2>
            <p>
              Explainability view only — probability, confidence,
              wallets, trajectory, patterns, calibration and blockers.
              This is not a second MEMEFLOW Score.
            </p>
          </div>

          <span
            id="tokenScorecardStatus"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>TRACKED</span>
            <strong id="tokenScorecardTracked">—</strong>
            <small>active scorecards</small>
          </article>

          <article class="oi-stat">
            <span>WITH PROBABILITY</span>
            <strong id="tokenScorecardProbable">—</strong>
            <small>usable shadow forecast</small>
          </article>

          <article class="oi-stat">
            <span>HIGH READINESS</span>
            <strong id="tokenScorecardReady">—</strong>
            <small>≥75% evidence ready</small>
          </article>

          <article class="oi-stat">
            <span>AVG READINESS</span>
            <strong id="tokenScorecardAverage">—</strong>
            <small>diagnostic only</small>
          </article>
        </div>

        <div class="oi-scorecard-search">
          <input
            id="tokenScorecardMint"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="Paste token mint to inspect"
          >
          <button
            id="tokenScorecardInspectBtn"
            class="oi-btn"
            type="button"
          >
            INSPECT TOKEN
          </button>
        </div>

        <div
          id="tokenScorecardDetail"
          class="oi-scorecard-detail"
          hidden
        ></div>

        <div class="oi-divider"></div>

        <div class="oi-promotion-check-head">
          <h3>Tracked token evidence</h3>
          <span id="tokenScorecardListSummary">—</span>
        </div>

        <div
          id="tokenScorecardList"
          class="oi-scorecard-list"
        ></div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "scorecard UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

js_block=r"""/* MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15_UI_JS */
function scorecardTone(card={}){
  const blockers=
    Array.isArray(card?.blockers)
      ? card.blockers
      : [];

  if(blockers.length){
    return 'warn';
  }

  const p=Number(card?.probabilityPositivePct);
  const c=Number(card?.confidencePct);

  if(
    Number.isFinite(p) &&
    Number.isFinite(c) &&
    p>=62 &&
    c>=50
  ){
    return 'positive';
  }

  if(
    Number.isFinite(p) &&
    p<=38
  ){
    return 'negative';
  }

  return 'neutral';
}

function scorecardCardHtml(card={}){
  const blockers=
    Array.isArray(card?.blockers)
      ? card.blockers
      : [];

  const probability=
    Number(card?.probabilityPositivePct);

  const confidence=
    Number(card?.confidencePct);

  return `
    <button
      type="button"
      class="oi-scorecard-card ${scorecardTone(card)}"
      data-scorecard-mint="${esc(card?.mint||'')}"
    >
      <div class="oi-scorecard-card-head">
        <strong>${esc(card?.mint||'UNKNOWN')}</strong>
        <span>${esc(String(card?.stage||'—'))}</span>
      </div>

      <div class="oi-scorecard-card-main">
        <div>
          <small>V23 probability</small>
          <b>
            ${
              Number.isFinite(probability)
                ? `${num(probability,1)}%`
                : '—'
            }
          </b>
        </div>

        <div>
          <small>confidence</small>
          <b>
            ${
              Number.isFinite(confidence)
                ? `${num(confidence,1)}%`
                : '—'
            }
          </b>
        </div>

        <div>
          <small>evidence</small>
          <b>${num(card?.evidenceReadinessPct,1)}%</b>
        </div>
      </div>

      <div class="oi-scorecard-card-foot">
        <span>
          ${esc(String(card?.direction||'UNKNOWN'))}
          · ${esc(String(card?.trajectory?.state||'COLD'))}
        </span>
        <span>
          ${
            blockers.length
              ? `${blockers.length} blocker${blockers.length===1?'':'s'}`
              : 'clear'
          }
        </span>
      </div>
    </button>
  `;
}

function renderTokenScorecardDetail(card={}){
  const node=$('tokenScorecardDetail');
  if(!node)return;

  const factors=
    Array.isArray(card?.factorRows)
      ? card.factorRows
      : [];

  const blockers=
    Array.isArray(card?.blockers)
      ? card.blockers
      : [];

  node.hidden=false;

  node.innerHTML=`
    <div class="oi-scorecard-detail-head">
      <div>
        <span class="oi-eyebrow">TOKEN INTELLIGENCE</span>
        <h3>${esc(card?.mint||'UNKNOWN')}</h3>
      </div>

      <span class="oi-scorecard-direction ${scorecardTone(card)}">
        ${esc(String(card?.direction||'UNKNOWN'))}
      </span>
    </div>

    <div class="oi-scorecard-detail-metrics">
      <div>
        <span>V23 probability</span>
        <strong>
          ${
            Number.isFinite(Number(card?.probabilityPositivePct))
              ? `${num(card.probabilityPositivePct,2)}%`
              : '—'
          }
        </strong>
        <small>${esc(card?.probabilitySource||'NONE')}</small>
      </div>

      <div>
        <span>Confidence</span>
        <strong>${pct(card?.confidencePct)}</strong>
        <small>${esc(card?.confidenceBand||'UNKNOWN')}</small>
      </div>

      <div>
        <span>Evidence ready</span>
        <strong>${pct(card?.evidenceReadinessPct)}</strong>
        <small>${esc(card?.regime||'UNKNOWN')} regime</small>
      </div>

      <div>
        <span>Canonical Score</span>
        <strong>${num(card?.canonicalScore,2)}</strong>
        <small>V22 source signal · unchanged</small>
      </div>
    </div>

    <div class="oi-scorecard-factor-grid">
      ${
        factors.map(row=>`
          <div
            class="oi-scorecard-factor ${row?.caution===true?'caution':''}"
          >
            <div>
              <strong>${esc(row?.label||row?.key||'FACTOR')}</strong>
              <small>${esc(String(row?.status||'UNKNOWN').replaceAll('_',' '))}</small>
            </div>
            <div>
              <b>
                ${
                  Number.isFinite(Number(row?.value))
                    ? num(row.value,2)
                    : '—'
                }
              </b>
              <small>${esc(row?.detail||'')}</small>
            </div>
          </div>
        `).join('')
      }
    </div>

    <div class="oi-scorecard-blockers">
      ${
        blockers.length
          ? blockers.map(x=>`
              <span>${esc(String(x).replaceAll('_',' '))}</span>
            `).join('')
          : '<span class="clear">NO ACTIVE SHADOW BLOCKERS</span>'
      }
    </div>
  `;
}

function bindTokenScorecardRows(){
  document
    .querySelectorAll('[data-scorecard-mint]')
    .forEach(button=>{
      button.addEventListener(
        'click',
        ()=>{
          const mint=
            String(
              button.dataset.scorecardMint||''
            );

          if(mint){
            $('tokenScorecardMint').value=mint;
            inspectTokenScorecard(mint);
          }
        }
      );
    });
}

function renderTokenScorecards(payload={}){
  const status=payload?.status||{};
  const rows=
    Array.isArray(payload?.scorecards)
      ? payload.scorecards
      : [];

  $('tokenScorecardStatus').className=
    'oi-ai-status '+
    (rows.length?'online':'');

  $('tokenScorecardStatus').textContent=
    rows.length
      ? 'LIVE'
      : 'LEARNING';

  $('tokenScorecardTracked').textContent=
    num(status?.tracked,0);

  $('tokenScorecardProbable').textContent=
    num(status?.withProbability,0);

  $('tokenScorecardReady').textContent=
    num(status?.highReadiness,0);

  $('tokenScorecardAverage').textContent=
    pct(status?.averageReadinessPct);

  $('tokenScorecardListSummary').textContent=
    `${rows.length} shown`;

  $('tokenScorecardList').innerHTML=
    rows.length
      ? rows.map(scorecardCardHtml).join('')
      : `
          <div class="oi-empty">
            No active Token Intelligence scorecards yet.
            The shadow network needs live token events.
          </div>
        `;

  bindTokenScorecardRows();
}

async function loadTokenScorecards(){
  try{
    const payload=await api(
      '/api/owner/intelligence/token-scorecards?limit=20'
    );

    renderTokenScorecards(payload);
  }catch(error){
    const badge=$('tokenScorecardStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const list=$('tokenScorecardList');

    if(list){
      list.innerHTML=`
        <div class="oi-empty">
          ${esc(error.message)}
        </div>
      `;
    }
  }
}

async function inspectTokenScorecard(mint=null){
  mint=String(
    mint||
    $('tokenScorecardMint')?.value||
    ''
  ).trim();

  if(!mint)return;

  const button=$('tokenScorecardInspectBtn');

  if(button){
    button.disabled=true;
    button.textContent='INSPECTING…';
  }

  try{
    const payload=await api(
      '/api/owner/intelligence/token-scorecard?mint='+
      encodeURIComponent(mint)
    );

    renderTokenScorecardDetail(
      payload?.scorecard||{}
    );
  }catch(error){
    const node=$('tokenScorecardDetail');

    if(node){
      node.hidden=false;
      node.innerHTML=`
        <div class="oi-empty">
          ${esc(error.message)}
        </div>
      `;
    }
  }finally{
    if(button){
      button.disabled=false;
      button.textContent='INSPECT TOKEN';
    }
  }
}

/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

j=once(
    j,
    js_anchor,
    js_block,
    "scorecard UI JS"
)

old="""    renderOverview(data);
    await loadPromotionReport();

    if(previous){
"""

j=once(
    j,
    old,
    """    renderOverview(data);

    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards()
    ]);

    if(previous){
""",
    "scorecard load"
)

listener_anchor="""$('refreshBtn')
  .addEventListener(
    'click',
    ()=>load()
  );
"""

listener_new="""$('refreshBtn')
  .addEventListener(
    'click',
    ()=>load()
  );

$('tokenScorecardInspectBtn')
  ?.addEventListener(
    'click',
    ()=>inspectTokenScorecard()
  );

$('tokenScorecardMint')
  ?.addEventListener(
    'keydown',
    event=>{
      if(
        event.key==='Enter' &&
        !event.isComposing
      ){
        event.preventDefault();
        inspectTokenScorecard();
      }
    }
  );
"""

j=once(
    j,
    listener_anchor,
    listener_new,
    "scorecard listeners"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15
   ========================================================== */

.oi-scorecard-search{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  gap:8px;
  margin-bottom:12px;
}

.oi-scorecard-search input{
  min-width:0;
  min-height:40px;
  padding:9px 11px;
  border:1px solid var(--line2);
  border-radius:10px;
  outline:none;
  background:#090f14;
  color:var(--text);
}

.oi-scorecard-search input:focus{
  border-color:rgba(87,220,255,.55);
}

.oi-scorecard-list{
  display:grid;
  grid-template-columns:
    repeat(2,minmax(0,1fr));
  gap:8px;
  margin-top:9px;
}

.oi-scorecard-card{
  min-width:0;
  padding:11px;
  border:1px solid rgba(38,56,69,.72);
  border-radius:12px;
  background:rgba(255,255,255,.012);
  color:var(--text);
  text-align:left;
  cursor:pointer;
}

.oi-scorecard-card:hover{
  border-color:rgba(87,220,255,.40);
}

.oi-scorecard-card.positive{
  border-color:rgba(81,231,168,.24);
}

.oi-scorecard-card.negative,
.oi-scorecard-card.warn{
  border-color:rgba(255,104,120,.20);
}

.oi-scorecard-card-head,
.oi-scorecard-card-foot{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}

.oi-scorecard-card-head strong{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:var(--mf-type-ui);
}

.oi-scorecard-card-head span,
.oi-scorecard-card-foot{
  color:var(--muted);
  font-size:var(--mf-type-micro);
}

.oi-scorecard-card-main{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:7px;
  margin:10px 0;
}

.oi-scorecard-card-main div{
  padding:8px;
  border:1px solid rgba(38,56,69,.55);
  border-radius:9px;
}

.oi-scorecard-card-main small{
  display:block;
  color:var(--muted);
  font-size:var(--mf-type-micro);
}

.oi-scorecard-card-main b{
  display:block;
  margin-top:4px;
  font-size:15px;
}

.oi-scorecard-detail{
  margin-bottom:12px;
  padding:12px;
  border:1px solid rgba(87,220,255,.18);
  border-radius:13px;
  background:rgba(87,220,255,.025);
}

.oi-scorecard-detail-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}

.oi-scorecard-detail-head h3{
  margin:4px 0 0;
  max-width:580px;
  overflow-wrap:anywhere;
  color:var(--text);
  font-size:14px;
  text-transform:none;
  letter-spacing:0;
}

.oi-scorecard-direction{
  padding:6px 9px;
  border:1px solid var(--line2);
  border-radius:999px;
  color:var(--muted);
  font-size:var(--mf-type-meta);
  font-weight:900;
}

.oi-scorecard-direction.positive{
  color:var(--green);
  border-color:rgba(81,231,168,.25);
}

.oi-scorecard-direction.negative,
.oi-scorecard-direction.warn{
  color:#ff9daa;
  border-color:rgba(255,104,120,.25);
}

.oi-scorecard-detail-metrics{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:7px;
  margin-top:10px;
}

.oi-scorecard-detail-metrics>div{
  padding:9px;
  border:1px solid rgba(38,56,69,.62);
  border-radius:10px;
  background:rgba(0,0,0,.08);
}

.oi-scorecard-detail-metrics span,
.oi-scorecard-detail-metrics small{
  display:block;
  color:var(--muted);
  font-size:var(--mf-type-micro);
}

.oi-scorecard-detail-metrics strong{
  display:block;
  margin:4px 0;
  font-size:17px;
}

.oi-scorecard-factor-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:7px;
  margin-top:10px;
}

.oi-scorecard-factor{
  display:flex;
  justify-content:space-between;
  gap:12px;
  padding:9px 10px;
  border:1px solid rgba(38,56,69,.58);
  border-radius:10px;
  background:rgba(255,255,255,.01);
}

.oi-scorecard-factor.caution{
  border-color:rgba(255,104,120,.20);
}

.oi-scorecard-factor strong,
.oi-scorecard-factor b{
  display:block;
  font-size:var(--mf-type-meta);
}

.oi-scorecard-factor small{
  display:block;
  margin-top:3px;
  color:var(--muted);
  font-size:var(--mf-type-micro);
}

.oi-scorecard-factor>div:last-child{
  text-align:right;
}

.oi-scorecard-blockers{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  margin-top:10px;
}

.oi-scorecard-blockers span{
  padding:5px 7px;
  border:1px solid rgba(255,104,120,.20);
  border-radius:999px;
  color:#ff9daa;
  font-size:var(--mf-type-micro);
  font-weight:800;
}

.oi-scorecard-blockers span.clear{
  border-color:rgba(81,231,168,.20);
  color:var(--green);
}

@media(max-width:900px){
  .oi-scorecard-detail-metrics{
    grid-template-columns:repeat(2,1fr);
  }
}

@media(max-width:650px){
  .oi-scorecard-search,
  .oi-scorecard-list,
  .oi-scorecard-factor-grid{
    grid-template-columns:1fr;
  }

  .oi-scorecard-search .oi-btn{
    width:100%;
  }

  .oi-scorecard-card-main{
    grid-template-columns:repeat(3,1fr);
  }
}

/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

c=once(
    c,
    css_anchor,
    css_block,
    "scorecard CSS"
)

cp.write_text(c,encoding="utf-8")

print("V23_15_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/shadow-promotion-report-v23_14.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-promotion-report-v23_14.mjs && node tests/token-intelligence-scorecard-v23_15.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.15 REFUSED: package test anchor changed"
    )

if "token-intelligence-scorecard-v23_15.mjs" in s:
    raise SystemExit(
        "V23.15 REFUSED: scorecard test already installed"
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
 "memeflow-app/src/token-intelligence-scorecard-v23_15.mjs",
 "memeflow-app/tests/token-intelligence-scorecard-v23_15.mjs"
]:
    p=Path(name)
    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_15_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V23.15 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$SCORECARD"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.15 TARGETED TESTS ==="

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
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.15 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.15 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
 "memeflow-app/src/token-intelligence-scorecard-v23_15.mjs"
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
 "MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15",
 "secondScore:false",
 "probabilityPositivePct",
 "probabilitySource",
 "confidencePct",
 "evidenceReadinessPct",
 "factorRows",
 "blockers",
 "V23_11_CALIBRATED",
 "V23_10_SYNTHESIS"
]:
    if x not in m:
        errors.append("scorecard marker missing: "+x)

for x in [
 "from './evaluate.mjs'",
 "openPosition(",
 "closePosition(",
 "setSettings(",
 "tradeEligible",
 "decisionScore",
 "tokenScore:"
]:
    if x in m:
        errors.append("forbidden authority: "+x)

for x in [
 "createTokenIntelligenceScorecardV23_15",
 "tokenIntelligenceScorecard:tokenIntelligenceScorecard.status()",
 "tokenScorecardStatus",
 "listTokenScorecards",
 "inspectTokenScorecard",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_15"
]:
    if x not in s:
        errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/token-scorecards",
 "/api/owner/intelligence/token-scorecard",
 "secondScore:false",
 "TOKEN_SCORECARD_NOT_FOUND"
]:
    if x not in a:
        errors.append("route missing: "+x)

for x in [
 'id="tokenScorecardList"',
 'id="tokenScorecardDetail"',
 'id="tokenScorecardMint"',
 'id="tokenScorecardInspectBtn"',
 'id="tokenScorecardTracked"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "loadTokenScorecards",
 "inspectTokenScorecard",
 "renderTokenScorecardDetail",
 "/api/owner/intelligence/token-scorecards",
 "/api/owner/intelligence/token-scorecard"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

for x in [
 ".oi-scorecard-list",
 ".oi-scorecard-card",
 ".oi-scorecard-detail",
 ".oi-scorecard-factor-grid",
 ".oi-scorecard-blockers"
]:
    if x not in c:
        errors.append("UI CSS missing: "+x)

if "token-intelligence-scorecard-v23_15.mjs" not in p:
    errors.append("V23.15 test missing from package")

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
 "shadowPromotionReport.status"
]:
    if x not in s:
        errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit(
        "V23_15_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_15_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.15 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|src/token-intelligence-shadow-v23\.mjs|src/token-intelligence-scorecard-v23_15\.mjs|tests/token-intelligence-scorecard-v23_15\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.15 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.15 STAGED ==="

git diff --cached --stat

git commit -m "feat: add per-token intelligence scorecards v23.15"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.15 CONTRACT:"
echo "  each active Token Cell gets an owner-readable explainability scorecard"
echo "  scorecard shows V23 probability/confidence source, readiness, trajectory, pattern, wallets, drift, disagreement, calibration and blockers"
echo "  owner can inspect a specific mint from Owner Intelligence"
echo "  scorecard is explicitly NOT a second MEMEFLOW Score"
echo "  V22 remains the only trading authority"
echo "  no Score/State/BUY/SELL mutation"
