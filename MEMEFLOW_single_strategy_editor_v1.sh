#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW SINGLE STRATEGY EDITOR V1 ==="

ROOT="${ROOT:-$PWD}"
APP="$ROOT/memeflow-app"

HTML="$APP/trading.html"
JS="$APP/trading.js"
CSS="$APP/trading.css"
NAV="$APP/memeflow-nav.js"

for f in "$HTML" "$JS" "$CSS" "$NAV"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path
import re

html_p = Path("memeflow-app/trading.html")
js_p = Path("memeflow-app/trading.js")
css_p = Path("memeflow-app/trading.css")
nav_p = Path("memeflow-app/memeflow-nav.js")

html = html_p.read_text(encoding="utf-8")
js = js_p.read_text(encoding="utf-8")
css = css_p.read_text(encoding="utf-8")
nav = nav_p.read_text(encoding="utf-8")

STAMP = "single-strategy-editor-v1-20260826"
SETTINGS_URL = "/settings.html?v=cachefix-c6663c7-20260826-v1"

summary_panel = r'''      <aside class="panel control-panel strategy-summary-panel">
        <div class="panel-head">
          <div>
            <span class="eyebrow">SERVER STRATEGY</span>
            <h2>Trade strategy</h2>
          </div>
          <span id="modeBadge" class="mode-badge">OBSERVE</span>
        </div>

        <section class="control-section">
          <div class="section-title">Current settings</div>
          <div class="strategy-grid strategy-summary-grid">
            <div class="strategy-summary-item">
              <span>Position</span>
              <div><strong id="strategyPosition" class="strategy-value">—</strong></div>
            </div>

            <div class="strategy-summary-item">
              <span>Stops</span>
              <div><strong id="strategyStops" class="strategy-value">—</strong></div>
            </div>

            <div class="strategy-summary-item">
              <span>TP1</span>
              <div><strong id="strategyTp1" class="strategy-value">—</strong></div>
            </div>

            <div class="strategy-summary-item">
              <span>TP2</span>
              <div><strong id="strategyTp2" class="strategy-value">—</strong></div>
            </div>

            <div class="strategy-summary-item">
              <span>Runner / hold</span>
              <div><strong id="strategyRunner" class="strategy-value">—</strong></div>
            </div>

            <div class="strategy-summary-item">
              <span>Exit pressure</span>
              <div><strong id="strategyExitPressure" class="strategy-value">—</strong></div>
            </div>

            <div class="strategy-summary-item">
              <span>Daily limits</span>
              <div><strong id="strategyDailyLimits" class="strategy-value">—</strong></div>
            </div>

            <div class="strategy-summary-item">
              <span>Position limits</span>
              <div><strong id="strategyPositionLimits" class="strategy-value">—</strong></div>
            </div>
          </div>
        </section>

        <div id="controlError" class="control-error" hidden></div>

        <div class="control-actions">
          <button id="editStrategyBtn" class="secondary-btn strategy-edit-btn" type="button">Edit strategy</button>
        </div>

        <div class="control-foot">
          <span id="saveState">Loading server strategy…</span>
        </div>
      </aside>'''

panel_re = re.compile(
    r'      <aside class="panel control-panel(?: [^"]*)?">.*?      </aside>',
    re.S
)
html2, count = panel_re.subn(summary_panel, html, count=1)
if count != 1:
    if 'strategy-summary-panel' not in html:
        raise SystemExit("ERROR: could not replace Trading control panel")
else:
    html = html2

html = re.sub(
    r'/trading\.css\?v=[^"]+',
    '/trading.css?v=' + STAMP,
    html,
    count=1
)
html = re.sub(
    r'/trading\.js\?v=[^"]+',
    '/trading.js?v=' + STAMP,
    html,
    count=1
)
html = re.sub(
    r'/memeflow-nav\.js\?v=[^"]+',
    '/memeflow-nav.js?v=global-right-drawer-' + STAMP,
    html,
    count=1
)

new_populate = r'''function populateSettings() {
  const s = state.settings;
  if (!s) return;

  const text = (id, value) => {
    const node = $(id);
    if (node) node.textContent = value;
  };

  const value = (v, digits = 2) =>
    finite(v) ? fmt(Number(v), digits) : '—';

  text(
    'strategyPosition',
    finite(s.positionSize)
      ? `${value(s.positionSize, 4)} SOL`
      : '—'
  );

  text(
    'strategyStops',
    `Hard ${value(s.hardStopPct, 1)}% · Trail ${value(s.trailingStopPct, 1)}%`
  );

  text(
    'strategyTp1',
    `+${value(s.tp1Pct, 0)}% · sell ${value(s.tp1SellPct, 0)}%`
  );

  text(
    'strategyTp2',
    `+${value(s.tp2Pct, 0)}% · sell ${value(s.tp2SellPct, 0)}%`
  );

  text(
    'strategyRunner',
    `${value(s.runnerPct, 0)}% · ${value(s.maxHoldMinutes, 0)} min`
  );

  text(
    'strategyExitPressure',
    `${value(s.exitBuyPressure, 2)}× · weak ${s.exitOnWeakBuyPressure ? 'ON' : 'OFF'}`
  );

  text(
    'strategyDailyLimits',
    `${value(s.dailySpendLimit, 2)} spend · ${value(s.dailyLossLimit, 2)} loss SOL`
  );

  text(
    'strategyPositionLimits',
    `${value(s.maxOpenPositions, 0)} positions · ${value(s.maxDailyEntries, 0)}/day`
  );

  const mode = String(s.operatingMode || 'observe').toLowerCase();
  const badge = $('modeBadge');
  if (badge) {
    badge.textContent = mode.toUpperCase();
    badge.dataset.mode = mode;
  }

  $('engineText').textContent = mode === 'automate'
    ? 'PAPER AUTO ACTIVE'
    : mode === 'assist'
      ? 'PAPER ASSIST'
      : 'ENGINE OBSERVE';

  $('enginePill').dataset.active =
    mode === 'automate' && s.tradingEnvironment === 'paper'
      ? 'true'
      : 'false';

  text(
    'saveState',
    `Synced from System Settings · ${s.tradingEnvironment || 'paper'}`
  );

  scheduleChart();
}'''

populate_re = re.compile(
    r'function populateSettings\(\) \{.*?\n\}\n\nasync function loadSettings\(\)',
    re.S
)
js2, count = populate_re.subn(
    new_populate + "\n\nasync function loadSettings()",
    js,
    count=1
)
if count != 1:
    if "strategyPositionLimits" not in js:
        raise SystemExit("ERROR: populateSettings replacement failed")
else:
    js = js2

if "function updateAmountHint() {" in js and "if (!$('amountInput') || !$('amountHint')) return;" not in js:
    js = js.replace(
        "function updateAmountHint() {\n",
        "function updateAmountHint() {\n  if (!$('amountInput') || !$('amountHint')) return;\n",
        1
    )

if "function updateAllocation() {" in js and "if (!$('allocationBadge')) return;" not in js:
    js = js.replace(
        "function updateAllocation() {\n",
        "function updateAllocation() {\n  if (!$('allocationBadge')) return;\n",
        1
    )

js = js.replace(
    "$('amountInput').addEventListener('input', updateAmountHint);",
    "$('amountInput')?.addEventListener('input', updateAmountHint);",
    1
)
js = js.replace(
    ".forEach(id => $(id).addEventListener('input', updateAllocation));",
    ".forEach(id => $(id)?.addEventListener('input', updateAllocation));",
    1
)
js = js.replace(
    "$('saveStrategyBtn').addEventListener('click', onSaveStrategy);",
    "$('saveStrategyBtn')?.addEventListener('click', onSaveStrategy);",
    1
)

edit_bind = (
    "\n  $('editStrategyBtn')?.addEventListener('click', () => {\n"
    "    window.location.href = '" + SETTINGS_URL + "';\n"
    "  });"
)
if "editStrategyBtn')?.addEventListener" not in js:
    anchor = "$('saveStrategyBtn')?.addEventListener('click', onSaveStrategy);"
    if anchor not in js:
        raise SystemExit("ERROR: bind anchor not found")
    js = js.replace(anchor, anchor + edit_bind, 1)

css = css.replace(
    ".strategy-grid label {\n",
    ".strategy-grid label,\n.strategy-grid .strategy-summary-item {\n",
    1
)
css = css.replace(
    ".strategy-grid label > span {\n",
    ".strategy-grid label > span,\n.strategy-grid .strategy-summary-item > span {\n",
    1
)
css = css.replace(
    ".strategy-grid label > div {\n",
    ".strategy-grid label > div,\n.strategy-grid .strategy-summary-item > div {\n",
    1
)
css = css.replace(
    '.strategy-grid input[type="number"] {\n',
    '.strategy-grid input[type="number"],\n.strategy-grid .strategy-value {\n',
    1
)

needle = (
    '.strategy-grid input[type="number"],\n'
    '.strategy-grid .strategy-value {\n'
    '  width: 100%;'
)
if needle in css:
    css = css.replace(
        needle,
        (
            '.strategy-grid input[type="number"],\n'
            '.strategy-grid .strategy-value {\n'
            '  display: block;\n'
            '  width: 100%;'
        ),
        1
    )

if ".strategy-edit-btn {" not in css:
    css = css.replace(
        ".secondary-btn {\n",
        ".strategy-edit-btn { grid-column: 1 / -1; }\n\n.secondary-btn {\n",
        1
    )

nav = re.sub(
    r"href:\s*'/trading\.html(?:\?[^']*)?'",
    f"href: '/trading.html?v={STAMP}'",
    nav,
    count=1
)

html_p.write_text(html, encoding="utf-8")
js_p.write_text(js, encoding="utf-8")
css_p.write_text(css, encoding="utf-8")
nav_p.write_text(nav, encoding="utf-8")
PY

echo
echo "=== SYNTAX CHECK ==="
node --check "$JS"
node --check "$NAV"

echo
echo "=== SINGLE EDITOR CHECK ==="

for needle in \
  'id="amountInput"' \
  'id="hardStopPct"' \
  'id="trailingStopPct"' \
  'id="tp1Pct"' \
  'id="tp1SellPct"' \
  'id="tp2Pct"' \
  'id="tp2SellPct"' \
  'id="runnerPct"' \
  'id="maxHoldMinutes"' \
  'id="exitBuyPressure"' \
  'id="exitOnWeakBuyPressure"' \
  'id="dailySpendLimit"' \
  'id="dailyLossLimit"' \
  'id="maxOpenPositions"' \
  'id="maxDailyEntries"' \
  'id="saveStrategyBtn"'
do
  if grep -q "$needle" "$HTML"; then
    echo "ERROR: duplicate editable control still exists in Trading: $needle"
    exit 1
  fi
done

grep -n 'strategy-summary-panel' "$HTML"
grep -n 'id="editStrategyBtn"' "$HTML"
grep -n 'id="strategyPosition"' "$HTML"
grep -n 'Synced from System Settings' "$JS"
grep -n 'single-strategy-editor-v1-20260826' "$HTML" "$NAV"

echo
echo "=== GIT DIFF ==="
git diff -- "$HTML" "$JS" "$CSS" "$NAV"

if git diff --quiet -- "$HTML" "$JS" "$CSS" "$NAV"; then
  echo "No changes needed: single strategy editor is already installed."
  exit 0
fi

git add "$HTML" "$JS" "$CSS" "$NAV"
git commit -m "refactor(trading): use System Settings as strategy editor"
git push origin HEAD

echo
echo "DONE: Trading Terminal is read-only for strategy configuration."
echo "DONE: System Settings is the single strategy editor."
echo "DONE: Trading still reads the same /api/settings server source."
