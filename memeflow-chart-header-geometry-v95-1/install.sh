#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in \
  "$APP/trading.css" \
  "$APP/trading-visual-hierarchy-v67.css" \
  "$APP/trading.html" \
  "$APP/trading-row-height-v89.css"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing required file: $f"
    exit 1
  fi
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/chart-header-geometry-v95-1-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

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
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BACKUP/$rel"
    printf '1\n' > "$flag"
  else
    printf '0\n' > "$flag"
  fi
done

git rev-parse HEAD > "$BACKUP/git-head.txt" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-chart-header-geometry-v95-1-last-backup"

# If V95 already failed after editing files, use its PRE-INSTALL backup as the
# rollback target. This makes rollback return to the clean V94 state, not the
# half-installed V95 state.
ROLLBACK_SOURCE="$BACKUP"
OLD_POINTER="$ROOT/.memeflow-chart-header-geometry-v95-last-backup"
if [[ -f "$OLD_POINTER" ]] && grep -q 'MEMEFLOW_CHART_HEADER_GEOMETRY_V95_ASSET' "$APP/trading.html"; then
  OLD_BACKUP="$(cat "$OLD_POINTER")"
  if [[ -d "$OLD_BACKUP" ]]; then
    ROLLBACK_SOURCE="$OLD_BACKUP"
    echo "Detected partial V95 install."
    echo "Rollback baseline: original pre-V95 backup"
  fi
fi
printf '%s\n' "$ROLLBACK_SOURCE" > "$ROOT/.memeflow-chart-header-geometry-v95-1-rollback-source"

cp "$PATCH_DIR/chart-header-geometry-v95-1.css" \
   "$APP/chart-header-geometry-v95-1.css"

python3 - \
  "$APP/trading.css" \
  "$APP/trading-visual-hierarchy-v67.css" \
  "$APP/trading.html" <<'PY'
from pathlib import Path
import re
import sys

trading_path = Path(sys.argv[1])
hierarchy_path = Path(sys.argv[2])
html_path = Path(sys.argv[3])

trading = trading_path.read_text()
hierarchy = hierarchy_path.read_text()
html = html_path.read_text()

# ---------------------------------------------------------------------------
# Idempotent cleanup: works both from clean V94 and from the half-installed V95.
# ONLY selected-token header geometry is changed.
# ---------------------------------------------------------------------------

# Base chart-head geometry, if still present.
trading = re.sub(
    r'\.chart-head\s*\{\s*'
    r'min-height:\s*73px;\s*'
    r'padding:\s*11px 13px;\s*'
    r'display:\s*flex;\s*'
    r'align-items:\s*center;\s*'
    r'justify-content:\s*space-between;\s*'
    r'gap:\s*16px;\s*'
    r'(border-bottom:[^;]+;)\s*'
    r'\}',
    r'.chart-head {\n  \1\n}',
    trading,
    count=1
)

# Base token-title flex geometry, if still present.
trading = re.sub(
    r'\.token-title\s*\{\s*'
    r'display:\s*flex;\s*'
    r'align-items:\s*center;\s*'
    r'gap:\s*10px;\s*'
    r'min-width:\s*0;\s*'
    r'\}',
    '.token-title { min-width: 0; }',
    trading,
    count=1
)

# Canonicalize the base token-avatar if old 48px remains.
trading = re.sub(
    r'(\.token-avatar\s*\{\s*)'
    r'width:\s*48px;\s*'
    r'height:\s*48px;',
    r'\1width: 36px;\n  height: 36px;',
    trading,
    count=1
)

# Remove historical chart-head / avatar mobile geometry if still present.
patterns = [
    r'\n\s*\.chart-head\s*\{\s*min-height:\s*62px;\s*padding:\s*8px 9px;\s*\}',
    r'\n\s*\.token-avatar\s*\{\s*width:\s*33px;\s*height:\s*33px;\s*\}',
    r'\n\s*\.chart-head\s*\{\s*min-height:\s*54px;\s*padding:\s*7px 8px;\s*gap:\s*8px;\s*\}',
    r'\n\s*\.token-title\s*\{\s*gap:\s*7px;\s*\}',
    r'\n\s*\.token-avatar\s*\{\s*width:\s*31px;\s*height:\s*31px;\s*border-radius:\s*8px;\s*\}',
    r'\n?\.chart-head \.token-avatar\s*\{\s*'
    r'width:\s*40px;\s*'
    r'height:\s*40px;\s*'
    r'flex:\s*0 0 40px;\s*'
    r'border-radius:\s*10px;\s*'
    r'\}\s*'
]
for pattern in patterns:
    trading = re.sub(pattern, '\n', trading)

# Remove marked V129 / V130 if still present.
for version in ('129', '130'):
    hierarchy = re.sub(
        rf'/\* =+\n'
        rf'\s*MEMEFLOW CHART HEADER ROW V{version}[\s\S]*?'
        rf'/\* MEMEFLOW_CHART_HEADER_ROW_V{version}_END \*/\s*',
        '',
        hierarchy,
        count=1,
        flags=re.M
    )

# Remove failed V95 asset and any old/repeated V95.1 asset.
html = re.sub(
    r'\n?<!-- MEMEFLOW_CHART_HEADER_GEOMETRY_V95_ASSET -->\s*'
    r'<link[^>]+chart-header-geometry-v95\.css[^>]*>\s*'
    r'<!-- /MEMEFLOW_CHART_HEADER_GEOMETRY_V95_ASSET -->\s*',
    '\n',
    html,
    flags=re.M
)

html = re.sub(
    r'\n?<!-- MEMEFLOW_CHART_HEADER_GEOMETRY_V95_1_ASSET -->\s*'
    r'<link[^>]+chart-header-geometry-v95-1\.css[^>]*>\s*'
    r'<!-- /MEMEFLOW_CHART_HEADER_GEOMETRY_V95_1_ASSET -->\s*',
    '\n',
    html,
    flags=re.M
)

block = (
    '<!-- MEMEFLOW_CHART_HEADER_GEOMETRY_V95_1_ASSET -->\n'
    '<link rel="stylesheet" '
    'href="/chart-header-geometry-v95-1.css?v=chart-header-geometry-v95-1-20260909">\n'
    '<!-- /MEMEFLOW_CHART_HEADER_GEOMETRY_V95_1_ASSET -->\n'
)

anchor = '</head>'
if anchor not in html:
    raise SystemExit('ERROR: </head> not found')

html = html.replace(anchor, block + anchor, 1)

# Cache-bust edited existing CSS files.
html = re.sub(
    r'/trading\.css\?v=[^"\']+',
    '/trading.css?v=chart-header-geometry-v95-1-20260909',
    html,
    count=1
)
html = re.sub(
    r'/trading-visual-hierarchy-v67\.css\?v=[^"\']+',
    '/trading-visual-hierarchy-v67.css?v=chart-header-geometry-v95-1-20260909',
    html,
    count=1
)

trading_path.write_text(trading)
hierarchy_path.write_text(hierarchy)
html_path.write_text(html)
PY

# Remove half-installed V95 artifacts; V95.1 is the only authority.
rm -f "$APP/chart-header-geometry-v95.css"
rm -f "$APP/tests/chart-header-geometry-v95.mjs"

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/chart-header-geometry-v95-1.mjs" \
   "$APP/tests/chart-header-geometry-v95-1.mjs"

echo "[1/4] Syntax / scope check"
node --check "$APP/tests/chart-header-geometry-v95-1.mjs"

echo "[2/4] V95.1 regression test"
(
  cd "$APP"
  node tests/chart-header-geometry-v95-1.mjs
)

echo "[3/4] Existing safety tests (no stale V94 cache-string assertion)"
(
  cd "$APP"

  # V94's old test hard-coded its own CSS cache-bust URL. V95 legitimately
  # changes that URL, so re-running that exact assertion is stale. V95.1
  # independently verifies the real V94 contract: token avatar = 36x36.

  if [[ -f tests/open-position-icon-geometry-v93.mjs ]]; then
    node tests/open-position-icon-geometry-v93.mjs
  fi

  if [[ -f tests/row-height-canonical-v89.mjs ]]; then
    node tests/row-height-canonical-v89.mjs
  fi
)

echo "[4/4] Diff guard + Git checkpoint"
git diff --check -- \
  memeflow-app/trading.css \
  memeflow-app/trading-visual-hierarchy-v67.css \
  memeflow-app/trading.html \
  memeflow-app/chart-header-geometry-v95-1.css \
  memeflow-app/tests/chart-header-geometry-v95-1.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V95.1 installed/tested, but auto-commit/push skipped to avoid mixing unrelated work."
  else
    git add -A -- \
      memeflow-app/trading.css \
      memeflow-app/trading-visual-hierarchy-v67.css \
      memeflow-app/trading.html \
      memeflow-app/chart-header-geometry-v95.css \
      memeflow-app/chart-header-geometry-v95-1.css \
      memeflow-app/tests/chart-header-geometry-v95.mjs \
      memeflow-app/tests/chart-header-geometry-v95-1.mjs

    if git diff --cached --quiet; then
      echo "V95.1 already present; nothing new to commit."
    else
      git commit -m "fix(trading): unify selected token header geometry"

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
echo "V95.1 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback source: $ROLLBACK_SOURCE"
echo "Rollback: bash memeflow-chart-header-geometry-v95-1/rollback.sh"
echo
echo "Selected-token header only:"
echo "  avatar            = 36x36"
echo "  header            = 64px"
echo "  left/right pad    = 9px"
echo "  top/bottom around avatar = 14px"
echo "  avatar -> text    = 17px"
echo "  price block       = right-aligned in same 64px row"
echo
echo "Chart/canvas/timeframes/legend/indicators were NOT touched."
