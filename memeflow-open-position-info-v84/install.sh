#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in "$APP/trading.js" "$APP/trading.html"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing required file: $f"
    exit 1
  fi
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/open-position-info-v84-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/trading.js"
  "memeflow-app/trading.html"
  "memeflow-app/open-position-info-v84.css"
  "memeflow-app/tests/open-position-info-v84.mjs"
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
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-open-position-info-v84-last-backup"

cp "$PATCH_DIR/open-position-info-v84.css" \
   "$APP/open-position-info-v84.css"

python3 - "$APP/trading.js" "$APP/trading.html" <<'PY'
from pathlib import Path
import re
import sys

js_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])

js = js_path.read_text()
html = html_path.read_text()

helper_marker = '/* MEMEFLOW_OPEN_POSITION_INFO_V84 */'

if helper_marker not in js:
    anchor = 'function renderPositions()'
    pos = js.find(anchor)
    if pos < 0:
        raise SystemExit('ERROR: renderPositions() anchor not found')

    helper = r'''
/* MEMEFLOW_OPEN_POSITION_INFO_V84 */
function ensurePositionInfoSheetV84() {
  let root = document.getElementById('positionInfoSheetV84');

  if (root) {
    return root;
  }

  root = document.createElement('div');
  root.id = 'positionInfoSheetV84';
  root.className = 'position-info-sheet-v84';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Position strategy details');

  root.innerHTML = `
    <button
      class="position-info-sheet-v84__backdrop"
      type="button"
      data-position-info-close-v84
      aria-label="Close position details"
    ></button>

    <section class="position-info-sheet-v84__card">
      <div class="position-info-sheet-v84__head">
        <div class="position-info-sheet-v84__title">
          <strong data-position-info-symbol-v84>Position</strong>
          <span>Position rules</span>
        </div>

        <button
          class="position-info-sheet-v84__close"
          type="button"
          data-position-info-close-v84
          aria-label="Close"
        >×</button>
      </div>

      <div
        class="position-info-sheet-v84__grid"
        data-position-info-grid-v84
      ></div>
    </section>
  `;

  root.addEventListener('click', event => {
    if (event.target.closest('[data-position-info-close-v84]')) {
      root.hidden = true;
    }
  });

  document.body.appendChild(root);

  return root;
}

function closePositionInfoV84() {
  const root = document.getElementById('positionInfoSheetV84');
  if (root) {
    root.hidden = true;
  }
}

function openPositionInfoV84(position) {
  if (!position) {
    return;
  }

  const root = ensurePositionInfoSheetV84();
  const settings = position.settingsSnapshot || {};

  const symbolNode =
    root.querySelector('[data-position-info-symbol-v84]');
  const grid =
    root.querySelector('[data-position-info-grid-v84]');

  symbolNode.textContent =
    String(position.symbol || short(position.mint) || 'Position');

  const signedPct = value => {
    const n = num(value);
    if (!finite(n)) return '—';
    return `${n > 0 ? '+' : ''}${fmt(n, 0)}%`;
  };

  const plainPct = value =>
    finite(value) ? `${fmt(value, 1)}%` : '—';

  const weakPressure =
    settings.exitOnWeakBuyPressure !== false
      ? 'ON'
      : 'OFF';

  const items = [
    ['Hard stop', plainPct(settings.hardStopPct)],
    ['Trailing', plainPct(settings.trailingStopPct)],
    [
      'TP1',
      `${signedPct(settings.tp1Pct)} · sell ${fmt(settings.tp1SellPct, 0)}%`
    ],
    [
      'TP2',
      `${signedPct(settings.tp2Pct)} · sell ${fmt(settings.tp2SellPct, 0)}%`
    ],
    ['Runner', plainPct(settings.runnerPct)],
    [
      'Max hold',
      finite(settings.maxHoldMinutes)
        ? `${fmt(settings.maxHoldMinutes, 0)} min`
        : '—'
    ],
    [
      'Exit pressure',
      finite(settings.exitBuyPressure)
        ? `${fmt(settings.exitBuyPressure, 1)}× · weak ${weakPressure}`
        : `— · weak ${weakPressure}`
    ]
  ];

  grid.innerHTML = items.map(([label, value]) => `
    <div class="position-info-sheet-v84__item">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  root.hidden = false;
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closePositionInfoV84();
  }
});

'''
    js = js[:pos] + helper + js[pos:]

old_details = '''            <i>·</i>
            <span>SL ${fmt(settings.hardStopPct, 1)}%</span>
            <i>·</i>
            <span>TP1 ${fmt(settings.tp1Pct, 0)}%</span>
            <i>·</i>
            <span>TP2 ${fmt(settings.tp2Pct, 0)}%</span>
'''

new_details = '''            <button
              class="position-info-v84"
              data-position-info-v84="${esc(position.id)}"
              type="button"
              aria-label="Show position rules"
              title="Position rules"
            >!</button>
'''

if 'class="position-info-v84"' not in js:
    if old_details not in js:
        raise SystemExit('ERROR: inline SL/TP row anchor changed')
    js = js.replace(old_details, new_details, 1)

selection_anchor = '''      if (event.target.closest('.close-position')) return;
      if (event.target.closest('[data-mf-pump-avatar-link-v76]')) return;
'''

selection_new = '''      if (event.target.closest('.close-position')) return;
      if (event.target.closest('.position-info-v84')) return;
      if (event.target.closest('[data-mf-pump-avatar-link-v76]')) return;
'''

if "event.target.closest('.position-info-v84')" not in js:
    if selection_anchor not in js:
        raise SystemExit('ERROR: Open Position selection guard anchor changed')
    js = js.replace(selection_anchor, selection_new, 1)

close_bind = "  list.querySelectorAll('.close-position').forEach(button => {"

if "list.querySelectorAll('.position-info-v84')" not in js:
    pos = js.find(close_bind)
    if pos < 0:
        raise SystemExit('ERROR: Close binding anchor not found')

    info_bind = r'''  list.querySelectorAll('.position-info-v84').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      const id =
        String(button.dataset.positionInfoV84 || '').trim();

      const position =
        state.positions.find(
          row => String(row?.id || '') === id
        );

      openPositionInfoV84(position);
    });
  });

'''
    js = js[:pos] + info_bind + js[pos:]

js_path.write_text(js)

css_link = (
    '<!-- MEMEFLOW_OPEN_POSITION_INFO_V84_ASSET -->\n'
    '<link rel="stylesheet" '
    'href="/open-position-info-v84.css?v=open-position-info-v84-20260908">\n'
    '<!-- /MEMEFLOW_OPEN_POSITION_INFO_V84_ASSET -->'
)

if '/open-position-info-v84.css' not in html:
    anchor = '</head>'
    if anchor not in html:
        raise SystemExit('ERROR: </head> not found')
    html = html.replace(anchor, css_link + '\n' + anchor, 1)

pattern = r'/trading\.js(?:\?v=[^"\']*)?'
matches = list(re.finditer(pattern, html))
if not matches:
    raise SystemExit('ERROR: trading.js script reference not found')

new_src = '/trading.js?v=open-position-info-v84-20260908'
m = matches[-1]
html = html[:m.start()] + new_src + html[m.end():]

html_path.write_text(html)
PY

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/open-position-info-v84.mjs" \
   "$APP/tests/open-position-info-v84.mjs"

echo "[1/4] Syntax check"
node --check "$APP/trading.js"
node --check "$APP/tests/open-position-info-v84.mjs"

echo "[2/4] V84 regression test"
(
  cd "$APP"
  node tests/open-position-info-v84.mjs
)

echo "[3/4] Existing live-position regression tests"
(
  cd "$APP"
  if [[ -f tests/open-position-live-value-v83.mjs ]]; then
    node tests/open-position-live-value-v83.mjs
  fi
  if [[ -f tests/open-position-mark-parity-v81.mjs ]]; then
    node tests/open-position-mark-parity-v81.mjs
  fi
  if [[ -f tests/paper-close-safety-v78.mjs ]]; then
    node tests/paper-close-safety-v78.mjs
  fi
)

echo "[4/4] Diff guard + Git checkpoint"
git diff --check -- \
  memeflow-app/trading.js \
  memeflow-app/trading.html \
  memeflow-app/open-position-info-v84.css \
  memeflow-app/tests/open-position-info-v84.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V84 installed/tested, but auto-commit/push skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/trading.js \
      memeflow-app/trading.html \
      memeflow-app/open-position-info-v84.css \
      memeflow-app/tests/open-position-info-v84.mjs

    if git diff --cached --quiet; then
      echo "V84 already present; nothing new to commit."
    else
      git commit -m "fix(trading): compact open position details"

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
echo "V84 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-open-position-info-v84/rollback.sh"
echo
echo "Open Position row:"
echo "  LIVE VALUE · TOTAL P&L · !"
echo "Tap ! to see SL / Trail / TP1 / TP2 / Runner / Hold / Exit pressure."
echo "Positive P&L = green. Negative P&L = red."
