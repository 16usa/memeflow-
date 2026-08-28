#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW RECENT TRADES CLEAN + BOTTOM V1 ==="

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

STAMP = "recent-trades-clean-bottom-v1-20260826"

# ------------------------------------------------------------------
# 1) Remove Recent trades from center-stack and append it as the last
#    child of <main class="terminal">. This makes Candidates come first
#    and Execution Log the true bottom panel on mobile and desktop.
# ------------------------------------------------------------------
history_re = re.compile(
    r'\n\s*<section class="panel history-panel">.*?'
    r'<div id="tradeHistory" class="trade-history">.*?</div>\s*'
    r'</section>',
    re.S
)

match = history_re.search(html)
if not match:
    if 'bottom-history-panel' not in html:
        raise SystemExit("ERROR: Recent trades block not found")
else:
    html = html[:match.start()] + "\n" + html[match.end():]

bottom_history = r'''
      <section class="panel history-panel bottom-history-panel">
        <div class="panel-head compact-head">
          <div>
            <span class="eyebrow">EXECUTION LOG</span>
            <h2>Recent trades</h2>
          </div>
          <span class="trade-log-hint">LATEST EXECUTIONS</span>
        </div>
        <div id="tradeHistory" class="trade-history">
          <div class="empty">No paper trades yet</div>
        </div>
      </section>
'''

if 'bottom-history-panel' not in html:
    marker = '    </main>\n  </div>'
    if marker not in html:
        raise SystemExit("ERROR: terminal closing marker not found")
    html = html.replace(
        marker,
        bottom_history + '    </main>\n  </div>',
        1
    )

# Cache bust entry assets.
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

# ------------------------------------------------------------------
# 2) Replace the old table-like renderer with a readable two-level row:
#    top = BUY/SELL + token + time
#    bottom = size + P&L + reason
# ------------------------------------------------------------------
new_render = r'''function renderTrades() {
  const rows = state.trades.slice(0, 40);
  const list = $('tradeHistory');

  if (!rows.length) {
    list.innerHTML = `<div class="empty">No paper trades yet</div>`;
    return;
  }

  const tradeTime = raw => {
    if (raw === null || raw === undefined || raw === '') return '—';

    let value = raw;
    if (typeof value === 'number' && value > 0 && value < 1e12) {
      value *= 1000;
    }

    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '—';

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  list.innerHTML = rows.map(trade => {
    const side = String(trade.side || '').toUpperCase() || '—';
    const sideClass = side.toLowerCase();
    const rawTime =
      trade.at ??
      trade.createdAt ??
      trade.timestamp ??
      trade.executedAt;

    const reason = String(
      trade.reason ||
      trade.exitReason ||
      'ENGINE'
    ).trim();

    const copyTrade =
      String(trade.strategySource || '').toLowerCase() === 'copy-trading';

    const sizeSol =
      num(trade.valueSol) ??
      num(trade.amountSol) ??
      num(trade.sizeSol);

    const pnl = num(trade.realizedPnlSol);
    const pnlText = finite(pnl)
      ? `${pnl >= 0 ? '+' : ''}${fmt(pnl, 5)} SOL`
      : '—';
    const pnlClass = finite(pnl)
      ? (pnl >= 0 ? 'pnl-positive' : 'pnl-negative')
      : '';

    return `
      <div class="trade-row trade-log-row">
        <div class="trade-log-primary">
          <strong class="trade-side ${sideClass}">${esc(side)}</strong>
          <strong class="trade-log-symbol">${esc(trade.symbol || short(trade.mint))}</strong>
          ${copyTrade ? '<em class="copy-trade-badge">COPY TRADE</em>' : ''}
          <time class="trade-log-time">${esc(tradeTime(rawTime))}</time>
        </div>

        <div class="trade-log-details">
          <span>
            <b>SIZE</b>
            <strong>${finite(sizeSol) ? `${fmt(sizeSol, 4)} SOL` : '—'}</strong>
          </span>

          <span>
            <b>P&amp;L</b>
            <strong class="${pnlClass}">${esc(pnlText)}</strong>
          </span>

          <span class="trade-log-reason">
            <b>REASON</b>
            <strong>${esc(reason)}</strong>
          </span>
        </div>
      </div>
    `;
  }).join('');
}'''

render_re = re.compile(
    r'function renderTrades\(\) \{.*?\n\}\n\nfunction openWalletSettings\(\)',
    re.S
)

js2, count = render_re.subn(
    new_render + "\n\nfunction openWalletSettings()",
    js,
    count=1
)
if count != 1:
    if 'trade-log-primary' not in js:
        raise SystemExit("ERROR: renderTrades replacement failed")
else:
    js = js2

# ------------------------------------------------------------------
# 3) Replace old trade-row table styling with clean execution cards.
#    Uses the same muted text, thin separators and panel language already
#    present on this page. No new theme layer.
# ------------------------------------------------------------------
old_trade_css = re.compile(
    r'\.trade-row \{.*?'
    r'\.trade-side\.sell \{ color: var\(--red\); \}',
    re.S
)

new_trade_css = r'''.bottom-history-panel {
  grid-column: 1 / -1;
  width: 100%;
}

.trade-log-hint {
  color: #506874;
  font-size: 6px;
  font-weight: 720;
  letter-spacing: .08em;
}

.trade-history {
  padding: 0;
  max-height: 420px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.trade-row.trade-log-row {
  min-height: 58px;
  padding: 8px 10px;
  display: grid;
  gap: 7px;
  border-bottom: 1px solid rgba(111, 154, 172, .06);
  color: #6d8590;
}

.trade-row.trade-log-row:last-child {
  border-bottom: 0;
}

.trade-log-primary {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.trade-side {
  flex: 0 0 auto;
  min-width: 30px;
  font-size: 7px;
  font-weight: 820;
}

.trade-side.buy { color: var(--green); }
.trade-side.sell { color: var(--red); }

.trade-log-symbol {
  min-width: 0;
  overflow: hidden;
  color: #c8d6dd;
  font-size: 8px;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trade-log-time {
  margin-left: auto;
  flex: 0 0 auto;
  color: #526a75;
  font-size: 6px;
  font-variant-numeric: tabular-nums;
}

.trade-log-details {
  display: grid;
  grid-template-columns: 110px 120px minmax(140px, 1fr);
  gap: 10px;
}

.trade-log-details > span {
  min-width: 0;
}

.trade-log-details b {
  display: block;
  margin-bottom: 3px;
  color: #455f6a;
  font-size: 5px;
  font-weight: 720;
  letter-spacing: .08em;
}

.trade-log-details strong {
  display: block;
  overflow: hidden;
  color: #7b919b;
  font-size: 7px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trade-log-details strong.pnl-positive {
  color: var(--green) !important;
}

.trade-log-details strong.pnl-negative {
  color: var(--red) !important;
}'''

css2, count = old_trade_css.subn(new_trade_css, css, count=1)
if count != 1:
    if '.trade-log-primary {' not in css:
        raise SystemExit("ERROR: old trade-row CSS block not found")
else:
    css = css2

# Old shared padding must not add space back to trade-history.
css = css.replace(
    ".positions-list, .trade-history { padding: 6px; }",
    ".positions-list { padding: 6px; }",
    1
)

# Mobile order: Candidates = 5, Recent trades = 6 / last.
css = css.replace(
    "  .history-panel { order: 4; width: 100%; }\n  .candidates-panel { order: 5; width: 100%; }",
    "  .candidates-panel { order: 5; width: 100%; }\n  .bottom-history-panel { order: 6; width: 100%; }",
    1
)

# Remove the old mobile rule that hid P&L/reason/time.
old_mobile_trade = r'''  .trade-row {
    grid-template-columns: 44px 1fr 65px;
  }
  .trade-row > :nth-child(4),
  .trade-row > :nth-child(5) { display: none; }'''

new_mobile_trade = r'''  .trade-log-details {
    grid-template-columns: 1fr 1fr;
    gap: 7px 12px;
  }

  .trade-log-reason {
    grid-column: 1 / -1;
  }

  .trade-row.trade-log-row {
    min-height: 62px;
    padding: 8px 9px;
  }'''

if old_mobile_trade in css:
    css = css.replace(old_mobile_trade, new_mobile_trade, 1)
elif ".trade-log-reason {" not in css:
    raise SystemExit("ERROR: old mobile trade CSS not found")

# On very small phones keep everything readable.
small_marker = "@media (max-width: 430px) {\n"
small_rules = r'''@media (max-width: 430px) {
  .trade-log-primary {
    gap: 6px;
  }

  .trade-log-details {
    grid-template-columns: 1fr 1fr;
  }

  .trade-log-symbol {
    font-size: 8px;
  }

'''
if small_marker in css and ".trade-log-primary {\n    gap: 6px;" not in css:
    css = css.replace(small_marker, small_rules, 1)

# ------------------------------------------------------------------
# 4) Fresh Trading page URL from menu.
# ------------------------------------------------------------------
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
echo "=== STRUCTURE CHECK ==="
grep -n 'bottom-history-panel' "$HTML"
grep -n 'trade-log-primary' "$JS"
grep -n 'trade-log-details' "$CSS" | head -n 6
grep -n 'recent-trades-clean-bottom-v1-20260826' "$HTML" "$NAV"

# Exactly one Recent trades container.
count="$(grep -c 'id="tradeHistory"' "$HTML" || true)"
if [[ "$count" != "1" ]]; then
  echo "ERROR: expected exactly one tradeHistory, found $count"
  exit 1
fi

# Confirm it is after Candidates in source.
python3 - <<'PY'
from pathlib import Path
s = Path("memeflow-app/trading.html").read_text(encoding="utf-8")
cand = s.find('class="panel candidates-panel"')
hist = s.find('class="panel history-panel bottom-history-panel"')
if cand < 0 or hist < 0 or hist <= cand:
    raise SystemExit("ERROR: Recent trades is not after Candidates")
print("ORDER OK: Candidates -> ... -> Recent trades")
PY

echo
echo "=== GIT DIFF ==="
git diff -- "$HTML" "$JS" "$CSS" "$NAV"

if git diff --quiet -- "$HTML" "$JS" "$CSS" "$NAV"; then
  echo "No changes needed: clean bottom Recent trades is already installed."
  exit 0
fi

git add "$HTML" "$JS" "$CSS" "$NAV"
git commit -m "style(trading): clarify recent trades and move log to bottom"
git push origin HEAD

echo
echo "DONE: Recent trades is readable and placed below Candidates."
echo "Trading data/API logic was not changed."
