#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in \
  "$APP/app-server.mjs" \
  "$APP/trading.js" \
  "$APP/trading.html" \
  "$APP/src/paper-position-mark-v81.mjs"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing required file: $f"
    exit 1
  fi
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/open-position-live-value-v83-$STAMP"
mkdir -p "$BACKUP/memeflow-app/src" "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/app-server.mjs"
  "memeflow-app/trading.js"
  "memeflow-app/trading.html"
  "memeflow-app/src/paper-position-mark-v81.mjs"
  "memeflow-app/tests/open-position-live-value-v83.mjs"
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

git rev-parse HEAD > "$BACKUP/git-head.txt" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-open-position-live-value-v83-last-backup"

cp "$PATCH_DIR/src/paper-position-mark-v81.mjs" \
   "$APP/src/paper-position-mark-v81.mjs"

python3 - "$APP/app-server.mjs" "$APP/trading.js" "$APP/trading.html" <<'PY'
from pathlib import Path
import re
import sys

server_path = Path(sys.argv[1])
trading_path = Path(sys.argv[2])
html_path = Path(sys.argv[3])

server = server_path.read_text()
trading = trading_path.read_text()
html = html_path.read_text()

# ---------------------------------------------------------------------------
# Backend: /api/paper/positions/live
# ---------------------------------------------------------------------------
live_start = server.find('// MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18')
live_end = server.find(
    '// MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3',
    live_start
)

if live_start < 0 or live_end < 0:
    raise SystemExit('ERROR: live positions route markers not found')

route = server[live_start:live_end]

# Support both current V81 and an accidentally preinstalled V82 shape.
if 'const liveValueSol=' not in route:
    old_v81 = """        const unrealized=
          pnlReady
            ? remainingQty*(markPrice-entryPrice)
            : null;

        const pnlPct=
          pnlReady
            ? ((realized+unrealized)/initialSize)*100
            : null;
"""
    new_v83 = """        const liveValueSol=
          pnlReady
            ? remainingQty*markPrice
            : null;

        const unrealized=
          pnlReady
            ? remainingQty*(markPrice-entryPrice)
            : null;

        const pnlSol=
          pnlReady
            ? realized+unrealized
            : null;

        const pnlPct=
          pnlReady
            ? (pnlSol/initialSize)*100
            : null;
"""

    if old_v81 in route:
        route = route.replace(old_v81, new_v83, 1)
    else:
        old_v82 = """        const unrealized=
          pnlReady
            ? remainingQty*(markPrice-entryPrice)
            : null;

        const pnlSol=
          pnlReady
            ? realized+unrealized
            : null;

        const pnlPct=
          pnlReady
            ? (pnlSol/initialSize)*100
            : null;
"""
        if old_v82 not in route:
            raise SystemExit('ERROR: live pnl formula anchor changed')
        route = route.replace(old_v82, new_v83, 1)

# Add metrics if absent.
if '            liveValueSol,' not in route:
    if '            pnlSol,' in route:
        route = route.replace(
            '            pnlReady,\n            pnlSol,\n',
            '            pnlReady,\n            liveValueSol,\n            pnlSol,\n',
            1
        )
    else:
        anchor = """            pnlReady,
            pnlPct,
            pnlUnrealizedSol:unrealized,
"""
        replacement = """            pnlReady,
            liveValueSol,
            pnlSol,
            pnlPct,
            pnlRealizedSol:realized,
            pnlUnrealizedSol:unrealized,
"""
        if anchor not in route:
            raise SystemExit('ERROR: live tokenMetrics anchor changed')
        route = route.replace(anchor, replacement, 1)

server = server[:live_start] + route + server[live_end:]

# Keep the non-hot /api/paper/positions endpoint semantically aligned.
if 'const _liveValueSol=' not in server:
    old_full = """    const _liveUnrealizedPnlSol=
      _pnlReady
        ? _remainingQty*(_latestPrice-_entryPrice)
        : null;

    const _livePnlPct=
      _pnlReady
        ? (
            (_realizedPnl+_liveUnrealizedPnlSol) /
            _initialSize
          )*100
        : null;
"""
    new_full = """    const _liveValueSol=
      _pnlReady
        ? _remainingQty*_latestPrice
        : null;

    const _liveUnrealizedPnlSol=
      _pnlReady
        ? _remainingQty*(_latestPrice-_entryPrice)
        : null;

    const _livePnlSol=
      _pnlReady
        ? _realizedPnl+_liveUnrealizedPnlSol
        : null;

    const _livePnlPct=
      _pnlReady
        ? (_livePnlSol/_initialSize)*100
        : null;
"""
    if old_full in server:
        server = server.replace(old_full, new_full, 1)
    elif 'const _livePnlSol=' in server:
        # V82-like shape.
        old_full_v82 = """    const _liveUnrealizedPnlSol=
      _pnlReady
        ? _remainingQty*(_latestPrice-_entryPrice)
        : null;

    const _livePnlSol=
      _pnlReady
        ? _realizedPnl+_liveUnrealizedPnlSol
        : null;
"""
        new_full_v82 = """    const _liveValueSol=
      _pnlReady
        ? _remainingQty*_latestPrice
        : null;

    const _liveUnrealizedPnlSol=
      _pnlReady
        ? _remainingQty*(_latestPrice-_entryPrice)
        : null;

    const _livePnlSol=
      _pnlReady
        ? _realizedPnl+_liveUnrealizedPnlSol
        : null;
"""
        if old_full_v82 not in server:
            raise SystemExit('ERROR: full positions pnl formula anchor changed')
        server = server.replace(old_full_v82, new_full_v82, 1)
    else:
        raise SystemExit('ERROR: full positions live pnl anchor changed')

if '        liveValueSol:_liveValueSol,' not in server:
    if '        pnlSol:_livePnlSol,' in server:
        server = server.replace(
            '        pnlReady:_pnlReady,\n        pnlSol:_livePnlSol,\n',
            '        pnlReady:_pnlReady,\n        liveValueSol:_liveValueSol,\n        pnlSol:_livePnlSol,\n',
            1
        )
    else:
        anchor = """        pnlReady:_pnlReady,
        pnlPct:_livePnlPct,
        pnlUnrealizedSol:_liveUnrealizedPnlSol,
"""
        replacement = """        pnlReady:_pnlReady,
        liveValueSol:_liveValueSol,
        pnlSol:_livePnlSol,
        pnlPct:_livePnlPct,
        pnlRealizedSol:_realizedPnl,
        pnlUnrealizedSol:_liveUnrealizedPnlSol,
"""
        if anchor not in server:
            raise SystemExit('ERROR: full positions tokenMetrics anchor changed')
        server = server.replace(anchor, replacement, 1)

server_path.write_text(server)

# ---------------------------------------------------------------------------
# Frontend: LIVE VALUE · TOTAL P&L
# ---------------------------------------------------------------------------
render_start = trading.find('function renderPositions()')
render_end = trading.find('\nfunction renderTrades(', render_start)

if render_start < 0 or render_end < 0:
    raise SystemExit('ERROR: renderPositions markers not found')

render = trading[render_start:render_end]

# Replace V80 percent renderer or V82 SOL renderer with final V83 display.
start = render.find('    // MEMEFLOW_OPEN_POSITION_LIVE_PNL_V80')
settings_anchor = render.find(
    '    const settings = position.settingsSnapshot || {};',
    start
)

if start < 0 or settings_anchor < 0:
    raise SystemExit('ERROR: live pnl renderer anchor not found')

new_value_block = """    // MEMEFLOW_OPEN_POSITION_LIVE_PNL_V80
    // MEMEFLOW_OPEN_POSITION_LIVE_VALUE_V83
    // First number = current market value of the REMAINING open tokens.
    // Second number = total position P&L so far (realized + unrealized).
    const liveValueSol =
      position?.tokenMetrics?.pnlReady === true
        ? num(position?.tokenMetrics?.liveValueSol)
        : null;

    const pnlSol =
      position?.tokenMetrics?.pnlReady === true
        ? num(position?.tokenMetrics?.pnlSol)
        : null;

"""
render = (
    render[:start] +
    new_value_block +
    render[settings_anchor:]
)

# Replace size/cost-basis formatting and old pnl formatting up to return.
size_start = render.find('    const size =', settings_anchor)
return_anchor = render.find('    return `', size_start)

if size_start < 0 or return_anchor < 0:
    raise SystemExit('ERROR: renderPositions value formatting anchor not found')

new_format_block = """    const valueDigits =
      finite(liveValueSol) &&
      Math.abs(liveValueSol) > 0 &&
      Math.abs(liveValueSol) < 0.00001
        ? 8
        : 5;

    const liveValueText =
      finite(liveValueSol)
        ? `${fmt(liveValueSol, valueDigits)} SOL`
        : '—';

    const pnlDigits =
      finite(pnlSol) &&
      Math.abs(pnlSol) > 0 &&
      Math.abs(pnlSol) < 0.00001
        ? 8
        : 5;

    const pnlText =
      finite(pnlSol)
        ? `${pnlSol > 0 ? '+' : ''}${fmt(pnlSol, pnlDigits)} SOL`
        : '—';

    const pnlClass =
      finite(pnlSol)
        ? (
            pnlSol > 0
              ? 'pnl-positive'
              : pnlSol < 0
                ? 'pnl-negative'
                : ''
          )
        : '';

"""
render = (
    render[:size_start] +
    new_format_block +
    render[return_anchor:]
)

# Replace the first visible number in the row.
render = render.replace(
    '<span class="position-size">${esc(size)}</span>',
    '<span class="position-size">${esc(liveValueText)}</span>',
    1
)

trading = (
    trading[:render_start] +
    render +
    trading[render_end:]
)

trading_path.write_text(trading)

# Cache bust.
new_src = '/trading.js?v=open-position-live-value-v83-20260908'
pattern = r'/trading\.js(?:\?v=[^"\']*)?'
matches = list(re.finditer(pattern, html))
if not matches:
    raise SystemExit('ERROR: trading.js script reference not found')

m = matches[-1]
html = html[:m.start()] + new_src + html[m.end():]
html_path.write_text(html)
PY

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/open-position-live-value-v83.mjs" \
   "$APP/tests/open-position-live-value-v83.mjs"

echo "[1/4] Syntax check"
node --check "$APP/src/paper-position-mark-v81.mjs"
node --check "$APP/app-server.mjs"
node --check "$APP/trading.js"
node --check "$APP/tests/open-position-live-value-v83.mjs"

echo "[2/4] V83 regression test"
(
  cd "$APP"
  node tests/open-position-live-value-v83.mjs
)

echo "[3/4] Existing safety regression tests"
(
  cd "$APP"
  if [[ -f tests/open-position-mark-parity-v81.mjs ]]; then
    node tests/open-position-mark-parity-v81.mjs
  fi
  if [[ -f tests/paper-close-safety-v78.mjs ]]; then
    node tests/paper-close-safety-v78.mjs
  fi
)

echo "[4/4] Diff guard + Git checkpoint"
git diff --check -- \
  memeflow-app/app-server.mjs \
  memeflow-app/trading.js \
  memeflow-app/trading.html \
  memeflow-app/src/paper-position-mark-v81.mjs \
  memeflow-app/tests/open-position-live-value-v83.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V83 installed/tested, but auto-commit/push skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/app-server.mjs \
      memeflow-app/trading.js \
      memeflow-app/trading.html \
      memeflow-app/src/paper-position-mark-v81.mjs \
      memeflow-app/tests/open-position-live-value-v83.mjs

    if git diff --cached --quiet; then
      echo "V83 already present; nothing new to commit."
    else
      git commit -m "fix(trading): show live position value and total pnl"

      if git remote get-url origin >/dev/null 2>&1; then
        if git push origin HEAD; then
          echo "Push: OK"
        else
          echo "NOTICE: commit created locally, but push failed."
          echo "Run: git push origin HEAD"
        fi
      fi
    fi
  fi
fi

echo
echo "V83 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-open-position-live-value-v83/rollback.sh"
echo
echo "Open Positions now shows:"
echo "  LIVE REMAINING VALUE · TOTAL P&L"
echo "Example after partial TP:"
echo "  0.82000 SOL · +0.14000 SOL"
echo
echo "Confirmed post-entry trade marks also remain valid through quiet periods."
