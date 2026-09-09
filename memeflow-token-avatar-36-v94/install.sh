#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for f in "$APP/trading.css" "$APP/trading-visual-hierarchy-v67.css" "$APP/trading.html" "$APP/trading-row-height-v89.css"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f"; exit 1; }
done
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/token-avatar-36-v94-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"
TARGETS=(
  "memeflow-app/trading.css"
  "memeflow-app/trading-visual-hierarchy-v67.css"
  "memeflow-app/trading.html"
  "memeflow-app/tests/token-avatar-36-v94.mjs"
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
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-token-avatar-36-v94-last-backup"
python3 - "$APP/trading.css" "$APP/trading-visual-hierarchy-v67.css" "$APP/trading.html" <<'PY'
from pathlib import Path
import re, sys
trading_path=Path(sys.argv[1]); hierarchy_path=Path(sys.argv[2]); html_path=Path(sys.argv[3])
trading=trading_path.read_text(); hierarchy=hierarchy_path.read_text(); html=html_path.read_text()
# Base 42 -> 36
trading,c=re.subn(r'(\.trade-token-avatar\s*\{[\s\S]*?position:\s*relative;[\s\S]*?)width:\s*42px;\s*height:\s*42px;',r'\1width: 36px;\n  height: 36px;',trading,count=1)
if c!=1: raise SystemExit('ERROR: base 42px avatar rule not found')
# Remove mobile 46 override
trading,c=re.subn(r'\n\s*\.trade-token-avatar\s*\{\s*width:\s*46px;\s*height:\s*46px;\s*border-radius:\s*11px;\s*\}\s*','\n',trading,count=1)
if c!=1: raise SystemExit('ERROR: mobile 46px avatar override not found')
# V76 29 -> 36
hierarchy,c1=re.subn(r'(\.mf-trading-pump-avatar-link-v76\s*\{[\s\S]*?)width:\s*29px\s*!important;\s*height:\s*29px\s*!important;',r'\1width: 36px !important;\n  height: 36px !important;',hierarchy,count=1)
if c1!=1: raise SystemExit('ERROR: V76 wrapper 29px rule not found')
hierarchy,c2=re.subn(r'(\.mf-trading-pump-avatar-link-v76 > \.trade-token-avatar\s*\{[\s\S]*?)width:\s*29px\s*!important;\s*height:\s*29px\s*!important;',r'\1width: 36px !important;\n  height: 36px !important;',hierarchy,count=1)
if c2!=1: raise SystemExit('ERROR: V76 child 29px rule not found')
# Remove mobile 32 override
hierarchy,c3=re.subn(r'\n@media \(max-width:\s*820px\)\s*\{\s*body\.mf-page-trading\.mf-trading-terminal\s*\.mf-trading-pump-avatar-link-v76,\s*body\.mf-page-trading\.mf-trading-terminal\s*\.mf-trading-pump-avatar-link-v76 > \.trade-token-avatar\s*\{\s*width:\s*32px\s*!important;\s*height:\s*32px\s*!important;\s*\}\s*\}\s*','\n',hierarchy,count=1)
if c3!=1: raise SystemExit('ERROR: V76 mobile 32px override not found')
hierarchy=hierarchy.replace('Wrapper dimensions exactly match the existing Trading avatar.','Wrapper and Trading avatar use one canonical 36x36 geometry.')
# cache bust changed assets
html,c4=re.subn(r'/trading\.css\?v=[^"\']+','/trading.css?v=token-avatar-36-v94-20260909',html,count=1)
html,c5=re.subn(r'/trading-visual-hierarchy-v67\.css\?v=[^"\']+','/trading-visual-hierarchy-v67.css?v=token-avatar-36-v94-20260909',html,count=1)
if c4!=1 or c5!=1: raise SystemExit('ERROR: CSS asset link not found')
trading_path.write_text(trading); hierarchy_path.write_text(hierarchy); html_path.write_text(html)
PY
cp "$PATCH_DIR/tests/token-avatar-36-v94.mjs" "$APP/tests/token-avatar-36-v94.mjs"
echo '[1/4] syntax'; node --check "$APP/tests/token-avatar-36-v94.mjs"
echo '[2/4] V94 test'; (cd "$APP" && node tests/token-avatar-36-v94.mjs)
echo '[3/4] existing tests'; (
  cd "$APP"
  [[ ! -f tests/row-height-canonical-v89.mjs ]] || node tests/row-height-canonical-v89.mjs
  [[ ! -f tests/open-position-icon-geometry-v93.mjs ]] || node tests/open-position-icon-geometry-v93.mjs
  [[ ! -f tests/open-position-popover-v85.mjs ]] || node tests/open-position-popover-v85.mjs
)
echo '[4/4] diff + git'
git diff --check -- memeflow-app/trading.css memeflow-app/trading-visual-hierarchy-v67.css memeflow-app/trading.html memeflow-app/tests/token-avatar-36-v94.mjs
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo 'NOTICE: pre-existing staged changes; auto-commit/push skipped.'
  else
    git add memeflow-app/trading.css memeflow-app/trading-visual-hierarchy-v67.css memeflow-app/trading.html memeflow-app/tests/token-avatar-36-v94.mjs
    if ! git diff --cached --quiet; then
      git commit -m 'fix(trading): canonicalize token avatars at 36px'
      if git remote get-url origin >/dev/null 2>&1; then git push origin HEAD || echo 'NOTICE: push failed; run git push origin HEAD'; fi
    fi
  fi
fi
echo
echo 'V94 PATCH OK'
echo "Backup: $BACKUP"
echo 'Open positions / Candidates / Recent trades = 36x36'
echo 'Removed old 42 / 46 / 29 / 32 size chain'
echo '64px row => 14px top/bottom; current phone left=9px; image-to-text=17px'
