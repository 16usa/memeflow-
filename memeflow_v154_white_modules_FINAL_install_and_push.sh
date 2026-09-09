#!/usr/bin/env bash
set -euo pipefail

cd "${WORKSPACE:-$HOME/workspace}"

HTML="memeflow-app/trading.html"
CSS="memeflow-app/memeflow-trading-white-surfaces-v154.css"
MARKER="MEMEFLOW_TRADING_LIGHT_WHITE_MODULE_SURFACES_V154_FINAL"
ASSET="/memeflow-trading-white-surfaces-v154.css?v=white-modules-v154-final-20260909"

if [[ ! -d .git || ! -f "$HTML" ]]; then
  echo "ERROR: Run this from the MEMEFLOW repository root (~/workspace)."
  exit 1
fi

echo "== MEMEFLOW V154 FINAL: white Trading modules =="

# Protect only the file we must edit. Unrelated untracked/modified files are ignored.
if ! git diff --quiet -- "$HTML" || ! git diff --cached --quiet -- "$HTML"; then
  echo "ERROR: $HTML already has local tracked changes."
  echo "Nothing was changed. Commit/stash that file, then rerun."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".memeflow-v154-backup-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$HTML" "$BACKUP_DIR/trading.html"
if [[ -f "$CSS" ]]; then
  cp "$CSS" "$BACKUP_DIR/memeflow-trading-white-surfaces-v154.css"
fi
git rev-parse HEAD > "$BACKUP_DIR/pre-v154-head.txt"

cat > "$CSS" <<'CSS_EOF'
/* ==========================================================================
   MEMEFLOW TRADING LIGHT WHITE MODULE SURFACES V154 FINAL

   LIGHT MODE ONLY.

   Goal:
     Remove the gray structural fill from exactly these Trading Terminal modules:
       - Chart
       - Trade strategy
       - Open positions
       - Candidates
       - Recent trades

   Preserve:
     - Dark mode
     - module geometry/radii/outlines/separators
     - typography
     - semantic badges / P&L / status colors
     - chart data and ECharts behavior
     - trading/scanner/backend logic

   This stylesheet is intentionally loaded LAST in <head> so it is the final
   light-surface authority and cannot lose to V61/V117/V121/V127 late rules.
   ========================================================================== */

/* Outer module canvases. */
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.terminal > .panel.candidates-panel,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.terminal > .panel.control-panel.strategy-summary-panel,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.terminal > .panel.bottom-history-panel,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.center-stack > .panel.chart-panel,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.center-stack > .panel.positions-panel {
  --mf-trading-v61-surface: #ffffff !important;
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

/* Chart: header, timeframe strip, plotting surface, indicators and metrics. */
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.chart-panel > .chart-head,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.chart-panel > .timeframes,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.chart-panel > .chart-wrap,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.chart-panel #chartCanvas,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.chart-panel > .indicator-bar,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.chart-panel > .selected-metrics,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.chart-panel > .selected-metrics > div {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

/* Trade strategy: whole structural body becomes one white canvas. */
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .panel-head,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .strategy-summary-list,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel .strategy-summary-list > .strategy-summary-row,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.strategy-summary-panel > .strategy-summary-foot {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

/* Open positions: list and every row, including selected row. */
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel > .panel-head,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel > .positions-list,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel .positions-list > .position-row,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.positions-panel .positions-list > .position-row.selected {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

/* Candidates: title, strip container, list, all rows and selected/hover rows. */
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel > .panel-head,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel > .candidate-filter,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel > #candidateList,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel #candidateList > .candidate,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel #candidateList > .candidate.selected,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel #candidateList > .candidate:hover {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

/* Candidate segment controls remain text-only instead of inheriting old gray fill. */
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel .candidate-filter > button[data-filter],

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.candidates-panel .candidate-filter > button[data-filter].active {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
}

/* Recent trades: header, list and every trade row. */
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.bottom-history-panel > .panel-head,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.bottom-history-panel > .trade-history,

html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
.bottom-history-panel .trade-history > .trade-row.trade-log-row {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

/* Empty states inside the requested modules must not reintroduce neutral fill. */
html[data-theme="light"]
body.mf-page-trading.mf-trading-terminal
:is(
  .chart-panel,
  .strategy-summary-panel,
  .positions-panel,
  .candidates-panel,
  .bottom-history-panel
) .empty {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
}

/* MEMEFLOW_TRADING_LIGHT_WHITE_MODULE_SURFACES_V154_FINAL_END */
CSS_EOF

python3 - <<'PY'
from pathlib import Path
import re

html_path = Path("memeflow-app/trading.html")
asset = "/memeflow-trading-white-surfaces-v154.css?v=white-modules-v154-final-20260909"
marker_start = "<!-- MEMEFLOW_TRADING_LIGHT_WHITE_MODULE_SURFACES_V154_FINAL_ASSET -->"
marker_end = "<!-- /MEMEFLOW_TRADING_LIGHT_WHITE_MODULE_SURFACES_V154_FINAL_ASSET -->"
block = f'{marker_start}\n<link rel="stylesheet" href="{asset}">\n{marker_end}\n'

text = html_path.read_text(encoding="utf-8")

# Remove any previous V154 asset block, then install exactly one copy as the
# LAST stylesheet before </head>. This is the cascade guarantee.
text = re.sub(
    r'<!-- MEMEFLOW_TRADING_LIGHT_WHITE_MODULE_SURFACES_V154_FINAL_ASSET -->.*?'
    r'<!-- /MEMEFLOW_TRADING_LIGHT_WHITE_MODULE_SURFACES_V154_FINAL_ASSET -->\s*',
    '',
    text,
    flags=re.S
)

if "</head>" not in text:
    raise SystemExit("ERROR: </head> not found; HTML left unchanged.")

text = text.replace("</head>", block + "</head>", 1)
html_path.write_text(text, encoding="utf-8")
PY

echo
echo "== Static verification =="

# 1) CSS is light-only: no dark-theme selector is allowed in this late authority.
if grep -q 'data-theme="dark"' "$CSS"; then
  echo "ERROR: V154 contains a dark-theme selector."
  exit 1
fi

# 2) Required target coverage.
for token in \
  '.chart-panel' \
  '.strategy-summary-panel' \
  '.positions-panel' \
  '.candidates-panel' \
  '.bottom-history-panel' \
  '#chartCanvas' \
  '.strategy-summary-row' \
  '.position-row' \
  '#candidateList > .candidate' \
  '.trade-row.trade-log-row'
do
  grep -Fq "$token" "$CSS" || {
    echo "ERROR: missing required selector: $token"
    exit 1
  }
done

# 3) Exactly one V154 asset and it must be the final stylesheet in <head>.
python3 - <<'PY'
from pathlib import Path
import re

text = Path("memeflow-app/trading.html").read_text(encoding="utf-8")
head = text.split("</head>", 1)[0]
asset = "/memeflow-trading-white-surfaces-v154.css?v=white-modules-v154-final-20260909"

if head.count(asset) != 1:
    raise SystemExit(f"ERROR: expected exactly one V154 stylesheet, found {head.count(asset)}")

links = re.findall(r'<link\b[^>]*rel=["\']stylesheet["\'][^>]*>', head, flags=re.I)
if not links or asset not in links[-1]:
    raise SystemExit("ERROR: V154 is not the final stylesheet in <head>.")

print("OK: V154 is the final stylesheet in <head>.")
PY

# 4) Git whitespace validation.
git diff --check -- "$HTML" "$CSS"

echo
echo "== Changes =="
git diff --stat -- "$HTML" "$CSS"
echo

git add -- "$HTML" "$CSS"

if git diff --cached --quiet -- "$HTML" "$CSS"; then
  echo "V154 is already installed; nothing to commit."
  exit 0
fi

git commit -m "Make Trading Terminal light modules pure white"
COMMIT="$(git rev-parse HEAD)"
git push

echo
echo "=============================================="
echo "V154 FINAL INSTALLED AND PUSHED"
echo "Commit:  $COMMIT"
echo "Backup:  $BACKUP_DIR"
echo "Rollback: git revert --no-edit $COMMIT && git push"
echo "=============================================="
