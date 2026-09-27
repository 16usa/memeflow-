#!/usr/bin/env bash
set -euo pipefail
APP="memeflow-app"
CSS="$APP/memeflow-x-canonical-v186.css"
HTML="$APP/trading.html"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-trading-v190-backup-$STAMP"
POINTER=".memeflow-trading-v190-last-backup"
COMPLETED=0

[ -d "$APP" ] || { echo "ERROR: memeflow-app not found. Run from the existing Replit workspace."; exit 1; }
[ -f "$CSS" ] || { echo "ERROR: $CSS not found."; exit 1; }
[ -f "$HTML" ] || { echo "ERROR: $HTML not found."; exit 1; }
for marker in \
  MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_START \
  MEMEFLOW_TRADING_TERMINAL_POLISH_V187_START \
  MEMEFLOW_TRADING_TERMINAL_COMPACT_V188_START \
  MEMEFLOW_TRADING_TECHNICAL_HIERARCHY_V189_START; do
  grep -q "$marker" "$CSS" || { echo "ERROR: prerequisite marker missing: $marker"; exit 1; }
done
if grep -q 'MEMEFLOW_TRADING_DENSITY_GEOMETRY_V190_START' "$CSS"; then
  echo "ERROR: V190 is already installed."
  exit 1
fi

mkdir -p "$BACKUP/memeflow-app"
cp -p "$CSS" "$BACKUP/memeflow-app/"
cp -p "$HTML" "$BACKUP/memeflow-app/"
printf '%s\n' "$BACKUP" > "$POINTER"

restore_on_error() {
  rc=$?
  if [ "$rc" -ne 0 ] && [ "$COMPLETED" -eq 0 ]; then
    echo
    echo "V190 failed before completion. Restoring exact pre-V190 V189 state..."
    cp -p "$BACKUP/memeflow-app/memeflow-x-canonical-v186.css" "$CSS"
    cp -p "$BACKUP/memeflow-app/trading.html" "$HTML"
    echo "Restored. Backup remains at: $BACKUP"
  fi
  exit "$rc"
}
trap restore_on_error EXIT

python3 memeflow_trading_v190/apply.py "$APP"
python3 memeflow_trading_v190/audit.py "$APP"
COMPLETED=1
trap - EXIT

echo
echo "Installed MEMEFLOW TRADING TERMINAL DENSITY & GEOMETRY V190"
echo "Backup: $BACKUP"
echo "Changed only:"
echo "  - $CSS"
echo "  - $HTML (cache-bust only)"
echo "No server restart was performed."
echo
echo "Rollback to exact V189 state:"
echo "  bash memeflow_trading_v190/rollback.sh"
echo
git status --short -- "$CSS" "$HTML" 2>/dev/null || true
