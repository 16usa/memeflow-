#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW RECENT TRADES TWO ROWS + AVATAR V3 ==="

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

html_p = Path('memeflow-app/trading.html')
js_p = Path('memeflow-app/trading.js')
css_p = Path('memeflow-app/trading.css')
nav_p = Path('memeflow-app/memeflow-nav.js')

html = html_p.read_text(encoding='utf-8')
js = js_p.read_text(encoding='utf-8')
css = css_p.read_text(encoding='utf-8')
nav = nav_p.read_text(encoding='utf-8')

STAMP = 'recent-trades-two-rows-avatar-v3-20260826'

# 1) Ensure Recent trades exists exactly once and is the last panel under <main>.
history_re = re.compile(
    r'\n\s*<section class="panel history-panel(?: [^"]*)?">.*?<div id="tradeHistory" class="trade-history">.*?</div>\s*</section>',
    re.S
)
html = history_re.sub('\n', html)

bottom_history = '''
      <section class="panel history-panel bottom-history-panel">
        <div class="panel-head compact-head">
          <div>
            <span class="eyebrow">EXECUTION LOG</span>
            <h2>Recent trades</h2>
          </div>
          <span class="trade-log-hint">SCROLL</span>
        </div>
        <div id="tradeHistory" class="trade-history">
          <div class="empty">No paper trades yet</div>
        </div>
      </section>
'''
marker = '    </main>\n  </div>'
if marker not in html:
    raise SystemExit('ERROR: could not find </main> marker in trading.html')
html = html.replace(marker, bottom_history + '    </main>\n  </div>', 1)

# cache-bust asset URLs in trading.html
html = re.sub(r'/trading\.css\?v=[^"]+', '/trading.css?v=' + STAMP, html, count=1)
html = re.sub(r'/trading\.js\?v=[^"]+', '/trading.js?v=' + STAMP, html, count=1)
html = re.sub(r'/memeflow-nav\.js\?v=[^"]+', '/memeflow-nav.js?v=global-right-drawer-' + STAMP, html, count=1)

# 2) Replace renderTrades with final compact scrollable 2-row list.
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

  const avatarMarkup = (url, symbol) => {
    if (url) {
      return `<span class="trade-token-avatar"><img src="${esc(url)}" alt="${esc(symbol)}"></span>`;
    }

    const fallback = String(symbol || 'TK').replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || 'TK';
    return `<span class="trade-token-avatar trade-token-avatar-fallback">${esc(fallback)}</span>`;
  };

  list.innerHTML = rows.map(trade => {
    const side = String(trade.side || '').toUpperCase() || '—';
    const sideClass = side.toLowerCase();
    const mint = String(trade.mint || '').trim();

    const related =
      (state.candidates || []).find(item => item?.mint === mint) ||
      (state.positions || []).find(item => item?.mint === mint) ||
      null;

    const symbol = String(
      trade.symbol ||
      related?.symbol ||
      (mint ? short(mint) : 'TOKEN')
    ).trim();

    const tokenName = String(
      trade.name ||
      related?.name ||
      ''
    ).trim();

    const showName = tokenName && tokenName.toUpperCase() !== symbol.toUpperCase();

    const avatarUrl = String(
      trade.logoUrl ||
      trade.imageUrl ||
      trade.image ||
      related?.logoUrl ||
      related?.imageUrl ||
      related?.image ||
      related?.icon ||
      ''
    ).trim();

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

    const pumpUrl = mint
      ? `https://pump.fun/coin/${encodeURIComponent(mint)}`
      : '';

    return `
      <article class="trade-row trade-log-row">
        ${avatarMarkup(avatarUrl, symbol)}

        <div class="trade-log-main">
          <div class="trade-log-primary">
            <strong class="trade-side ${sideClass}">${esc(side)}</strong>

            <div class="trade-token">
              <div class="trade-token-line">
                <strong class="trade-log-symbol">${esc(symbol)}</strong>
                ${pumpUrl
                  ? `<a class="trade-pump-link"
                        href="${esc(pumpUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open ${esc(symbol)} on Pump.fun">Pump &#8599;</a>`
                  : ''}
              </div>
              ${showName
                ? `<span class="trade-token-name">${esc(tokenName)}</span>`
                : ''}
            </div>

            <time class="trade-log-time">${esc(tradeTime(rawTime))}</time>
          </div>

          <div class="trade-log-secondary">
            <span><b>SIZE</b><strong>${finite(sizeSol) ? `${fmt(sizeSol, 4)} SOL` : '—'}</strong></span>
            <span><b>P&amp;L</b><strong class="${pnlClass}">${esc(pnlText)}</strong></span>
            <span class="trade-log-reason"><b>REASON</b><strong>${esc(reason)}</strong></span>
          </div>
        </div>
      </article>
    `;
  }).join('');
}'''

render_re = re.compile(
    r'(?:let tradeHistoryExpanded = false;\n\n)?function renderTrades\(\) \{.*?\n\}\n\nfunction openWalletSettings\(\)',
    re.S
)
if not render_re.search(js):
    raise SystemExit('ERROR: could not find renderTrades block in trading.js')
js = render_re.sub(new_render + '\n\nfunction openWalletSettings()', js, count=1)

# 3) Remove known stale trade-history component blocks that conflict.
patterns = [
    r'\n?/\* ===== MEMEFLOW_RECENT_TRADES_FINAL_COMPACT_V2 ===== \*/.*?/\* ===== /MEMEFLOW_RECENT_TRADES_FINAL_COMPACT_V2 ===== \*/\n?',
    r'\n?/\* ===== MEMEFLOW_COMPACT_NATIVE_TRADE_STRATEGY_V1 ===== \*/.*?/\* ===== /MEMEFLOW_COMPACT_NATIVE_TRADE_STRATEGY_V1 ===== \*/\n?',
]
for pat in patterns:
    css = re.sub(pat, '\n', css, flags=re.S)

# Remove specific stale mobile ordering blocks if present.
css = re.sub(
    r'\.positions-panel\s*\{\s*order:\s*4;\s*width:\s*100%;\s*\}\s*'
    r'\.history-panel\s*\{\s*order:\s*5;\s*width:\s*100%;\s*\}\s*'
    r'\.candidates-panel\s*\{\s*order:\s*6;\s*width:\s*100%;\s*\}',
    '.positions-panel {\n    order: 3;\n    width: 100%;\n  }\n\n  .candidates-panel {\n    order: 5;\n    width: 100%;\n  }\n\n  .bottom-history-panel {\n    order: 6;\n    width: 100%;\n  }',
    css,
    count=1,
    flags=re.S
)

# 4) Append final canonical CSS for the component.
component_css = r'''
/* ===== MEMEFLOW_RECENT_TRADES_TWO_ROWS_AVATAR_V3 ===== */
.bottom-history-panel {
  grid-column: 1 / -1;
  width: 100%;
}

.bottom-history-panel .panel-head {
  min-height: 51px;
}

.trade-log-hint {
  color: #506874;
  font-size: 6px;
  font-weight: 720;
  letter-spacing: .08em;
}

.bottom-history-panel .trade-history {
  display: block;
  padding: 0;
  min-height: 132px;
  max-height: 132px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.bottom-history-panel .trade-row.trade-log-row {
  width: 100%;
  min-height: 66px;
  padding: 8px 10px;
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 8px;
  border: 0;
  border-bottom: 1px solid rgba(111, 154, 172, .06);
  border-radius: 0;
  background: transparent;
  color: #6d8590;
}

.bottom-history-panel .trade-row.trade-log-row:last-child {
  border-bottom: 0;
}

.trade-token-avatar {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  align-self: start;
  overflow: hidden;
  border: 1px solid rgba(111, 154, 172, .12);
  border-radius: 8px;
  background: rgba(111, 154, 172, .05);
}

.trade-token-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.trade-token-avatar-fallback {
  color: #8aa2ad;
  font-size: 7px;
  font-weight: 800;
}

.trade-log-main {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.trade-log-primary {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.trade-side {
  flex: 0 0 auto;
  min-width: 30px;
  font-size: 7px;
  font-weight: 820;
  line-height: 1.2;
}

.trade-side.buy { color: var(--green); }
.trade-side.sell { color: var(--red); }

.trade-token {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.trade-token-line {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.trade-log-symbol {
  min-width: 0;
  overflow: hidden;
  color: #c8d6dd;
  font-size: 8px;
  font-weight: 740;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trade-token-name {
  overflow: hidden;
  color: #526a75;
  font-size: 6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trade-pump-link {
  flex: 0 0 auto;
  color: #6f929f;
  font-size: 6px;
  font-weight: 720;
  text-decoration: none;
}

.trade-pump-link:active,
.trade-pump-link:hover {
  color: #b7ecfa;
}

.trade-log-time {
  margin-left: auto;
  flex: 0 0 auto;
  color: #526a75;
  font-size: 6px;
  font-variant-numeric: tabular-nums;
}

.trade-log-secondary {
  display: grid;
  grid-template-columns: 90px 108px minmax(120px, 1fr);
  gap: 8px;
}

.trade-log-secondary > span {
  min-width: 0;
}

.trade-log-secondary b {
  display: block;
  margin-bottom: 2px;
  color: #455f6a;
  font-size: 5px;
  font-weight: 720;
  letter-spacing: .08em;
}

.trade-log-secondary strong {
  display: block;
  overflow: hidden;
  color: #7b919b;
  font-size: 7px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trade-log-secondary strong.pnl-positive {
  color: var(--green) !important;
}

.trade-log-secondary strong.pnl-negative {
  color: var(--red) !important;
}

@media (max-width: 820px) {
  .chart-panel { order: 1; width: 100%; }
  .control-panel { order: 2; width: 100%; }
  .positions-panel { order: 3; width: 100%; }
  .candidates-panel { order: 5; width: 100%; }
  .bottom-history-panel { order: 6; width: 100%; }

  .bottom-history-panel .trade-history {
    min-height: 132px;
    max-height: 132px;
  }

  .trade-log-secondary {
    grid-template-columns: 1fr 1fr;
    gap: 6px 10px;
  }

  .trade-log-reason {
    grid-column: 1 / -1;
  }
}

@media (max-width: 430px) {
  .bottom-history-panel .trade-row.trade-log-row {
    padding: 8px 9px;
    gap: 7px;
  }

  .trade-log-primary {
    gap: 6px;
  }

  .trade-token-line {
    gap: 5px;
  }
}
/* ===== /MEMEFLOW_RECENT_TRADES_TWO_ROWS_AVATAR_V3 ===== */
'''
css += '\n\n' + component_css

# 5) Make menu open a fresh Trading URL.
nav = re.sub(
    r"href:\s*'/trading\.html(?:\?[^']*)?'",
    "href: '/trading.html?v=" + STAMP + "'",
    nav,
    count=1
)

html_p.write_text(html, encoding='utf-8')
js_p.write_text(js, encoding='utf-8')
css_p.write_text(css, encoding='utf-8')
nav_p.write_text(nav, encoding='utf-8')
PY

echo
echo "=== SYNTAX CHECK ==="
node --check "$JS"
node --check "$NAV"

echo
echo "=== FEATURE CHECK ==="
grep -n 'bottom-history-panel' "$HTML"
grep -n 'trade-token-avatar' "$JS" "$CSS" | head -n 8
grep -n 'pump.fun/coin' "$JS"
grep -n 'min-height: 132px' "$CSS"
grep -n 'order: 6' "$CSS" | head -n 3
grep -n 'recent-trades-two-rows-avatar-v3-20260826' "$HTML" "$NAV"

echo
echo "=== ORDER CHECK ==="
python3 - <<'PY'
from pathlib import Path
html = Path('memeflow-app/trading.html').read_text(encoding='utf-8')
css = Path('memeflow-app/trading.css').read_text(encoding='utf-8')
if html.count('id="tradeHistory"') != 1:
    raise SystemExit('ERROR: expected exactly one tradeHistory container')
if 'class="panel history-panel bottom-history-panel"' not in html:
    raise SystemExit('ERROR: bottom history panel missing')
if html.find('class="panel candidates-panel"') > html.find('class="panel history-panel bottom-history-panel"'):
    raise SystemExit('ERROR: Recent trades is not after Candidates in HTML source')
if '.bottom-history-panel { order: 6; width: 100%; }' not in css:
    raise SystemExit('ERROR: mobile bottom order rule missing')
print('ORDER OK: Candidates -> Recent trades')
print('HEIGHT OK: internal list locked to ~2 visible rows with scroll')
PY

echo
echo "=== GIT DIFF ==="
git diff -- "$HTML" "$JS" "$CSS" "$NAV"

if ! git diff --quiet -- "$HTML" "$JS" "$CSS" "$NAV"; then
  git add "$HTML" "$JS" "$CSS" "$NAV"
  git commit -m "fix(trading): compact recent trades with avatars"
else
  echo "No new working-tree changes; checking whether local HEAD still needs push."
fi

git push origin HEAD:main

echo
echo "DONE: Recent trades moved below Candidates."
echo "DONE: Only ~2 trade rows are visible at once; the rest scroll inside the block."
echo "DONE: Each trade now shows token avatar, ticker/name, Pump link, time, size, P&L, and reason."
