#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW RECENT TRADES TRUE TWO ROWS V4 ==="

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

STAMP = "recent-trades-true-two-rows-v4-20260826"

# Cache bust.
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

# Replace only renderTrades(). No API logic changes.
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
    const fallback = String(symbol || 'TK')
      .replace(/[^A-Z0-9]/gi, '')
      .slice(0, 2)
      .toUpperCase() || 'TK';

    if (url) {
      return `
        <span class="trade-token-avatar">
          <img
            src="${esc(url)}"
            alt="${esc(symbol)}"
            onerror="this.parentElement.classList.add('is-fallback');this.remove();"
          >
          <span class="trade-avatar-fallback-text">${esc(fallback)}</span>
        </span>
      `;
    }

    return `
      <span class="trade-token-avatar is-fallback">
        <span class="trade-avatar-fallback-text">${esc(fallback)}</span>
      </span>
    `;
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
      symbol
    ).trim();

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
          <div class="trade-log-topline">
            <strong class="trade-side ${sideClass}">${esc(side)}</strong>
            <strong class="trade-log-symbol">${esc(symbol)}</strong>

            ${pumpUrl
              ? `<a class="trade-pump-link"
                    href="${esc(pumpUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open ${esc(symbol)} on Pump.fun">Pump &#8599;</a>`
              : ''}

            <time class="trade-log-time">${esc(tradeTime(rawTime))}</time>
          </div>

          <div class="trade-log-bottomline">
            <span class="trade-token-name">${esc(tokenName)}</span>
            <i>·</i>
            <span>${finite(sizeSol) ? `${fmt(sizeSol, 4)} SOL` : '—'}</span>
            <i>·</i>
            <span class="${pnlClass}">${esc(pnlText)}</span>
            <i>·</i>
            <span class="trade-log-reason">${esc(reason)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');
}'''

render_re = re.compile(
    r'function renderTrades\(\) \{.*?\n\}\n\nfunction openWalletSettings\(\)',
    re.S
)

if not render_re.search(js):
    raise SystemExit("ERROR: renderTrades() not found")

js = render_re.sub(
    new_render + "\n\nfunction openWalletSettings()",
    js,
    count=1
)

# Remove prior Recent trades V3 component CSS only.
css = re.sub(
    r'\n?/\* ===== MEMEFLOW_RECENT_TRADES_TWO_ROWS_AVATAR_V3 ===== \*/.*?'
    r'/\* ===== /MEMEFLOW_RECENT_TRADES_TWO_ROWS_AVATAR_V3 ===== \*/\n?',
    '\n',
    css,
    count=1,
    flags=re.S
)

component_css = r'''
/* ===== MEMEFLOW_RECENT_TRADES_TRUE_TWO_ROWS_V4 ===== */
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
  height: 128px;
  min-height: 128px;
  max-height: 128px;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y proximity;
  -webkit-overflow-scrolling: touch;
}

.bottom-history-panel .trade-row.trade-log-row {
  width: 100%;
  height: 64px;
  min-height: 64px;
  max-height: 64px;
  padding: 8px 10px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border: 0;
  border-bottom: 1px solid rgba(111, 154, 172, .06);
  border-radius: 0;
  background: transparent;
  color: #6d8590;
  overflow: hidden;
  scroll-snap-align: start;
}

.bottom-history-panel .trade-row.trade-log-row:last-child {
  border-bottom: 0;
}

.trade-token-avatar {
  position: relative;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(111, 154, 172, .12);
  border-radius: 8px;
  background: rgba(111, 154, 172, .05);
}

.trade-token-avatar img {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.trade-avatar-fallback-text {
  position: relative;
  z-index: 1;
  color: #8aa2ad;
  font-size: 7px;
  font-weight: 800;
}

.trade-token-avatar.is-fallback img {
  display: none;
}

.trade-log-main {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.trade-log-topline {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.trade-side {
  flex: 0 0 auto;
  min-width: 30px;
  font-size: 7px;
  font-weight: 820;
  line-height: 1;
}

.trade-side.buy { color: var(--green); }
.trade-side.sell { color: var(--red); }

.trade-log-symbol {
  min-width: 0;
  overflow: hidden;
  color: #c8d6dd;
  font-size: 8px;
  font-weight: 740;
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

.trade-log-bottomline {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  color: #657d88;
  font-size: 6px;
  line-height: 1;
  white-space: nowrap;
}

.trade-log-bottomline > span {
  flex: 0 0 auto;
}

.trade-log-bottomline i {
  flex: 0 0 auto;
  color: #344a54;
  font-style: normal;
}

.trade-token-name {
  max-width: 120px;
  overflow: hidden;
  color: #526a75;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trade-log-reason {
  min-width: 0;
  flex: 1 1 auto !important;
  overflow: hidden;
  color: #718995;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trade-log-bottomline .pnl-positive {
  color: var(--green);
}

.trade-log-bottomline .pnl-negative {
  color: var(--red);
}

@media (max-width: 820px) {
  .chart-panel { order: 1; width: 100%; }
  .control-panel { order: 2; width: 100%; }
  .positions-panel { order: 3; width: 100%; }
  .candidates-panel { order: 5; width: 100%; }
  .bottom-history-panel { order: 6; width: 100%; }
}

@media (max-width: 430px) {
  .bottom-history-panel .trade-row.trade-log-row {
    padding: 8px 9px;
    gap: 7px;
  }

  .trade-log-topline {
    gap: 6px;
  }

  .trade-token-name {
    max-width: 92px;
  }
}
/* ===== /MEMEFLOW_RECENT_TRADES_TRUE_TWO_ROWS_V4 ===== */
'''

css = css.rstrip() + "\n\n" + component_css.strip() + "\n"

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
echo "=== FEATURE CHECK ==="
grep -n 'MEMEFLOW_RECENT_TRADES_TRUE_TWO_ROWS_V4' "$CSS"
grep -n 'height: 128px' "$CSS" | tail -n 3
grep -n 'height: 64px' "$CSS" | tail -n 3
grep -n 'trade-log-bottomline' "$JS" "$CSS" | head -n 6
grep -n 'pump.fun/coin' "$JS"
grep -n 'recent-trades-true-two-rows-v4-20260826' "$HTML" "$NAV"

echo
echo "=== PRESERVE TRADE STRATEGY CHECK ==="
grep -n 'MEMEFLOW_RESTORE_COMPACT_TRADE_STRATEGY_V1' "$CSS"

echo
echo "=== GIT DIFF ==="
git diff -- "$HTML" "$JS" "$CSS" "$NAV"

if ! git diff --quiet -- "$HTML" "$JS" "$CSS" "$NAV"; then
  git add "$HTML" "$JS" "$CSS" "$NAV"
  git commit -m "fix(trading): fit exactly two recent trade rows"
else
  echo "No new working-tree changes; checking whether local HEAD still needs push."
fi

git push origin HEAD:main

echo
echo "DONE: exactly two complete trade rows fit inside Recent trades."
echo "DONE: remaining trades scroll vertically inside the panel."
echo "DONE: avatar, token, Pump link, time, size, P&L, and reason preserved."
echo "DONE: Trade strategy styling preserved."
