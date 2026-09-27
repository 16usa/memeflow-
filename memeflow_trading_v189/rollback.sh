#!/usr/bin/env bash
set -euo pipefail
APP="memeflow-app"
CSS="$APP/memeflow-x-canonical-v186.css"
HTML="$APP/trading.html"
POINTER=".memeflow-trading-v189-last-backup"

[ -f "$POINTER" ] || { echo "ERROR: V189 backup pointer not found."; exit 1; }
BACKUP="$(cat "$POINTER")"
[ -f "$BACKUP/memeflow-app/memeflow-x-canonical-v186.css" ] || { echo "ERROR: backup CSS missing: $BACKUP"; exit 1; }
[ -f "$BACKUP/memeflow-app/trading.html" ] || { echo "ERROR: backup trading.html missing: $BACKUP"; exit 1; }

cp -p "$BACKUP/memeflow-app/memeflow-x-canonical-v186.css" "$CSS"
cp -p "$BACKUP/memeflow-app/trading.html" "$HTML"

echo "Rolled back MEMEFLOW Trading Terminal V189 -> exact pre-V189 V188 state."
echo "Restored from: $BACKUP"
echo "No server restart was performed."
echo
git status --short -- "$CSS" "$HTML" 2>/dev/null || true
