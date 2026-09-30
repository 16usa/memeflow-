#!/usr/bin/env bash
set -euo pipefail

ROOT="memeflow-app"
FILES=(
  "$ROOT/trading.js"
  "$ROOT/trading.css"
  "$ROOT/trading.html"
)

for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "ERROR: missing $f"; exit 1; }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/chart-layout-v31-$STAMP"
mkdir -p "$BACKUP"
cp "${FILES[@]}" "$BACKUP"/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/patch.py"

echo
echo "===== SYNTAX CHECK ====="
node --check "$ROOT/trading.js"

echo
echo "===== PATCH MARKERS ====="
grep -n "MEMEFLOW_CHART_COMPACT_LAYOUT_V31" \
  "$ROOT/trading.js" "$ROOT/trading.css"

echo
echo "===== CACHE VERSION ====="
grep -n "chart-compact-layout-v31" "$ROOT/trading.html"

echo
echo "===== GIT CHECK ====="
git diff --check
git diff --stat -- "${FILES[@]}"

echo
echo "===== COMMIT + PUSH ====="
git add "${FILES[@]}"
git diff --cached --quiet || \
  git commit -m "Fix chart metric spacing and compact legend V31"
git push

echo
echo "DONE V31."
echo "No server restart was performed."
echo "Reload the page or restart Replit manually."
