#!/usr/bin/env bash
set -euo pipefail

PATCH_NAME="MEMEFLOW V23.3 regression recovery"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "==> ${PATCH_NAME}"

if [[ -f "system-tokens.js" && -f "package.json" ]]; then
  APP_DIR="$PWD"
elif [[ -f "memeflow-app/system-tokens.js" && -f "memeflow-app/package.json" ]]; then
  APP_DIR="$PWD/memeflow-app"
else
  echo "ERROR: MEMEFLOW app directory was not found."
  echo "Run this script from the Replit project root or memeflow-app."
  exit 1
fi

cd "$APP_DIR"
echo "==> App: $APP_DIR"

required_files=(
  "system-tokens.js"
  "system-tokens.html"
  "package.json"
  "src/live-card-market.mjs"
  "tests/per-mint-card-refresh-v18.mjs"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: missing required file: $file"
    exit 1
  fi
done

BACKUP_DIR=".patch-backups/v23-3-$STAMP"
mkdir -p "$BACKUP_DIR"

for file in \
  system-tokens.js \
  system-tokens.html \
  package.json \
  src/live-card-market.mjs \
  tests/per-mint-card-refresh-v18.mjs \
  tests/live-ranking-reorder-v23.mjs
do
  if [[ -f "$file" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$file")"
    cp -p "$file" "$BACKUP_DIR/$file"
  fi
done

python3 <<'PY'
from pathlib import Path
import re

market_path = Path("src/live-card-market.mjs")
test_path = Path("tests/per-mint-card-refresh-v18.mjs")
ui_path = Path("system-tokens.js")
html_path = Path("system-tokens.html")

market = market_path.read_text(encoding="utf-8")
test = test_path.read_text(encoding="utf-8")
ui = ui_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

# Confirm the current runtime contract before changing any test:
# Pump reference market cap is accepted only when pumpReferenceAt is fresh.
required_runtime_fragments = (
    "const pumpReferenceAt=finite(token?.pumpReferenceAt);",
    "const pumpReferenceFresh=Boolean(",
    "const pumpReferenceUsd=",
    "pumpReferenceFresh",
)

for fragment in required_runtime_fragments:
    if fragment not in market:
        raise SystemExit(
            "ERROR: live-card-market runtime does not match the expected fresh Pump reference contract."
        )

# Confirm the V23 runtime fix from the previous recovery run is present.
required_ui_fragments = (
    "MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23",
    "MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23",
)

for fragment in required_ui_fragments:
    if fragment not in ui:
        raise SystemExit(
            f"ERROR: required V23 runtime marker is missing: {fragment}"
        )

if not re.search(r"watch:\s*2,\s*waiting:\s*2,", ui, re.S):
    raise SystemExit(
        "ERROR: WATCH and WAITING are not in the same visual ranking lane."
    )

if "instant-rank-v23-20260827" not in html:
    raise SystemExit(
        "ERROR: V23 browser cache-bust version is missing."
    )

# Repair the stale test fixture shown in the shell screenshot.
#
# The old fixture expected pumpReportedMarketCapUsd to be accepted without
# a timestamp. The runtime now intentionally requires a fresh pumpReferenceAt,
# so the correct regression fixture must include that timestamp.
fixture_start = test.find("const referenced=liveCardMarketSnapshot({")
if fixture_start < 0:
    raise SystemExit(
        "ERROR: referenced Pump market-cap fixture was not found."
    )

fixture_end = test.find("assert.equal(referenced.marketCapUsd", fixture_start)
if fixture_end < 0:
    raise SystemExit(
        "ERROR: referenced Pump market-cap assertion was not found."
    )

fixture = test[fixture_start:fixture_end]

if "pumpReportedMarketCapUsd:12345" not in fixture:
    raise SystemExit(
        "ERROR: expected pumpReportedMarketCapUsd:12345 fixture was not found."
    )

if "pumpReferenceAt:" not in fixture:
    fixture = fixture.replace(
        "    pumpReportedMarketCapUsd:12345",
        "    pumpReportedMarketCapUsd:12345,\n    pumpReferenceAt:999_500",
        1,
    )
    test = test[:fixture_start] + fixture + test[fixture_end:]

# Keep the cache-bust assertion aligned with V23.
test = test.replace(
    "single-clock-v19-20260827",
    "instant-rank-v23-20260827",
)

# Ensure the regression also proves the source label is Pump reference.
source_assert = "assert.equal(referenced.marketCapSource,'pump-reference');"
if source_assert not in test:
    market_cap_assert = "assert.equal(referenced.marketCapUsd,12345);"
    if market_cap_assert not in test:
        raise SystemExit(
            "ERROR: referenced market-cap assertion could not be located."
        )
    test = test.replace(
        market_cap_assert,
        market_cap_assert + "\n" + source_assert,
        1,
    )

test_path.write_text(test, encoding="utf-8")

print("Stale Pump reference regression fixture repaired.")
PY

echo "==> Verify repaired fixture"
grep -n -A8 -B2 "const referenced=liveCardMarketSnapshot" \
  tests/per-mint-card-refresh-v18.mjs

echo "==> Syntax checks"
node --check system-tokens.js
node --check src/live-card-market.mjs
node --check tests/per-mint-card-refresh-v18.mjs

if [[ -f "tests/live-ranking-reorder-v23.mjs" ]]; then
  node --check tests/live-ranking-reorder-v23.mjs
fi

echo "==> Focused market truth regressions"
node tests/per-mint-card-refresh-v18.mjs
node tests/live-market-truth.mjs
node tests/open-position-live-mc-v20.mjs

if [[ -f "tests/live-ranking-reorder-v23.mjs" ]]; then
  echo "==> Focused ranking regression"
  node tests/live-ranking-reorder-v23.mjs
fi

echo "==> Full test suite"
npm test

echo "==> Git diff check"
git diff --check

echo "==> Git status"
git status --short

git add \
  system-tokens.js \
  system-tokens.html \
  package.json \
  tests/per-mint-card-refresh-v18.mjs

if [[ -f "tests/live-ranking-reorder-v23.mjs" ]]; then
  git add tests/live-ranking-reorder-v23.mjs
fi

if git diff --cached --quiet; then
  echo "==> No new changes to commit."
else
  git commit -m "fix: recover instant ranking patch regressions"
fi

echo "==> Push"
git push

echo
echo "============================================================"
echo "V23.3 DONE"
echo "- stale Pump reference test fixture repaired"
echo "- live market truth was not weakened"
echo "- instant score ranking remains enabled"
echo "- OPEN POSITION instant ranking remains enabled"
echo "- focused regressions passed"
echo "- full test suite passed before commit and push"
echo "============================================================"
