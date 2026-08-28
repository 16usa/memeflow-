#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW REMOVE TRADING WALLET BLOCK V1 ==="

ROOT="${ROOT:-$PWD}"
APP="$ROOT/memeflow-app"

HTML="$APP/trading.html"
JS="$APP/trading.js"
ACCOUNT="$APP/account-wallet-settings.js"

for f in "$HTML" "$JS" "$ACCOUNT"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path
import re

html_p = Path("memeflow-app/trading.html")
js_p = Path("memeflow-app/trading.js")
account_p = Path("memeflow-app/account-wallet-settings.js")

html = html_p.read_text(encoding="utf-8")
js = js_p.read_text(encoding="utf-8")
account = account_p.read_text(encoding="utf-8")

STAMP = "remove-trading-wallet-v1-20260826"
SETTINGS_URL = "/settings.html?v=cachefix-c6663c7-20260826-v1#wallet"

# 1) Physically remove the lower Wallet block from Trading Terminal.
wallet_section = re.compile(
    r'\n\s*<section class="control-section wallet-section">\s*.*?</section>\s*',
    re.S,
)
html2, count = wallet_section.subn("\n", html, count=1)
if count != 1 and 'control-section wallet-section' in html:
    raise SystemExit("ERROR: legacy wallet section exists but exact block removal failed")
html = html2

# Top action now routes to Settings instead of connecting inside Trading.
html = html.replace(
    '<button id="walletBtn" class="wallet-btn" type="button">Connect wallet</button>',
    '<button id="walletBtn" class="wallet-btn" type="button">Wallet settings</button>',
    1,
)

# 2) Remove legacy direct wallet connection code from trading.js.
wallet_logic = re.compile(
    r'\nfunction walletProvider\(\)\s*\{.*?\n\}\s*'
    r'\nasync function connectWallet\(\)\s*\{.*?\n\}\s*'
    r'(?=\nfunction bind\(\))',
    re.S,
)
replacement = (
    "\nfunction openWalletSettings() {\n"
    "  window.location.href = '" + SETTINGS_URL + "';\n"
    "}\n"
)
js2, count = wallet_logic.subn(replacement, js, count=1)
if count == 0 and "function openWalletSettings()" not in js:
    raise SystemExit("ERROR: could not replace old trading wallet connection logic")
js = js2

# Remove obsolete wallet state from Trading.
js = re.sub(r'\n\s*walletProvider:\s*null,\s*', '\n', js, count=1)
js = re.sub(r'\n\s*walletAddress:\s*null,\s*', '\n', js, count=1)

old_bind = "$('walletBtn').addEventListener('click', connectWallet);"
new_bind = "$('walletBtn')?.addEventListener('click', openWalletSettings);"
if old_bind in js:
    js = js.replace(old_bind, new_bind, 1)
elif new_bind not in js:
    raise SystemExit("ERROR: walletBtn binding pattern not found")

# 3) Trading cleanup must no longer wait for a Wallet section that no longer exists.
old_install = (
    "    const wallet = document.querySelector('.control-panel .wallet-section');\n"
    "    const walletBtn = $('walletBtn');\n"
    "    if (!wallet || !walletBtn) return false;\n\n"
    "    document.documentElement.dataset.mfWalletMoved = '1';\n"
    "    wallet.setAttribute('aria-hidden','true');"
)
new_install = (
    "    const walletBtn = $('walletBtn');\n"
    "    if (!walletBtn) return false;\n\n"
    "    document.documentElement.dataset.mfWalletMoved = '1';"
)
if old_install in account:
    account = account.replace(old_install, new_install, 1)
elif "const wallet = document.querySelector('.control-panel .wallet-section');" in account:
    raise SystemExit("ERROR: trading cleanup block changed unexpectedly")

# Remove obsolete selector that only hid the old block.
account = account.replace(
    '      html[data-mf-wallet-moved="1"] .control-panel .wallet-section,\n',
    '',
    1,
)

# Keep route deterministic.
account = re.sub(
    r"location\.href\s*=\s*'/settings\.html[^']*#wallet';",
    "location.href = '" + SETTINGS_URL + "';",
    account,
    count=1,
)

# 4) Cache-bust Trading entry points.
html = re.sub(
    r'/trading\.js\?v=[^"]+',
    '/trading.js?v=' + STAMP,
    html,
    count=1,
)
html = re.sub(
    r'/memeflow-nav\.js\?v=[^"]+',
    '/memeflow-nav.js?v=global-right-drawer-' + STAMP,
    html,
    count=1,
)

html_p.write_text(html, encoding="utf-8")
js_p.write_text(js, encoding="utf-8")
account_p.write_text(account, encoding="utf-8")
PY

echo
echo "=== SYNTAX CHECK ==="
node --check "$JS"
node --check "$ACCOUNT"

echo
echo "=== HARD REMOVAL CHECK ==="

if grep -q 'control-section wallet-section' "$HTML"; then
  echo "ERROR: Wallet section is still present in trading.html"
  exit 1
fi

if grep -q 'id="walletState"' "$HTML"; then
  echo "ERROR: walletState is still present in trading.html"
  exit 1
fi

if grep -q 'id="walletAddress"' "$HTML"; then
  echo "ERROR: walletAddress is still present in trading.html"
  exit 1
fi

if grep -q 'function walletProvider' "$JS"; then
  echo "ERROR: old walletProvider remains in trading.js"
  exit 1
fi

if grep -q 'async function connectWallet' "$JS"; then
  echo "ERROR: old connectWallet remains in trading.js"
  exit 1
fi

grep -n 'Wallet settings' "$HTML"
grep -n 'openWalletSettings' "$JS"
grep -n 'remove-trading-wallet-v1-20260826' "$HTML"

echo
echo "=== GIT DIFF ==="
git diff -- "$HTML" "$JS" "$ACCOUNT"

if git diff --quiet -- "$HTML" "$JS" "$ACCOUNT"; then
  echo "No changes needed: Trading Wallet block is already removed."
  exit 0
fi

git add "$HTML" "$JS" "$ACCOUNT"
git commit -m "fix(trading): remove legacy wallet block"
git push origin HEAD

echo
echo "DONE: legacy Account / Wallet block was physically removed from Trading Terminal."
echo "Wallet remains available only through System Settings."
