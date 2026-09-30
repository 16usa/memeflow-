#!/usr/bin/env bash
set -euo pipefail

CANDIDATES=(
  "memeflow-app/trading.js"
  "trading.js"
  "app/trading.js"
  "src/trading.js"
)

TARGET=""
for f in "${CANDIDATES[@]}"; do
  if [ -f "$f" ]; then
    TARGET="$f"
    break
  fi
done

if [ -z "$TARGET" ]; then
  echo "ERROR: trading.js not found"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".memeflow-backups/hide-chart-indicators-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$TARGET" "$BACKUP_DIR/"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/patch.py"

node --check "$TARGET"

echo
echo "===== PATCH MARKER ====="
grep -n "MEMEFLOW_HIDE_CHART_INDICATOR_ROW_V1" "$TARGET"

echo
echo "===== GIT CHECK ====="
git diff --check
git diff --stat -- "$TARGET"

echo
echo "===== COMMIT + PUSH ====="
git add "$TARGET"
git diff --cached --quiet || git commit -m "Hide chart indicator switch row"
git push

echo
echo "DONE. No server restart was performed."
echo "Restart or reload Replit manually and reopen the chart."
