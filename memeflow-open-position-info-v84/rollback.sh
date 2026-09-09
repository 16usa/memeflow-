#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

POINTER="$ROOT/.memeflow-open-position-info-v84-last-backup"

if [[ ! -f "$POINTER" ]]; then
  echo "ERROR: no V84 backup pointer found."
  exit 1
fi

BACKUP="$(cat "$POINTER")"

if [[ ! -d "$BACKUP" ]]; then
  echo "ERROR: backup directory not found: $BACKUP"
  exit 1
fi

TARGETS=(
  "memeflow-app/trading.js"
  "memeflow-app/trading.html"
  "memeflow-app/open-position-info-v84.css"
  "memeflow-app/tests/open-position-info-v84.mjs"
)

for rel in "${TARGETS[@]}"; do
  flag="$BACKUP/${rel//\//__}.existed"
  existed="0"
  [[ -f "$flag" ]] && existed="$(cat "$flag")"

  if [[ "$existed" == "1" ]]; then
    mkdir -p "$ROOT/$(dirname "$rel")"
    cp "$BACKUP/$rel" "$ROOT/$rel"
  else
    rm -f "$ROOT/$rel"
  fi
done

node --check "$ROOT/memeflow-app/trading.js"

echo "V84 ROLLBACK OK"
echo "Restored from: $BACKUP"
echo "Review with: git status --short"
