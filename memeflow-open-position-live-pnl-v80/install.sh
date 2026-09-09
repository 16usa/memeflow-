#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$APP/trading.js" || ! -f "$APP/trading.html" || ! -f "$APP/app-server.mjs" ]]; then
  echo "ERROR: run from the MEMEFLOW repository root."
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/open-position-live-pnl-v80-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

cp "$APP/trading.js" "$BACKUP/memeflow-app/trading.js"
cp "$APP/trading.html" "$BACKUP/memeflow-app/trading.html"

if [[ -f "$APP/tests/open-position-live-pnl-v80.mjs" ]]; then
  cp "$APP/tests/open-position-live-pnl-v80.mjs" \
     "$BACKUP/memeflow-app/tests/open-position-live-pnl-v80.mjs"
  printf '1\n' > "$BACKUP/test-existed"
else
  printf '0\n' > "$BACKUP/test-existed"
fi

git rev-parse HEAD > "$BACKUP/git-head.txt" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-open-position-live-pnl-v80-last-backup"

python3 - "$APP/trading.js" "$APP/trading.html" <<'PY'
from pathlib import Path
import re
import sys

trading_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])

text = trading_path.read_text()

if 'MEMEFLOW_OPEN_POSITION_LIVE_PNL_V80' not in text:
    old_head = """  list.innerHTML = rows.map(position => {
    const pnl = num(position.unrealizedPnlPct, 0);
    const settings = position.settingsSnapshot || {};
"""
    new_head = """  list.innerHTML = rows.map(position => {
    // MEMEFLOW_OPEN_POSITION_LIVE_PNL_V80
    // /api/paper/positions/live already computes a canonical live P&L from
    // the latest trusted TradeEvent mark. The old renderer ignored it and
    // displayed the durable engine field with a forced zero fallback.
    const pnl =
      position?.tokenMetrics?.pnlReady === true
        ? num(position?.tokenMetrics?.pnlPct)
        : null;

    const settings = position.settingsSnapshot || {};
"""
    if old_head not in text:
        raise SystemExit(
            "ERROR: renderPositions P&L anchor changed; no files were committed."
        )
    text = text.replace(old_head, new_head, 1)

    old_text = """    const pnlText =
      `${pnl >= 0 ? '+' : ''}${fmt(pnl, 2)}%`;

    return `
"""
    new_text = """    // Keep tiny real moves visible instead of rounding them to fake 0.00%.
    const pnlDigits =
      finite(pnl) &&
      Math.abs(pnl) > 0 &&
      Math.abs(pnl) < 0.01
        ? 4
        : 2;

    const pnlText =
      finite(pnl)
        ? `${pnl > 0 ? '+' : ''}${fmt(pnl, pnlDigits)}%`
        : '—';

    const pnlClass =
      finite(pnl)
        ? (
            pnl > 0
              ? 'pnl-positive'
              : pnl < 0
                ? 'pnl-negative'
                : ''
          )
        : '';

    return `
"""
    if old_text not in text:
        raise SystemExit(
            "ERROR: renderPositions pnlText anchor changed; no files were committed."
        )
    text = text.replace(old_text, new_text, 1)

    old_class = """            <strong class=\"position-pnl ${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}\">
"""
    new_class = """            <strong class=\"position-pnl ${pnlClass}\">
"""
    if old_class not in text:
        raise SystemExit(
            "ERROR: renderPositions P&L class anchor changed; no files were committed."
        )
    text = text.replace(old_class, new_class, 1)

    trading_path.write_text(text)

html = html_path.read_text()
new_src = '/trading.js?v=open-position-live-pnl-v80-20260908'
pattern = r'/trading\.js(?:\?v=[^"\']*)?'
matches = list(re.finditer(pattern, html))

if not matches:
    raise SystemExit("ERROR: trading.js script reference not found in trading.html")

m = matches[-1]
html = html[:m.start()] + new_src + html[m.end():]
html_path.write_text(html)
PY

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/open-position-live-pnl-v80.mjs" \
   "$APP/tests/open-position-live-pnl-v80.mjs"

echo "[1/4] Syntax check"
node --check "$APP/trading.js"
node --check "$APP/tests/open-position-live-pnl-v80.mjs"

echo "[2/4] Regression test"
(
  cd "$APP"
  node tests/open-position-live-pnl-v80.mjs
)

echo "[3/4] Diff guard"
git diff --check -- \
  memeflow-app/trading.js \
  memeflow-app/trading.html \
  memeflow-app/tests/open-position-live-pnl-v80.mjs

echo "[4/4] Git checkpoint"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V80 is installed/tested, but auto-commit/push is skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/trading.js \
      memeflow-app/trading.html \
      memeflow-app/tests/open-position-live-pnl-v80.mjs

    if git diff --cached --quiet; then
      echo "V80 already present; nothing new to commit."
    else
      git commit -m "fix(trading): show live pnl for open positions"

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
echo "V80 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-open-position-live-pnl-v80/rollback.sh"
echo
echo "Expected behavior:"
echo "  positive live P&L -> +X.XX%"
echo "  negative live P&L -> -X.XX%"
echo "  exact breakeven   -> 0%"
echo "  no trusted mark   -> —"
echo "  refresh cadence   -> existing 1.8s terminal poll"
