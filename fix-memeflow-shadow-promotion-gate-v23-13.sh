#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside MEMEFLOW repo"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="3f4cbdad4f013fd3badb33c2b9f591dd1606eaf2"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
GATE="memeflow-app/src/shadow-promotion-gate-v23_13.mjs"
TEST="memeflow-app/tests/shadow-promotion-gate-v23_13.mjs"
MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$GATE" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW PROMOTION GATE V23.13 ==="

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
            active="$proc:$comm:$cwd"; break
          fi
        ;;
      esac
    done
    [[ -z "$active" ]] || { echo "V23.13 REFUSED: active git process"; echo "$active"; exit 1; }
    rm -f .git/index.lock
  fi
}
clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || { echo "V23.13 REFUSED: wrong branch"; exit 1; }
[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.13 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "V23.13 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V23.13 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V23.13 REFUSED: staged changes in $f"; exit 1; }
done
for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || { echo "V23.13 REFUSED: $f already exists"; exit 1; }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-promotion-gate-v23-13-$STAMP"
mkdir -p "$BACKUP"
for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo; echo "=== V23.13 FAILED - RESTORING ==="
    for f in "${MODIFIED[@]}"; do [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true; done
    for f in "${NEW_FILES[@]}"; do rm -f "$f"; done
    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

cat > "$GATE" <<'EOF_GATE'
// MEMEFLOW_SHADOW_PROMOTION_GATE_V23_13
// SHADOW ONLY. Manual review readiness only. Never promotes or trades.

const num=v=>{
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};
const up=v=>String(v||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';
const check=(name,pass,actual,required)=>({
  name,
  pass:pass===true,
  actual:actual??null,
  required
});

export function createShadowPromotionGateV23_13({
  championBenchmark=null,
  outcomeCalibration=null,
  driftRegime=null
}={}){
  let evaluations=0;
  let errors=0;

  function evaluate(){
    try{
      const bs=championBenchmark?.status?.()||{};
      const target=bs?.target||{};
      const verdict=up(target?.verdict?.status);

      const cs=outcomeCalibration?.status?.()||{};
      const calibrationStatus=up(cs?.targetStatus);
      const ece=num(cs?.targetEcePct);

      const ds=driftRegime?.status?.()||{};
      const driftStatus=up(ds?.drift?.status);

      const paired=Number(target?.pairedRows||0);
      const positive=Number(target?.positive||0);
      const negative=Number(target?.negative||0);
      const brier=num(target?.delta?.brier);
      const logLoss=num(target?.delta?.logLoss);
      const accuracy=num(target?.delta?.accuracyPct);

      const checks=[
        check('PAIRED_5M_SAMPLE',paired>=100,paired,'>=100'),
        check('POSITIVE_COVERAGE',positive>=20,positive,'>=20'),
        check('NEGATIVE_COVERAGE',negative>=20,negative,'>=20'),
        check(
          'V23_12_VERDICT',
          verdict==='V23_CHALLENGER_WINS',
          verdict,
          'V23_CHALLENGER_WINS'
        ),
        check(
          'BRIER_IMPROVEMENT',
          brier!==null&&brier>=0.0075,
          brier,
          '>=0.0075'
        ),
        check(
          'LOG_LOSS_IMPROVEMENT',
          logLoss!==null&&logLoss>=0.015,
          logLoss,
          '>=0.015'
        ),
        check(
          'ACCURACY_NON_REGRESSION',
          accuracy!==null&&accuracy>=-1,
          accuracy,
          '>=-1 pct'
        ),
        check(
          'CALIBRATION_HEALTH',
          calibrationStatus==='CALIBRATION_HEALTHY',
          calibrationStatus,
          'CALIBRATION_HEALTHY'
        ),
        check(
          'CALIBRATION_ECE',
          ece!==null&&ece<=10,
          ece,
          '<=10%'
        ),
        check(
          'DRIFT_HEALTH',
          !['DRIFT','ERROR'].includes(driftStatus),
          driftStatus,
          'not DRIFT/ERROR'
        )
      ];

      const failed=checks.filter(x=>!x.pass);
      const hardBlocked=
        ['DRIFT','ERROR'].includes(driftStatus) ||
        calibrationStatus==='CALIBRATION_MISALIGNED';

      let status='PROMOTION_LOCKED';
      let candidateForManualReview=false;

      if(hardBlocked){
        status='PROMOTION_BLOCKED';
      }else if(failed.length===0){
        status='PROMOTION_CANDIDATE';
        candidateForManualReview=true;
      }else if(paired<100){
        status='PROMOTION_EVIDENCE_BUILDING';
      }else if(verdict==='V23_CHALLENGER_WINS'){
        status='PROMOTION_PROBATION';
      }

      evaluations++;

      return {
        version:'MEMEFLOW_SHADOW_PROMOTION_GATE_V23_13',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        automaticPromotion:false,
        candidateForManualReview,
        status,
        targetHorizonMs:300_000,
        benchmark:{
          verdict,
          pairedRows:paired,
          positive,
          negative,
          brierDelta:brier,
          logLossDelta:logLoss,
          accuracyDeltaPct:accuracy
        },
        calibration:{
          status:calibrationStatus,
          ecePct:ece,
          brier:num(cs?.targetBrier),
          logLoss:num(cs?.targetLogLoss)
        },
        drift:{
          status:driftStatus,
          ready:ds?.drift?.ready===true
        },
        checks,
        failedChecks:failed.map(x=>x.name)
      };
    }catch{
      errors++;
      return {
        version:'MEMEFLOW_SHADOW_PROMOTION_GATE_V23_13',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        automaticPromotion:false,
        candidateForManualReview:false,
        status:'PROMOTION_GATE_ERROR',
        targetHorizonMs:300_000,
        checks:[],
        failedChecks:['PROMOTION_GATE_ERROR']
      };
    }
  }

  function status(){
    return {
      ...evaluate(),
      evaluations,
      errors,
      policy:{
        minPaired5mRows:100,
        minPositive5m:20,
        minNegative5m:20,
        minBrierImprovement:0.0075,
        minLogLossImprovement:0.015,
        minAccuracyDeltaPct:-1,
        requiredCalibrationStatus:'CALIBRATION_HEALTHY',
        maxCalibrationEcePct:10,
        forbiddenDriftStatuses:['DRIFT','ERROR'],
        manualReviewRequired:true
      }
    };
  }

  return {evaluate,status};
}

EOF_GATE
cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createShadowPromotionGateV23_13}
from '../src/shadow-promotion-gate-v23_13.mjs';

function providers(o={}){
  const x={
    pairedRows:120,positive:60,negative:60,
    verdict:'V23_CHALLENGER_WINS',
    brier:0.02,logLoss:0.04,accuracy:4,
    calibration:'CALIBRATION_HEALTHY',ece:5,drift:'STABLE',
    ...o
  };

  return {
    championBenchmark:{status:()=>({target:{
      pairedRows:x.pairedRows,
      positive:x.positive,
      negative:x.negative,
      delta:{brier:x.brier,logLoss:x.logLoss,accuracyPct:x.accuracy},
      verdict:{status:x.verdict}
    }})},
    outcomeCalibration:{status:()=>({
      targetStatus:x.calibration,
      targetEcePct:x.ece,
      targetBrier:0.12,
      targetLogLoss:0.35
    })},
    driftRegime:{status:()=>({drift:{status:x.drift,ready:true}})}
  };
}

let gate=createShadowPromotionGateV23_13(providers());
let r=gate.evaluate();
assert.equal(r.status,'PROMOTION_CANDIDATE');
assert.equal(r.candidateForManualReview,true);
assert.equal(r.automaticPromotion,false);
assert.equal(r.failedChecks.length,0);

gate=createShadowPromotionGateV23_13(providers({pairedRows:70}));
r=gate.evaluate();
assert.equal(r.status,'PROMOTION_EVIDENCE_BUILDING');
assert.equal(r.candidateForManualReview,false);

gate=createShadowPromotionGateV23_13(
  providers({calibration:'CALIBRATION_MISALIGNED',ece:18})
);
r=gate.evaluate();
assert.equal(r.status,'PROMOTION_BLOCKED');

gate=createShadowPromotionGateV23_13(providers({drift:'DRIFT'}));
r=gate.evaluate();
assert.equal(r.status,'PROMOTION_BLOCKED');
assert.ok(r.failedChecks.includes('DRIFT_HEALTH'));

gate=createShadowPromotionGateV23_13(
  providers({brier:0.004,logLoss:0.009})
);
r=gate.evaluate();
assert.equal(r.status,'PROMOTION_PROBATION');

const source=fs.readFileSync(
  'src/shadow-promotion-gate-v23_13.mjs','utf8'
);
assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/setSettings\s*\(/);
assert.doesNotMatch(source,/tradeEligible/);
assert.doesNotMatch(source,/decisionScore/);

const shadow=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs','utf8'
);
const app=fs.readFileSync('app-server.mjs','utf8');

assert.match(shadow,/createShadowPromotionGateV23_13/);
assert.match(shadow,/shadowPromotionGate:shadowPromotionGate\.status\(\)/);
assert.match(shadow,/promotionGateStatus/);
assert.match(app,/\/api\/owner\/intelligence\/promotion-gate/);

console.log('shadow promotion gate v23.13 ok');

EOF_TEST

python3 - <<'PY'
from pathlib import Path
sp=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
ap=Path("memeflow-app/app-server.mjs")
s=sp.read_text(encoding="utf-8")
a=ap.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f"V23.13 REFUSED: {label}: expected 1 match, got {n}")
    return text.replace(old,new,1)

old="""import {
  createShadowChampionBenchmarkV23_12
} from './shadow-champion-benchmark-v23_12.mjs';"""
s=once(s,old,old+"""
import {
  createShadowPromotionGateV23_13
} from './shadow-promotion-gate-v23_13.mjs';""","import")

old="""  const shadowChampionBenchmark=
    createShadowChampionBenchmarkV23_12({
      dataDir
    });"""
s=once(s,old,old+"""

  const shadowPromotionGate=
    createShadowPromotionGateV23_13({
      championBenchmark:shadowChampionBenchmark,
      outcomeCalibration:shadowOutcomeCalibration,
      driftRegime:shadowDriftRegime
    });""","construction")

s=once(
  s,
  "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_12'",
  "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_13'",
  "network version"
)

old="""      shadowOutcomeCalibration:shadowOutcomeCalibration.status(),
      shadowChampionBenchmark:shadowChampionBenchmark.status()
"""
s=once(s,old,"""      shadowOutcomeCalibration:shadowOutcomeCalibration.status(),
      shadowChampionBenchmark:shadowChampionBenchmark.status(),
      shadowPromotionGate:shadowPromotionGate.status()
""","status")

old="""    flushChampionBenchmark:
      ()=>shadowChampionBenchmark.flush(),
    status
"""
s=once(s,old,"""    flushChampionBenchmark:
      ()=>shadowChampionBenchmark.flush(),
    promotionGateStatus:
      ()=>shadowPromotionGate.status(),
    status
""","api")

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""
route=r"""/* MEMEFLOW_SHADOW_PROMOTION_GATE_MONITOR_V23_13
 * Owner-only, read-only manual-promotion readiness diagnostics.
 */
 if(
   url.pathname==='/api/owner/intelligence/promotion-gate' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     automaticPromotion:false,
     gate:
       tokenIntelligenceShadowV23
         .promotionGateStatus()
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""
a=once(a,anchor,route,"owner route")
ap.write_text(a,encoding="utf-8")
print("V23_13_TRANSFORM_OK")

PY
python3 - <<'PY'
import json
from pathlib import Path
p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]
needle="node tests/shadow-champion-benchmark-v23_12.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-champion-benchmark-v23_12.mjs && node tests/shadow-promotion-gate-v23_13.mjs && node tests/assist-fresh-decision-v22.mjs"
if s.count(needle)!=1:
    raise SystemExit("V23.13 REFUSED: package test anchor changed")
if "shadow-promotion-gate-v23_13.mjs" in s:
    raise SystemExit("V23.13 REFUSED: gate test already installed")
d["scripts"]["test:core"]=s.replace(needle,replacement,1)
p.write_text(json.dumps(d,indent=2)+"\n",encoding="utf-8")
print("PACKAGE_TRANSFORM_OK")

PY

node --check "$APP"
node --check "$SHADOW"
node --check "$GATE"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

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
 node tests/lifecycle-decision-v22.mjs
 node tests/assist-fresh-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

(cd memeflow-app && npm test)
echo "FULL_TEST_SUITE_OK"

python3 - <<'PY'
from pathlib import Path
m=Path("memeflow-app/src/shadow-promotion-gate-v23_13.mjs").read_text()
s=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs").read_text()
a=Path("memeflow-app/app-server.mjs").read_text()
p=Path("memeflow-app/package.json").read_text()

errors=[]
for x in [
 "MEMEFLOW_SHADOW_PROMOTION_GATE_V23_13",
 "PROMOTION_CANDIDATE","PROMOTION_BLOCKED",
 "PROMOTION_EVIDENCE_BUILDING","PROMOTION_PROBATION",
 "automaticPromotion:false","candidateForManualReview",
 "minPaired5mRows:100","minBrierImprovement:0.0075",
 "minLogLossImprovement:0.015","maxCalibrationEcePct:10"
]:
    if x not in m: errors.append("gate marker missing: "+x)

for x in [
 "from './evaluate.mjs'","openPosition(","closePosition(",
 "setSettings(","tradeEligible","decisionScore"
]:
    if x in m: errors.append("forbidden authority: "+x)

for x in [
 "createShadowPromotionGateV23_13",
 "shadowPromotionGate:shadowPromotionGate.status()",
 "promotionGateStatus",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_13"
]:
    if x not in s: errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/promotion-gate",
 "MEMEFLOW_SHADOW_PROMOTION_GATE_MONITOR_V23_13",
 "automaticPromotion:false"
]:
    if x not in a: errors.append("monitor missing: "+x)

if "shadow-promotion-gate-v23_13.mjs" not in p:
    errors.append("test missing from package")

for x in [
 "shadowMathBrain.predict","shadowModelArena.predict",
 "shadowDriftRegime.predict","shadowConfidenceGovernor.predict",
 "shadowTokenTrajectory.observe","shadowTokenPatternMemory.predict",
 "shadowEvidenceSynthesis.predict","shadowOutcomeCalibration.predict",
 "shadowChampionBenchmark.recordOutcome"
]:
    if x not in s: errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit("V23_13_CONTRACT_FAILED:\n- "+"\n- ".join(errors))
print("V23_13_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"
echo "=== V23.13 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/shadow-promotion-gate-v23_13\.mjs|tests/shadow-promotion-gate-v23_13\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"
[[ -z "$BAD" ]] || { echo "V23.13 REFUSED: unrelated staged files:"; echo "$BAD"; git reset; exit 1; }

git diff --cached --check
git commit -m "feat: add shadow promotion readiness gate v23.13"
git push origin HEAD
trap - EXIT INT TERM

echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline --decorate
echo "V23.13 CONTRACT:"
echo "  V22 remains the only trading authority"
echo "  automaticPromotion is always false"
echo "  candidate requires >=100 paired 5m outcomes, >=20 positive, >=20 negative"
echo "  V23.12 must already say V23_CHALLENGER_WINS"
echo "  stricter Brier/log-loss gate + healthy calibration + ECE <=10%"
echo "  DRIFT or calibration misalignment blocks readiness"
echo "  no Score/State/BUY/SELL mutation"
