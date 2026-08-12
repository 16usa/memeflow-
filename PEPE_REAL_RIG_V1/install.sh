#!/usr/bin/env bash
set -euo pipefail
cd ~/workspace
APP="memeflow-app"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$APP/.real-rig-backups/$STAMP"
[ -f "$APP/character-rig.js" ] && cp "$APP/character-rig.js" "$APP/.real-rig-backups/$STAMP/" || true
mkdir -p "$APP/game-assets/character"
cp -f character/* "$APP/game-assets/character/"
cp -f character-real-rig.js "$APP/character-real-rig.js"
cp -f character-real-test.html "$APP/character-real-test.html"
cp -f character-real-test.js "$APP/character-real-test.js"
echo "===== INSTALLED ====="
ls -lh "$APP"/character-real-*
echo "Core PNG:"
find "$APP/game-assets/character" -maxdepth 1 -name '*.png' | wc -l
echo "===== PEPE REAL RIG V1 READY ====="
