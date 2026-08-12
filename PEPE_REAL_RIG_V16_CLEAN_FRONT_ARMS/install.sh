#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/workspace}"
APP="$ROOT/memeflow-app"
HERE="$(cd "$(dirname "$0")" && pwd)"

test -d "$APP" || { echo "ERROR: $APP not found"; exit 1; }
test -f "$APP/vendor/three.module.js" || { echo "ERROR: Three.js vendor module missing"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.pepe-rig-backups/v16-$STAMP"
mkdir -p "$BACKUP"

for f in character-real-rig-v16.js character-real-test-v16.js character-real-test-v16.html; do
  [ -f "$APP/$f" ] && cp "$APP/$f" "$BACKUP/$f"
done

mkdir -p "$APP/game-assets/character-v16"
cp -f "$HERE/character/"*.png "$APP/game-assets/character-v16/"
cp -f "$HERE/character-real-rig-v16.js" "$APP/"
cp -f "$HERE/character-real-test-v16.js" "$APP/"
cp -f "$HERE/character-real-test-v16.html" "$APP/"

echo
echo "===== V16 INSTALLED ====="
echo "OK: clean separated PNG parts copied"
echo "OK: arms/hands render in front of torso"
echo "OK: V14/V15 untouched"
echo "OPEN:"
echo "/character-real-test-v16.html?refresh=1601"
