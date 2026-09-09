#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in \
  "$APP/trading.html" \
  "$APP/trading.js" \
  "$APP/memeflow-accessibility-usability-v64a.css" \
  "$APP/trading-visual-hierarchy-v67.css"; do
  [[ -f "$f" ]] || { echo "ERROR: missing required file: $f"; exit 1; }
done

echo "[1/7] Guard tracked changes"

allowed_re='^(memeflow-app/(trading\.html|chart-header-geometry-v95-1\.css|chart-header-geometry-v97\.css|tests/chart-header-geometry-v95-1\.mjs|tests/chart-header-copy-touch-v96\.mjs|tests/chart-header-row-parity-v97\.mjs))$'
unexpected=()

while IFS= read -r p; do
  [[ -z "$p" ]] && continue
  [[ "$p" =~ $allowed_re ]] || unexpected+=("$p")
done < <(git diff --name-only)

while IFS= read -r p; do
  [[ -z "$p" ]] && continue
  [[ "$p" =~ $allowed_re ]] || unexpected+=("$p")
done < <(git diff --cached --name-only)

if (( ${#unexpected[@]} > 0 )); then
  echo "ERROR: unrelated TRACKED changes detected."
  printf '  %s\n' "${unexpected[@]}"
  echo "Untracked patch ZIPs/folders are ignored."
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/chart-header-row-parity-v97-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/trading.html"
  "memeflow-app/chart-header-geometry-v95-1.css"
  "memeflow-app/chart-header-geometry-v97.css"
  "memeflow-app/tests/chart-header-geometry-v95-1.mjs"
  "memeflow-app/tests/chart-header-copy-touch-v96.mjs"
  "memeflow-app/tests/chart-header-row-parity-v97.mjs"
)

for rel in "${TARGETS[@]}"; do
  flag="$BACKUP/${rel//\//__}.existed"
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BACKUP/$rel"
    printf '1\n' > "$flag"
  else
    printf '0\n' > "$flag"
  fi
done

git rev-parse HEAD > "$BACKUP/git-head.txt"
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-chart-header-row-parity-v97-last-backup"

echo "[2/7] Replace old header authority with one clean V97 owner"

cp "$PATCH_DIR/chart-header-geometry-v97.css" \
   "$APP/chart-header-geometry-v97.css"

python3 - "$APP/trading.html" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
html = path.read_text()

# Remove every old V95.1 chart-header asset block.
html = re.sub(
    r'\n?<!-- MEMEFLOW_CHART_HEADER_GEOMETRY_V95_1_ASSET -->\s*'
    r'<link[^>]+chart-header-geometry-v95-1\.css[^>]*>\s*'
    r'<!-- /MEMEFLOW_CHART_HEADER_GEOMETRY_V95_1_ASSET -->\s*',
    '\n',
    html,
    flags=re.M
)

# Remove a previous V97 asset on re-run.
html = re.sub(
    r'\n?<!-- MEMEFLOW_CHART_HEADER_ROW_PARITY_V97_ASSET -->\s*'
    r'<link[^>]+chart-header-geometry-v97\.css[^>]*>\s*'
    r'<!-- /MEMEFLOW_CHART_HEADER_ROW_PARITY_V97_ASSET -->\s*',
    '\n',
    html,
    flags=re.M
)

block = (
    '<!-- MEMEFLOW_CHART_HEADER_ROW_PARITY_V97_ASSET -->\n'
    '<link rel="stylesheet" '
    'href="/chart-header-geometry-v97.css?v=chart-header-row-parity-v97-20260909">\n'
    '<!-- /MEMEFLOW_CHART_HEADER_ROW_PARITY_V97_ASSET -->\n'
)

if '</head>' not in html:
    raise SystemExit('ERROR: </head> not found')

html = html.replace('</head>', block + '</head>', 1)
path.write_text(html)
PY

# Remove the superseded chart-header owner and its now-stale tests.
rm -f "$APP/chart-header-geometry-v95-1.css"
rm -f "$APP/tests/chart-header-geometry-v95-1.mjs"
rm -f "$APP/tests/chart-header-copy-touch-v96.mjs"

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/chart-header-row-parity-v97.mjs" \
   "$APP/tests/chart-header-row-parity-v97.mjs"

echo "[3/7] V97 root-cause regression"
(
  cd "$APP"
  node --check tests/chart-header-row-parity-v97.mjs
  node tests/chart-header-row-parity-v97.mjs
)

echo "[4/7] Existing row safety tests"
(
  cd "$APP"
  [[ ! -f tests/open-position-icon-geometry-v93.mjs ]] || node tests/open-position-icon-geometry-v93.mjs
  [[ ! -f tests/row-height-canonical-v89.mjs ]] || node tests/row-height-canonical-v89.mjs
)

echo "[5/7] Verify single header authority"
COUNT="$(grep -c 'chart-header-geometry-v97.css' "$APP/trading.html" || true)"
[[ "$COUNT" == "1" ]] || {
  echo "ERROR: expected exactly one V97 chart-header stylesheet link, got $COUNT"
  exit 1
}

if grep -q 'chart-header-geometry-v95-1.css' "$APP/trading.html"; then
  echo "ERROR: old V95.1 chart-header stylesheet is still loaded"
  exit 1
fi

echo "[6/7] Diff + scope guard"

git diff --check -- \
  memeflow-app/trading.html \
  memeflow-app/chart-header-geometry-v95-1.css \
  memeflow-app/chart-header-geometry-v97.css \
  memeflow-app/tests/chart-header-geometry-v95-1.mjs \
  memeflow-app/tests/chart-header-copy-touch-v96.mjs \
  memeflow-app/tests/chart-header-row-parity-v97.mjs

for forbidden in '.chart-wrap' '#chartCanvas' '.timeframes' '.chart-legend' '.indicator-bar' '.selected-metrics'; do
  if grep -Fq "$forbidden" "$APP/chart-header-geometry-v97.css"; then
    echo "ERROR: forbidden chart selector found in V97: $forbidden"
    exit 1
  fi
done

echo "[7/7] Exact Git checkpoint + push"

if ! git diff --cached --quiet; then
  echo "ERROR: pre-existing staged changes detected."
  exit 1
fi

git add -A -- \
  memeflow-app/trading.html \
  memeflow-app/chart-header-geometry-v95-1.css \
  memeflow-app/chart-header-geometry-v97.css \
  memeflow-app/tests/chart-header-geometry-v95-1.mjs \
  memeflow-app/tests/chart-header-copy-touch-v96.mjs \
  memeflow-app/tests/chart-header-row-parity-v97.mjs

if git diff --cached --quiet; then
  echo "V97 already present; nothing new to commit."
else
  git commit -m "fix(trading): align and contain selected token header"
  git push origin HEAD
  echo "Push: OK"
fi

echo
echo "V97 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-chart-header-row-parity-v97/rollback.sh"
echo
echo "Fixed:"
echo "  title/status row == price row"
echo "  mint/Copy row    == PRICE/MC/BP row"
echo "  avatar           = 36x36"
echo "  Pump.fun badge   = 16x16 at right:-4 bottom:-4"
echo "  price toggle     = fixed 128px and cannot overflow the header"
echo "  long price/meta  = ellipsis inside the 128px column"
echo "  Copy + price controls keep 44px invisible touch targets"
echo
echo "Cleanup:"
echo "  removed V95.1 chart-header stylesheet"
echo "  removed stale V95.1/V96 chart-header tests"
echo "  one chart-header CSS owner remains: V97"
echo
echo "Chart/canvas/timeframes/legend/indicators untouched."
