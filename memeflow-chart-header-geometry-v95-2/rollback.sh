#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

POINTER="$ROOT/.memeflow-chart-header-geometry-v95-2-last-backup"

if [[ ! -f "$POINTER" ]]; then
  echo "ERROR: no V95.2 backup pointer found."
  exit 1
fi

BACKUP="$(cat "$POINTER")"
if [[ ! -d "$BACKUP" ]]; then
  echo "ERROR: V95.2 backup not found: $BACKUP"
  exit 1
fi

TARGETS=(
  "memeflow-app/trading.css"
  "memeflow-app/trading-visual-hierarchy-v67.css"
  "memeflow-app/trading.html"
  "memeflow-app/chart-header-geometry-v95-1.css"
  "memeflow-app/tests/chart-header-geometry-v95-1.mjs"
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

echo "V95.2 FINALIZER ROLLBACK OK"
echo "Restored the exact half-installed V95.1 state from:"
echo "  $BACKUP"
echo
echo "For a FULL rollback to pre-V95, use:"
echo "  bash memeflow-chart-header-geometry-v95-1/rollback.sh"
