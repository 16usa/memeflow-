#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
POINTER="$ROOT/.memeflow-token-avatar-36-v94-last-backup"
[[ -f "$POINTER" ]] || { echo 'ERROR: no V94 backup pointer'; exit 1; }
BACKUP="$(cat "$POINTER")"
TARGETS=(
  "memeflow-app/trading.css"
  "memeflow-app/trading-visual-hierarchy-v67.css"
  "memeflow-app/trading.html"
  "memeflow-app/tests/token-avatar-36-v94.mjs"
)
for rel in "${TARGETS[@]}"; do
  flag="$BACKUP/${rel//\//__}.existed"; existed=0
  [[ -f "$flag" ]] && existed="$(cat "$flag")"
  if [[ "$existed" == 1 ]]; then mkdir -p "$ROOT/$(dirname "$rel")"; cp "$BACKUP/$rel" "$ROOT/$rel"; else rm -f "$ROOT/$rel"; fi
done
echo 'V94 ROLLBACK OK'
echo "Restored from: $BACKUP"
