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
BACKUP="$ROOT/.memeflow-backups/chart-header-geometry-v95-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/trading.css"
  "memeflow-app/trading-visual-hierarchy-v67.css"
  "memeflow-app/trading.html"
  "memeflow-app/chart-header-geometry-v95.css"
  "memeflow-app/tests/chart-header-geometry-v95.mjs"
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
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-chart-header-geometry-v95-last-backup"

cp "$PATCH_DIR/chart-header-geometry-v95.css" \
   "$APP/chart-header-geometry-v95.css"

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
# Clean old chart-header geometry from trading.css.
# Do NOT touch chart-wrap / canvas / timeframes / indicator / chart logic.
# ---------------------------------------------------------------------------

# Base chart head: remove old 73px/flex geometry, leave border declaration.
trading, n = re.subn(
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
if n != 1:
    raise SystemExit('ERROR: old base .chart-head geometry not found')

# Base token-title: remove old flex geometry, keep only min-width.
trading, n = re.subn(
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
if n != 1:
    raise SystemExit('ERROR: old base .token-title geometry not found')

# Base token-avatar was historically 48px. V94 already changed the shared
# .trade-token-avatar to 36px, but this chart-specific rule still conflicts.
trading, n = re.subn(
    r'(\.token-avatar\s*\{\s*)'
    r'width:\s*48px;\s*'
    r'height:\s*48px;',
    r'\1width: 36px;\n  height: 36px;',
    trading,
    count=1
)
if n != 1:
    raise SystemExit('ERROR: old base .token-avatar 48px geometry not found')

# Remove old mobile single-line chart head / avatar size overrides.
trading = re.sub(
    r'\n\s*\.chart-head\s*\{\s*min-height:\s*62px;\s*padding:\s*8px 9px;\s*\}',
    '',
    trading
)
trading = re.sub(
    r'\n\s*\.token-avatar\s*\{\s*width:\s*33px;\s*height:\s*33px;\s*\}',
    '',
    trading
)

# Remove compact V4 chart-head geometry and avatar size. Keep unrelated
# typography/chart-wrap rules in that media block.
trading = re.sub(
    r'\n\s*\.chart-head\s*\{\s*min-height:\s*54px;\s*padding:\s*7px 8px;\s*gap:\s*8px;\s*\}',
    '',
    trading
)
trading = re.sub(
    r'\n\s*\.token-title\s*\{\s*gap:\s*7px;\s*\}',
    '',
    trading
)
trading = re.sub(
    r'\n\s*\.token-avatar\s*\{\s*width:\s*31px;\s*height:\s*31px;\s*border-radius:\s*8px;\s*\}',
    '',
    trading
)

# Remove the later chart-only 40px avatar override.
trading = re.sub(
    r'\n?\.chart-head \.token-avatar\s*\{\s*'
    r'width:\s*40px;\s*'
    r'height:\s*40px;\s*'
    r'flex:\s*0 0 40px;\s*'
    r'border-radius:\s*10px;\s*'
    r'\}\s*',
    '\n',
    trading
)

# ---------------------------------------------------------------------------
# Remove the two marked historical chart-header layout experiments from V67.
# V95 becomes the only late authority for this exact position.
# ---------------------------------------------------------------------------
for version in ('129', '130'):
    pattern = re.compile(
        rf'/\* =+\n'
        rf'\s*MEMEFLOW CHART HEADER ROW V{version}[\s\S]*?'
        rf'/\* MEMEFLOW_CHART_HEADER_ROW_V{version}_END \*/\s*',
        re.M
    )
    hierarchy, count = pattern.subn('', hierarchy, count=1)
    if count != 1:
        raise SystemExit(
            f'ERROR: marked chart-header V{version} block not found'
        )

# ---------------------------------------------------------------------------
# Add one final isolated asset. Idempotent.
# ---------------------------------------------------------------------------
html = re.sub(
    r'\n?<!-- MEMEFLOW_CHART_HEADER_GEOMETRY_V95_ASSET -->\s*'
    r'<link[^>]+chart-header-geometry-v95\.css[^>]*>\s*'
    r'<!-- /MEMEFLOW_CHART_HEADER_GEOMETRY_V95_ASSET -->\s*',
    '\n',
    html,
    flags=re.M
)

block = (
    '<!-- MEMEFLOW_CHART_HEADER_GEOMETRY_V95_ASSET -->\n'
    '<link rel="stylesheet" '
    'href="/chart-header-geometry-v95.css?v=chart-header-geometry-v95-20260909">\n'
    '<!-- /MEMEFLOW_CHART_HEADER_GEOMETRY_V95_ASSET -->\n'
)

anchor = '</head>'
if anchor not in html:
    raise SystemExit('ERROR: </head> not found')

html = html.replace(anchor, block + anchor, 1)

# Cache-bust the two edited existing CSS files.
html, c1 = re.subn(
    r'/trading\.css\?v=[^"\']+',
    '/trading.css?v=chart-header-geometry-v95-20260909',
    html,
    count=1
)
html, c2 = re.subn(
    r'/trading-visual-hierarchy-v67\.css\?v=[^"\']+',
    '/trading-visual-hierarchy-v67.css?v=chart-header-geometry-v95-20260909',
    html,
    count=1
)
if c1 != 1 or c2 != 1:
    raise SystemExit('ERROR: expected Trading CSS links not found')

trading_path.write_text(trading)
hierarchy_path.write_text(hierarchy)
html_path.write_text(html)
PY

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/chart-header-geometry-v95.mjs" \
   "$APP/tests/chart-header-geometry-v95.mjs"

echo "[1/4] Syntax / scope check"
node --check "$APP/tests/chart-header-geometry-v95.mjs"

echo "[2/4] V95 regression test"
(
  cd "$APP"
  node tests/chart-header-geometry-v95.mjs
)

echo "[3/4] Existing avatar / row / Open Position tests"
(
  cd "$APP"

  if [[ -f tests/token-avatar-36-v94.mjs ]]; then
    node tests/token-avatar-36-v94.mjs
  fi

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
  memeflow-app/chart-header-geometry-v95.css \
  memeflow-app/tests/chart-header-geometry-v95.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V95 installed/tested, but auto-commit/push skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/trading.css \
      memeflow-app/trading-visual-hierarchy-v67.css \
      memeflow-app/trading.html \
      memeflow-app/chart-header-geometry-v95.css \
      memeflow-app/tests/chart-header-geometry-v95.mjs

    if git diff --cached --quiet; then
      echo "V95 already present; nothing new to commit."
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
echo "V95 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-chart-header-geometry-v95/rollback.sh"
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
