#!/usr/bin/env bash
set -euo pipefail

APP="memeflow-app"
CSS="$APP/memeflow-x-lights-out-v166.css"
BACKUP=".memeflow-pump-fee-palette-v166-backup"

if [[ ! -f "$BACKUP/.created" ]]; then
  echo "ERROR: V166 backup not found: $BACKUP"
  exit 1
fi

PAGES=(
  "$APP/index.html"
  "$APP/agent-performance.html"
  "$APP/how-it-works.html"
  "$APP/settings.html"
  "$APP/smart-vault.html"
  "$APP/system-tokens.html"
  "$APP/system.html"
  "$APP/trading.html"
  "$APP/owner-intelligence.html"
)

for f in "${PAGES[@]}"; do
  [[ -f "$BACKUP/$f" ]] && cp -p "$BACKUP/$f" "$f"
done

if [[ "$(cat "$BACKUP/.css-existed" 2>/dev/null || echo 0)" == "1" && -f "$BACKUP/$CSS" ]]; then
  cp -p "$BACKUP/$CSS" "$CSS"
else
  rm -f "$CSS"
fi

echo "Pump Fee palette V166 rolled back. No server restart was performed."
git status --short -- "$APP" || true
