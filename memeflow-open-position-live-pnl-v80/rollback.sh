#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

POINTER="$ROOT/.memeflow-open-position-live-pnl-v80-last-backup"

if [[ ! -f "$POINTER" ]]; then
  echo "ERROR: no V80 backup pointer found."
  exit 1
fi

BACKUP="$(cat "$POINTER")"

if [[ ! -d "$BACKUP" ]]; then
  echo "ERROR: backup directory not found: $BACKUP"
  exit 1
fi

cp "$BACKUP/memeflow-app/trading.js" \
   "$ROOT/memeflow-app/trading.js"
cp "$BACKUP/memeflow-app/trading.html" \
   "$ROOT/memeflow-app/trading.html"

if [[ "$(cat "$BACKUP/test-existed")" == "1" ]]; then
  cp "$BACKUP/memeflow-app/tests/open-position-live-pnl-v80.mjs" \
     "$ROOT/memeflow-app/tests/open-position-live-pnl-v80.mjs"
else
  rm -f "$ROOT/memeflow-app/tests/open-position-live-pnl-v80.mjs"
fi

node --check "$ROOT/memeflow-app/trading.js"

echo "V80 ROLLBACK OK"
echo "Restored from: $BACKUP"
echo "Review with: git status --short"
