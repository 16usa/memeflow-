#!/usr/bin/env bash
set -euo pipefail
APP="memeflow-app"
WORK=".memeflow-type-scale-v180-work"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-type-scale-v180-backup-$STAMP"
POINTER=".memeflow-type-scale-v180-last-backup"

[ -d "$APP" ] || { echo "ERROR: memeflow-app not found."; exit 1; }
[ -f "$APP/memeflow-x-canonical-v179.css" ] || { echo "ERROR: V179 canonical not found."; exit 1; }

rm -rf "$WORK"
mkdir -p "$WORK/memeflow-app" "$BACKUP/memeflow-app"
cp -p "$APP"/*.css "$WORK/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$WORK/memeflow-app/" 2>/dev/null || true

python3 memeflow_type_scale_v180/transform.py "$WORK/memeflow-app"
python3 memeflow_type_scale_v180/audit.py "$WORK/memeflow-app"

cp -p "$APP"/*.css "$BACKUP/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$BACKUP/memeflow-app/" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$POINTER"

rm -f "$APP"/*.css "$APP"/*.html
cp -p "$WORK/memeflow-app/"*.css "$APP/" 2>/dev/null || true
cp -p "$WORK/memeflow-app/"*.html "$APP/" 2>/dev/null || true
rm -rf "$WORK"

python3 memeflow_type_scale_v180/audit.py "$APP"
echo
echo "Installed MEMEFLOW TYPE SCALE V180"
echo "Backup: $BACKUP"
echo "No server restart was performed."
git status --short memeflow-app
