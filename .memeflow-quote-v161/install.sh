#!/usr/bin/env bash
set -euo pipefail

ROOT="memeflow-app"
FILES=(
  "$ROOT/src/pump-live-trade-feed.mjs"
  "$ROOT/src/chart-history-archive.mjs"
  "$ROOT/src/pump-history-backfill.mjs"
  "$ROOT/app-server.mjs"
  "$ROOT/trading.js"
)

for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "ERROR: missing $f"; exit 1; }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/quote-price-v16.1-$STAMP"
mkdir -p "$BACKUP"
cp "${FILES[@]}" "$BACKUP"/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/patch.py"

echo
echo "===== SYNTAX CHECK ====="
for f in "${FILES[@]}"; do
  node --check "$f"
done

echo
echo "===== REQUIRED MARKERS ====="
grep -n \
  "EXECUTION_PRICE_AUTHORITY_V16\|REFERENCE_REPAIR_AND_CIRCUIT_BREAKER_V16_1\|REFERENCE_MC_DISPLAY_FALLBACK_V16" \
  "${FILES[@]}"

echo
echo "===== GIT CHECK ====="
git diff --check
git diff --stat

echo
echo "===== COMMIT + PUSH ====="
git add "${FILES[@]}"
git diff --cached --quiet || \
  git commit -m "Repair Pump execution price pipeline V16.1"
git push

echo
echo "DONE V16.1."
echo "No server restart was performed."
echo "Restart Replit manually."
