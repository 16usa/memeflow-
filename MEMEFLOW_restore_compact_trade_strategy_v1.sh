#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW RESTORE COMPACT TRADE STRATEGY V1 ==="

ROOT="${ROOT:-$PWD}"
APP="$ROOT/memeflow-app"

HTML="$APP/trading.html"
CSS="$APP/trading.css"
NAV="$APP/memeflow-nav.js"

for f in "$HTML" "$CSS" "$NAV"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path
import re

html_p = Path("memeflow-app/trading.html")
css_p = Path("memeflow-app/trading.css")
nav_p = Path("memeflow-app/memeflow-nav.js")

html = html_p.read_text(encoding="utf-8")
css = css_p.read_text(encoding="utf-8")
nav = nav_p.read_text(encoding="utf-8")

STAMP = "restore-compact-trade-strategy-v1-20260826"

# Make sure the expected Trade strategy markup is still present.
required = [
    'class="panel control-panel strategy-summary-panel"',
    'class="strategy-summary-list"',
    'class="strategy-summary-row"',
    'id="editStrategyBtn"',
    'id="strategyPosition"',
    'id="strategyPositionLimits"',
]
for needle in required:
    if needle not in html:
        raise SystemExit(f"ERROR: expected Trade strategy markup missing: {needle}")

# Replace an earlier recovery block if rerun.
block_re = re.compile(
    r'\n?/\* ===== MEMEFLOW_RESTORE_COMPACT_TRADE_STRATEGY_V1 ===== \*/.*?'
    r'/\* ===== /MEMEFLOW_RESTORE_COMPACT_TRADE_STRATEGY_V1 ===== \*/\n?',
    re.S
)
css = block_re.sub("\n", css)

restore_css = r'''
/* ===== MEMEFLOW_RESTORE_COMPACT_TRADE_STRATEGY_V1 ===== */
.strategy-summary-panel .panel-head {
  min-height: 51px;
}

.strategy-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.strategy-edit-link {
  min-width: 42px;
  height: 25px;
  padding: 0 8px;
  border: 1px solid rgba(111, 154, 172, .08);
  border-radius: 7px;
  background: transparent;
  color: #718995;
  font-size: 7px;
  font-weight: 720;
  line-height: 1;
}

.strategy-edit-link:active,
.strategy-edit-link:hover {
  border-color: rgba(85, 217, 255, .20);
  color: #a9dce8;
}

.strategy-summary-list {
  display: grid;
}

.strategy-summary-row {
  min-height: 43px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid rgba(111, 154, 172, .055);
}

.strategy-summary-row > div {
  min-width: 0;
  padding: 7px 10px;
}

.strategy-summary-row > div + div {
  border-left: 1px solid rgba(111, 154, 172, .045);
}

.strategy-summary-row span {
  display: block;
  color: #526a75;
  font-size: 6px;
  line-height: 1.2;
  font-weight: 500;
}

.strategy-summary-row strong {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: #c8d6dd;
  font-size: 8px;
  font-weight: 700;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strategy-summary-foot {
  min-height: 27px;
  padding: 7px 10px;
  display: flex;
  align-items: center;
  color: #405965;
  font-size: 6px;
  line-height: 1.2;
}

.strategy-summary-panel .control-error {
  margin: 7px 9px;
}

@media (max-width: 820px) {
  .strategy-summary-panel {
    width: 100%;
  }
}

@media (max-width: 460px) {
  .strategy-summary-row > div {
    padding: 7px 9px;
  }

  .strategy-summary-row strong {
    font-size: 8px;
  }

  .strategy-edit-link {
    min-width: 40px;
    height: 24px;
    padding: 0 7px;
    font-size: 7px;
  }
}
/* ===== /MEMEFLOW_RESTORE_COMPACT_TRADE_STRATEGY_V1 ===== */
'''

css = css.rstrip() + "\n\n" + restore_css.strip() + "\n"

# Cache-bust only the CSS/nav chain. JS stays untouched.
html = re.sub(
    r'/trading\.css\?v=[^"]+',
    '/trading.css?v=' + STAMP,
    html,
    count=1
)
html = re.sub(
    r'/memeflow-nav\.js\?v=[^"]+',
    '/memeflow-nav.js?v=global-right-drawer-' + STAMP,
    html,
    count=1
)
nav = re.sub(
    r"href:\s*'/trading\.html(?:\?[^']*)?'",
    f"href: '/trading.html?v={STAMP}'",
    nav,
    count=1
)

html_p.write_text(html, encoding="utf-8")
css_p.write_text(css, encoding="utf-8")
nav_p.write_text(nav, encoding="utf-8")
PY

echo
echo "=== CHECK ==="
node --check "$NAV"

grep -n 'MEMEFLOW_RESTORE_COMPACT_TRADE_STRATEGY_V1' "$CSS"
grep -n 'strategy-summary-row {' "$CSS" | tail -n 2
grep -n 'strategy-edit-link {' "$CSS" | tail -n 2
grep -n 'restore-compact-trade-strategy-v1-20260826' "$HTML" "$NAV"

echo
echo "=== VERIFY RECENT TRADES WAS NOT REMOVED ==="
grep -n 'MEMEFLOW_RECENT_TRADES_TWO_ROWS_AVATAR_V3' "$CSS"
grep -n 'bottom-history-panel' "$HTML"
grep -n 'trade-token-avatar' "$CSS" | head -n 3

echo
echo "=== GIT DIFF ==="
git diff -- "$HTML" "$CSS" "$NAV"

if ! git diff --quiet -- "$HTML" "$CSS" "$NAV"; then
  git add "$HTML" "$CSS" "$NAV"
  git commit -m "fix(trading): restore compact trade strategy styles"
else
  echo "No new working-tree changes; checking whether local HEAD still needs push."
fi

git push origin HEAD:main

echo
echo "DONE: Trade strategy compact styling restored."
echo "DONE: Recent trades two-row scroll/avatar implementation preserved."
echo "DONE: No API or trading logic changed."
