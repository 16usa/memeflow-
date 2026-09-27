#!/usr/bin/env bash
set -euo pipefail
APP="memeflow-app"
CSS="$APP/memeflow-x-canonical-v186.css"
HTML="$APP/trading.html"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-trading-v187-backup-$STAMP"
POINTER=".memeflow-trading-v187-last-backup"
COMMITTED=0

[ -d "$APP" ] || { echo "ERROR: memeflow-app not found. Run this from the existing Replit workspace."; exit 1; }
[ -f "$CSS" ] || { echo "ERROR: $CSS not found. Install/restore V186 first."; exit 1; }
[ -f "$HTML" ] || { echo "ERROR: $HTML not found."; exit 1; }

grep -q 'MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_START' "$CSS" || { echo "ERROR: V186 typography role system marker missing."; exit 1; }
if grep -q 'MEMEFLOW_TRADING_TERMINAL_POLISH_V187_START' "$CSS"; then
  echo "ERROR: V187 is already installed."
  exit 1
fi

mkdir -p "$BACKUP/memeflow-app"
cp -p "$CSS" "$BACKUP/memeflow-app/"
cp -p "$HTML" "$BACKUP/memeflow-app/"
printf '%s\n' "$BACKUP" > "$POINTER"

restore_on_error() {
  rc=$?
  if [ "$rc" -ne 0 ] && [ "$COMMITTED" -eq 0 ]; then
    echo
    echo "V187 failed before completion. Restoring V186 files..."
    cp -p "$BACKUP/memeflow-app/memeflow-x-canonical-v186.css" "$CSS"
    cp -p "$BACKUP/memeflow-app/trading.html" "$HTML"
    echo "Restored. Backup remains at: $BACKUP"
  fi
  exit "$rc"
}
trap restore_on_error EXIT

python3 memeflow_trading_v187/apply.py "$APP"
python3 memeflow_trading_v187/audit.py "$APP"
COMMITTED=1
trap - EXIT

echo
echo "Installed MEMEFLOW TRADING TERMINAL POLISH V187"
echo "Backup: $BACKUP"
echo "Changed only:"
echo "  - $CSS"
echo "  - $HTML (cache-bust only)"
echo "No server restart was performed."
echo
echo "Rollback:"
echo "  bash memeflow_trading_v187/rollback.sh"
echo
git status --short -- "$CSS" "$HTML" 2>/dev/null || true
