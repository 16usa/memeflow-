#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in \
  "$APP/trading.html" \
  "$APP/trading-visual-hierarchy-v67.css" \
  "$APP/trading-row-height-v89.css"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing required file: $f"
    exit 1
  fi
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/open-position-align-v91-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/trading.html"
  "memeflow-app/open-position-align-v91.css"
  "memeflow-app/tests/open-position-align-v91.mjs"
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
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-open-position-align-v91-last-backup"

cp "$PATCH_DIR/open-position-align-v91.css" \
   "$APP/open-position-align-v91.css"

python3 - "$APP/trading.html" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
html = path.read_text()

# Remove V90 runtime ownership entirely.
html = re.sub(
    r'\n?<!-- MEMEFLOW_OPEN_POSITION_COPY_ALIGN_V90_ASSET -->\s*'
    r'<link[^>]+open-position-copy-align-v90\.css[^>]*>\s*'
    r'<!-- /MEMEFLOW_OPEN_POSITION_COPY_ALIGN_V90_ASSET -->\s*',
    '\n',
    html,
    flags=re.M
)

# Idempotent V91 reinstall.
html = re.sub(
    r'\n?<!-- MEMEFLOW_OPEN_POSITION_ALIGN_V91_ASSET -->\s*'
    r'<link[^>]+open-position-align-v91\.css[^>]*>\s*'
    r'<!-- /MEMEFLOW_OPEN_POSITION_ALIGN_V91_ASSET -->\s*',
    '\n',
    html,
    flags=re.M
)

block = (
    '<!-- MEMEFLOW_OPEN_POSITION_ALIGN_V91_ASSET -->\n'
    '<link rel="stylesheet" '
    'href="/open-position-align-v91.css?v=open-position-align-v91-20260909-1">\n'
    '<!-- /MEMEFLOW_OPEN_POSITION_ALIGN_V91_ASSET -->\n'
)

anchor = '</head>'
if anchor not in html:
    raise SystemExit('ERROR: </head> not found')

# Final style layer: V91 owns Open Position internal vertical composition.
html = html.replace(anchor, block + anchor, 1)

path.write_text(html)
PY

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/open-position-align-v91.mjs" \
   "$APP/tests/open-position-align-v91.mjs"

echo "[1/4] Syntax / asset check"
node --check "$APP/tests/open-position-align-v91.mjs"

echo "[2/4] V91 regression test"
(
  cd "$APP"
  node tests/open-position-align-v91.mjs
)

echo "[3/4] Existing row / Open Position safety tests"
(
  cd "$APP"

  if [[ -f tests/row-height-canonical-v89.mjs ]]; then
    node tests/row-height-canonical-v89.mjs
  fi

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
  memeflow-app/open-position-align-v91.css \
  memeflow-app/tests/open-position-align-v91.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V91 installed/tested, but auto-commit/push skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/trading.html \
      memeflow-app/open-position-align-v91.css \
      memeflow-app/tests/open-position-align-v91.mjs

    if git diff --cached --quiet; then
      echo "V91 already present; nothing new to commit."
    else
      git commit -m "fix(trading): resolve open position vertical layout"

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
echo "V91 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-open-position-align-v91/rollback.sh"
echo
echo "Resolved conflict:"
echo "  V67 mobile .position-bottomline display:block !important"
echo "  -> V91 final display:flex !important"
echo "  position-main -> centered vertical flex stack"
echo "  V89 64px row contract unchanged"
