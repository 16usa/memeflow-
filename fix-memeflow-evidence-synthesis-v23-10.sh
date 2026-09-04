#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="365c33b5618f991ec8484963e9acc0337913e40c"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
SYNTHESIS="memeflow-app/src/shadow-evidence-synthesis-v23_10.mjs"
TEST="memeflow-app/tests/shadow-evidence-synthesis-v23_10.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$SYNTHESIS" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW EVIDENCE SYNTHESIS V23.10 ==="

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
      echo "V23.10 REFUSED: active git process with index.lock"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.10 REFUSED: wrong branch"
  echo "expected: $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.10 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.10 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.10 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.10 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.10 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/evidence-synthesis-v23-10-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.10 FAILED - RESTORING ==="

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

cat > "$SYNTHESIS" <<'EOF_SYNTHESIS'
// MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10
// SHADOW ONLY. No MEMEFLOW Score/State/settings/BUY/SELL authority.
//
// Governor already contains Math Brain / Arena / Regime / Smart Money.
// V23.10 therefore does NOT re-count those sources independently.
// It combines Governor + Pattern Memory, while Trajectory/Risk act only
// as confidence/direction modifiers.

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

function trajectoryModifier(state){
  switch(upper(state)){
    case 'RISING':
      return {probabilityShift:4,confidenceMultiplier:1.08,reason:'TRAJECTORY_RISING'};
    case 'BUILDING':
      return {probabilityShift:2,confidenceMultiplier:1.05,reason:'TRAJECTORY_BUILDING'};
    case 'FADING':
      return {probabilityShift:-5,confidenceMultiplier:0.82,reason:'TRAJECTORY_FADING'};
    case 'CONFLICTED':
      return {probabilityShift:0,confidenceMultiplier:0.55,reason:'TRAJECTORY_CONFLICTED'};
    case 'DRIFTED':
      return {probabilityShift:0,confidenceMultiplier:0.25,reason:'TRAJECTORY_DRIFTED'};
    case 'REGIME_SHIFT':
      return {probabilityShift:0,confidenceMultiplier:0.68,reason:'TRAJECTORY_REGIME_SHIFT'};
    case 'COLD':
      return {probabilityShift:0,confidenceMultiplier:0.72,reason:'TRAJECTORY_COLD'};
    default:
      return {probabilityShift:0,confidenceMultiplier:1,reason:'TRAJECTORY_STABLE'};
  }
}

function dataQualityMultiplier(snapshot={}){
  const completeness=finite(snapshot?.evidence?.dataQuality?.completenessPct);
  if(completeness===null)return 0.80;
  if(completeness>=95)return 1;
  if(completeness>=80)return 0.90;
  if(completeness>=60)return 0.72;
  return 0.50;
}

function coordinationMultiplier(snapshot={}){
  return snapshot?.specialists?.coordination?.suspectedCoordination===true
    ? 0.72
    : 1;
}

function smartMoneyConsistency(snapshot={},probability=null){
  const sm=snapshot?.specialists?.smartMoneyMemory||{};
  const p=finite(sm.weightedPositiveProbabilityPct);
  const confidence=finite(sm.historicalConfidencePct);

  if(sm.reputationReady!==true||p===null||probability===null){
    return {
      available:false,
      probabilityPositivePct:p,
      confidencePct:confidence,
      deltaPct:null,
      multiplier:1,
      reason:'SMART_MONEY_UNAVAILABLE'
    };
  }

  const delta=Math.abs(p-probability);

  return {
    available:true,
    probabilityPositivePct:p,
    confidencePct:confidence,
    deltaPct:delta,
    multiplier:delta>=30?0.70:delta>=20?0.84:1,
    reason:delta>=30
      ? 'SMART_MONEY_MAJOR_CONFLICT'
      : delta>=20
        ? 'SMART_MONEY_CONFLICT'
        : 'SMART_MONEY_ALIGNED'
  };
}

export function createShadowEvidenceSynthesisV23_10(){
  let predictions=0;
  let coldStarts=0;
  let conflicts=0;
  let errors=0;
  const recent=[];

  function remember(row){
    recent.unshift(row);
    if(recent.length>200)recent.length=200;
  }

  function predict(snapshot={},meta={}){
    try{
      const governor=snapshot?.shadowConfidenceGovernor||{};
      const pattern=snapshot?.shadowTokenPattern||{};
      const trajectory=snapshot?.shadowTokenTrajectory||{};

      const governorP=finite(governor.consensusProbabilityPositivePct);
      const governorC=finite(governor.ensembleConfidencePct);

      const governorReady=
        governor.ready===true &&
        governorP!==null &&
        governorC!==null &&
        governorC>0;

      if(!governorReady){
        coldStarts++;

        const cold={
          version:'MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10',
          shadowOnly:true,
          authority:'DIAGNOSTIC_ONLY',
          status:'SYNTHESIS_COLD_START',
          ready:false,
          direction:'UNKNOWN',
          synthesisProbabilityPositivePct:null,
          synthesisConfidencePct:0,
          governorProbabilityPositivePct:governorP,
          governorConfidencePct:governorC??0,
          patternProbabilityPositivePct:null,
          patternConfidencePct:0,
          patternWeightPct:0,
          governorWeightPct:100,
          crossSourceDisagreementPct:null,
          trajectoryState:upper(trajectory.trajectoryState),
          modifiers:[],
          blockers:['GOVERNOR_NOT_READY'],
          mint:meta?.mint||snapshot?.mint||null,
          observedAt:Number(meta?.at||snapshot?.observedAt||Date.now())
        };

        remember(cold);
        return cold;
      }

      const patternP=finite(pattern.patternProbabilityPositivePct);
      const patternC=finite(pattern.matchConfidencePct);

      const patternReady=
        pattern.ready===true &&
        patternP!==null &&
        patternC!==null &&
        Number(pattern.neighbourCount||0)>=3;

      // Pattern overlaps current evidence through its signature, therefore
      // its blend weight is deliberately capped at 35%.
      const patternWeight=patternReady
        ? clamp((patternC/100)*0.35,0,0.35)
        : 0;

      const governorWeight=1-patternWeight;

      let probability=governorP*governorWeight;

      if(patternReady){
        probability+=patternP*patternWeight;
      }

      const crossSourceDisagreement=patternReady
        ? Math.abs(governorP-patternP)
        : null;

      const disagreementMultiplier=
        crossSourceDisagreement===null
          ? 1
          : crossSourceDisagreement>=35
            ? 0.45
            : crossSourceDisagreement>=25
              ? 0.62
              : crossSourceDisagreement>=15
                ? 0.82
                : 1;

      const patternSupportMultiplier=patternReady
        ? 0.90+0.10*clamp(patternC/100,0,1)
        : 0.78;

      const trajectoryEffect=trajectoryModifier(trajectory.trajectoryState);

      probability=clamp(
        probability+trajectoryEffect.probabilityShift,
        0,
        100
      );

      const smartMoney=smartMoneyConsistency(snapshot,probability);

      let confidence=
        governorC *
        patternSupportMultiplier *
        disagreementMultiplier *
        trajectoryEffect.confidenceMultiplier *
        dataQualityMultiplier(snapshot) *
        coordinationMultiplier(snapshot) *
        smartMoney.multiplier;

      const driftStatus=upper(snapshot?.shadowDriftRegime?.driftStatus);

      if(driftStatus==='DRIFT'){
        confidence*=0.25;
      }else if(driftStatus==='WATCH'){
        confidence*=0.65;
      }

      confidence=clamp(confidence,0,100);

      const blockers=[];
      const modifiers=[trajectoryEffect.reason,smartMoney.reason];

      if(!patternReady){
        modifiers.push('PATTERN_NOT_READY_CONFIDENCE_CAP');
      }

      if(crossSourceDisagreement!==null&&crossSourceDisagreement>=25){
        blockers.push('GOVERNOR_PATTERN_CONFLICT');
        conflicts++;
      }

      if(upper(trajectory.trajectoryState)==='CONFLICTED'){
        blockers.push('TRAJECTORY_CONFLICT');
      }

      if(
        upper(trajectory.trajectoryState)==='DRIFTED' ||
        driftStatus==='DRIFT'
      ){
        blockers.push('DRIFT');
      }

      if(snapshot?.specialists?.coordination?.suspectedCoordination===true){
        blockers.push('COORDINATION_RISK');
      }

      const direction=
        probability>=62
          ? 'POSITIVE'
          : probability<=38
            ? 'NEGATIVE'
            : 'NEUTRAL';

      const status=
        blockers.includes('DRIFT')
          ? 'SYNTHESIS_DRIFT_SUPPRESSED'
          : blockers.includes('GOVERNOR_PATTERN_CONFLICT') ||
            blockers.includes('TRAJECTORY_CONFLICT')
            ? 'SYNTHESIS_CONFLICT'
            : confidence>=70&&direction!=='NEUTRAL'
              ? 'SYNTHESIS_HIGH_CONVICTION'
              : confidence>=45
                ? 'SYNTHESIS_MODERATE'
                : 'SYNTHESIS_LOW_CONFIDENCE';

      const result={
        version:'MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        status,
        ready:true,
        direction,
        synthesisProbabilityPositivePct:round(probability,2),
        synthesisConfidencePct:round(confidence,2),
        governorProbabilityPositivePct:round(governorP,2),
        governorConfidencePct:round(governorC,2),
        patternProbabilityPositivePct:patternReady?round(patternP,2):null,
        patternConfidencePct:patternReady?round(patternC,2):0,
        patternWeightPct:round(patternWeight*100,2),
        governorWeightPct:round(governorWeight*100,2),
        crossSourceDisagreementPct:round(crossSourceDisagreement,2),
        trajectoryState:upper(trajectory.trajectoryState),
        driftStatus,
        smartMoneyConsistency:{
          available:smartMoney.available,
          probabilityPositivePct:round(smartMoney.probabilityPositivePct,2),
          confidencePct:round(smartMoney.confidencePct,2),
          deltaPct:round(smartMoney.deltaPct,2)
        },
        modifiers,
        blockers,
        mint:meta?.mint||snapshot?.mint||null,
        observedAt:Number(meta?.at||snapshot?.observedAt||Date.now())
      };

      predictions++;
      remember(result);
      return result;
    }catch{
      errors++;

      const failed={
        version:'MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        status:'SYNTHESIS_ERROR',
        ready:false,
        direction:'UNKNOWN',
        synthesisProbabilityPositivePct:null,
        synthesisConfidencePct:0,
        governorProbabilityPositivePct:null,
        governorConfidencePct:0,
        patternProbabilityPositivePct:null,
        patternConfidencePct:0,
        patternWeightPct:0,
        governorWeightPct:100,
        crossSourceDisagreementPct:null,
        trajectoryState:'UNKNOWN',
        modifiers:[],
        blockers:['SYNTHESIS_ERROR'],
        mint:meta?.mint||snapshot?.mint||null,
        observedAt:Date.now()
      };

      remember(failed);
      return failed;
    }
  }

  function listRecent({limit=50,status=null}={}){
    const safeLimit=Math.max(1,Math.min(200,Number(limit)||50));
    const wanted=status?upper(status):null;

    return recent
      .filter(row=>!wanted||row.status===wanted)
      .slice(0,safeLimit);
  }

  function status(){
    return {
      version:'MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      method:'GOVERNOR_PATTERN_SYNTHESIS_WITH_TEMPORAL_RISK_MODIFIERS',
      doubleCountingGuard:
        'MATH_BRAIN_ARENA_REGIME_SMART_MONEY_NOT_RECOUNTED_OUTSIDE_GOVERNOR',
      patternWeightCapPct:35,
      predictions,
      coldStarts,
      conflicts,
      errors,
      recentPredictions:recent.length
    };
  }

  return {predict,listRecent,status};
}

EOF_SYNTHESIS

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowEvidenceSynthesisV23_10
} from '../src/shadow-evidence-synthesis-v23_10.mjs';

function snapshot({
  governorP=72,
  governorC=75,
  governorReady=true,
  patternP=78,
  patternC=60,
  patternReady=true,
  neighbours=15,
  trajectory='RISING',
  drift='STABLE',
  completeness=100,
  smartMoney=74,
  smartMoneyConfidence=70,
  smartMoneyReady=true,
  coordination=false
}={}){
  return {
    mint:'T1',
    observedAt:1_801_100_000_000,
    evidence:{
      dataQuality:{
        completenessPct:completeness
      }
    },
    specialists:{
      coordination:{
        suspectedCoordination:coordination
      },
      smartMoneyMemory:{
        reputationReady:smartMoneyReady,
        weightedPositiveProbabilityPct:smartMoney,
        historicalConfidencePct:smartMoneyConfidence
      }
    },
    shadowDriftRegime:{
      driftStatus:drift
    },
    shadowConfidenceGovernor:{
      ready:governorReady,
      consensusProbabilityPositivePct:governorP,
      ensembleConfidencePct:governorC
    },
    shadowTokenTrajectory:{
      trajectoryState:trajectory
    },
    shadowTokenPattern:{
      ready:patternReady,
      neighbourCount:neighbours,
      patternProbabilityPositivePct:patternP,
      matchConfidencePct:patternC
    }
  };
}

const synthesis=createShadowEvidenceSynthesisV23_10();

const good=synthesis.predict(snapshot());

assert.equal(good.shadowOnly,true);
assert.equal(good.ready,true);
assert.equal(good.direction,'POSITIVE');
assert.ok(good.synthesisProbabilityPositivePct>70);
assert.ok(good.patternWeightPct<=35);
assert.equal(good.blockers.length,0);

const conflict=synthesis.predict(snapshot({
  governorP:82,
  patternP:30,
  patternC:80,
  trajectory:'STABLE'
}));

assert.equal(conflict.status,'SYNTHESIS_CONFLICT');
assert.ok(conflict.synthesisConfidencePct<good.synthesisConfidencePct);
assert.ok(conflict.blockers.includes('GOVERNOR_PATTERN_CONFLICT'));

const drifted=synthesis.predict(snapshot({
  trajectory:'DRIFTED',
  drift:'DRIFT'
}));

assert.equal(drifted.status,'SYNTHESIS_DRIFT_SUPPRESSED');
assert.ok(drifted.synthesisConfidencePct<good.synthesisConfidencePct);

const noPattern=synthesis.predict(snapshot({
  patternReady:false,
  neighbours:0
}));

assert.equal(noPattern.ready,true);
assert.equal(noPattern.patternWeightPct,0);
assert.ok(noPattern.modifiers.includes('PATTERN_NOT_READY_CONFIDENCE_CAP'));

const cold=synthesis.predict(snapshot({
  governorReady:false
}));

assert.equal(cold.ready,false);
assert.equal(cold.status,'SYNTHESIS_COLD_START');

assert.equal(typeof synthesis.buy,'undefined');
assert.equal(typeof synthesis.sell,'undefined');
assert.equal(typeof synthesis.execute,'undefined');

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
  /createShadowEvidenceSynthesisV23_10/
);

assert.match(
  shadow,
  /shadowEvidenceSynthesis\.predict/
);

assert.match(
  shadow,
  /shadowEvidenceSynthesis:shadowEvidenceSynthesis\.status\(\)/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/evidence-synthesis/
);

assert.match(
  app,
  /listEvidenceSynthesisPredictions/
);

const source=fs.readFileSync(
  'src/shadow-evidence-synthesis-v23_10.mjs',
  'utf8'
);

assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/setSettings\s*\(/);
assert.doesNotMatch(source,/tradeEligible/);
assert.doesNotMatch(source,/decisionScore/);
assert.doesNotMatch(source,/synthesisScore/);

console.log('shadow evidence synthesis v23.10 ok');

EOF_TEST

python3 - <<'PY'
from pathlib import Path

for name in [
    "memeflow-app/src/shadow-evidence-synthesis-v23_10.mjs",
    "memeflow-app/tests/shadow-evidence-synthesis-v23_10.mjs"
]:
    p=Path(name)

    p.write_text(
        p.read_text(
            encoding="utf-8"
        ).rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_10_EOF_NORMALIZATION_OK")
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
            f"V23.10 REFUSED: {label}: expected 1 exact match, got {n}"
        )
    return text.replace(old,new,1)

old="""import {
  createShadowTokenPatternMemoryV23_9
} from './shadow-token-pattern-memory-v23_9.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowEvidenceSynthesisV23_10
} from './shadow-evidence-synthesis-v23_10.mjs';""",
    "synthesis import"
)

old="""  const shadowTokenPatternMemory=
    createShadowTokenPatternMemoryV23_9({
      dataDir
    });"""

s=once(
    s,
    old,
    old+"""

  const shadowEvidenceSynthesis=
    createShadowEvidenceSynthesisV23_10();""",
    "synthesis construction"
)

old="""      snapshot.shadowTokenPattern=
        shadowTokenPatternMemory.predict(
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
      // MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10
      // Brain-over-agents diagnostic only. Computed last so it can see
      // Governor + Trajectory + Pattern without modifying evaluate()/V22.
      snapshot.shadowEvidenceSynthesis=
        shadowEvidenceSynthesis.predict(
          snapshot,
          {
            mint,
            at:snapshot.observedAt
          }
        );
""",
    "synthesis prediction"
)

old="""          shadowTokenPattern:{
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
              snap?.shadowTokenPattern?.meanSimilarityPct??0,
            nearestSimilarityPct:
              snap?.shadowTokenPattern?.nearestSimilarityPct??null
          },
"""

s=once(
    s,
    old,
    old+"""          shadowEvidenceSynthesis:{
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
""",
    "synthesis list summary"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_9'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_10'",
    "network version"
)

old="""      shadowTokenTrajectory:shadowTokenTrajectory.status(),
      shadowTokenPatternMemory:shadowTokenPatternMemory.status()
"""

s=once(
    s,
    old,
    """      shadowTokenTrajectory:shadowTokenTrajectory.status(),
      shadowTokenPatternMemory:shadowTokenPatternMemory.status(),
      shadowEvidenceSynthesis:shadowEvidenceSynthesis.status()
""",
    "synthesis status"
)

old="""    flushTokenPatternMemory:
      ()=>shadowTokenPatternMemory.flush(),
    status
"""

s=once(
    s,
    old,
    """    flushTokenPatternMemory:
      ()=>shadowTokenPatternMemory.flush(),
    evidenceSynthesisStatus:
      ()=>shadowEvidenceSynthesis.status(),
    listEvidenceSynthesisPredictions:
      options=>shadowEvidenceSynthesis.listRecent(options),
    status
""",
    "synthesis API"
)

sp.write_text(
    s,
    encoding="utf-8"
)

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_EVIDENCE_SYNTHESIS_MONITOR_V23_10
 * Owner-only, read-only brain-over-agents diagnostics.
 */
 if(
   url.pathname==='/api/owner/intelligence/evidence-synthesis' &&
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

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     synthesis:
       tokenIntelligenceShadowV23
         .evidenceSynthesisStatus(),
     predictions:
       tokenIntelligenceShadowV23
         .listEvidenceSynthesisPredictions({
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
    "synthesis owner route"
)

ap.write_text(
    a,
    encoding="utf-8"
)

print("V23_10_TRANSFORM_OK")

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

needle="node tests/shadow-token-pattern-memory-v23_9.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-token-pattern-memory-v23_9.mjs && node tests/shadow-evidence-synthesis-v23_10.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.10 REFUSED: package test anchor changed"
    )

if "shadow-evidence-synthesis-v23_10.mjs" in s:
    raise SystemExit(
        "V23.10 REFUSED: synthesis test already installed"
    )

d["scripts"]["test:core"] = s.replace(
    needle,
    replacement,
    1
)

p.write_text(
    json.dumps(
        d,
        indent=2
    )+"\n",
    encoding="utf-8"
)

print("PACKAGE_TRANSFORM_OK")

PY

echo
echo "=== V23.10 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$SYNTHESIS"
node --check "$TEST"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.10 TARGETED TESTS ==="

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
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.10 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.10 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
    "memeflow-app/src/shadow-evidence-synthesis-v23_10.mjs"
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
    "MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10",
    "SYNTHESIS_COLD_START",
    "SYNTHESIS_CONFLICT",
    "SYNTHESIS_DRIFT_SUPPRESSED",
    "SYNTHESIS_HIGH_CONVICTION",
    "patternWeightCapPct:35",
    "MATH_BRAIN_ARENA_REGIME_SMART_MONEY_NOT_RECOUNTED_OUTSIDE_GOVERNOR"
]:
    if marker not in m:
        errors.append("synthesis marker missing: "+marker)

for forbidden in [
    "from './evaluate.mjs'",
    'from "./evaluate.mjs"',
    "openPosition(",
    "closePosition(",
    "setSettings(",
    "tradeEligible",
    "decisionScore",
    "synthesisScore"
]:
    if forbidden in m:
        errors.append("forbidden authority: "+forbidden)

for marker in [
    "createShadowEvidenceSynthesisV23_10",
    "shadowEvidenceSynthesis.predict",
    "shadowEvidenceSynthesis:shadowEvidenceSynthesis.status()",
    "evidenceSynthesisStatus",
    "listEvidenceSynthesisPredictions",
    "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_10"
]:
    if marker not in s:
        errors.append("wiring missing: "+marker)

pos=s.find(
    "snapshot.shadowEvidenceSynthesis="
)

for marker in [
    "snapshot.shadowConfidenceGovernor=",
    "snapshot.shadowTokenTrajectory=",
    "snapshot.shadowTokenPattern="
]:
    q=s.find(marker)

    if q<0 or pos<0 or q>=pos:
        errors.append("ordering invalid: "+marker)

for marker in [
    "/api/owner/intelligence/evidence-synthesis",
    "MEMEFLOW_EVIDENCE_SYNTHESIS_MONITOR_V23_10",
    "listEvidenceSynthesisPredictions"
]:
    if marker not in a:
        errors.append("monitor missing: "+marker)

if "shadow-evidence-synthesis-v23_10.mjs" not in pkg:
    errors.append("V23.10 test missing from package")

for marker in [
    "shadowMathBrain.predict",
    "shadowModelArena.predict",
    "shadowDriftRegime.predict",
    "shadowConfidenceGovernor.predict",
    "shadowTokenTrajectory.observe",
    "shadowTokenPatternMemory.predict"
]:
    if marker not in s:
        errors.append("backward compatibility missing: "+marker)

if errors:
    raise SystemExit(
        "V23_10_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_10_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.10 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/shadow-evidence-synthesis-v23_10\.mjs|tests/shadow-evidence-synthesis-v23_10\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.10 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.10 STAGED ==="

git diff --cached --stat

git commit -m "feat: add shadow evidence synthesis brain v23.10"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.10 CONTRACT:"
echo "  V22 evaluate remains the only trading authority"
echo "  Governor is current-model consensus; Brain/Arena/Regime/Smart Money are not double-counted"
echo "  Pattern Memory contributes at most 35% because its features overlap current evidence"
echo "  Trajectory modifies confidence/direction, never execution"
echo "  disagreement, drift, low data quality, coordination and Smart Money conflict reduce confidence"
echo "  output is probability + confidence + direction + blockers, never a second MEMEFLOW Score"
echo "  no Score/State/BUY/SELL mutation"
