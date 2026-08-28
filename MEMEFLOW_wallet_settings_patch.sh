#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ]; then
  echo "ERROR: run this inside the MEMEFLOW Replit Git repository."
  exit 1
fi

APP="$ROOT/memeflow-app"
for f in "$APP/trading.html" "$APP/settings.html" "$APP/memeflow-nav.js"; do
  [ -f "$f" ] || { echo "ERROR: missing $f"; exit 1; }
done

python3 - "$APP" <<'PY'
from pathlib import Path
import base64, gzip, re, sys

app = Path(sys.argv[1])
payload = "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"
js = gzip.decompress(base64.b64decode(payload)).decode("utf-8")
(app / "account-wallet-settings.js").write_text(js, encoding="utf-8")

nav_path = app / "memeflow-nav.js"
nav = nav_path.read_text(encoding="utf-8")
loader_marker = "MEMEFLOW_ACCOUNT_WALLET_SETTINGS_LOADER_V1"
if loader_marker not in nav:
    nav += r"""

/* MEMEFLOW_ACCOUNT_WALLET_SETTINGS_LOADER_V1 */
(() => {
  if (window.__MEMEFLOW_ACCOUNT_WALLET_SETTINGS_LOADER_V1__) return;
  window.__MEMEFLOW_ACCOUNT_WALLET_SETTINGS_LOADER_V1__ = true;
  const script = document.createElement('script');
  script.src = '/account-wallet-settings.js?v=account-wallet-settings-v1-20260826';
  script.defer = true;
  document.head.appendChild(script);
})();
/* /MEMEFLOW_ACCOUNT_WALLET_SETTINGS_LOADER_V1 */
"""
nav_path.write_text(nav, encoding="utf-8")

for name in ("trading.html", "settings.html"):
    path = app / name
    text = path.read_text(encoding="utf-8")
    text = re.sub(
        r'/memeflow-nav\.js\?v=[^"\']+',
        '/memeflow-nav.js?v=global-right-drawer-wallet-settings-v1-20260826',
        text
    )
    path.write_text(text, encoding="utf-8")
PY

node --check "$APP/account-wallet-settings.js"
node --check "$APP/memeflow-nav.js"
git diff --check

echo
echo "=== WALLET PATCH CHECK ==="
grep -n "account-wallet-settings.js" "$APP/memeflow-nav.js" | tail -1
grep -n "global-right-drawer-wallet-settings-v1" "$APP/trading.html" | tail -1
grep -n "global-right-drawer-wallet-settings-v1" "$APP/settings.html" | tail -1

git add \
  "$APP/account-wallet-settings.js" \
  "$APP/memeflow-nav.js" \
  "$APP/trading.html" \
  "$APP/settings.html"

if git diff --cached --quiet; then
  echo "Patch is already applied; nothing new to commit."
  exit 0
fi

git commit -m "feat(settings): move account wallet and execution controls to settings"
git push origin HEAD

echo
echo "DONE: Account/Wallet moved to System Settings and pushed."
