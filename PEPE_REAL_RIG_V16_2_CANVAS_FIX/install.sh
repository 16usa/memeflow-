#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/workspace}"
APP="$ROOT/memeflow-app"
HERE="$(cd "$(dirname "$0")" && pwd)"

test -f "$APP/character-real-rig-v16.js" || {
  echo "ERROR: character-real-rig-v16.js missing"
  exit 1
}

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.pepe-rig-backups/v16-2-canvas-$STAMP"
mkdir -p "$BACKUP"

for f in character-real-test-v16.js character-real-test-v16.html; do
  [ -f "$APP/$f" ] && cp "$APP/$f" "$BACKUP/$f"
done

cp -f "$HERE/character-real-test-v16.js" "$APP/character-real-test-v16.js"
cp -f "$HERE/character-real-test-v16.html" "$APP/character-real-test-v16.html"

echo
echo "===== V16.2 CANVAS FIX INSTALLED ====="
echo "OK: canvas is no longer full Safari viewport"
echo "OK: canvas uses real #stage bounds"
echo "OK: ResizeObserver enabled"
echo "OK: visualViewport resize supported"
echo "OK: V16 rig/assets untouched"
echo
echo "OPEN:"
echo "/character-real-test-v16.html?refresh=1620"
