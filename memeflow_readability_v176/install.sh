#!/usr/bin/env bash
set -euo pipefail

APP="memeflow-app"
WORK=".memeflow-readability-v176-work"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-readability-v176-backup-$STAMP"
POINTER=".memeflow-readability-v176-last-backup"

if [ ! -d "$APP" ]; then
  echo "ERROR: memeflow-app not found. Run from the existing Replit workspace root."
  exit 1
fi

if [ ! -f "$APP/memeflow-x-canonical-v175.css" ] && [ ! -f "$APP/memeflow-x-canonical-v174.css" ]; then
  echo "ERROR: neither V175 nor V174 canonical file exists."
  exit 1
fi

rm -rf "$WORK"
mkdir -p "$WORK/memeflow-app" "$BACKUP/memeflow-app"

cp -p "$APP"/*.css "$WORK/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$WORK/memeflow-app/" 2>/dev/null || true

if [ ! -f "$WORK/memeflow-app/memeflow-x-canonical-v175.css" ] && \
   [ -f "$WORK/memeflow-app/memeflow-x-canonical-v174.css" ]; then
  echo "Applying bundled V175 Settings unification inside temporary worktree..."
  python3 memeflow_readability_v176/settings_v175_transform.py "$WORK/memeflow-app"
  python3 memeflow_readability_v176/settings_v175_audit.py "$WORK/memeflow-app"
fi

python3 memeflow_readability_v176/transform.py "$WORK/memeflow-app"
python3 memeflow_readability_v176/audit.py "$WORK/memeflow-app"

cp -p "$APP"/*.css "$BACKUP/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$BACKUP/memeflow-app/" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$POINTER"

rm -f "$APP"/*.css "$APP"/*.html
cp -p "$WORK/memeflow-app/"*.css "$APP/" 2>/dev/null || true
cp -p "$WORK/memeflow-app/"*.html "$APP/" 2>/dev/null || true
rm -rf "$WORK"

python3 memeflow_readability_v176/audit.py "$APP"

echo
echo "Installed MEMEFLOW READABILITY V176"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
git status --short
