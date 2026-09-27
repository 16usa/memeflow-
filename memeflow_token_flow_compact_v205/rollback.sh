#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
LAST="$HERE/.last-backup"

[[ -f "$LAST" ]] || { echo "ERROR: no V205 backup pointer"; exit 1; }
BACKUP="$(cat "$LAST")"
[[ -f "$BACKUP/system-tokens.css" ]] || { echo "ERROR: backup CSS missing"; exit 1; }
[[ -f "$BACKUP/system-tokens.html" ]] || { echo "ERROR: backup HTML missing"; exit 1; }

cp "$BACKUP/system-tokens.css" "$APP/system-tokens.css"
cp "$BACKUP/system-tokens.html" "$APP/system-tokens.html"

echo "Exact pre-V205 Token Flow files restored."
echo "No server restart was performed."
