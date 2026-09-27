#!/usr/bin/env bash
set -euo pipefail
APP="memeflow-app"
WORK=".memeflow-typography-v186-work"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-typography-v186-backup-$STAMP"
POINTER=".memeflow-typography-v186-last-backup"
PAGES=(index.html system.html how-it-works.html smart-vault.html trading.html settings.html system-tokens.html x100.html agent-performance.html owner-intelligence.html system-source.html)
SOURCE="memeflow-x-canonical-v185.css"
TARGET="memeflow-x-canonical-v186.css"

[ -d "$APP" ] || { echo "ERROR: memeflow-app not found."; exit 1; }
[ -f "$APP/$SOURCE" ] || { echo "ERROR: V185 canonical not found. V186 expects the clean V185 state."; exit 1; }
for page in "${PAGES[@]}"; do [ -f "$APP/$page" ] || { echo "ERROR: production page missing: $page"; exit 1; }; done

rm -rf "$WORK"
mkdir -p "$WORK/memeflow-app" "$BACKUP/memeflow-app"
cp -p "$APP/$SOURCE" "$WORK/memeflow-app/"
cp -p "$APP/$SOURCE" "$BACKUP/memeflow-app/"
for page in "${PAGES[@]}"; do
  cp -p "$APP/$page" "$WORK/memeflow-app/"
  cp -p "$APP/$page" "$BACKUP/memeflow-app/"
done

python3 memeflow_typography_v186/transform.py "$WORK/memeflow-app"
python3 memeflow_typography_v186/audit.py "$WORK/memeflow-app"

printf '%s\n' "$BACKUP" > "$POINTER"
cp -p "$WORK/memeflow-app/$TARGET" "$APP/$TARGET"
for page in "${PAGES[@]}"; do cp -p "$WORK/memeflow-app/$page" "$APP/$page"; done
rm -f "$APP/$SOURCE"
rm -rf "$WORK"

python3 memeflow_typography_v186/audit.py "$APP"
echo
echo "Installed MEMEFLOW TYPOGRAPHY ROLE SYSTEM V186"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
git status --short -- "$APP/$TARGET" "$APP/$SOURCE" "${PAGES[@]/#/$APP/}"
