#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW V6 exact resume fix =="

if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "src" && -d "tests" ]]; then
  :
else
  echo "ERROR: Run from ~/workspace or memeflow-app."
  exit 1
fi

if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
  echo "ERROR: Current branch is not main."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

app_path=Path("app-server.mjs")
app=app_path.read_text()

# This script resumes the local, partially-applied V4/V5 state.
if "MEMEFLOW_CARD_MARKET_TRUTH_V5" not in app:
    raise SystemExit(
        "ERROR: Local V4/V5 market-truth changes were not found. "
        "Do not run this resume patch on another state."
    )

# IMPORTANT:
# The previous V5 incorrectly tested for the substring
# MEMEFLOW_REALTIME_UI_FAIRNESS_V1. The route contains
# MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE, so that false-positive prevented the
# missing helper block from being restored.
#
# Check the ACTUAL constant instead.
if "const __mfLiveStatesResponseCacheMs=" not in app:
    anchor="function candidateView(d){"
    if anchor not in app:
        raise SystemExit("PATCH FAILED: candidateView anchor not found")

    block=r"""// MEMEFLOW_REALTIME_UI_FAIRNESS_V1
// Building a large Live Token States response must yield to the Pump WS path.
const __mfLiveStatesYieldEvery=Math.max(
  20,
  Number(process.env.LIVE_STATES_YIELD_EVERY||75)
);
const __mfLiveStatesResponseCacheMs=Math.max(
  100,
  Number(process.env.LIVE_STATES_RESPONSE_CACHE_MS||350)
);
const __mfLiveStatesResponseCache=new Map();
const __mfYieldToEventLoop=()=>new Promise(resolve=>setImmediate(resolve));

"""

    app=app.replace(anchor,block+anchor,1)
    app_path.write_text(app)
    print("RESTORED: __mfLiveStatesResponseCacheMs + realtime helpers")
else:
    print("OK: realtime helper constants already exist")

# Make sure the route still references the restored helpers.
app=app_path.read_text()
required=[
    "__mfLiveStatesResponseCacheMs",
    "__mfLiveStatesResponseCache",
    "__mfYieldToEventLoop",
    "LIVE_STATES_RESPONSE_CACHE_MS"
]
for x in required:
    if x not in app:
        raise SystemExit(f"PATCH FAILED: missing realtime symbol {x}")

# Update stale regression from the pre-reference-merge behavior.
test_path=Path("tests/realtime-update-path.mjs")
test=test_path.read_text()

old=r"""assert.match(app,/if\(current\?\.wsFirst===true\)return/);
assert.match(app,/__mfQueueHistoryEvaluation\(hot\)/);
assert.match(app,/HISTORY_EVAL_INTERVAL_MS/);
"""
new=r"""assert.match(app,/if\(current\?\.wsFirst===true\)\{/);
assert.match(app,/pumpReportedMarketCapUsd/);
assert.match(app,/pumpReportedHolderCount/);
assert.match(app,/__mfQueueHistoryEvaluation\(hot\)/);
assert.match(app,/HISTORY_EVAL_INTERVAL_MS/);
"""

if old in test:
    test=test.replace(old,new,1)
    test_path.write_text(test)
    print("UPDATED: realtime history isolation regression")
elif "pumpReportedMarketCapUsd" in test and "pumpReportedHolderCount" in test:
    print("OK: realtime regression already updated")
else:
    raise SystemExit("PATCH FAILED: realtime-update-path assertion block not recognized")

PY

echo
echo "== Syntax checks =="
node --check app-server.mjs
node --check src/pump-live-trade-feed.mjs
node --check src/pump-history-backfill.mjs

echo
echo "== Exact failing test first =="
node tests/realtime-update-path.mjs

echo
echo "== Market truth test =="
node tests/live-market-truth.mjs

echo
echo "== Scanner regression =="
node tests/fresh-session-scanner.mjs

echo
echo "== Full npm test =="
npm test

echo
echo "== Stage source only =="
git add \
  app-server.mjs \
  src/pump-live-trade-feed.mjs \
  src/pump-history-backfill.mjs \
  tests/live-market-truth.mjs \
  tests/realtime-update-path.mjs \
  package.json

git --no-pager diff --cached --stat

if git diff --cached --quiet; then
  echo "No source changes to commit."
else
  git commit -m "fix: restore realtime helpers and correct live market data"
fi

echo
echo "== Push =="
git push origin main

echo
echo "SUCCESS."
echo "The exact LIVE_STATES_RESPONSE_CACHE_MS failure is fixed."
echo "Runtime data/state/ledger files were not staged."
