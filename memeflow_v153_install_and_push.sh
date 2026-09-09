#!/usr/bin/env bash
set -euo pipefail

cd "${WORKSPACE:-$HOME/workspace}"
CSS="memeflow-app/trading-light-polish-v61.css"
HTML="memeflow-app/trading.html"
MARKER="MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153"

if [[ ! -f "$CSS" || ! -f "$HTML" ]]; then
  echo "ERROR: Run this from the MEMEFLOW repository root (expected $CSS and $HTML)."
  exit 1
fi

echo "== MEMEFLOW V153: light white modules =="

if ! git diff --quiet -- "$CSS" "$HTML" || ! git diff --cached --quiet -- "$CSS" "$HTML"; then
  echo "ERROR: $CSS or $HTML already has local tracked changes."
  echo "Nothing was changed. Commit/stash those two files first, then rerun."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".memeflow-v153-backup-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$CSS" "$BACKUP_DIR/trading-light-polish-v61.css"
cp "$HTML" "$BACKUP_DIR/trading.html"
printf '%s\n' "$(git rev-parse HEAD)" > "$BACKUP_DIR/pre-v153-head.txt"
echo "Backup: $BACKUP_DIR"

python3 - <<'PY'
from pathlib import Path

css_path = Path("memeflow-app/trading-light-polish-v61.css")
html_path = Path("memeflow-app/trading.html")
marker = "MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153"

css = css_path.read_text(encoding="utf-8")
if marker not in css:
    block = '''

/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153
   Light theme only.
   Requested modules use the true white canvas while preserving:
   - Dark mode
   - geometry and module outlines
   - semantic state/P&L colors
   - selected-row feedback
   - typography and trading logic
*/
html[data-theme="light"] body.mf-trading-terminal :is(
  .chart-panel,
  .strategy-summary-panel,
  .positions-panel,
  .candidates-panel,
  .bottom-history-panel
) {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

/* Structural neutral sub-surfaces inside the requested modules merge into
   the same white canvas. Action/selection states are intentionally untouched. */
html[data-theme="light"] body.mf-trading-terminal .chart-panel .indicator-bar,
html[data-theme="light"] body.mf-trading-terminal .chart-panel .selected-metrics > div,
html[data-theme="light"] body.mf-trading-terminal .strategy-summary-panel .strategy-summary-row {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULES_V153_END */
'''
    css_path.write_text(css.rstrip() + block + "\n", encoding="utf-8")

html = html_path.read_text(encoding="utf-8")
old = '/trading-light-polish-v61.css?v=trading-light-polish-v61-20260905'
new = '/trading-light-polish-v61.css?v=trading-light-white-modules-v153-20260909'
if old in html:
    html = html.replace(old, new, 1)
elif new not in html:
    raise SystemExit("ERROR: Expected trading-light-polish-v61.css asset URL was not found; HTML left unchanged.")
html_path.write_text(html, encoding="utf-8")
PY

echo
echo "== Validation =="
grep -q "$MARKER" "$CSS"
grep -q 'trading-light-white-modules-v153-20260909' "$HTML"
git diff --check -- "$CSS" "$HTML"

echo
git diff --stat -- "$CSS" "$HTML"
echo

git add -- "$CSS" "$HTML"
git commit -m "Make Trading Terminal modules white in light theme"
COMMIT="$(git rev-parse HEAD)"
git push

echo
echo "V153 installed and pushed."
echo "Commit: $COMMIT"
echo "Backup: $BACKUP_DIR"
echo
echo "Rollback if needed:"
echo "  git revert --no-edit $COMMIT && git push"
