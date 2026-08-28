#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW Copy Trading Settings cache fix V5"
APP="memeflow-app"
HTML="$APP/system.html"
JS="$APP/system.js"
NEW_VERSION="native-copy-trading-v5-20260826"
COMMIT_MESSAGE="fix(settings): refresh native copy trading asset"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

echo "==> $PATCH_NAME"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || die "Run this from inside the MEMEFLOW git repository."
cd "$ROOT"

[[ -f "$HTML" ]] || die "$HTML not found"
[[ -f "$JS" ]] || die "$JS not found"

echo "==> 1/5 Confirming native Copy Trading exists in system.js..."
grep -F "/* MEMEFLOW_NATIVE_COPY_TRADING_SETTINGS_V3 */" "$JS" >/dev/null \
  || die "Native Copy Trading marker is missing from $JS"
grep -F "['copyTrading', 'Copy trading'" "$JS" >/dev/null \
  || die "Copy trading settings group is missing from $JS"
grep -F "['copyTradingEnabled', 'Enable copy trading', 'boolean']" "$JS" >/dev/null \
  || die "copyTradingEnabled field is missing"
grep -F "['copyTradingWallet', 'Tracked Solana wallet', 'text']" "$JS" >/dev/null \
  || die "copyTradingWallet field is missing"
grep -F "['copyTradingBuyAmountSol', 'Your BUY size · SOL'" "$JS" >/dev/null \
  || die "copyTradingBuyAmountSol field is missing"
grep -F "['copyTradingMirrorSells', 'Mirror sells proportionally', 'boolean']" "$JS" >/dev/null \
  || die "copyTradingMirrorSells field is missing"

echo "==> 2/5 Confirming exact Settings order..."
python3 - <<'PY'
from pathlib import Path

s = Path("memeflow-app/system.js").read_text(encoding="utf-8")

trading = s.find("['trading', 'Trading'")
copy = s.find("['copyTrading', 'Copy trading'")
filters = s.find("['filters', 'Entry filters'")
exits = s.find("['exits', 'Risk & exits'")

if min(trading, copy, filters, exits) < 0:
    raise SystemExit("ERROR: one or more Settings groups could not be found")

if not (trading < copy < filters < exits):
    raise SystemExit("ERROR: wrong Settings order; refusing to patch blindly")

print("OK: Trading -> Copy trading -> Entry filters -> Risk & exits")
PY

echo "==> 3/5 Replacing stale system.js cache key..."
python3 - <<PY
from pathlib import Path
import re

p = Path("$HTML")
s = p.read_text(encoding="utf-8")

new_src = 'src="/system.js?v=$NEW_VERSION"'

if new_src in s:
    print("Cache key already fixed.")
else:
    s2, n = re.subn(
        r'src="/system\.js(?:\?v=[^"]*)?"',
        new_src,
        s,
        count=1
    )
    if n != 1:
        raise SystemExit("ERROR: could not find the system.js module script tag")
    p.write_text(s2, encoding="utf-8")
    print("Updated system.js cache key.")
PY

echo "==> 4/5 Validating patch..."
grep -F "src=\"/system.js?v=$NEW_VERSION\"" "$HTML" >/dev/null \
  || die "New cache key was not written"

git diff --check -- "$HTML"
git diff -- "$HTML"

echo "==> 5/5 Commit + push..."
if git diff --quiet -- "$HTML"; then
  echo "No new file change to commit; the cache key is already current."
else
  # Commit only system.html so unrelated staged/working files are not included.
  git commit -m "$COMMIT_MESSAGE" -- "$HTML"
  git push origin HEAD
fi

echo
echo "DONE."
echo "Copy Trading is already present natively in system.js."
echo "The stale system.js cache key in system.html has been refreshed."
echo "After Replit deploy/restart, reload System Settings once."
