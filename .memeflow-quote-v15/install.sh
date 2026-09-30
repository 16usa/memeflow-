#!/usr/bin/env bash
set -euo pipefail

echo '=== MEMEFLOW Quote-Aware Market Fix V15 ==='
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$PATCH_DIR/patch.py"

echo
echo '=== Syntax checks ==='
node --check memeflow-app/src/pump-live-trade-feed.mjs
node --check memeflow-app/src/chart-history-archive.mjs
node --check memeflow-app/src/live-card-market.mjs
node --check memeflow-app/src/paper-position-mark-v81.mjs
node --check memeflow-app/src/paper-engine.mjs
node --check memeflow-app/app-server.mjs

echo
echo '=== Patch markers ==='
grep -nE 'QUOTE_AWARE_PUMP_PRICE_V15|CHART_QUOTE_BACKFILL_V15|QUOTE_STALE_DISPLAY_GUARD_V15|QUOTE_STALE_MARK_GUARD_V15|QUOTE_MARK_FAIL_CLOSED_V15|QUOTE_ENTRY_FAIL_CLOSED_V15' \
  memeflow-app/src/pump-live-trade-feed.mjs \
  memeflow-app/src/chart-history-archive.mjs \
  memeflow-app/src/live-card-market.mjs \
  memeflow-app/src/paper-position-mark-v81.mjs \
  memeflow-app/src/paper-engine.mjs \
  memeflow-app/app-server.mjs

echo
echo '=== Git diff check ==='
git diff --check
git diff --stat

git add \
  memeflow-app/src/pump-live-trade-feed.mjs \
  memeflow-app/src/chart-history-archive.mjs \
  memeflow-app/src/live-card-market.mjs \
  memeflow-app/src/paper-position-mark-v81.mjs \
  memeflow-app/src/paper-engine.mjs \
  memeflow-app/app-server.mjs

git diff --cached --quiet || git commit -m 'Fix stale quote price and quote-aware chart backfill V15'
git push

echo
echo 'DONE. No server restart was performed.'
echo 'Restart the Replit app manually, then reopen the same token.'
