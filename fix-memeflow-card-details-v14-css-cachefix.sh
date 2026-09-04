#!/usr/bin/env bash
set -euo pipefail
cd ~/workspace

HTML="memeflow-app/system-tokens.html"
JS="memeflow-app/system-tokens.js"
CSS="memeflow-app/system-tokens.css"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-card-details-v14-css-cachefix-$STAMP"
mkdir -p "$BACKUP"
cp "$HTML" "$JS" "$CSS" "$BACKUP/"

echo "=== PRECHECK ==="

grep -q "MEMEFLOW_CARD_DETAILS_COMPACT_V14" "$CSS" || {
  echo "ERROR: V14 CSS marker missing. Nothing changed."
  exit 1
}

grep -q "mf-card-analysis-summary-v14" "$JS" || {
  echo "ERROR: V14 JS renderer missing. Nothing changed."
  exit 1
}

grep -q 'href="/system-tokens.css?v=token-scan-v27-2-20260902"' "$HTML" || {
  echo "ERROR: expected old CSS cache URL not found. Nothing changed."
  exit 1
}

grep -q 'src="/system-tokens.js?v=card-details-compact-v14-20260902"' "$HTML" || {
  echo "ERROR: expected V14 JS cache URL not found. Nothing changed."
  exit 1
}

python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/system-tokens.html")
s = p.read_text()

old_css = 'href="/system-tokens.css?v=token-scan-v27-2-20260902"'
new_css = 'href="/system-tokens.css?v=card-details-compact-v14-verified-20260902"'

old_js = 'src="/system-tokens.js?v=card-details-compact-v14-20260902"'
new_js = 'src="/system-tokens.js?v=card-details-compact-v14-verified-20260902"'

if old_css not in s:
    raise SystemExit("ERROR: CSS cache anchor missing")
if old_js not in s:
    raise SystemExit("ERROR: JS cache anchor missing")

s = s.replace(old_css, new_css, 1)
s = s.replace(old_js, new_js, 1)

p.write_text(s)
print("ASSET_CACHE_BUST_OK")
PY

echo "=== VERIFY ==="
node --check "$JS"
echo "SYNTAX_OK"

grep -n 'system-tokens.css?v=' "$HTML"
grep -n 'system-tokens.js?v=' "$HTML"

grep -q 'system-tokens.css?v=card-details-compact-v14-verified-20260902' "$HTML"
grep -q 'system-tokens.js?v=card-details-compact-v14-verified-20260902' "$HTML"
echo "V14_ASSETS_SYNCED_OK"

git diff --check
git reset
git add "$HTML"

if [ "$(git diff --cached --name-only | wc -l | tr -d ' ')" != "1" ]; then
  echo "ERROR: unexpected staged files"
  git reset
  exit 1
fi

if [ "$(git diff --cached --name-only)" != "$HTML" ]; then
  echo "ERROR: wrong staged file"
  git reset
  exit 1
fi

echo "=== STAGED DIFF ==="
git diff --cached --stat
git diff --cached

git commit -m "fix: sync v14 card details css asset"
git push origin HEAD

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
