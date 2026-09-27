#!/usr/bin/env bash
set -euo pipefail
ROOT="$PWD"
APP="$ROOT/memeflow-app"
LATEST="$(ls -dt "$APP"/.cash-dark-v220-backup-* 2>/dev/null | head -n 1 || true)"
if [[ -z "$LATEST" || ! -d "$LATEST" ]]; then
  echo "ERROR: no V220 backup found."
  exit 1
fi
PAGES=(system.html how-it-works.html smart-vault.html trading.html settings.html system-tokens.html x100.html agent-performance.html index.html owner-intelligence.html system-source.html)
for page in "${PAGES[@]}"; do
  cp -p "$LATEST/$page" "$APP/$page"
done
if [[ "$(cat "$LATEST/had_css" 2>/dev/null || echo 0)" == "1" ]]; then
  cp -p "$LATEST/memeflow-cash-dark-v220.css" "$APP/memeflow-cash-dark-v220.css"
else
  rm -f "$APP/memeflow-cash-dark-v220.css"
fi
echo "Rolled back from: $LATEST"
echo "No server/process restart was performed."
