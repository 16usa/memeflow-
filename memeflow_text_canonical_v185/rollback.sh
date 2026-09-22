#!/usr/bin/env bash
set -euo pipefail
APP="memeflow-app"
POINTER=".memeflow-text-canonical-v185-last-backup"
[ -f "$POINTER" ] || { echo "ERROR: backup pointer not found."; exit 1; }
BACKUP="$(cat "$POINTER")"
[ -d "$BACKUP/memeflow-app" ] || { echo "ERROR: backup not found: $BACKUP"; exit 1; }
rm -f "$APP"/*.css "$APP"/*.html
cp -p "$BACKUP/memeflow-app/"*.css "$APP/" 2>/dev/null || true
cp -p "$BACKUP/memeflow-app/"*.html "$APP/" 2>/dev/null || true
cp -p "$BACKUP/memeflow-app/market-chart-final-v5.js" "$APP/" 2>/dev/null || true
cp -p "$BACKUP/memeflow-app/trading.js" "$APP/" 2>/dev/null || true
echo "Rollback complete from $BACKUP"
echo "No server restart was performed."
git status --short memeflow-app
