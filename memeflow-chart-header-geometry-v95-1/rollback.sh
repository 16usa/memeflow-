#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

SOURCE_POINTER="$ROOT/.memeflow-chart-header-geometry-v95-1-rollback-source"
if [[ ! -f "$SOURCE_POINTER" ]]; then
  echo "ERROR: no V95.1 rollback source found."
  exit 1
fi

BACKUP="$(cat "$SOURCE_POINTER")"
if [[ ! -d "$BACKUP" ]]; then
  echo "ERROR: rollback backup directory not found: $BACKUP"
  exit 1
fi

TARGETS=(
  "memeflow-app/trading.css"
  "memeflow-app/trading-visual-hierarchy-v67.css"
  "memeflow-app/trading.html"
  "memeflow-app/chart-header-geometry-v95.css"
  "memeflow-app/chart-header-geometry-v95-1.css"
  "memeflow-app/tests/chart-header-geometry-v95.mjs"
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

echo "V95.1 ROLLBACK OK"
echo "Restored from: $BACKUP"
echo "Review with: git status --short"
