#!/usr/bin/env bash
set -euo pipefail

APP="memeflow-app"
WORK=".memeflow-neutral-text-v177-work"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-neutral-text-v177-backup-$STAMP"
POINTER=".memeflow-neutral-text-v177-last-backup"

if [ ! -d "$APP" ]; then
  echo "ERROR: memeflow-app not found. Run from the existing Replit workspace root."
  exit 1
fi

if [ ! -f "$APP/memeflow-x-canonical-v176.css" ] && \
   [ ! -f "$APP/memeflow-x-canonical-v175.css" ] && \
   [ ! -f "$APP/memeflow-x-canonical-v174.css" ]; then
  echo "ERROR: no supported canonical file found (V174/V175/V176)."
  exit 1
fi

rm -rf "$WORK"
mkdir -p "$WORK/memeflow-app" "$BACKUP/memeflow-app"

cp -p "$APP"/*.css "$WORK/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$WORK/memeflow-app/" 2>/dev/null || true

if [ ! -f "$WORK/memeflow-app/memeflow-x-canonical-v176.css" ]; then
  if [ ! -f "$WORK/memeflow-app/memeflow-x-canonical-v175.css" ] && \
     [ -f "$WORK/memeflow-app/memeflow-x-canonical-v174.css" ]; then
    echo "Applying bundled V175 Settings unification in temporary worktree..."
    python3 memeflow_neutral_text_v177/v175_transform.py "$WORK/memeflow-app"
    python3 memeflow_neutral_text_v177/v175_audit.py "$WORK/memeflow-app"
  fi

  echo "Applying bundled V176 readability in temporary worktree..."
  python3 memeflow_neutral_text_v177/v176_transform.py "$WORK/memeflow-app"
  python3 memeflow_neutral_text_v177/v176_audit.py "$WORK/memeflow-app"
fi

python3 memeflow_neutral_text_v177/transform.py "$WORK/memeflow-app"
python3 memeflow_neutral_text_v177/audit.py "$WORK/memeflow-app"

cp -p "$APP"/*.css "$BACKUP/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$BACKUP/memeflow-app/" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$POINTER"

rm -f "$APP"/*.css "$APP"/*.html
cp -p "$WORK/memeflow-app/"*.css "$APP/" 2>/dev/null || true
cp -p "$WORK/memeflow-app/"*.html "$APP/" 2>/dev/null || true
rm -rf "$WORK"

python3 memeflow_neutral_text_v177/audit.py "$APP"

echo
echo "Installed MEMEFLOW PURE NEUTRAL TEXT V177"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
git status --short
