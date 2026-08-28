#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW COMPACT NATIVE TRADE STRATEGY V1 ==="

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

STAMP = "compact-native-trade-strategy-v1-20260826"

new_panel = r'''      <aside class="panel control-panel strategy-summary-panel">
        <div class="panel-head compact-head">
          <div>
            <span class="eyebrow">SERVER STRATEGY</span>
            <h2>Trade strategy</h2>
          </div>
          <div class="strategy-head-actions">
            <span id="modeBadge" class="mode-badge">OBSERVE</span>
            <button id="editStrategyBtn" class="strategy-edit-link" type="button">Edit</button>
          </div>
        </div>

        <div class="strategy-summary-list">
          <div class="strategy-summary-row">
            <div>
              <span>Position</span>
              <strong id="strategyPosition">—</strong>
            </div>
            <div>
              <span>Stops</span>
              <strong id="strategyStops">—</strong>
            </div>
          </div>

          <div class="strategy-summary-row">
            <div>
              <span>TP1</span>
              <strong id="strategyTp1">—</strong>
            </div>
            <div>
              <span>TP2</span>
              <strong id="strategyTp2">—</strong>
            </div>
          </div>

          <div class="strategy-summary-row">
            <div>
              <span>Runner / hold</span>
              <strong id="strategyRunner">—</strong>
            </div>
            <div>
              <span>Exit pressure</span>
              <strong id="strategyExitPressure">—</strong>
            </div>
          </div>

          <div class="strategy-summary-row">
            <div>
              <span>Daily limits</span>
              <strong id="strategyDailyLimits">—</strong>
            </div>
            <div>
              <span>Position limits</span>
              <strong id="strategyPositionLimits">—</strong>
            </div>
          </div>
        </div>

        <div id="controlError" class="control-error" hidden></div>

        <div class="strategy-summary-foot">
          <span id="saveState">Loading server strategy…</span>
        </div>
      </aside>'''

panel_re = re.compile(
    r'      <aside class="panel control-panel strategy-summary-panel">.*?      </aside>',
    re.S
)
html2, count = panel_re.subn(new_panel, html, count=1)
if count != 1:
    raise SystemExit("ERROR: current Trade strategy panel was not found")
html = html2

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

css = css.replace(
    ".strategy-grid label,\n.strategy-grid .strategy-summary-item {\n",
    ".strategy-grid label {\n",
    1
)
css = css.replace(
    ".strategy-grid label > span,\n.strategy-grid .strategy-summary-item > span {\n",
    ".strategy-grid label > span {\n",
    1
)
css = css.replace(
    ".strategy-grid label > div,\n.strategy-grid .strategy-summary-item > div {\n",
    ".strategy-grid label > div {\n",
    1
)
css = css.replace(
    '.strategy-grid input[type="number"],\n.strategy-grid .strategy-value {\n  display: block;\n',
    '.strategy-grid input[type="number"] {\n',
    1
)
css = css.replace(
    ".strategy-edit-btn { grid-column: 1 / -1; }\n\n",
    "",
    1
)

native_css = r'''
/* ===== MEMEFLOW_COMPACT_NATIVE_TRADE_STRATEGY_V1 ===== */
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
}

.strategy-edit-link:active {
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
}

.strategy-summary-panel .control-error {
  margin: 7px 9px;
}

@media (max-width: 460px) {
  .strategy-summary-row > div {
    padding: 7px 9px;
  }

  .strategy-summary-row strong {
    font-size: 8px;
  }
}
/* ===== /MEMEFLOW_COMPACT_NATIVE_TRADE_STRATEGY_V1 ===== */
'''

block_re = re.compile(
    r'\n?/\* ===== MEMEFLOW_COMPACT_NATIVE_TRADE_STRATEGY_V1 ===== \*/.*?'
    r'/\* ===== /MEMEFLOW_COMPACT_NATIVE_TRADE_STRATEGY_V1 ===== \*/\n?',
    re.S
)
if block_re.search(css):
    css = block_re.sub("\n" + native_css.strip() + "\n", css, count=1)
else:
    css = css.rstrip() + "\n\n" + native_css.strip() + "\n"

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

grep -n 'strategy-summary-list' "$HTML"
grep -n 'strategy-edit-link' "$HTML"
grep -n 'MEMEFLOW_COMPACT_NATIVE_TRADE_STRATEGY_V1' "$CSS"
grep -n 'compact-native-trade-strategy-v1-20260826' "$HTML" "$NAV"

if grep -q 'strategy-summary-item' "$HTML"; then
  echo "ERROR: old nested strategy cards remain in HTML"
  exit 1
fi

if grep -q 'strategy-edit-btn' "$HTML"; then
  echo "ERROR: old large Edit strategy button remains"
  exit 1
fi

echo
echo "=== GIT DIFF ==="
git diff -- "$HTML" "$CSS" "$NAV"

if git diff --quiet -- "$HTML" "$CSS" "$NAV"; then
  echo "No changes needed: compact native strategy design already applied."
  exit 0
fi

git add "$HTML" "$CSS" "$NAV"
git commit -m "style(trading): compact strategy summary to native panel style"
git push origin HEAD

echo
echo "DONE: Trade strategy is compact and matches the native Trading Terminal style."
echo "No strategy values, API behavior, or trading logic were changed."
