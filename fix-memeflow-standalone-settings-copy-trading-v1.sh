#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW standalone Settings Copy Trading V1"
APP="memeflow-app"
PAGE="$APP/settings-page.js"
HTML="$APP/settings.html"
BACKEND="$APP/src/settings.mjs"
VERSION="copy-trading-standalone-v1-20260826"
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

echo "==> 1/6 Confirming backend Copy Trading support..."
for needle in \
  "copyTradingEnabled:false" \
  "copyTradingWallet:''" \
  "copyTradingBuyAmountSol:0.1" \
  "copyTradingMirrorSells:true" \
  "'copyTradingEnabled','copyTradingMirrorSells'" \
  "'copyTradingBuyAmountSol'"
do
  grep -F "$needle" "$BACKEND" >/dev/null \
    || die "Backend Copy Trading support is incomplete: missing $needle"
done

echo "==> 2/6 Installing Copy Trading group in the REAL standalone Settings page..."
python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/settings-page.js")
s = p.read_text(encoding="utf-8")

marker = "/* MEMEFLOW_STANDALONE_COPY_TRADING_SETTINGS_V1 */"

if marker in s:
    print("Standalone Copy Trading group already installed.")
else:
    anchor = """  ['filters', 'Entry filters', 'Scanner scans all · these filters control cards + trading', false, [
"""
    if anchor not in s:
        raise SystemExit(
            "ERROR: Entry filters anchor was not found in settings-page.js. "
            "Refusing a blind modification."
        )

    block = """  /* MEMEFLOW_STANDALONE_COPY_TRADING_SETTINGS_V1 */
  ['copyTrading', 'Copy trading', 'Mirror a Solana wallet with your own position size', false, [
    ['copyTradingEnabled', 'Enable copy trading', 'boolean'],
    ['copyTradingWallet', 'Tracked Solana wallet', 'text'],
    ['copyTradingBuyAmountSol', 'Your BUY size · SOL', 'number', 0.001, null, 0.001],
    ['copyTradingMirrorSells', 'Mirror sells proportionally', 'boolean']
  ]],
"""

    s = s.replace(anchor, block + anchor, 1)
    p.write_text(s, encoding="utf-8")
    print("Inserted Copy Trading between Trading and Entry filters.")
PY

echo "==> 3/6 Verifying exact group order and field wiring..."
python3 - <<'PY'
from pathlib import Path

s = Path("memeflow-app/settings-page.js").read_text(encoding="utf-8")

required = [
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

for item in required:
    if item not in s:
        raise SystemExit(f"ERROR: missing required standalone Settings wiring: {item}")

logic = s.index("['logic', 'Logic'")
trading = s.index("['trading', 'Trading'")
copy = s.index("['copyTrading', 'Copy trading'")
filters = s.index("['filters', 'Entry filters'")
preopen = s.index("['preopen', 'Pre-open RPC verification'")
exits = s.index("['exits', 'Risk & exits'")

if not (logic < trading < copy < filters < preopen < exits):
    raise SystemExit(
        "ERROR: wrong Settings order. Expected "
        "Logic -> Trading -> Copy trading -> Entry filters -> "
        "Pre-open RPC verification -> Risk & exits"
    )

print(
    "OK: Logic -> Trading -> Copy trading -> Entry filters -> "
    "Pre-open RPC verification -> Risk & exits"
)
PY

echo "==> 4/6 Bumping settings-page.js cache key..."
python3 - <<PY
from pathlib import Path
import re

p = Path("$HTML")
s = p.read_text(encoding="utf-8")

new_src = 'src="/settings-page.js?v=$VERSION"'

if new_src not in s:
    s2, n = re.subn(
        r'src="/settings-page\.js(?:\?v=[^"]*)?"',
        new_src,
        s,
        count=1
    )
    if n != 1:
        raise SystemExit("ERROR: settings-page.js module script tag not found in settings.html")
    s = s2
    p.write_text(s, encoding="utf-8")
    print("Updated standalone Settings cache key.")
else:
    print("Standalone Settings cache key already current.")
PY

echo "==> 5/6 Syntax + project tests..."
node --check "$PAGE"
grep -F "src=\"/settings-page.js?v=$VERSION\"" "$HTML" >/dev/null \
  || die "New settings-page.js cache key was not written"
git diff --check -- "$PAGE" "$HTML"

(
  cd "$APP"
  npm test
)

echo "==> Diff:"
git diff -- "$PAGE" "$HTML"

echo "==> 6/6 Commit + push..."
if git diff --quiet -- "$PAGE" "$HTML"; then
  echo "No new changes to commit."
else
  git commit -m "$COMMIT_MESSAGE" -- "$PAGE" "$HTML"
  git push origin HEAD
fi

echo
echo "DONE."
echo "Standalone /settings.html now contains Copy trading between Trading and Entry filters."
echo "The existing canonical /api/settings backend remains the single source of truth."
echo "Deploy/restart Replit, then reload /settings.html."
