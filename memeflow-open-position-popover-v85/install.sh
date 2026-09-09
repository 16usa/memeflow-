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
BACKUP="$ROOT/.memeflow-backups/open-position-popover-v85-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/trading.js"
  "memeflow-app/trading.html"
  "memeflow-app/open-position-popover-v85.css"
  "memeflow-app/tests/open-position-popover-v85.mjs"
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
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-open-position-popover-v85-last-backup"

cp "$PATCH_DIR/open-position-popover-v85.css" \
   "$APP/open-position-popover-v85.css"

python3 - "$APP/trading.js" "$APP/trading.html" <<'PY'
from pathlib import Path
import re
import sys

js_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])

js = js_path.read_text()
html = html_path.read_text()

helper = r'''
/* MEMEFLOW_OPEN_POSITION_POPOVER_V85 */
let positionInfoActiveButtonV85 = null;

function ensurePositionInfoPopoverV85() {
  let root = document.getElementById('positionInfoPopoverV85');

  if (root) {
    return root;
  }

  root = document.createElement('div');
  root.id = 'positionInfoPopoverV85';
  root.className = 'position-popover-v85';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Position rules');

  root.innerHTML = `
    <div class="position-popover-v85__head">
      <div class="position-popover-v85__title">
        <strong data-position-info-symbol-v85>Position</strong>
        <span>Position rules</span>
      </div>

      <button
        class="position-popover-v85__close"
        type="button"
        data-position-info-close-v85
        aria-label="Close"
      >×</button>
    </div>

    <ul
      class="position-popover-v85__list"
      data-position-info-list-v85
    ></ul>
  `;

  root.addEventListener('click', event => {
    if (event.target.closest('[data-position-info-close-v85]')) {
      closePositionInfoV85();
    }
  });

  document.addEventListener('pointerdown', event => {
    if (root.hidden) return;
    if (root.contains(event.target)) return;
    if (event.target.closest('.position-info-v85')) return;
    closePositionInfoV85();
  }, true);

  window.addEventListener('resize', () => {
    if (!root.hidden) closePositionInfoV85();
  });

  window.addEventListener('scroll', () => {
    if (!root.hidden) closePositionInfoV85();
  }, true);

  document.body.appendChild(root);

  return root;
}

function closePositionInfoV85() {
  const root = document.getElementById('positionInfoPopoverV85');
  if (root) {
    root.hidden = true;
  }

  if (positionInfoActiveButtonV85) {
    positionInfoActiveButtonV85.removeAttribute('data-open');
    positionInfoActiveButtonV85 = null;
  }
}

function positionPositionInfoV85(root, anchor) {
  const gap = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = anchor.getBoundingClientRect();

  root.style.left = '0px';
  root.style.top = '0px';
  root.hidden = false;

  const pop = root.getBoundingClientRect();
  const showAbove =
    rect.bottom + gap + pop.height > vh - 8 &&
    rect.top - gap - pop.height >= 8;

  const top = showAbove
    ? rect.top - pop.height - gap
    : rect.bottom + gap;

  let left = rect.left - 10;
  left = Math.max(8, Math.min(left, vw - pop.width - 8));

  const arrowCenter = rect.left + (rect.width / 2) - left - 5;
  const arrowLeft = Math.max(14, Math.min(arrowCenter, pop.width - 22));

  root.dataset.side = showAbove ? 'top' : 'bottom';
  root.style.left = `${Math.round(left)}px`;
  root.style.top = `${Math.round(top)}px`;
  root.style.setProperty('--arrow-left', `${Math.round(arrowLeft)}px`);
}

function openPositionInfoV85(position, anchor) {
  if (!position || !anchor) {
    return;
  }

  const root = ensurePositionInfoPopoverV85();
  const settings = position.settingsSnapshot || {};
  const title = root.querySelector('[data-position-info-symbol-v85]');
  const list = root.querySelector('[data-position-info-list-v85]');

  title.textContent =
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

  list.innerHTML = items.map(([label, value]) => `
    <li class="position-popover-v85__row">
      <span class="position-popover-v85__label">${esc(label)}</span>
      <strong class="position-popover-v85__value">${esc(value)}</strong>
    </li>
  `).join('');

  if (positionInfoActiveButtonV85 && positionInfoActiveButtonV85 !== anchor) {
    positionInfoActiveButtonV85.removeAttribute('data-open');
  }

  positionInfoActiveButtonV85 = anchor;
  anchor.setAttribute('data-open', '1');

  positionPositionInfoV85(root, anchor);
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closePositionInfoV85();
  }
});

'''

pattern = re.compile(
    r'/\* MEMEFLOW_OPEN_POSITION_(?:INFO_V84|POPOVER_V85) \*/[\s\S]*?function renderPositions\(\)',
    re.M
)
if pattern.search(js):
    js = pattern.sub(helper + '\nfunction renderPositions()', js, count=1)
else:
    anchor = 'function renderPositions()'
    pos = js.find(anchor)
    if pos < 0:
        raise SystemExit('ERROR: renderPositions() anchor not found')
    js = js[:pos] + helper + '\n' + js[pos:]

button_pattern = re.compile(
    r'<button\s+class="position-info-v(?:84|85)"[\s\S]*?</button>',
    re.M
)
new_button = '''<button
              class="position-info-v85"
              data-position-info-v85="${esc(position.id)}"
              type="button"
              aria-label="Show position rules"
              title="Position rules"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.3"></circle>
                <path d="M8 7.1v3.45" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"></path>
                <circle cx="8" cy="4.55" r="0.9" fill="currentColor"></circle>
              </svg>
            </button>'''

if button_pattern.search(js):
    js = button_pattern.sub(new_button, js, count=1)
else:
    old_details = '''            <i>·</i>
            <span>SL ${fmt(settings.hardStopPct, 1)}%</span>
            <i>·</i>
            <span>TP1 ${fmt(settings.tp1Pct, 0)}%</span>
            <i>·</i>
            <span>TP2 ${fmt(settings.tp2Pct, 0)}%</span>
'''
    replacement = '            ' + new_button + '\n'
    if old_details not in js:
        raise SystemExit('ERROR: neither V84/V85 button nor original details row found')
    js = js.replace(old_details, replacement, 1)

js = js.replace("      if (event.target.closest('.position-info-v84')) return;\n", "")
guard_anchor = "      if (event.target.closest('.close-position')) return;\n"
guard_insert = guard_anchor + "      if (event.target.closest('.position-info-v85')) return;\n"
if "event.target.closest('.position-info-v85')" not in js:
    if guard_anchor not in js:
        raise SystemExit('ERROR: open position click guard anchor not found')
    js = js.replace(guard_anchor, guard_insert, 1)

bind_block_pattern = re.compile(
    r"  list\.querySelectorAll\('\.position-info-v(?:84|85)'\)\.forEach\(button => \{[\s\S]*?  \}\);\n\n",
    re.M
)
new_bind = r'''  list.querySelectorAll('.position-info-v85').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      const id =
        String(button.dataset.positionInfoV85 || '').trim();

      const position =
        state.positions.find(
          row => String(row?.id || '') === id
        );

      if (button === positionInfoActiveButtonV85) {
        closePositionInfoV85();
        return;
      }

      openPositionInfoV85(position, button);
    });
  });

'''
if bind_block_pattern.search(js):
    js = bind_block_pattern.sub(new_bind, js, count=1)
else:
    close_bind_anchor = "  list.querySelectorAll('.close-position').forEach(button => {"
    pos = js.find(close_bind_anchor)
    if pos < 0:
        raise SystemExit('ERROR: close-position binding anchor not found')
    js = js[:pos] + new_bind + js[pos:]

js_path.write_text(js)

css_link = (
    '<!-- MEMEFLOW_OPEN_POSITION_POPOVER_V85_ASSET -->\n'
    '<link rel="stylesheet" href="/open-position-popover-v85.css?v=open-position-popover-v85-20260909">\n'
    '<!-- /MEMEFLOW_OPEN_POSITION_POPOVER_V85_ASSET -->'
)

if '/open-position-popover-v85.css' not in html:
    head_close = '</head>'
    if head_close not in html:
        raise SystemExit('ERROR: </head> not found')
    html = html.replace(head_close, css_link + '\n' + head_close, 1)

script_pattern = re.compile(r'/trading\.js(?:\?v=[^"\']*)?')
matches = list(script_pattern.finditer(html))
if not matches:
    raise SystemExit('ERROR: trading.js script reference not found')

m = matches[-1]
html = html[:m.start()] + '/trading.js?v=open-position-popover-v85-20260909' + html[m.end():]

html_path.write_text(html)
PY

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/open-position-popover-v85.mjs" \
   "$APP/tests/open-position-popover-v85.mjs"

echo "[1/4] Syntax check"
node --check "$APP/trading.js"
node --check "$APP/tests/open-position-popover-v85.mjs"

echo "[2/4] V85 regression test"
(
  cd "$APP"
  node tests/open-position-popover-v85.mjs
)

echo "[3/4] Existing open-position regression tests"
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
  memeflow-app/open-position-popover-v85.css \
  memeflow-app/tests/open-position-popover-v85.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V85 installed/tested, but auto-commit/push skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/trading.js \
      memeflow-app/trading.html \
      memeflow-app/open-position-popover-v85.css \
      memeflow-app/tests/open-position-popover-v85.mjs

    if git diff --cached --quiet; then
      echo "V85 already present; nothing new to commit."
    else
      git commit -m "fix(trading): shrink open position info popover"

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
echo "V85 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-open-position-popover-v85/rollback.sh"
echo
echo "Open Position row:"
echo "  LIVE VALUE · TOTAL P&L · info-icon"
echo "Tap the small icon for a compact contextual popover."
echo "No full-screen modal. P&L colors remain green/red."
