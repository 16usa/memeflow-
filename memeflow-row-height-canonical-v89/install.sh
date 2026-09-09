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
BACKUP="$ROOT/.memeflow-backups/row-height-canonical-v89-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/trading.html"
  "memeflow-app/trading-row-height-v89.css"
  "memeflow-app/tests/row-height-canonical-v89.mjs"
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
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-row-height-canonical-v89-last-backup"

cp "$PATCH_DIR/trading-row-height-v89.css" \
   "$APP/trading-row-height-v89.css"

python3 - "$APP/trading.html" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
html = path.read_text()

# Remove the old V87 linked runtime layer. The file may remain in the repo,
# but it is no longer loaded, so there is no cascade conflict.
html = re.sub(
    r'\n?<!-- MEMEFLOW_ROW_HEIGHT_UNIFY_V87_ASSET -->\s*'
    r'<link[^>]+trading-row-height-v87\.css[^>]*>\s*'
    r'<!-- /MEMEFLOW_ROW_HEIGHT_UNIFY_V87_ASSET -->\s*',
    '\n',
    html,
    flags=re.M
)

# Defensive cleanup if an experimental V88 build was ever installed locally.
html = re.sub(
    r'\n?<!-- MEMEFLOW_ROW_HEIGHT_SYNC_V88_ASSET -->\s*'
    r'<script[^>]+trading-row-height-sync-v88\.js[^>]*></script>\s*'
    r'<!-- /MEMEFLOW_ROW_HEIGHT_SYNC_V88_ASSET -->\s*',
    '\n',
    html,
    flags=re.M
)

# Remove any previous V89 asset block before adding the canonical one once.
html = re.sub(
    r'\n?<!-- MEMEFLOW_ROW_HEIGHT_CANONICAL_V89_ASSET -->\s*'
    r'<link[^>]+trading-row-height-v89\.css[^>]*>\s*'
    r'<!-- /MEMEFLOW_ROW_HEIGHT_CANONICAL_V89_ASSET -->\s*',
    '\n',
    html,
    flags=re.M
)

block = (
    '<!-- MEMEFLOW_ROW_HEIGHT_CANONICAL_V89_ASSET -->\n'
    '<link rel="stylesheet" '
    'href="/trading-row-height-v89.css?v=row-height-canonical-v89-20260909">\n'
    '<!-- /MEMEFLOW_ROW_HEIGHT_CANONICAL_V89_ASSET -->\n'
)

anchor = '</head>'
if anchor not in html:
    raise SystemExit('ERROR: </head> not found in trading.html')

# Load LAST: this stylesheet owns only final row geometry.
html = html.replace(anchor, block + anchor, 1)

path.write_text(html)
PY

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/row-height-canonical-v89.mjs" \
   "$APP/tests/row-height-canonical-v89.mjs"

echo "[1/4] Syntax / asset check"
node --check "$APP/tests/row-height-canonical-v89.mjs"

echo "[2/4] V89 regression test"
(
  cd "$APP"
  node tests/row-height-canonical-v89.mjs
)

echo "[3/4] Existing Open Position / trading safety tests"
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
  memeflow-app/trading-row-height-v89.css \
  memeflow-app/tests/row-height-canonical-v89.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V89 installed/tested, but auto-commit/push skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/trading.html \
      memeflow-app/trading-row-height-v89.css \
      memeflow-app/tests/row-height-canonical-v89.mjs

    if git diff --cached --quiet; then
      echo "V89 already present; nothing new to commit."
    else
      git commit -m "fix(trading): enforce canonical 64px rows"

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
echo "V89 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-row-height-canonical-v89/rollback.sh"
echo
echo "Canonical Trading row contract:"
echo "  Candidates     = 64px"
echo "  Open positions = 64px"
echo "  Recent trades  = 64px"
echo "  Vertical pad   = 8px"
echo "  Runtime JS sync = NONE"
