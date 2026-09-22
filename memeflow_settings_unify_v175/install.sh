#!/usr/bin/env bash
set -euo pipefail

APP="memeflow-app"
WORK=".memeflow-settings-unify-v175-work"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-settings-unify-v175-backup-$STAMP"
POINTER=".memeflow-settings-unify-v175-last-backup"

if [ ! -d "$APP" ]; then
  echo "ERROR: memeflow-app not found. Run from the existing Replit workspace root."
  exit 1
fi

if [ ! -f "$APP/memeflow-x-canonical-v174.css" ]; then
  echo "ERROR: V174 canonical not found. V175 expects the current successful V174 state."
  exit 1
fi

rm -rf "$WORK"
mkdir -p "$WORK/memeflow-app" "$BACKUP/memeflow-app"

# Transactional: transform/audit a copy before touching live files.
cp -p "$APP"/*.css "$WORK/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$WORK/memeflow-app/" 2>/dev/null || true

python3 memeflow_settings_unify_v175/transform.py "$WORK/memeflow-app"
python3 memeflow_settings_unify_v175/audit.py "$WORK/memeflow-app"

# Back up only after the candidate has passed.
cp -p "$APP"/*.css "$BACKUP/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$BACKUP/memeflow-app/" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$POINTER"

rm -f "$APP"/*.css "$APP"/*.html
cp -p "$WORK/memeflow-app/"*.css "$APP/" 2>/dev/null || true
cp -p "$WORK/memeflow-app/"*.html "$APP/" 2>/dev/null || true
rm -rf "$WORK"

python3 memeflow_settings_unify_v175/audit.py "$APP"

echo
echo "Installed MEMEFLOW SYSTEM SETTINGS UNIFY V175"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
git status --short
