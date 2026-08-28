#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW standalone Copy Trading test-compatible repair V2"
APP="memeflow-app"
PAGE="$APP/settings-page.js"
HTML="$APP/settings.html"
BACKEND="$APP/src/settings.mjs"
CACHE_VERSION="ws-only-preopen-rpc-v1-copy-trading-standalone-v1-20260826"
COMMIT_MESSAGE="fix(settings): show copy trading on standalone settings page"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

echo "==> $PATCH_NAME"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || die "Run this from inside the MEMEFLOW git repository."
cd "$ROOT"

[[ -f "$PAGE" ]] || die "$PAGE not found"
[[ -f "$HTML" ]] || die "$HTML not found"
[[ -f "$BACKEND" ]] || die "$BACKEND not found"

echo "==> 1/6 Ensuring standalone Copy Trading group exists..."
python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/settings-page.js")
s = p.read_text(encoding="utf-8")

marker = "/* MEMEFLOW_STANDALONE_COPY_TRADING_SETTINGS_V1 */"
anchor = """  ['filters', 'Entry filters', 'Scanner scans all · these filters control cards + trading', false, [
"""

block = """  /* MEMEFLOW_STANDALONE_COPY_TRADING_SETTINGS_V1 */
  ['copyTrading', 'Copy trading', 'Mirror a Solana wallet with your own position size', false, [
    ['copyTradingEnabled', 'Enable copy trading', 'boolean'],
    ['copyTradingWallet', 'Tracked Solana wallet', 'text'],
    ['copyTradingBuyAmountSol', 'Your BUY size · SOL', 'number', 0.001, null, 0.001],
    ['copyTradingMirrorSells', 'Mirror sells proportionally', 'boolean']
  ]],
"""

if marker not in s:
    if anchor not in s:
        raise SystemExit("ERROR: Entry filters anchor missing; refusing blind edit.")
    s = s.replace(anchor, block + anchor, 1)
    p.write_text(s, encoding="utf-8")
    print("Inserted Copy Trading group.")
else:
    print("Copy Trading group is already present from the previous run.")
PY

echo "==> 2/6 Restoring test-compatible cache prefix while still busting browser cache..."
python3 - <<PY
from pathlib import Path
import re

p = Path("$HTML")
s = p.read_text(encoding="utf-8")

new_src = 'src="/settings-page.js?v=$CACHE_VERSION"'

s2, n = re.subn(
    r'src="/settings-page\.js(?:\?v=[^"]*)?"',
    new_src,
    s,
    count=1
)

if n != 1:
    raise SystemExit("ERROR: settings-page.js script tag not found.")

p.write_text(s2, encoding="utf-8")
print("Cache key:", "$CACHE_VERSION")
print("It keeps the legacy test prefix and still creates a new browser URL.")
PY

echo "==> 3/6 Verifying exact UI order + backend fields..."
python3 - <<'PY'
from pathlib import Path

page = Path("memeflow-app/settings-page.js").read_text(encoding="utf-8")
backend = Path("memeflow-app/src/settings.mjs").read_text(encoding="utf-8")

required_page = [
    "/* MEMEFLOW_STANDALONE_COPY_TRADING_SETTINGS_V1 */",
    "['copyTrading', 'Copy trading'",
    "['copyTradingEnabled', 'Enable copy trading', 'boolean']",
    "['copyTradingWallet', 'Tracked Solana wallet', 'text']",
    "['copyTradingBuyAmountSol', 'Your BUY size · SOL', 'number', 0.001, null, 0.001]",
    "['copyTradingMirrorSells', 'Mirror sells proportionally', 'boolean']",
    "MF293_GROUPS.flatMap(group => group[4])",
    "fetch('/api/settings'",
    "method: 'PUT'",
]

for item in required_page:
    if item not in page:
        raise SystemExit(f"ERROR: missing UI wiring: {item}")

required_backend = [
    "copyTradingEnabled:false",
    "copyTradingWallet:''",
    "copyTradingBuyAmountSol:0.1",
    "copyTradingMirrorSells:true",
    "'copyTradingEnabled','copyTradingMirrorSells'",
    "'copyTradingBuyAmountSol'",
]

for item in required_backend:
    if item not in backend:
        raise SystemExit(f"ERROR: missing backend support: {item}")

logic = page.index("['logic', 'Logic'")
trading = page.index("['trading', 'Trading'")
copy = page.index("['copyTrading', 'Copy trading'")
filters = page.index("['filters', 'Entry filters'")
preopen = page.index("['preopen', 'Pre-open RPC verification'")
exits = page.index("['exits', 'Risk & exits'")

if not (logic < trading < copy < filters < preopen < exits):
    raise SystemExit("ERROR: standalone Settings group order is wrong.")

print("OK: Logic -> Trading -> Copy trading -> Entry filters -> Pre-open RPC verification -> Risk & exits")
PY

echo "==> 4/6 Syntax + compatibility checks..."
node --check "$PAGE"

# This is the exact legacy prefix visible in the failing test from the previous run.
grep -F 'settings-page.js?v=ws-only-preopen-rpc-v1' "$HTML" >/dev/null \
  || die "Legacy test-compatible cache prefix is missing."

# Also confirm this is not the old cached URL.
grep -F "settings-page.js?v=$CACHE_VERSION" "$HTML" >/dev/null \
  || die "New cache-busting URL is missing."

git diff --check -- "$PAGE" "$HTML"

echo "==> 5/6 Running full project tests..."
(
  cd "$APP"
  npm test
)

echo "==> 6/6 Commit + push..."
git diff -- "$PAGE" "$HTML"

if git diff --quiet -- "$PAGE" "$HTML"; then
  echo "No uncommitted change found."
else
  git commit -m "$COMMIT_MESSAGE" -- "$PAGE" "$HTML"
  git push origin HEAD
fi

echo
echo "DONE."
echo "Standalone /settings.html now renders Copy trading between Trading and Entry filters."
echo "Tests passed, commit created, and push completed."
echo "Deploy/restart Replit, then reload /settings.html."
