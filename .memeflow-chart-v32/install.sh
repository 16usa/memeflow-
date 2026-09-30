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
BACKUP=".memeflow-backups/chart-hierarchy-v32-$STAMP"
mkdir -p "$BACKUP"
cp "${FILES[@]}" "$BACKUP"/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/patch.py"

echo
echo "===== SYNTAX CHECK ====="
node --check "$ROOT/trading.js"

echo
echo "===== PATCH MARKERS ====="
grep -n "MEMEFLOW_CHART_INFORMATION_HIERARCHY_V32" \
  "$ROOT/trading.js" "$ROOT/trading.css"

echo
echo "===== CACHE VERSION ====="
grep -n "chart-information-hierarchy-v32" "$ROOT/trading.html"

echo
echo "===== GIT CHECK ====="
git diff --check
git diff --stat -- "${FILES[@]}"

echo
echo "===== COMMIT + PUSH ====="
git add "${FILES[@]}"
git diff --cached --quiet || \
  git commit -m "Refine chart information hierarchy V32"
git push

echo
echo "DONE V32."
echo "No server restart was performed."
echo "Reload the page or restart Replit manually."
