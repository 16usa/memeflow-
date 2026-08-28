#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW V5 resume/fix after V4 test failure =="

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

if "MEMEFLOW_CARD_MARKET_TRUTH_V5" not in app:
    raise SystemExit(
        "ERROR: V4 market-truth changes are not present. "
        "Do not use this resume script on an unrelated checkout."
    )

if "MEMEFLOW_REALTIME_UI_FAIRNESS_V1" not in app:
    anchor="function candidateView(d){"
    block=r"""// MEMEFLOW_REALTIME_UI_FAIRNESS_V1
// Building a large Live Token States response must never monopolize Node's
// event loop and starve Pump WebSocket messages.
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
    if anchor not in app:
        raise SystemExit("PATCH FAILED: candidateView anchor not found")
    app=app.replace(anchor,block+anchor,1)
    app_path.write_text(app)
    print("restored: MEMEFLOW_REALTIME_UI_FAIRNESS_V1 helpers")
else:
    print("ok: realtime fairness helpers already present")

test_path=Path("tests/realtime-update-path.mjs")
test=test_path.read_text()

old="""assert.match(app,/if\\(current\\?\\.wsFirst===true\\)return/);
assert.match(app,/__mfQueueHistoryEvaluation\\(hot\\)/);
assert.match(app,/HISTORY_EVAL_INTERVAL_MS/);
"""
new="""assert.match(app,/if\\(current\\?\\.wsFirst===true\\)\\{/);
assert.match(app,/pumpReportedMarketCapUsd/);
assert.match(app,/pumpReportedHolderCount/);
assert.match(app,/__mfQueueHistoryEvaluation\\(hot\\)/);
assert.match(app,/HISTORY_EVAL_INTERVAL_MS/);
"""

if old in test:
    test=test.replace(old,new,1)
    test_path.write_text(test)
    print("updated: realtime history-isolation regression")
elif "pumpReportedMarketCapUsd" in test and "pumpReportedHolderCount" in test:
    print("ok: realtime regression already updated")
else:
    raise SystemExit("PATCH FAILED: realtime-update-path assertion block changed")

PY

echo
echo "== Syntax =="
node --check app-server.mjs
node --check src/pump-live-trade-feed.mjs
node --check src/pump-history-backfill.mjs

echo
echo "== Focused regressions =="
node tests/live-market-truth.mjs
node tests/realtime-update-path.mjs
node tests/fresh-session-scanner.mjs

echo
echo "== Full project tests =="
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

echo
git --no-pager diff --cached --stat

if git diff --cached --quiet; then
  echo "No source changes to commit."
else
  git commit -m "fix: make live card market data authoritative"
fi

echo
echo "== Push main =="
git push origin main

echo
echo "SUCCESS: tests passed, source committed and pushed."
echo "Runtime data/state/ledger files were not staged."
