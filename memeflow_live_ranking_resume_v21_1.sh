#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

if [[ -f "memeflow-app/package.json" ]]; then
  cd memeflow-app
fi

if [[ ! -f "package.json" || ! -f "app-server.mjs" ]]; then
  echo "ERROR: run this from the repository root or memeflow-app/"
  exit 1
fi

echo "==> Checking that the live-ranking patch is present"
grep -q "MEMEFLOW_FEED_RELEVANCE_RANKING_V2" src/feed-ranking.mjs || {
  echo "ERROR: V21 ranking patch is not present. Run the original patch first."
  exit 1
}
grep -q "MEMEFLOW_WAITING_PREVIEW_SCORE_V21" app-server.mjs || {
  echo "ERROR: V21 WAITING preview patch is not present. Run the original patch first."
  exit 1
}

echo "==> Repairing the unrelated Settings UI contract drift that stopped npm test"
python3 <<'PY'
from pathlib import Path
import re

p = Path("settings-page.js")
s = p.read_text()

expected = "['filters', 'Entry filters', 'Scanner scans all · these filters control cards + trading', false, ["

if expected not in s:
    pattern = re.compile(
        r"\['filters',\s*'Entry filters',\s*'[^']*',\s*false,\s*\["
    )
    s2, n = pattern.subn(expected, s, count=1)
    if n != 1:
        raise SystemExit(
            "Could not safely locate the Entry filters group in settings-page.js"
        )
    p.write_text(s2)
    print("normalized Entry filters UI contract text")
else:
    print("Entry filters UI contract text already correct")
PY

echo "==> Running the test that failed in the screenshot"
node tests/settings-architecture-v2.mjs

echo "==> Re-running live ranking regressions"
node tests/feed-ranking.mjs
node tests/live-market-truth.mjs

echo "==> Full project test suite"
npm test

echo "==> Diff validation"
git diff --check

echo "==> Staging only the intended repair files"
git add \
  app-server.mjs \
  src/feed-ranking.mjs \
  src/live-card-market.mjs \
  src/event-holder-ledger.mjs \
  tests/feed-ranking.mjs \
  tests/live-market-truth.mjs \
  settings-page.js

if git diff --cached --quiet; then
  echo "No staged changes to commit."
else
  git commit -m "Fix live token ranking and stale card metrics"
  git push
fi

echo
echo "SUCCESS: tests passed and the live-ranking repair was pushed."
