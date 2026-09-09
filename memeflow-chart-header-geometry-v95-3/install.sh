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
    echo "This finalizer is for the current half-installed V95.1 state."
    exit 1
  fi
done

echo "[1/6] Verify partial V95.1 runtime state"

grep -q 'MEMEFLOW_CHART_HEADER_GEOMETRY_V95_1_ASSET' "$APP/trading.html" || {
  echo "ERROR: V95.1 asset marker missing from trading.html"
  exit 1
}

if grep -q 'MEMEFLOW_CHART_HEADER_GEOMETRY_V95_ASSET' "$APP/trading.html"; then
  echo "ERROR: failed V95 asset is still loaded."
  exit 1
fi

# ---------------------------------------------------------------------------
# IMPORTANT FIX VS V95.2
# ---------------------------------------------------------------------------
# V95.2 treated ALL untracked workspace files as "unrelated work".
# Your workspace intentionally contains patch zips, extracted patch folders,
# .memeflow-* backup pointers, reports, etc. Those are untracked and harmless.
#
# We only care about TRACKED modifications because git add below names the
# exact files to stage. Untracked files can safely remain in the workspace.
# ---------------------------------------------------------------------------

echo "[2/6] Guard tracked changes only"

allowed_re='^(memeflow-app/(trading\.css|trading-visual-hierarchy-v67\.css|trading\.html|chart-header-geometry-v95-1\.css|tests/chart-header-geometry-v95-1\.mjs))$'

unexpected=()

while IFS= read -r p; do
  [[ -z "$p" ]] && continue
  if [[ ! "$p" =~ $allowed_re ]]; then
    unexpected+=("$p")
  fi
done < <(git diff --name-only)

while IFS= read -r p; do
  [[ -z "$p" ]] && continue
  if [[ ! "$p" =~ $allowed_re ]]; then
    unexpected+=("$p")
  fi
done < <(git diff --cached --name-only)

if (( ${#unexpected[@]} > 0 )); then
  echo "ERROR: unrelated TRACKED changes detected."
  printf '  %s\n' "${unexpected[@]}"
  echo "V95.3 will not stage or commit them."
  exit 1
fi

echo "Tracked-change guard: OK"
echo "Untracked patch zips/folders and .memeflow-* pointers are intentionally ignored."

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/chart-header-geometry-v95-3-$STAMP"
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
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-chart-header-geometry-v95-3-last-backup"

echo "[3/6] Repair EOF whitespace"

python3 - "$APP/trading-visual-hierarchy-v67.css" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
# Exactly one terminal newline. No extra blank line at EOF.
path.write_text(text.rstrip('\n') + '\n')
PY

echo "[4/6] Regression + scope tests"
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

# Hard scope guard again: the V95.1 stylesheet is allowed to target only
# the selected-token header above the chart, never the chart itself.
for forbidden in '.chart-wrap' '#chartCanvas' '.timeframes' '.chart-legend' '.indicator-bar' '.selected-metrics'; do
  if grep -Fq "$forbidden" "$APP/chart-header-geometry-v95-1.css"; then
    echo "ERROR: forbidden chart selector found: $forbidden"
    exit 1
  fi
done

echo "[5/6] Diff guard"

git diff --check -- \
  memeflow-app/trading.css \
  memeflow-app/trading-visual-hierarchy-v67.css \
  memeflow-app/trading.html \
  memeflow-app/chart-header-geometry-v95-1.css \
  memeflow-app/tests/chart-header-geometry-v95-1.mjs

echo "[6/6] Exact staging + commit + push"

# Refuse pre-existing staged changes even if allowed: keep checkpoint explicit.
if ! git diff --cached --quiet; then
  echo "ERROR: pre-existing staged changes exist."
  echo "Nothing was staged by V95.3."
  exit 1
fi

# Explicit paths only. NO git add -A.
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
echo "V95.3 FINALIZE OK"
echo "Backup: $BACKUP"
echo "Rollback this finalizer:"
echo "  bash memeflow-chart-header-geometry-v95-3/rollback.sh"

if [[ -f "$ROOT/.memeflow-chart-header-geometry-v95-1-rollback-source" ]]; then
  echo "Full pre-V95 rollback still available:"
  echo "  bash memeflow-chart-header-geometry-v95-1/rollback.sh"
fi

echo
echo "Final header geometry:"
echo "  avatar          = 36x36"
echo "  header          = 64px"
echo "  left/right      = 9px"
echo "  top/bottom      = 14px"
echo "  avatar -> text  = 17px"
echo
echo "Chart/canvas/timeframes/legend/indicators untouched."
