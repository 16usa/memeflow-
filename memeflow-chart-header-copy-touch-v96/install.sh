#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in \
  "$APP/chart-header-geometry-v95-1.css" \
  "$APP/memeflow-accessibility-usability-v64a.css" \
  "$APP/trading.html"; do
  [[ -f "$f" ]] || { echo "ERROR: missing required file: $f"; exit 1; }
done

echo "[1/6] Guard tracked changes"

allowed_re='^(memeflow-app/(chart-header-geometry-v95-1\.css|trading\.html|tests/chart-header-copy-touch-v96\.mjs))$'
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
BACKUP="$ROOT/.memeflow-backups/chart-header-copy-touch-v96-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/chart-header-geometry-v95-1.css"
  "memeflow-app/trading.html"
  "memeflow-app/tests/chart-header-copy-touch-v96.mjs"
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
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-chart-header-copy-touch-v96-last-backup"

echo "[2/6] Patch existing chart-header authority"
python3 "$PATCH_DIR/patcher.py" \
  "$APP/chart-header-geometry-v95-1.css" \
  "$APP/trading.html"

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/chart-header-copy-touch-v96.mjs" \
   "$APP/tests/chart-header-copy-touch-v96.mjs"

echo "[3/6] Root-cause regression test"
(
  cd "$APP"
  node --check tests/chart-header-copy-touch-v96.mjs
  node tests/chart-header-copy-touch-v96.mjs
)

echo "[4/6] Existing geometry safety tests"
(
  cd "$APP"
  [[ ! -f tests/open-position-icon-geometry-v93.mjs ]] || node tests/open-position-icon-geometry-v93.mjs
  [[ ! -f tests/row-height-canonical-v89.mjs ]] || node tests/row-height-canonical-v89.mjs
)

echo "[5/6] Diff guard"
git diff --check -- \
  memeflow-app/chart-header-geometry-v95-1.css \
  memeflow-app/trading.html \
  memeflow-app/tests/chart-header-copy-touch-v96.mjs

echo "[6/6] Exact Git checkpoint + push"

if ! git diff --cached --quiet; then
  echo "ERROR: pre-existing staged changes detected."
  exit 1
fi

git add -- \
  memeflow-app/chart-header-geometry-v95-1.css \
  memeflow-app/trading.html \
  memeflow-app/tests/chart-header-copy-touch-v96.mjs

if git diff --cached --quiet; then
  echo "V96 already present; nothing new to commit."
else
  git commit -m "fix(trading): compact chart header copy control"
  git push origin HEAD
  echo "Push: OK"
fi

echo
echo "V96 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-chart-header-copy-touch-v96/rollback.sh"
echo
echo "Fixed only:"
echo "  #copyMintBtn layout min-block-size: 44px -> 0px"
echo "  preserved invisible 44x44 touch target"
echo
echo "Unchanged:"
echo "  avatar 36x36"
echo "  header 64px"
echo "  left/right 9px"
echo "  top/bottom around avatar 14px"
echo "  avatar -> text 17px"
echo "  Pump.fun badge absolute overlay"
echo "  chart/canvas/timeframes/legend/indicators"
