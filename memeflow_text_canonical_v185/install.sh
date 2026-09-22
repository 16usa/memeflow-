#!/usr/bin/env bash
set -euo pipefail
APP="memeflow-app"
WORK=".memeflow-text-canonical-v185-work"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-text-canonical-v185-backup-$STAMP"
POINTER=".memeflow-text-canonical-v185-last-backup"

[ -d "$APP" ] || { echo "ERROR: memeflow-app not found."; exit 1; }
[ -f "$APP/memeflow-x-canonical-v184.css" ] || { echo "ERROR: V184 canonical not found. V185 expects the current post-V184 state."; exit 1; }
[ -f "$APP/market-chart-final-v5.js" ] || { echo "ERROR: market-chart-final-v5.js missing."; exit 1; }
[ -f "$APP/trading.js" ] || { echo "ERROR: trading.js missing."; exit 1; }

rm -rf ".memeflow-text-canonical-v181-work" ".memeflow-text-canonical-v182-work" ".memeflow-text-canonical-v183-work" ".memeflow-text-canonical-v184-work" "$WORK"
mkdir -p "$WORK/memeflow-app" "$BACKUP/memeflow-app"
cp -p "$APP"/*.css "$WORK/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$WORK/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.js "$WORK/memeflow-app/" 2>/dev/null || true

python3 memeflow_text_canonical_v185/transform.py "$WORK/memeflow-app"
python3 memeflow_text_canonical_v185/audit.py "$WORK/memeflow-app"

cp -p "$APP"/*.css "$BACKUP/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$BACKUP/memeflow-app/" 2>/dev/null || true
cp -p "$APP/market-chart-final-v5.js" "$BACKUP/memeflow-app/" 2>/dev/null || true
cp -p "$APP/trading.js" "$BACKUP/memeflow-app/" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$POINTER"

rm -f "$APP"/*.css "$APP"/*.html
cp -p "$WORK/memeflow-app/"*.css "$APP/" 2>/dev/null || true
cp -p "$WORK/memeflow-app/"*.html "$APP/" 2>/dev/null || true
cp -p "$WORK/memeflow-app/market-chart-final-v5.js" "$APP/"
cp -p "$WORK/memeflow-app/trading.js" "$APP/"
rm -rf "$WORK"

python3 memeflow_text_canonical_v185/audit.py "$APP"

echo
echo "Installed MEMEFLOW DEEP TEXT CANONICAL V185"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
git status --short memeflow-app
