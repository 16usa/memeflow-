#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
LAST="$HERE/.last-backup"

[[ -f "$LAST" ]] || { echo "ERROR: no V208 backup pointer"; exit 1; }
BACKUP="$(cat "$LAST")"
[[ -f "$BACKUP/settings.html" ]] || { echo "ERROR: settings backup missing"; exit 1; }

cp "$BACKUP/settings.html" "$APP/settings.html"

state="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("css_state","created"))' "$BACKUP/manifest.json")"
if [[ "$state" == "existed" ]]; then
  cp "$BACKUP/memeflow-settings-compact-v208.css" "$APP/memeflow-settings-compact-v208.css"
else
  rm -f "$APP/memeflow-settings-compact-v208.css"
fi

echo "Exact pre-V208 System Settings restored."
echo "No server restart was performed."
