#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
HTML="$APP/trading.html"
CSS="$APP/trading-compact-v206.css"
LAST="$HERE/.last-backup"

[[ -f "$LAST" ]] || { echo "ERROR: no V206 backup pointer"; exit 1; }
BACKUP="$(cat "$LAST")"
[[ -f "$BACKUP/trading.html" ]] || { echo "ERROR: backup trading.html missing"; exit 1; }

cp "$BACKUP/trading.html" "$HTML"

state="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("compact_css","created"))' "$BACKUP/manifest.json")"
if [[ "$state" == "existed" ]]; then
  cp "$BACKUP/trading-compact-v206.css" "$CSS"
else
  rm -f "$CSS"
fi

echo "Exact pre-V206 Trading Terminal restored."
echo "No server restart was performed."
