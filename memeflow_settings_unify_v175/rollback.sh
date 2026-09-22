#!/usr/bin/env bash
set -euo pipefail

APP="memeflow-app"
POINTER=".memeflow-settings-unify-v175-last-backup"

if [ ! -f "$POINTER" ]; then
  echo "ERROR: backup pointer not found."
  exit 1
fi

BACKUP="$(cat "$POINTER")"
if [ ! -d "$BACKUP/memeflow-app" ]; then
  echo "ERROR: backup not found: $BACKUP"
  exit 1
fi

rm -f "$APP"/*.css "$APP"/*.html
cp -p "$BACKUP/memeflow-app/"*.css "$APP/" 2>/dev/null || true
cp -p "$BACKUP/memeflow-app/"*.html "$APP/" 2>/dev/null || true

echo "Rollback complete from $BACKUP"
echo "No server restart was performed."
git status --short
