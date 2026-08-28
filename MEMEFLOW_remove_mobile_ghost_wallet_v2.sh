#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW REMOVE MOBILE GHOST WALLET V2 ==="

ROOT="${ROOT:-$PWD}"
APP="$ROOT/memeflow-app"
HTML="$APP/trading.html"
JS="$APP/trading.js"
NAV="$APP/memeflow-nav.js"

for f in "$HTML" "$JS" "$NAV"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path
import re

html_p = Path("memeflow-app/trading.html")
js_p = Path("memeflow-app/trading.js")
nav_p = Path("memeflow-app/memeflow-nav.js")

html = html_p.read_text(encoding="utf-8")
js = js_p.read_text(encoding="utf-8")
nav = nav_p.read_text(encoding="utf-8")

STAMP = "remove-mobile-ghost-wallet-v2-20260826"

# ------------------------------------------------------------
# 1) Delete the entire mobile script that recreates
#    ACCOUNT / Wallet after the real Wallet was removed.
# ------------------------------------------------------------
compact_block = re.compile(
    r'\n?<!-- MEMEFLOW_COMPACT_TRADING_V4_JS_START -->'
    r'.*?'
    r'<!-- MEMEFLOW_COMPACT_TRADING_V4_JS_END -->\n?',
    re.S
)

html2, count = compact_block.subn("\n", html, count=1)
if count == 0 and "compact-wallet-panel" in html:
    raise SystemExit("ERROR: compact Wallet generator still exists but block markers were not found")
html = html2

# ------------------------------------------------------------
# 2) Execution controls were already moved to Settings.
#    Physically remove them from Trading instead of relying on hide CSS.
#    Keep Save strategy in Trade control.
# ------------------------------------------------------------
for button_id in ("assistBtn", "startAutoBtn", "pauseBtn"):
    html = re.sub(
        rf'\n\s*<button id="{button_id}"[^>]*>.*?</button>',
        '',
        html,
        count=1,
        flags=re.S
    )

html = re.sub(
    r'\n\s*<button id="killBtn"[^>]*>.*?</button>',
    '',
    html,
    count=1,
    flags=re.S
)

# Clean marker and cache hints for the Trading HTML itself.
viewport = '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
cache_meta = (
    viewport + "\n"
    '  <!-- MEMEFLOW_TRADING_GHOST_WALLET_REMOVAL_V2 -->\n'
    '  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n'
    '  <meta http-equiv="Pragma" content="no-cache">\n'
    '  <meta http-equiv="Expires" content="0">\n'
    f'  <meta name="mf-trading-build" content="{STAMP}">'
)
if "MEMEFLOW_TRADING_GHOST_WALLET_REMOVAL_V2" not in html:
    if viewport not in html:
        raise SystemExit("ERROR: trading viewport meta not found")
    html = html.replace(viewport, cache_meta, 1)
else:
    html = re.sub(
        r'<meta name="mf-trading-build" content="[^"]+">',
        f'<meta name="mf-trading-build" content="{STAMP}">',
        html,
        count=1
    )

# Bust Trading JS and nav URLs.
html = re.sub(
    r'/trading\.js\?v=[^"]+',
    f'/trading.js?v={STAMP}',
    html,
    count=1
)
html = re.sub(
    r'/memeflow-nav\.js\?v=[^"]+',
    f'/memeflow-nav.js?v=global-right-drawer-{STAMP}',
    html,
    count=1
)

# ------------------------------------------------------------
# 3) trading.js must tolerate the controls being absent.
#    The mode is still read and displayed; controls now live in Settings.
# ------------------------------------------------------------
js = js.replace(
    "$('assistBtn').dataset.active = mode === 'assist' ? 'true' : 'false';",
    "if ($('assistBtn')) $('assistBtn').dataset.active = mode === 'assist' ? 'true' : 'false';",
    1
)
js = js.replace(
    "$('startAutoBtn').dataset.active = mode === 'automate' ? 'true' : 'false';",
    "if ($('startAutoBtn')) $('startAutoBtn').dataset.active = mode === 'automate' ? 'true' : 'false';",
    1
)
js = js.replace(
    "$('pauseBtn').dataset.active = mode === 'observe' ? 'true' : 'false';",
    "if ($('pauseBtn')) $('pauseBtn').dataset.active = mode === 'observe' ? 'true' : 'false';",
    1
)

# Kill-state render paths.
js = js.replace(
    "$('startAutoBtn').disabled = true;",
    "if ($('startAutoBtn')) $('startAutoBtn').disabled = true;"
)
js = js.replace(
    "$('killBtn').textContent = 'Emergency lock active';",
    "if ($('killBtn')) $('killBtn').textContent = 'Emergency lock active';"
)
js = js.replace(
    "$('killBtn').disabled = true;",
    "if ($('killBtn')) $('killBtn').disabled = true;"
)

# Removed controls must not be bound in Trading.
js = js.replace(
    "$('assistBtn').addEventListener('click', onAssist);",
    "$('assistBtn')?.addEventListener('click', onAssist);",
    1
)
js = js.replace(
    "$('startAutoBtn').addEventListener('click', onStartAuto);",
    "$('startAutoBtn')?.addEventListener('click', onStartAuto);",
    1
)
js = js.replace(
    "$('pauseBtn').addEventListener('click', onPause);",
    "$('pauseBtn')?.addEventListener('click', onPause);",
    1
)
js = js.replace(
    "$('killBtn').addEventListener('click', onKill);",
    "$('killBtn')?.addEventListener('click', onKill);",
    1
)

# ------------------------------------------------------------
# 4) Force menu navigation to a new Trading HTML URL,
#    so Safari cannot reuse the previous inline ghost-Wallet script.
# ------------------------------------------------------------
nav = re.sub(
    r"href:\s*'/trading\.html(?:\?[^']*)?'",
    f"href: '/trading.html?v={STAMP}'",
    nav,
    count=1
)

html_p.write_text(html, encoding="utf-8")
js_p.write_text(js, encoding="utf-8")
nav_p.write_text(nav, encoding="utf-8")
PY

echo
echo "=== SYNTAX CHECK ==="
node --check "$JS"
node --check "$NAV"

echo
echo "=== GHOST WALLET HARD CHECK ==="

for needle in \
  'compact-wallet-panel' \
  'compact-wallet-body' \
  'MEMEFLOW_COMPACT_TRADING_V4_JS_START' \
  'control-section wallet-section' \
  'id="assistBtn"' \
  'id="startAutoBtn"' \
  'id="pauseBtn"' \
  'id="killBtn"'
do
  if grep -q "$needle" "$HTML"; then
    echo "ERROR: still found in trading.html: $needle"
    exit 1
  fi
done

grep -n 'MEMEFLOW_TRADING_GHOST_WALLET_REMOVAL_V2' "$HTML"
grep -n 'remove-mobile-ghost-wallet-v2-20260826' "$HTML" "$NAV"
grep -n 'saveStrategyBtn' "$HTML"

echo
echo "=== GIT DIFF ==="
git diff -- "$HTML" "$JS" "$NAV"

if git diff --quiet -- "$HTML" "$JS" "$NAV"; then
  echo "No changes needed: mobile ghost Wallet is already removed."
  exit 0
fi

git add "$HTML" "$JS" "$NAV"
git commit -m "fix(trading): remove mobile ghost wallet panel"
git push origin HEAD

echo
echo "DONE: mobile ACCOUNT / Wallet generator is physically gone."
echo "DONE: Review/Paper Auto/Pause/Emergency controls now exist only in Settings."
echo "DONE: Save strategy remains in Trading control."
