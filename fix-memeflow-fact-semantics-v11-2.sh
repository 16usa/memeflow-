#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"
MANUAL="memeflow-app/src/manual-scan.mjs"

echo "=== MEMEFLOW V11.2 finalize validated patch ==="

# V11.1 already edited these three files and passed syntax/regression tests.
# Do NOT restore them. Just verify the expected markers are still present.
python3 - <<'PY'
from pathlib import Path

checks = {
    "memeflow-app/app-server.mjs": [
        "MEMEFLOW_FACT_SEMANTICS_V11_1",
        "mf49PumpReference",
        "referenceHolderCount"
    ],
    "memeflow-app/system-tokens.js": [
        "MEMEFLOW_MANUAL_DECISION_EVIDENCE_V11_1",
        "__mfScanLiveEvidenceReadyV11"
    ],
    "memeflow-app/src/manual-scan.mjs": [
        "creatorResolution.curve ? 'pump' : null"
    ]
}

for file, needles in checks.items():
    text = Path(file).read_text()
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"ERROR: expected V11.1 change missing: {needle} in {file}")

print("V11_1_PATCH_PRESENT_OK")
PY

echo
echo "=== Syntax verification ==="
node --check "$APP"
node --check "$UI"
node --check "$MANUAL"
echo "SYNTAX_OK"

echo
echo "=== Regression verification ==="
(
  cd memeflow-app
  node tests/settings-gate.mjs
  node tests/opportunity-engine.mjs
)
echo "REGRESSION_TESTS_OK"

echo
echo "=== UNKNOWN != ZERO verification ==="
node --input-type=module <<'NODE'
import {evaluateSettingsGate} from './memeflow-app/src/settings-gate.mjs';

const gate=evaluateSettingsGate(
  {
    mint:'UnknownFacts',
    launchPlatform:'pump',
    buyPressure:null,
    liquidityUsd:null,
    holderCount:null
  },
  {
    minBuyPressure:1.5,
    minLiquidityUsd:1000,
    minHolders:10
  }
);

if(gate.state!=='WAITING'){
  throw new Error(`UNKNOWN facts became ${gate.state}`);
}
if((gate.failedGates||[]).length){
  throw new Error('UNKNOWN facts created FAIL gates');
}

console.log('UNKNOWN_NOT_ZERO_OK');
NODE

echo
echo "=== Stage ONLY intended source files ==="
git reset
git add "$APP" "$UI" "$MANUAL"

echo
echo "=== Staged scope verification ==="
ALLOWED='^(memeflow-app/app-server\.mjs|memeflow-app/system-tokens\.js|memeflow-app/src/manual-scan\.mjs)$'
BAD="$(
  git diff --cached --name-only | grep -Ev "$ALLOWED" || true
)"

if [ -n "$BAD" ]; then
  echo "ERROR: unrelated files accidentally staged:"
  echo "$BAD"
  git reset
  echo "Nothing committed."
  exit 1
fi

COUNT="$(git diff --cached --name-only | wc -l | tr -d ' ')"
if [ "$COUNT" -ne 3 ]; then
  echo "ERROR: expected exactly 3 staged source files, got $COUNT"
  git diff --cached --name-status
  git reset
  echo "Nothing committed."
  exit 1
fi

echo "STAGED_SCOPE_OK"

echo
echo "=== Runtime dirty files intentionally ignored ==="
git status --short -- \
  memeflow-app/data/platform-trade-analytics-v2.sqlite-shm \
  memeflow-app/data/platform-trade-analytics-v2.sqlite-wal \
  memeflow-app/data/state.json \
  memeflow-app/data/state.json.bak || true

echo
echo "=== Staged diff summary ==="
git diff --cached --stat

git commit -m "fix: preserve unknown facts in manual token analysis"
git push origin HEAD

echo
echo "DONE"
git log -1 --oneline
