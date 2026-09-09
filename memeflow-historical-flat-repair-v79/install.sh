#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -d "$APP" || ! -f "$APP/src/platform-trade-analytics.mjs" ]]; then
  echo "ERROR: run from the MEMEFLOW repository root."
  exit 1
fi

mkdir -p "$APP/src" "$APP/scripts" "$APP/tests"

cp "$PATCH_DIR/src/historical-flat-repair-v79.mjs" \
   "$APP/src/historical-flat-repair-v79.mjs"
cp "$PATCH_DIR/scripts/historical-flat-repair-v79.mjs" \
   "$APP/scripts/historical-flat-repair-v79.mjs"
cp "$PATCH_DIR/tests/historical-flat-repair-v79.mjs" \
   "$APP/tests/historical-flat-repair-v79.mjs"

echo "[1/4] Syntax check"
node --check "$APP/src/historical-flat-repair-v79.mjs"
node --check "$APP/scripts/historical-flat-repair-v79.mjs"
node --check "$APP/tests/historical-flat-repair-v79.mjs"

echo "[2/4] Regression test"
(
  cd "$APP"
  node tests/historical-flat-repair-v79.mjs
)

echo "[3/4] Git checkpoint"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V79 files are installed/tested, but auto-commit/push is skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/src/historical-flat-repair-v79.mjs \
      memeflow-app/scripts/historical-flat-repair-v79.mjs \
      memeflow-app/tests/historical-flat-repair-v79.mjs

    if git diff --cached --quiet; then
      echo "V79 code already present; nothing new to commit."
    else
      git commit -m "feat(analytics): audit historical false flat outcomes"

      if git remote get-url origin >/dev/null 2>&1; then
        if git push origin HEAD; then
          echo "Push: OK"
        else
          echo "NOTICE: commit created locally, but push failed."
          echo "Run: git push origin HEAD"
        fi
      fi
    fi
  fi
fi

echo "[4/4] Historical Flat audit (READ-ONLY)"
node "$APP/scripts/historical-flat-repair-v79.mjs" --audit

echo
echo "V79 AUDIT INSTALLED"
echo "No historical trading data was modified."
echo "Send the audit summary to ChatGPT before running --apply."
