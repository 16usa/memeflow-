#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

POINTER="$ROOT/.memeflow-chart-header-row-parity-v97-last-backup"
[[ -f "$POINTER" ]] || { echo "ERROR: no V97 backup pointer found."; exit 1; }

BACKUP="$(cat "$POINTER")"
[[ -d "$BACKUP" ]] || { echo "ERROR: V97 backup not found: $BACKUP"; exit 1; }

TARGETS=(
  "memeflow-app/trading.html"
  "memeflow-app/chart-header-geometry-v95-1.css"
  "memeflow-app/chart-header-geometry-v97.css"
  "memeflow-app/tests/chart-header-geometry-v95-1.mjs"
  "memeflow-app/tests/chart-header-copy-touch-v96.mjs"
  "memeflow-app/tests/chart-header-row-parity-v97.mjs"
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

echo "V97 ROLLBACK OK"
echo "Restored from: $BACKUP"
echo "Review: git status --short"
