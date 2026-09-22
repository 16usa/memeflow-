#!/usr/bin/env bash
set -euo pipefail

APP="memeflow-app"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-typography-clean-v174-backup-$STAMP"
POINTER=".memeflow-typography-clean-v174-last-backup"
WORK=".memeflow-typography-clean-v174-work"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run from the existing Replit workspace root."
  exit 1
fi

if [ ! -f "$APP/memeflow-x-canonical-v173.css" ]; then
  echo "ERROR: memeflow-x-canonical-v173.css not found."
  echo "Install/run this only after successful V173."
  exit 1
fi

rm -rf "$WORK"
mkdir -p "$WORK/memeflow-app"
mkdir -p "$BACKUP/memeflow-app"

# Transactional copy: original site is not touched until transform + audit pass.
cp -p "$APP"/*.css "$WORK/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$WORK/memeflow-app/" 2>/dev/null || true

python3 memeflow_full_style_typography_v174/transform.py "$WORK/memeflow-app"
python3 memeflow_full_style_typography_v174/audit.py "$WORK/memeflow-app"

# Backup current root CSS/HTML only after the transformed worktree passed audit.
cp -p "$APP"/*.css "$BACKUP/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$BACKUP/memeflow-app/" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$POINTER"

# Atomically replace root CSS/HTML surface with the audited worktree.
rm -f "$APP"/*.css "$APP"/*.html
cp -p "$WORK/memeflow-app/"*.css "$APP/" 2>/dev/null || true
cp -p "$WORK/memeflow-app/"*.html "$APP/" 2>/dev/null || true
rm -rf "$WORK"

# Re-audit the actual installed site.
python3 memeflow_full_style_typography_v174/audit.py "$APP"

echo
echo "Installed MEMEFLOW FULL STYLE + TYPOGRAPHY CLEAN V174"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
git status --short
