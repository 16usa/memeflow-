#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

APP="memeflow-app/app-server.mjs"
TEST="memeflow-app/tests/canonical-score-state-v20_7.mjs"

[[ -f "$APP" ]] || { echo "ERROR: missing $APP"; exit 1; }

echo "=== MEMEFLOW CANONICAL SCORE/STATE V20.7 ==="

python3 - <<'PY'
from pathlib import Path

app=Path("memeflow-app/app-server.mjs").read_text(encoding="utf-8")

required=[
  "MEMEFLOW_FINAL_ACTIVITY_GATE_V20_2",
  "function __mfLiveDecisionForUserV14(",
  "function __mfLiveDisplayStateV28(view,settings={}){",
  "const __v20truth=__mfCurrentEntryTruthV20_2(token,{isOpen});",
]

for marker in required:
  if marker not in app:
    raise SystemExit("V20.7 REFUSED: current marker missing: "+marker)

if "MEMEFLOW_CANONICAL_SCORE_STATE_V20_7" in app:
  raise SystemExit("V20.7 REFUSED: patch already installed")

print("CURRENT_ARCHITECTURE_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/canonical-score-state-v20_7-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"
cp "$APP" "$BACKUP/$APP"

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== FAILED — RESTORING ==="
    cp "$BACKUP/$APP" "$APP" || true
    rm -f "$TEST"
    git reset -- "$APP" "$TEST" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

python3 - <<'PY'
from pathlib import Path

APP=Path("memeflow-app/app-server.mjs")
app=APP.read_text(encoding="utf-8")

# ------------------------------------------------------------------
# 1) Safety gate: WAITING must NOT erase the evaluator's AI score/conf.
# ------------------------------------------------------------------
old = """  if(!isOpen&&__v20truth.pass!==true){
    const reason=__v20truth.reason||'Fresh live market evidence is unavailable';
    decision={
      ...(decision||{}),
      state:'WAITING',
      displayState:'WAITING',
      score:0,
      confidence:0,
      primaryReason:reason,
      reasons:[reason],
      terminal:false,
      liveTruthBlocked:true
    };
  }
"""

new = """  // MEMEFLOW_CANONICAL_SCORE_STATE_V20_7
  // Live eligibility may force WAITING, but it must never destroy the
  // evaluator's AI score/confidence. Score describes token quality;
  // liveTruthBlocked/tradeEligible describe execution readiness.
  if(!isOpen&&__v20truth.pass!==true){
    const reason=__v20truth.reason||'Fresh live market evidence is unavailable';

    const priorReasons=Array.isArray(decision?.reasons)
      ? decision.reasons.filter(Boolean)
      : [];

    const reasons=[
      ...priorReasons,
      ...(priorReasons.includes(reason)?[]:[reason])
    ];

    decision={
      ...(decision||{}),
      state:'WAITING',
      displayState:'WAITING',
      primaryReason:
        decision?.primaryReason||
        reason,
      reasons,
      terminal:false,
      liveTruthBlocked:true,
      liveTruthReason:reason
    };
  }
"""

if old not in app:
  raise SystemExit("V20.7 REFUSED: score-zeroing live gate block not found")
app=app.replace(old,new,1)

# ------------------------------------------------------------------
# 2) Delete the display-only WAITING -> WATCH state override.
#    Keep function name for compatibility with existing callers.
# ------------------------------------------------------------------
start=app.find("function __mfLiveDisplayStateV28(view,settings={}){")
end=app.find("function __mfRankLiveDisplayV28(view,settings={}){",start)

if start<0 or end<=start:
  raise SystemExit("V20.7 REFUSED: V28 display classifier boundaries not found")

block=app[start:end]

for marker in (
  "state!=='WAITING'",
  "relevanceScore",
  "feedScore",
  "state:'WATCH'",
  "watchPendingAdmission:true"
):
  if marker not in block:
    raise SystemExit("V20.7 REFUSED: V28 classifier shape changed: "+marker)

replacement = """function __mfLiveDisplayStateV28(view,settings={}){
  // MEMEFLOW_CANONICAL_SCORE_STATE_V20_7
  // Deleted: display-only WAITING -> WATCH mutation.
  //
  // relevanceScore/feedScore remain ranking/sorting signals only.
  // The visible state must be the canonical decision state.
  void settings;
  return view;
}

"""

app=app[:start]+replacement+app[end:]

APP.write_text(app,encoding="utf-8")
print("V20_7_TRANSFORM_OK")
PY

cat > "$TEST" <<'TESTJS'
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

assert.match(app,/MEMEFLOW_CANONICAL_SCORE_STATE_V20_7/);

// The live safety gate may force WAITING but must not zero the evaluator score.
const ds=app.indexOf('const __v20truth=__mfCurrentEntryTruthV20_2');
const de=app.indexOf('function __mfLiveCardViewV14(',ds);
assert.ok(ds>=0&&de>ds);

const decisionBlock=app.slice(ds,de);

assert.match(decisionBlock,/state:'WAITING'/);
assert.match(decisionBlock,/liveTruthBlocked:true/);
assert.match(decisionBlock,/liveTruthReason:reason/);
assert.doesNotMatch(decisionBlock,/score:0/);
assert.doesNotMatch(decisionBlock,/confidence:0/);

// V28 must no longer convert canonical WAITING into a display-only WATCH.
const ws=app.indexOf('function __mfLiveDisplayStateV28(view,settings={}){');
const we=app.indexOf('function __mfRankLiveDisplayV28(view,settings={}){',ws);
assert.ok(ws>=0&&we>ws);

const watchBlock=app.slice(ws,we);

assert.match(watchBlock,/return view;/);
// Comments may mention the deleted ranking fields; executable reads may not.
assert.doesNotMatch(watchBlock,/state:'WATCH'/);
assert.doesNotMatch(watchBlock,/watchPendingAdmission:true/);
assert.doesNotMatch(watchBlock,/view\?\.relevanceScore|view\.relevanceScore/);
assert.doesNotMatch(watchBlock,/view\?\.feedScore|view\.feedScore/);

console.log('CANONICAL_SCORE_STATE_V20_7_OK');
TESTJS

echo "=== VALIDATE V20.7 ==="

node --check "$APP"
node --check "$TEST"

(
  cd memeflow-app
  node tests/canonical-score-state-v20_7.mjs
  [[ -f tests/live-truth-no-dynamic-cache-v20_3.mjs ]] && node tests/live-truth-no-dynamic-cache-v20_3.mjs
  [[ -f tests/settings-gate.mjs ]] && node tests/settings-gate.mjs
  [[ -f tests/opportunity-engine.mjs ]] && node tests/opportunity-engine.mjs
)

git diff --check -- "$APP" "$TEST"

echo "VALIDATION_OK"

git reset >/dev/null
git add "$APP" "$TEST"

BAD="$(
  git diff --cached --name-only |
  grep -Ev '^memeflow-app/(app-server\.mjs|tests/canonical-score-state-v20_7\.mjs)$' ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo "=== STAGED ==="
git diff --cached --stat

git commit -m "fix: preserve canonical AI score and remove display watch override"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
