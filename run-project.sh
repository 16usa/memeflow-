#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/workspace"

echo "[PROJECT] Starting current MEMEFLOW..."
cd "$ROOT/memeflow-app"

exec node live-bootstrap.mjs
