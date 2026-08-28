#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW SETTINGS CACHE CHAIN FIX V1 ==="

ROOT="${ROOT:-$PWD}"
APP="$ROOT/memeflow-app"
SETTINGS_HTML="$APP/settings.html"
NAV_JS="$APP/memeflow-nav.js"
ACCOUNT_JS="$APP/account-wallet-settings.js"

for f in "$SETTINGS_HTML" "$NAV_JS" "$ACCOUNT_JS"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing $f"
    exit 1
  fi
done

python3 - <<'PY'
from pathlib import Path
import re

html_p = Path("memeflow-app/settings.html")
nav_p = Path("memeflow-app/memeflow-nav.js")
account_p = Path("memeflow-app/account-wallet-settings.js")

html = html_p.read_text(encoding="utf-8")
nav = nav_p.read_text(encoding="utf-8")
account = account_p.read_text(encoding="utf-8")

STAMP = "cachefix-c6663c7-20260826-v1"
SETTINGS_URL = f"/settings.html?v={STAMP}"

# 1) Force the Settings HTML entry point itself onto a new URL.
nav = re.sub(
    r"href:\s*'/settings\.html(?:\?[^']*)?'",
    f"href: '{SETTINGS_URL}'",
    nav,
    count=1
)

account = re.sub(
    r"location\.href\s*=\s*'/settings\.html(?:\?[^'#]*)?(?:#wallet)?';",
    f"location.href = '{SETTINGS_URL}#wallet';",
    account,
    count=1
)

# 2) Give every Settings entry asset a new URL.
def replace_asset(src, asset, new_version):
    pattern = rf'({re.escape(asset)}\?v=)[^"\']+'
    out, count = re.subn(pattern, rf'\g<1>{new_version}', src)
    if count == 0:
        raise SystemExit(f"ERROR: asset version not found for {asset}")
    return out

html = replace_asset(html, "/system.css", f"settings-visual-unify-v2-{STAMP}")
html = replace_asset(html, "/memeflow-nav.css", f"global-right-drawer-v1-{STAMP}")
html = replace_asset(html, "/settings-page.js", f"settings-page-6dd8543-{STAMP}")
html = replace_asset(html, "/memeflow-nav.js", f"global-right-drawer-{STAMP}")
nav = replace_asset(nav, "/account-wallet-settings.js", f"account-wallet-settings-c6663c7-{STAMP}")

# 3) Add browser-side no-cache hints to Settings HTML.
marker = '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
nocache = (
    marker + "\n"
    '  <!-- MEMEFLOW_SETTINGS_CACHE_CHAIN_FIX_V1 -->\n'
    '  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n'
    '  <meta http-equiv="Pragma" content="no-cache">\n'
    '  <meta http-equiv="Expires" content="0">\n'
    f'  <meta name="mf-build" content="{STAMP}">'
)

if "MEMEFLOW_SETTINGS_CACHE_CHAIN_FIX_V1" not in html:
    if marker not in html:
        raise SystemExit("ERROR: viewport marker not found in settings.html")
    html = html.replace(marker, nocache, 1)
else:
    html = re.sub(
        r'<meta name="mf-build" content="[^"]+">',
        f'<meta name="mf-build" content="{STAMP}">',
        html,
        count=1
    )

html_p.write_text(html, encoding="utf-8")
nav_p.write_text(nav, encoding="utf-8")
account_p.write_text(account, encoding="utf-8")
PY

echo
echo "=== SYNTAX CHECK ==="
node --check "$NAV_JS"
node --check "$ACCOUNT_JS"

echo
echo "=== CACHE CHAIN CHECK ==="
grep -n "MEMEFLOW_SETTINGS_CACHE_CHAIN_FIX_V1" "$SETTINGS_HTML"
grep -n "settings-page-6dd8543-cachefix-c6663c7-20260826-v1" "$SETTINGS_HTML"
grep -n "global-right-drawer-cachefix-c6663c7-20260826-v1" "$SETTINGS_HTML"
grep -n "account-wallet-settings-c6663c7-cachefix-c6663c7-20260826-v1" "$NAV_JS"
grep -n "/settings.html?v=cachefix-c6663c7-20260826-v1" "$NAV_JS" "$ACCOUNT_JS"

echo
echo "=== VERIFY ACTUAL FIXES ARE STILL PRESENT ==="
grep -n "section.open = false" "$APP/settings-page.js" | head -n 3
grep -n "wallet.open = false" "$ACCOUNT_JS"
grep -n "execution.open = false" "$ACCOUNT_JS"
grep -n "mf293-field mf-account-stat" "$ACCOUNT_JS" | head -n 4

echo
echo "=== GIT DIFF ==="
git diff -- "$SETTINGS_HTML" "$NAV_JS" "$ACCOUNT_JS"

if git diff --quiet -- "$SETTINGS_HTML" "$NAV_JS" "$ACCOUNT_JS"; then
  echo "No changes needed: cache-chain fix already applied."
  exit 0
fi

git add "$SETTINGS_HTML" "$NAV_JS" "$ACCOUNT_JS"
git commit -m "fix(settings): bust stale settings asset cache chain"
git push origin HEAD

echo
echo "DONE: Settings HTML + JS/CSS + Wallet loader now use new cache-busted URLs."
echo "Open Settings from the MEMEFLOW menu once after deploy/restart."
