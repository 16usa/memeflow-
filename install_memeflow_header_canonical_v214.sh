#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
APP="$ROOT/memeflow-app"
CSS="$APP/site-header-unify-v213.css"
X100="$APP/x100.html"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run this from the existing Replit workspace root."
  exit 1
fi

for f in "$CSS" "$X100"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing $f"
    exit 1
  fi
done

python3 - "$APP" <<'PY'
from pathlib import Path
import sys

app = Path(sys.argv[1])
css_path = app / "site-header-unify-v213.css"
x100_path = app / "x100.html"

css = r'''/* MEMEFLOW_SITE_HEADER_CANONICAL_V214
   One header contract for every current APE TRADING product page.
   Canonical visual reference: System Overview mobile header.
   Scope: header geometry / brand / subtitle / menu only.
   No trading, scanner, RPC, chart, wallet or data logic is touched.
*/

:root{
  --mf214-header-h:74px;
  --mf214-header-px:20px;
  --mf214-header-py:16px;

  --mf214-logo-box-w:54px;
  --mf214-logo-box-h:40px;
  --mf214-logo-w:52px;
  --mf214-logo-h:36px;

  --mf214-brand-gap:10px;
  --mf214-copy-gap:3px;

  --mf214-title-size:13px;
  --mf214-title-weight:700;
  --mf214-title-line:1.10;
  --mf214-title-letter:.015em;

  --mf214-sub-size:8px;
  --mf214-sub-weight:500;
  --mf214-sub-line:1.20;
  --mf214-sub-letter:.08em;

  --mf214-menu:38px;

  --mf214-title:#111317;
  --mf214-sub:#6f7780;
  --mf214-menu-line:#71828d;
}

html:not([data-theme="light"]){
  --mf214-title:#f2f5f7;
  --mf214-sub:#8d98a2;
  --mf214-menu-line:#8ea0ad;
}

body .mf-site-header{
  box-sizing:border-box !important;
  width:100% !important;
  max-width:100% !important;
  min-width:0 !important;

  height:var(--mf214-header-h) !important;
  min-height:var(--mf214-header-h) !important;
  max-height:var(--mf214-header-h) !important;

  margin:0 !important;
  padding:var(--mf214-header-py) var(--mf214-header-px) !important;

  display:flex !important;
  align-items:center !important;
  justify-content:flex-start !important;
  gap:8px !important;

  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;

  overflow:visible !important;
}

body .mf-site-header.mf-site-header--sticky{
  position:sticky !important;
  top:0 !important;
  z-index:100 !important;
}

body .mf-site-header:not(.mf-site-header--sticky){
  position:relative !important;
  top:auto !important;
}

body .mf-site-header > :is(
  .brand,
  .brand-block,
  .header-left,
  .mf-settings-page-header-left,
  .mf-vault-brand,
  .mf-hiw-brand,
  .mf-x100-brand
){
  min-width:0 !important;
  height:40px !important;
  margin:0 auto 0 0 !important;
  padding:0 !important;

  display:flex !important;
  align-items:center !important;
  justify-content:flex-start !important;
  gap:var(--mf214-brand-gap) !important;

  text-decoration:none !important;
}

body .mf-site-header > :is(
  .engine-strip,
  .system-chips,
  .live-status,
  .mf-settings-page-live,
  .ap-live-pill
){
  flex:0 0 auto !important;
}

body .mf-site-header :is(
  .brand-mark,
  .mf-settings-page-brand-mark,
  .mf-vault-brand-mark,
  .mf-hiw-brand-mark,
  .mf-x100-brand-mark
){
  box-sizing:border-box !important;

  width:var(--mf214-logo-box-w) !important;
  min-width:var(--mf214-logo-box-w) !important;
  max-width:var(--mf214-logo-box-w) !important;
  height:var(--mf214-logo-box-h) !important;
  min-height:var(--mf214-logo-box-h) !important;
  max-height:var(--mf214-logo-box-h) !important;
  flex:0 0 var(--mf214-logo-box-w) !important;

  margin:0 !important;
  padding:0 !important;

  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;

  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  overflow:visible !important;
}

body .mf-site-header :is(
  .brand-mark img,
  .mf-brand-img,
  .mf-settings-page-brand-mark img,
  .mf-vault-brand-mark img,
  .mf-hiw-brand-mark img,
  .mf-x100-brand-mark img
){
  width:var(--mf214-logo-w) !important;
  min-width:var(--mf214-logo-w) !important;
  max-width:var(--mf214-logo-w) !important;
  height:var(--mf214-logo-h) !important;
  min-height:var(--mf214-logo-h) !important;
  max-height:var(--mf214-logo-h) !important;

  margin:0 !important;
  padding:0 !important;

  display:block !important;
  object-fit:contain !important;
  object-position:center !important;

  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  filter:none !important;
}

body .mf-site-header :is(
  .brand > div:last-child,
  .brand-block > div:last-child,
  .header-title,
  .mf-settings-page-title,
  .mf-vault-brand-copy,
  .mf-hiw-brand-copy,
  .mf-x100-brand-copy
){
  min-width:0 !important;
  margin:0 !important;
  padding:0 !important;

  display:grid !important;
  grid-template-rows:auto auto !important;
  align-content:center !important;
  justify-items:start !important;
  row-gap:var(--mf214-copy-gap) !important;

  text-align:left !important;
}

body .mf-site-header :is(
  .brand-title,
  .brand-block .brand,
  .header-title > span,
  .mf-settings-page-title > span,
  .mf-vault-brand-copy > strong,
  .mf-hiw-brand-copy > strong,
  .mf-x100-brand-copy > strong
){
  box-sizing:border-box !important;
  margin:0 !important;
  padding:0 !important;
  display:block !important;

  color:var(--mf214-title) !important;
  font-family:var(--mf-terminal-font, "IBM Plex Mono","SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace) !important;
  font-size:var(--mf214-title-size) !important;
  font-weight:var(--mf214-title-weight) !important;
  line-height:var(--mf214-title-line) !important;
  letter-spacing:var(--mf214-title-letter) !important;
  text-transform:uppercase !important;

  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
}

body .mf-site-header :is(
  .brand-sub,
  .brand-block .subtitle,
  .header-title > strong,
  .mf-settings-page-title > strong,
  .mf-vault-brand-copy > small,
  .mf-hiw-brand-copy > small,
  .mf-x100-brand-copy > small
){
  box-sizing:border-box !important;
  margin:0 !important;
  padding:0 !important;
  display:block !important;

  color:var(--mf214-sub) !important;
  font-family:var(--mf-terminal-font, "IBM Plex Mono","SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace) !important;
  font-size:var(--mf214-sub-size) !important;
  font-weight:var(--mf214-sub-weight) !important;
  line-height:var(--mf214-sub-line) !important;
  letter-spacing:var(--mf214-sub-letter) !important;
  text-transform:uppercase !important;

  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
}

body .mf-site-header .top-actions{
  min-width:0 !important;
  margin:0 !important;
  padding:0 !important;

  display:flex !important;
  align-items:center !important;
  justify-content:flex-end !important;
  gap:7px !important;

  flex:0 0 auto !important;
}

body .mf-site-header > .mf-nav-host,
body .mf-site-header .top-actions > .mf-nav-host{
  width:var(--mf214-menu) !important;
  height:var(--mf214-menu) !important;
  min-width:var(--mf214-menu) !important;
  min-height:var(--mf214-menu) !important;
  max-width:var(--mf214-menu) !important;
  max-height:var(--mf214-menu) !important;
  flex:0 0 var(--mf214-menu) !important;

  margin:0 !important;
  padding:0 !important;

  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
}

body .mf-site-header .mf-nav-toggle{
  appearance:none !important;
  -webkit-appearance:none !important;

  width:var(--mf214-menu) !important;
  height:var(--mf214-menu) !important;
  min-width:var(--mf214-menu) !important;
  min-height:var(--mf214-menu) !important;
  max-width:var(--mf214-menu) !important;
  max-height:var(--mf214-menu) !important;
  flex:0 0 var(--mf214-menu) !important;

  margin:0 !important;
  padding:0 !important;

  display:grid !important;
  place-items:center !important;

  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
}

body .mf-site-header .mf-nav-toggle-lines{
  width:20px !important;
  height:14px !important;
}

body .mf-site-header .mf-nav-toggle-line{
  left:0 !important;
  width:20px !important;
  height:1.5px !important;
  background:var(--mf214-menu-line) !important;
  box-shadow:none !important;
}

body .mf-site-header .mf-nav-toggle-line:first-child{
  top:3px !important;
}

body .mf-site-header .mf-nav-toggle-line:last-child{
  top:10px !important;
}

html[data-mf-nav-open="1"] body .mf-site-header .mf-nav-toggle-line:first-child,
html[data-mf-nav-open="1"] body .mf-site-header .mf-nav-toggle-line:last-child{
  top:6.5px !important;
}

@media (max-width:820px){
  body.mf-page-trading .mf-site-header--sticky:has(> .engine-strip){
    margin-bottom:32px !important;
  }

  body.mf-page-trading .mf-site-header--sticky > .engine-strip{
    position:absolute !important;
    left:0 !important;
    right:0 !important;
    top:100% !important;

    width:100% !important;
    height:32px !important;
    min-height:32px !important;

    margin:0 !important;
    padding:0 var(--mf214-header-px) !important;

    display:flex !important;
    align-items:center !important;
    justify-content:flex-start !important;
    gap:12px !important;

    overflow-x:auto !important;
    overflow-y:hidden !important;
    white-space:nowrap !important;
    scrollbar-width:none !important;

    border:0 !important;
    border-radius:0 !important;
    background:transparent !important;
    box-shadow:none !important;
  }

  body.mf-page-trading .mf-site-header--sticky > .engine-strip::-webkit-scrollbar{
    display:none !important;
  }

  body.mf-page-trading .mf-site-header--sticky > .engine-strip .status-pill{
    min-height:0 !important;
    height:auto !important;
    margin:0 !important;
    padding:0 !important;
    border:0 !important;
    border-radius:0 !important;
    background:transparent !important;
    box-shadow:none !important;
  }
}

@media (max-width:820px){
  :root{
    --mf214-header-h:66px;
    --mf214-header-px:14px;
    --mf214-header-py:12px;

    --mf214-logo-box-w:50px;
    --mf214-logo-box-h:38px;
    --mf214-logo-w:48px;
    --mf214-logo-h:34px;

    --mf214-brand-gap:10px;
    --mf214-copy-gap:3px;

    --mf214-title-size:13px;
    --mf214-sub-size:8px;

    --mf214-menu:36px;
  }

  body .mf-site-header{
    gap:6px !important;
  }

  body .mf-site-header > :is(
    .system-chips,
    .live-status,
    .mf-settings-page-live,
    .ap-live-pill
  ){
    display:none !important;
  }

  body .mf-site-header .top-actions > :is(
    .tool-btn,
    .wallet-btn
  ):not(.mf-nav-toggle){
    display:none !important;
  }
}

body.mf-page-x100 > .site-header.mf-site-header{
  position:relative !important;
  inset:auto !important;
}

body.mf-page-x100 > .site-header.mf-site-header .mf-x100-brand{
  color:inherit !important;
}

/* /MEMEFLOW_SITE_HEADER_CANONICAL_V214 */
'''

css_path.write_text(css, encoding="utf-8")

# Bust the old v213 static-asset URL everywhere it was previously injected.
for path in app.rglob("*.html"):
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        continue
    if '/site-header-unify-v213.css?v=213' in text:
        text = text.replace(
            '/site-header-unify-v213.css?v=213',
            '/site-header-unify-v213.css?v=214'
        )
        path.write_text(text, encoding="utf-8")

# X100 was still on its own legacy MEMEFLOW/dragonfly header.
x100 = x100_path.read_text(encoding="utf-8")

old_head_assets = '''  <link rel="stylesheet" href="/x100.css?v=1">
  <link rel="stylesheet" href="/memeflow-x-canonical-v186.css?v=typography-role-system-v186-20260922">'''
new_head_assets = '''  <link rel="stylesheet" href="/x100.css?v=1">
  <link rel="stylesheet" href="/memeflow-brand.css?v=gorilla-pair-v159-20260919">
  <link rel="stylesheet" href="/memeflow-nav.css?v=global-right-drawer-frameless-v2-20260829">
  <link rel="stylesheet" href="/memeflow-header.css?v=canvas-header-v4-20260904-233242">
  <link rel="stylesheet" href="/memeflow-x-canonical-v186.css?v=typography-role-system-v186-20260922">'''

if old_head_assets in x100 and new_head_assets not in x100:
    x100 = x100.replace(old_head_assets, new_head_assets, 1)

old_header = '''  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/system.html" aria-label="MEMEFLOW system">
        <img src="/brand/memeflow-dragonfly-dark.png?v=final-v5" alt="" width="34" height="34">
        <span><b>MEMEFLOW</b><small>X100 NETWORK</small></span>
      </a>
      <nav class="nav" aria-label="Primary navigation">
        <a href="/how-it-works.html">How it works</a>
        <a href="/system.html">System</a>
        <a href="/trading.html">Trading</a>
      </nav>
    </div>
  </header>'''

new_header = '''  <header class="site-header mf-site-header">
    <a class="mf-x100-brand" href="/system.html" aria-label="APE TRADING System Overview">
      <span class="mf-x100-brand-mark" aria-hidden="true">
        <img class="mf-brand-img" src="/brand/memeflow-gorilla-dark.png?v=gorilla-pair-v159" alt="">
      </span>
      <span class="mf-x100-brand-copy">
        <strong>APE TRADING</strong>
        <small>X100 NETWORK</small>
      </span>
    </a>
    <div class="top-actions" aria-label="Page actions"></div>
  </header>'''

if old_header in x100:
    x100 = x100.replace(old_header, new_header, 1)
elif new_header not in x100:
    raise SystemExit("ERROR: x100 header structure changed; refusing unsafe replacement.")

nav_script = '<script src="/memeflow-nav.js?v=global-right-drawer-v2-how-it-works" defer></script>'
if nav_script not in x100:
    if '</body>' not in x100:
        raise SystemExit("ERROR: x100.html missing </body>.")
    x100 = x100.replace('</body>', f'{nav_script}\n</body>', 1)

x100 = x100.replace(
    '/site-header-unify-v213.css?v=213',
    '/site-header-unify-v213.css?v=214'
)

x100_path.write_text(x100, encoding="utf-8")

print("Updated canonical header CSS.")
print("Updated all existing header stylesheet URLs to v214.")
print("Migrated X100 to Gorilla + APE TRADING + global menu.")
PY

echo
echo "=== Header validation ==="

grep -q 'MEMEFLOW_SITE_HEADER_CANONICAL_V214' "$CSS"
grep -q 'class="site-header mf-site-header"' "$X100"
grep -q 'memeflow-gorilla-dark.png' "$X100"
grep -q 'memeflow-nav.js' "$X100"

for f in \
  "$APP/system.html" \
  "$APP/how-it-works.html" \
  "$APP/smart-vault.html" \
  "$APP/trading.html" \
  "$APP/settings.html" \
  "$APP/system-tokens.html" \
  "$APP/agent-performance.html" \
  "$APP/x100.html"
do
  if [ -f "$f" ]; then
    grep -q 'site-header-unify-v213.css?v=214' "$f" || {
      echo "ERROR: v214 header asset missing in $f"
      exit 1
    }
  fi
done

git diff --check
git status --short

git add "$APP"
if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "Canonicalize APE TRADING header across site"
fi

git push

echo
echo "DONE."
echo "Header is normalized across current product pages and X100 is migrated."
echo "No server/process restart was performed."
