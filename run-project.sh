#!/usr/bin/env bash
set -u

ROOT="$HOME/workspace"

echo "[PROJECT] Starting current MEMEFLOW..."
cd "$ROOT/memeflow-app"

exec node app-server.mjs
