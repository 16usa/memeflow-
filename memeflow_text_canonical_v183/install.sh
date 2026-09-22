#!/usr/bin/env bash
set -euo pipefail

APP="memeflow-app"
WORK=".memeflow-text-canonical-v183-work"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-text-canonical-v183-backup-$STAMP"
POINTER=".memeflow-text-canonical-v183-last-backup"

[ -d "$APP" ] || { echo "ERROR: memeflow-app not found."; exit 1; }
[ -f "$APP/memeflow-x-canonical-v180.css" ] || { echo "ERROR: V180 canonical not found."; exit 1; }

rm -rf ".memeflow-text-canonical-v181-work" "$WORK"
mkdir -p "$WORK/memeflow-app" "$BACKUP/memeflow-app"

# Full top-level CSS/HTML copy so the audit sees the real production surface.
cp -p "$APP"/*.css "$WORK/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$WORK/memeflow-app/" 2>/dev/null || true

# Transactional: nothing live changes until the deep audit passes.
python3 memeflow_text_canonical_v183/transform.py "$WORK/memeflow-app"
python3 memeflow_text_canonical_v183/audit.py "$WORK/memeflow-app"

# Backup current live top-level CSS/HTML after candidate PASS.
cp -p "$APP"/*.css "$BACKUP/memeflow-app/" 2>/dev/null || true
cp -p "$APP"/*.html "$BACKUP/memeflow-app/" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$POINTER"

rm -f "$APP"/*.css "$APP"/*.html
cp -p "$WORK/memeflow-app/"*.css "$APP/" 2>/dev/null || true
cp -p "$WORK/memeflow-app/"*.html "$APP/" 2>/dev/null || true
rm -rf ".memeflow-text-canonical-v181-work" ".memeflow-text-canonical-v182-work" "$WORK"

# Re-audit the actual installed tree.
python3 memeflow_text_canonical_v183/audit.py "$APP"

echo
echo "Installed MEMEFLOW DEEP TEXT CANONICAL V183"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
git status --short memeflow-app
