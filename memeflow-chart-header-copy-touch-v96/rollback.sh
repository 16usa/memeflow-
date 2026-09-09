#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

POINTER="$ROOT/.memeflow-chart-header-copy-touch-v96-last-backup"
[[ -f "$POINTER" ]] || { echo "ERROR: no V96 backup pointer found."; exit 1; }

BACKUP="$(cat "$POINTER")"
[[ -d "$BACKUP" ]] || { echo "ERROR: V96 backup not found: $BACKUP"; exit 1; }

TARGETS=(
  "memeflow-app/chart-header-geometry-v95-1.css"
  "memeflow-app/trading.html"
  "memeflow-app/tests/chart-header-copy-touch-v96.mjs"
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

echo "V96 ROLLBACK OK"
echo "Restored from: $BACKUP"
