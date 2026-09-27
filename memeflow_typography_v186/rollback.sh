#!/usr/bin/env bash
set -euo pipefail
APP="memeflow-app"
POINTER=".memeflow-typography-v186-last-backup"
PAGES=(index.html system.html how-it-works.html smart-vault.html trading.html settings.html system-tokens.html x100.html agent-performance.html owner-intelligence.html system-source.html)
SOURCE="memeflow-x-canonical-v185.css"
TARGET="memeflow-x-canonical-v186.css"

[ -f "$POINTER" ] || { echo "ERROR: backup pointer not found."; exit 1; }
BACKUP="$(cat "$POINTER")"
[ -d "$BACKUP/memeflow-app" ] || { echo "ERROR: backup not found: $BACKUP"; exit 1; }
[ -f "$BACKUP/memeflow-app/$SOURCE" ] || { echo "ERROR: V185 backup missing."; exit 1; }

cp -p "$BACKUP/memeflow-app/$SOURCE" "$APP/$SOURCE"
for page in "${PAGES[@]}"; do cp -p "$BACKUP/memeflow-app/$page" "$APP/$page"; done
rm -f "$APP/$TARGET"

echo "Rollback complete from $BACKUP"
echo "No server restart was performed."
git status --short -- "$APP/$TARGET" "$APP/$SOURCE" "${PAGES[@]/#/$APP/}"
