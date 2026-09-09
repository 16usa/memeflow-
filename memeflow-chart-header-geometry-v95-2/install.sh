#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"

REQUIRED=(
  "$APP/trading.css"
  "$APP/trading-visual-hierarchy-v67.css"
  "$APP/trading.html"
  "$APP/chart-header-geometry-v95-1.css"
  "$APP/tests/chart-header-geometry-v95-1.mjs"
)

for f in "${REQUIRED[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: expected partial V95.1 file missing: $f"
    echo "This V95.2 finalizer is for the current half-installed V95.1 state."
    exit 1
  fi
done

echo "[1/5] Verify expected partial V95.1 state"

if ! grep -q 'MEMEFLOW_CHART_HEADER_GEOMETRY_V95_1_ASSET' "$APP/trading.html"; then
  echo "ERROR: V95.1 asset marker is not present in trading.html"
  exit 1
fi

if grep -q 'MEMEFLOW_CHART_HEADER_GEOMETRY_V95_ASSET' "$APP/trading.html"; then
  echo "ERROR: failed V95 asset is still loaded."
  exit 1
fi

# Refuse to accidentally commit unrelated work.
mapfile -t changed < <(git status --porcelain=v1 | sed 's/^...//')
allowed_re='^(memeflow-app/(trading\.css|trading-visual-hierarchy-v67\.css|trading\.html|chart-header-geometry-v95-1\.css|tests/chart-header-geometry-v95-1\.mjs))$'

unexpected=()
for p in "${changed[@]}"; do
  [[ -z "$p" ]] && continue
  if [[ ! "$p" =~ $allowed_re ]]; then
    unexpected+=("$p")
  fi
done

if (( ${#unexpected[@]} > 0 )); then
  echo "ERROR: unrelated working-tree changes detected."
  printf '  %s\n' "${unexpected[@]}"
  echo "V95.2 will not stage or commit unrelated work."
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/chart-header-geometry-v95-2-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/trading.css"
  "memeflow-app/trading-visual-hierarchy-v67.css"
  "memeflow-app/trading.html"
  "memeflow-app/chart-header-geometry-v95-1.css"
  "memeflow-app/tests/chart-header-geometry-v95-1.mjs"
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
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-chart-header-geometry-v95-2-last-backup"

echo "[2/5] Repair EOF whitespace"

python3 - "$APP/trading-visual-hierarchy-v67.css" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

# `git diff --check` reported:
#   new blank line at EOF
# Keep exactly ONE terminal newline, no extra blank line.
path.write_text(text.rstrip('\n') + '\n')
PY

echo "[3/5] Regression / scope tests"
(
  cd "$APP"
  node tests/chart-header-geometry-v95-1.mjs

  if [[ -f tests/open-position-icon-geometry-v93.mjs ]]; then
    node tests/open-position-icon-geometry-v93.mjs
  fi

  if [[ -f tests/row-height-canonical-v89.mjs ]]; then
    node tests/row-height-canonical-v89.mjs
  fi
)

echo "[4/5] Diff guard"
git diff --check -- \
  memeflow-app/trading.css \
  memeflow-app/trading-visual-hierarchy-v67.css \
  memeflow-app/trading.html \
  memeflow-app/chart-header-geometry-v95-1.css \
  memeflow-app/tests/chart-header-geometry-v95-1.mjs

# Hard scope guard once more: V95.1 stylesheet must not touch the chart itself.
for forbidden in '.chart-wrap' '#chartCanvas' '.timeframes' '.chart-legend' '.indicator-bar' '.selected-metrics'; do
  if grep -Fq "$forbidden" "$APP/chart-header-geometry-v95-1.css"; then
    echo "ERROR: forbidden chart selector found in V95.1: $forbidden"
    exit 1
  fi
done

echo "[5/5] Git checkpoint + push"

if ! git diff --cached --quiet; then
  echo "ERROR: pre-existing staged changes detected."
  echo "Nothing was staged by V95.2."
  exit 1
fi

git add -- \
  memeflow-app/trading.css \
  memeflow-app/trading-visual-hierarchy-v67.css \
  memeflow-app/trading.html \
  memeflow-app/chart-header-geometry-v95-1.css \
  memeflow-app/tests/chart-header-geometry-v95-1.mjs

if git diff --cached --quiet; then
  echo "No V95.1 changes remain to commit."
else
  git commit -m "fix(trading): unify selected token header geometry"
  git push origin HEAD
  echo "Push: OK"
fi

echo
echo "V95.2 FINALIZE OK"
echo "Backup: $BACKUP"
echo "Rollback current finalizer: bash memeflow-chart-header-geometry-v95-2/rollback.sh"

if [[ -f "$ROOT/.memeflow-chart-header-geometry-v95-1-rollback-source" ]]; then
  echo "Full pre-V95 rollback remains available through V95.1:"
  echo "  bash memeflow-chart-header-geometry-v95-1/rollback.sh"
fi

echo
echo "Header geometry finalized:"
echo "  avatar          = 36x36"
echo "  header          = 64px"
echo "  left/right      = 9px"
echo "  top/bottom      = 14px"
echo "  avatar -> text  = 17px"
echo
echo "Chart/canvas/timeframes/legend/indicators untouched."
