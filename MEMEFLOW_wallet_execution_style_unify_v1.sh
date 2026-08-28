#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW WALLET / EXECUTION SETTINGS STYLE UNIFY V1 ==="

ROOT="${ROOT:-$PWD}"
APP="$ROOT/memeflow-app"
ACCOUNT_JS="$APP/account-wallet-settings.js"
NAV_JS="$APP/memeflow-nav.js"

if [[ ! -f "$ACCOUNT_JS" || ! -f "$NAV_JS" ]]; then
  echo "ERROR: expected files not found:"
  echo "  $ACCOUNT_JS"
  echo "  $NAV_JS"
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import re

account = Path("memeflow-app/account-wallet-settings.js")
nav = Path("memeflow-app/memeflow-nav.js")

s = account.read_text(encoding="utf-8")
n = nav.read_text(encoding="utf-8")

# ---------------------------------------------------------------------
# 1) Replace the custom visual skin with layout-only helpers.
#    The actual cards now inherit the existing native Settings classes:
#      .mf293-settings-group
#      .mf293-settings-grid
#      .mf293-field
#      .mf293-field-label
#      .mf293-primary / .mf293-secondary
# ---------------------------------------------------------------------

old_css = r"""      .mf-account-settings-group .mf-account-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;width:100%}
      .mf-account-stat{border:1px solid var(--line,#28333e);border-radius:12px;padding:11px 12px;min-width:0;background:rgba(255,255,255,.018)}
      .mf-account-stat small{display:block;color:var(--muted,#8c98a6);font-size:8px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
      .mf-account-stat b{display:block;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .mf-account-stat.wide{grid-column:1/-1}.mf-account-address{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:normal!important;word-break:break-all}
      .mf-account-actions{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}
      .mf-account-note{grid-column:1/-1;border:1px solid var(--line,#28333e);border-radius:11px;padding:10px 12px;color:var(--muted,#8c98a6);font-size:10px;line-height:1.5}
      .mf-account-note strong{color:var(--text,#fff)}.mf-account-note.danger{border-color:rgba(255,101,118,.35);background:rgba(255,101,118,.055)}
      .mf-status-ok{color:var(--green,#51e7a8)!important}.mf-status-danger{color:var(--red,#ff6576)!important}
      #mfEmergencyEntryLock{border-color:rgba(255,101,118,.48)!important;color:var(--red,#ff6576)!important}
      @media(max-width:760px){.mf-account-settings-group .mf-account-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:460px){.mf-account-settings-group .mf-account-grid{grid-template-columns:1fr}.mf-account-actions{display:grid;grid-template-columns:1fr}.mf-account-actions button{width:100%}}"""

new_css = r"""      /* MEMEFLOW_ACCOUNT_SETTINGS_NATIVE_STYLE_V1
         Layout helpers only. Visual surfaces inherit the native Settings
         design system instead of creating a second border/background layer. */
      .mf-account-settings-group .mf-account-grid{width:100%}
      .mf-account-stat{min-width:0}
      .mf-account-stat b{display:block;margin-top:5px;font-size:12px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .mf-account-stat.wide{grid-column:1/-1}
      .mf-account-address{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:normal!important;word-break:break-all}
      .mf-account-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
      .mf-account-actions button{width:100%;min-width:0}
      .mf-account-note{grid-column:1/-1;line-height:1.5}
      .mf-account-note strong{color:var(--text,#fff)}
      .mf-account-note.danger strong{color:var(--red,#ff6679)}
      .mf-status-ok{color:var(--green,#51e7a8)!important}
      .mf-status-danger{color:var(--red,#ff6679)!important}
      /* Keep emergency semantics in text only; border remains native Settings style. */
      #mfEmergencyEntryLock{color:var(--red,#ff6679)!important}
      @media(max-width:460px){.mf-account-actions{grid-template-columns:1fr}}"""

if old_css in s:
    s = s.replace(old_css, new_css, 1)
elif "MEMEFLOW_ACCOUNT_SETTINGS_NATIVE_STYLE_V1" not in s:
    raise SystemExit("ERROR: account-wallet custom style block did not match current source")

# ---------------------------------------------------------------------
# 2) Make every status/info tile use the exact native Settings field card.
# ---------------------------------------------------------------------

# Convert every account stat tile:
# <div class="mf-account-stat ..."><small>...
# -> native .mf293-field + native .mf293-field-label
s = re.sub(
    r'<div class="mf-account-stat( wide)?"><small>',
    lambda m: '<div class="mf293-field mf-account-stat' + (m.group(1) or '') + '"><small class="mf293-field-label">',
    s
)

# Notes become native full-width field cards too.
s = s.replace(
    '<div class="mf-account-note">',
    '<div class="mf293-field mf293-field-wide mf-account-note">'
)
s = s.replace(
    '<div class="mf-account-note danger">',
    '<div class="mf293-field mf293-field-wide mf-account-note danger">'
)
s = s.replace(
    '<div id="mfAccountWalletMessage" class="mf-account-note" hidden>',
    '<div id="mfAccountWalletMessage" class="mf293-field mf293-field-wide mf-account-note" hidden>'
)

# ---------------------------------------------------------------------
# 3) Cache-bust the loader so Replit/mobile Safari cannot keep old styling.
# ---------------------------------------------------------------------
old_loader = "script.src = '/account-wallet-settings.js?v=account-wallet-settings-v1-20260826';"
new_loader = "script.src = '/account-wallet-settings.js?v=account-wallet-settings-native-style-v1-20260826';"

if old_loader in n:
    n = n.replace(old_loader, new_loader, 1)
elif "account-wallet-settings-native-style-v1-20260826" not in n:
    raise SystemExit("ERROR: account-wallet loader version pattern not found")

account.write_text(s, encoding="utf-8")
nav.write_text(n, encoding="utf-8")
PY

echo
echo "=== SYNTAX CHECK ==="
node --check "$ACCOUNT_JS"
node --check "$NAV_JS"

echo
echo "=== STYLE CHECK ==="
grep -n "MEMEFLOW_ACCOUNT_SETTINGS_NATIVE_STYLE_V1" "$ACCOUNT_JS"
grep -n "mf293-field mf-account-stat" "$ACCOUNT_JS" | head -n 10
grep -n "mf293-field mf293-field-wide mf-account-note" "$ACCOUNT_JS" | head -n 10
grep -n "account-wallet-settings-native-style-v1-20260826" "$NAV_JS"

# These old strong custom surfaces must be gone.
if grep -q '\.mf-account-stat{border:' "$ACCOUNT_JS"; then
  echo "ERROR: old custom account-stat border still exists"
  exit 1
fi

if grep -q '\.mf-account-note{grid-column:1/-1;border:' "$ACCOUNT_JS"; then
  echo "ERROR: old custom account-note border still exists"
  exit 1
fi

if grep -q '#mfEmergencyEntryLock{border-color:' "$ACCOUNT_JS"; then
  echo "ERROR: old emergency red border override still exists"
  exit 1
fi

echo
echo "=== GIT DIFF ==="
git diff -- "$ACCOUNT_JS" "$NAV_JS"

if git diff --quiet -- "$ACCOUNT_JS" "$NAV_JS"; then
  echo "No changes needed: style-unify patch is already applied."
  exit 0
fi

git add "$ACCOUNT_JS" "$NAV_JS"
git commit -m "fix(settings): unify wallet and execution styling"
git push origin HEAD

echo
echo "DONE: Wallet and Execution & safety now inherit the native System Settings visual style."
echo "No new CSS layer was added; custom heavy borders/backgrounds were removed."
