#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in \
  "$APP/trading.html" \
  "$APP/open-position-popover-v85.css" \
  "$APP/memeflow-accessibility-usability-v64a.css" \
  "$APP/trading-row-height-v89.css"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing required file: $f"
    exit 1
  fi
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/open-position-icon-geometry-v93-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/trading.html"
  "memeflow-app/open-position-popover-v85.css"
  "memeflow-app/tests/open-position-icon-geometry-v93.mjs"
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
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-open-position-icon-geometry-v93-last-backup"

python3 - "$APP/open-position-popover-v85.css" "$APP/trading.html" <<'PY'
from pathlib import Path
import re
import sys

css_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])

css = css_path.read_text()
html = html_path.read_text()

marker_start = '/* MEMEFLOW_OPEN_POSITION_ICON_GEOMETRY_V93 */'
marker_end = '/* /MEMEFLOW_OPEN_POSITION_ICON_GEOMETRY_V93 */'

css = re.sub(
    re.escape(marker_start) + r'[\s\S]*?' + re.escape(marker_end) + r'\s*',
    '',
    css,
    flags=re.M
)

fix = '''
/* MEMEFLOW_OPEN_POSITION_ICON_GEOMETRY_V93
   Confirmed root cause:
   memeflow-accessibility-usability-v64a.css gives EVERY native button
   min-block-size:44px on coarse pointers.

   .position-info-v85 is a native button. Its SVG looked 14/16px, but its
   layout box was still 44px tall. That made .position-bottomline 44px tall
   and pushed the token title upward inside the fixed 64px row.
*/
@media (pointer: coarse) {
  body.mf-accessibility-v64a .position-info-v85 {
    block-size: 16px !important;
    min-block-size: 16px !important;
    max-block-size: 16px !important;

    height: 16px !important;
    min-height: 16px !important;
    max-height: 16px !important;

    padding-block: 0 !important;
  }
}

@media (pointer: coarse) and (max-width: 430px) {
  body.mf-accessibility-v64a .position-info-v85 {
    block-size: 14px !important;
    min-block-size: 14px !important;
    max-block-size: 14px !important;

    height: 14px !important;
    min-height: 14px !important;
    max-height: 14px !important;
  }
}
/* /MEMEFLOW_OPEN_POSITION_ICON_GEOMETRY_V93 */
'''

css = css.rstrip() + '\n\n' + fix.strip() + '\n'
css_path.write_text(css)

patterns = [
    (
        'MEMEFLOW_OPEN_POSITION_COPY_ALIGN_V90_ASSET',
        r'open-position-copy-align-v90\.css'
    ),
    (
        'MEMEFLOW_OPEN_POSITION_ALIGN_V91_ASSET',
        r'open-position-align-v91\.css'
    ),
    (
        'MEMEFLOW_OPEN_POSITION_CANDIDATE_ALIGN_V92_ASSET',
        r'open-position-candidate-align-v92\.css'
    )
]

for marker, href in patterns:
    html = re.sub(
        rf'\n?<!-- {marker} -->\s*'
        rf'<link[^>]+{href}[^>]*>\s*'
        rf'<!-- /{marker} -->\s*',
        '\n',
        html,
        flags=re.M
    )

html, count = re.subn(
    r'/open-position-popover-v85\.css\?v=[^"\']+',
    '/open-position-popover-v85.css?v=open-position-icon-geometry-v93-20260909',
    html,
    count=1
)

if count != 1:
    raise SystemExit('ERROR: V85 stylesheet link not found in trading.html')

html_path.write_text(html)
PY

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/open-position-icon-geometry-v93.mjs" \
   "$APP/tests/open-position-icon-geometry-v93.mjs"

echo "[1/4] Syntax / root-cause contract check"
node --check "$APP/tests/open-position-icon-geometry-v93.mjs"

echo "[2/4] V93 regression test"
(
  cd "$APP"
  node tests/open-position-icon-geometry-v93.mjs
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
  memeflow-app/open-position-popover-v85.css \
  memeflow-app/tests/open-position-icon-geometry-v93.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V93 installed/tested, but auto-commit/push skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/trading.html \
      memeflow-app/open-position-popover-v85.css \
      memeflow-app/tests/open-position-icon-geometry-v93.mjs

    if git diff --cached --quiet; then
      echo "V93 already present; nothing new to commit."
    else
      git commit -m "fix(trading): stop info icon from stretching position row"

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
echo "V93 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-open-position-icon-geometry-v93/rollback.sh"
echo
echo "Confirmed root cause:"
echo "  Global touch accessibility rule -> every button min-block-size 44px"
echo "  Info icon is a native button    -> invisible layout height became 44px"
echo "  Open Position bottom line       -> became 44px tall"
echo "  Token name                      -> got pushed upward"
echo
echo "V93:"
echo "  Info button layout = 16px desktop / 14px <=430px"
echo "  V90/V91/V92 alignment layers removed from runtime"
echo "  V89 64px row contract unchanged"
