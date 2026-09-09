#!/usr/bin/env bash
set -euo pipefail

cd "${WORKSPACE:-$HOME/workspace}"

CSS="memeflow-app/memeflow-trading-white-surfaces-v154.css"
HTML="memeflow-app/trading.html"
MARKER="MEMEFLOW_TRADING WHITE RESIDUAL SURFACES V155"
CACHE_OLD="white-modules-v154-final-20260909"
CACHE_NEW="white-modules-v155-residual-final-20260909"

if [[ ! -d .git || ! -f "$CSS" || ! -f "$HTML" ]]; then
  echo "ERROR: Expected MEMEFLOW repo files were not found in ~/workspace."
  exit 1
fi

echo "== MEMEFLOW V155: remove the last two gray fills =="

# Do not mix this patch with tracked edits to its two target files.
if ! git diff --quiet -- "$CSS" "$HTML" || ! git diff --cached --quiet -- "$CSS" "$HTML"; then
  echo "ERROR: One of the two target files already has tracked local changes."
  echo "Nothing was changed."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".memeflow-v155-backup-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$CSS" "$BACKUP_DIR/memeflow-trading-white-surfaces-v154.css"
cp "$HTML" "$BACKUP_DIR/trading.html"
git rev-parse HEAD > "$BACKUP_DIR/pre-v155-head.txt"

python3 - <<'PY'
from pathlib import Path
import re

css_path = Path("memeflow-app/memeflow-trading-white-surfaces-v154.css")
html_path = Path("memeflow-app/trading.html")

marker = "MEMEFLOW TRADING WHITE RESIDUAL SURFACES V155"
block = r"""
/* ==========================================================================
   MEMEFLOW TRADING WHITE RESIDUAL SURFACES V155

   LIGHT MODE ONLY.
   Exact residual child surfaces confirmed from current DOM:
     1) Chart > .indicator-bar > .indicator-scroll
     2) Trade strategy > .strategy-summary-list > .strategy-summary-row > div

   Parent surfaces are already white in V154. These child boxes were still
   painting the old neutral gray above those white parents.
   ========================================================================== */

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.chart-panel > #indicatorBar.indicator-bar > .indicator-scroll {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

/* Keep indicator buttons visually text-only on the newly white strip. */
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.chart-panel > #indicatorBar.indicator-bar > .indicator-scroll > button,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.chart-panel > #indicatorBar.indicator-bar > .indicator-scroll > button[aria-pressed="true"] {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
}

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .strategy-summary-list,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .strategy-summary-list > .strategy-summary-row,
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .strategy-summary-list > .strategy-summary-row > div {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

/* MEMEFLOW_TRADING_WHITE_RESIDUAL_SURFACES_V155_END */
"""

css = css_path.read_text(encoding="utf-8")

# Idempotent: append once only.
if marker not in css:
    css = css.rstrip() + "\n\n" + block.strip() + "\n"
    css_path.write_text(css, encoding="utf-8")

html = html_path.read_text(encoding="utf-8")

# Validate the exact DOM targets we are fixing.
required_dom = [
    'id="indicatorBar" class="indicator-bar"',
    'class="indicator-scroll"',
    'class="strategy-summary-list"',
    'class="strategy-summary-row"',
]
for needle in required_dom:
    if needle not in html:
        raise SystemExit(f"ERROR: current Trading DOM changed; missing {needle!r}. Nothing committed.")

# Cache-bust the already-last V154 authority after updating its contents.
pattern = (
    r'(/memeflow-trading-white-surfaces-v154\.css\?v=)'
    r'[^"\']+'
)
replacement = r'\1white-modules-v155-residual-final-20260909'
html2, count = re.subn(pattern, replacement, html, count=1)

if count != 1:
    raise SystemExit("ERROR: V154 stylesheet link was not found exactly once.")

html_path.write_text(html2, encoding="utf-8")
PY

echo
echo "== Verification =="

# Exact new child selectors must exist.
grep -Fq '.chart-panel > #indicatorBar.indicator-bar > .indicator-scroll' "$CSS"
grep -Fq '.strategy-summary-panel > .strategy-summary-list > .strategy-summary-row > div' "$CSS"

# V155 is light-only. Extract just the V155 block and reject any dark selector.
python3 - <<'PY'
from pathlib import Path
import re

css = Path("memeflow-app/memeflow-trading-white-surfaces-v154.css").read_text(encoding="utf-8")
start = css.find("/* ==========================================================================\n   MEMEFLOW TRADING WHITE RESIDUAL SURFACES V155")
end_marker = "/* MEMEFLOW_TRADING_WHITE_RESIDUAL_SURFACES_V155_END */"
end = css.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("ERROR: V155 block markers missing.")
block = css[start:end + len(end_marker)]
if 'data-theme="dark"' in block:
    raise SystemExit("ERROR: V155 unexpectedly touches dark mode.")
print("OK: V155 is light-only.")
PY

# Confirm the white-surface CSS is still the LAST stylesheet in <head>.
python3 - <<'PY'
from pathlib import Path
import re

html = Path("memeflow-app/trading.html").read_text(encoding="utf-8")
head = html.split("</head>", 1)[0]
links = re.findall(r'<link\b[^>]*rel=["\']stylesheet["\'][^>]*>', head, flags=re.I)
expected = "/memeflow-trading-white-surfaces-v154.css?v=white-modules-v155-residual-final-20260909"

if head.count(expected) != 1:
    raise SystemExit("ERROR: V155 cache-busted stylesheet link is not unique.")
if not links or expected not in links[-1]:
    raise SystemExit("ERROR: white-surface stylesheet is not last in <head>.")
print("OK: white-surface authority is the final stylesheet.")
PY

git diff --check -- "$CSS" "$HTML"

echo
echo "== Diff =="
git diff --stat -- "$CSS" "$HTML"
echo

git add -- "$CSS" "$HTML"
git commit -m "Remove final Trading light gray surfaces"
COMMIT="$(git rev-parse HEAD)"
git push

echo
echo "=============================================="
echo "V155 INSTALLED AND PUSHED"
echo "Commit:   $COMMIT"
echo "Backup:   $BACKUP_DIR"
echo "Rollback: git revert --no-edit $COMMIT && git push"
echo "=============================================="
