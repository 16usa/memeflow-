#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in "$APP/trading.html" "$APP/trading.css"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing required file: $f"
    exit 1
  fi
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/row-height-unify-v87-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/trading.html"
  "memeflow-app/trading-row-height-v87.css"
  "memeflow-app/tests/row-height-unify-v87.mjs"
)

for rel in "${TARGETS[@]}"; do
  flag="$BACKUP/${rel//\//__}.existed"
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BACKUP/$rel"
    printf '1\n' > "$flag"
  else
    printf '0\n' > "$flag"
  fi
done

git rev-parse HEAD > "$BACKUP/git-head.txt" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-row-height-unify-v87-last-backup"

cp "$PATCH_DIR/trading-row-height-v87.css" \
   "$APP/trading-row-height-v87.css"

python3 - "$APP/trading.html" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
html = path.read_text()

href = '/trading-row-height-v87.css?v=row-height-unify-v87-20260909'

if '/trading-row-height-v87.css' not in html:
    block = (
        '<!-- MEMEFLOW_ROW_HEIGHT_UNIFY_V87_ASSET -->\n'
        f'<link rel="stylesheet" href="{href}">\n'
        '<!-- /MEMEFLOW_ROW_HEIGHT_UNIFY_V87_ASSET -->\n'
    )

    anchor = '</head>'
    if anchor not in html:
        raise SystemExit('ERROR: </head> not found in trading.html')

    # V87 intentionally loads last so it owns only final row geometry.
    html = html.replace(anchor, block + anchor, 1)

path.write_text(html)
PY

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/row-height-unify-v87.mjs" \
   "$APP/tests/row-height-unify-v87.mjs"

echo "[1/4] Syntax / asset check"
node --check "$APP/tests/row-height-unify-v87.mjs"

echo "[2/4] V87 regression test"
(
  cd "$APP"
  node tests/row-height-unify-v87.mjs
)

echo "[3/4] Existing Open Position safety/UI tests"
(
  cd "$APP"
  if [[ -f tests/open-position-popover-v85.mjs ]]; then
    node tests/open-position-popover-v85.mjs
  fi
  if [[ -f tests/open-position-live-value-v83.mjs ]]; then
    node tests/open-position-live-value-v83.mjs
  fi
  if [[ -f tests/open-position-mark-parity-v81.mjs ]]; then
    node tests/open-position-mark-parity-v81.mjs
  fi
  if [[ -f tests/paper-close-safety-v78.mjs ]]; then
    node tests/paper-close-safety-v78.mjs
  fi
)

echo "[4/4] Diff guard + Git checkpoint"
git diff --check -- \
  memeflow-app/trading.html \
  memeflow-app/trading-row-height-v87.css \
  memeflow-app/tests/row-height-unify-v87.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V87 installed/tested, but auto-commit/push skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/trading.html \
      memeflow-app/trading-row-height-v87.css \
      memeflow-app/tests/row-height-unify-v87.mjs

    if git diff --cached --quiet; then
      echo "V87 already present; nothing new to commit."
    else
      git commit -m "fix(trading): unify operational row heights"

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

echo
echo "V87 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-row-height-unify-v87/rollback.sh"
echo
echo "Final row height:"
echo "  Candidates     = 64px (reference, untouched)"
echo "  Open positions = 64px"
echo "  Recent trades  = 64px"
