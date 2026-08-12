#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/workspace}"
APP="$ROOT/memeflow-app"
HERE="$(cd "$(dirname "$0")" && pwd)"

test -f "$APP/character-real-rig-v16.js" || {
  echo "ERROR: V16 rig not found. Install V16 first."
  exit 1
}

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.pepe-rig-backups/v16-1-$STAMP"
mkdir -p "$BACKUP"

if [ -f "$APP/character-real-test-v16.js" ]; then
  cp "$APP/character-real-test-v16.js" "$BACKUP/character-real-test-v16.js"
fi

cp -f "$HERE/character-real-test-v16.js" "$APP/character-real-test-v16.js"

echo
echo "===== V16.1 VIEWPORT FIX INSTALLED ====="
echo "OK: V16 rig untouched"
echo "OK: auto-center enabled"
echo "OK: auto-fit enabled"
echo "OK: portrait/mobile viewport fixed"
echo
echo "OPEN:"
echo "/character-real-test-v16.html?refresh=1610"
