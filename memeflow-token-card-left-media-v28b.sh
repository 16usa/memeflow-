#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW token-card left-media patch v28b =="

if [ -d "memeflow-app" ]; then
  APP_DIR="memeflow-app"
elif [ -f "system-tokens.js" ] && [ -f "system-tokens.css" ]; then
  APP_DIR="."
else
  echo "ERROR: memeflow-app/system-tokens.js not found."
  exit 1
fi

JS="$APP_DIR/system-tokens.js"
CSS="$APP_DIR/system-tokens.css"
HTML="$APP_DIR/system-tokens.html"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$APP_DIR/.patch-backups/token-card-left-media-v28b-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$JS" "$CSS" "$HTML" "$BACKUP_DIR/"

echo "Backup: $BACKUP_DIR"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  HEAD_SHA="$(git rev-parse HEAD)"
  BACKUP_BRANCH="backup/token-card-left-media-v28b-$STAMP"
  git branch "$BACKUP_BRANCH" "$HEAD_SHA"
  echo "Git backup branch: $BACKUP_BRANCH"
fi

python3 - "$JS" "$CSS" "$HTML" <<'PY'
from pathlib import Path
import re
import sys

js_path, css_path, html_path = map(Path, sys.argv[1:4])
js = js_path.read_text()
css = css_path.read_text()
html = html_path.read_text()

MARK = "MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28"
if MARK in js or MARK in css:
    raise SystemExit("Patch v28 is already installed.")

old_pump = '''  if (links.pump) {
    out.push(`
      <!-- MEMEFLOW_PUMPFUN_LOGO_LINK_V6 -->
      <a
        class="token-source-link pump mf-pump-logo-link"
        href="${escapeHtml(links.pump)}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open token on Pump.fun"
        title="Open on Pump.fun"
      >
        <img
          class="mf-pump-logo"
          src="https://pump.fun/pump-logomark.svg"
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        >
      </a>`);
  }'''

new_pump = '''  if (links.pump) {
    out.push(`
      <!-- MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28 -->
      <a
        class="token-source-link pump mf-pump-logo-link mf-external-arrow-link"
        href="${escapeHtml(links.pump)}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open token on Pump.fun"
        title="Open on Pump.fun"
      >
        <svg class="mf-external-arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 16L16 8"></path>
          <path d="M10 8H16V14"></path>
        </svg>
      </a>`);
  }'''

if old_pump not in js:
    raise SystemExit("ERROR: expected Pump.fun template not found; refusing partial patch.")
js = js.replace(old_pump, new_pump, 1)

marker = "\nfunction tokenTemplate(row, index) {"
if marker not in js:
    raise SystemExit("ERROR: tokenTemplate marker not found.")

helper = r'''
// MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28
function detailsToggleIconV28() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 9.5L12 14.5L17 9.5"></path>
    </svg>
  `;
}

function syncDetailsButtonV28(button, expanded) {
  if (!button) return;

  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  button.setAttribute('aria-label', expanded ? 'Close details' : 'Open details');
  button.title = expanded ? 'Close details' : 'Open details';
}
'''
js = js.replace(marker, helper + marker, 1)

old_details = '''      <button
        class="details-button"
        type="button"
      >
        Details
      </button>'''
new_details = '''      <button
        class="details-button mf-details-toggle-v28"
        type="button"
        aria-expanded="false"
        aria-label="Open details"
        title="Open details"
      >
        ${detailsToggleIconV28()}
      </button>'''
if old_details not in js:
    raise SystemExit("ERROR: Details button template not found.")
js = js.replace(old_details, new_details, 1)

old_handler = '''            button.textContent =
              expanded
                ? 'Close'
                : 'Details';'''
new_handler = '''            syncDetailsButtonV28(
              button,
              expanded
            );'''
if js.count(old_handler) < 2:
    raise SystemExit("ERROR: expected two Details text handlers.")
js = js.replace(old_handler, new_handler)

css += r'''

/* ==========================================================================
   MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28
   ========================================================================== */
.mf-external-arrow-link{overflow:hidden!important}
.mf-external-arrow-link .mf-external-arrow-icon{width:15px;height:15px;display:block;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.mf-details-toggle-v28{display:inline-grid;place-items:center}
.mf-details-toggle-v28 svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transition:transform .16s ease}
.flow-token.expanded .mf-details-toggle-v28 svg{transform:rotate(180deg)}

@media(max-width:760px){
  .flow-token,.flow-token.open,.flow-token:not(.open){position:relative!important;display:block!important;min-height:82px!important;height:82px;padding:7px 8px 7px 88px!important;border-radius:10px!important;overflow:hidden!important}
  .flow-token.expanded{height:auto!important;min-height:82px!important;overflow:visible!important;padding-bottom:9px!important}
  .flow-token::before{top:7px!important;bottom:7px!important}
  .flow-token .token-avatar{position:absolute!important;left:10px!important;top:7px!important;bottom:7px!important;width:68px!important;height:auto!important;min-width:68px!important;margin:0!important;flex:none!important;border-radius:9px!important;overflow:hidden!important}
  .flow-token .token-avatar img{width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;object-position:center!important;border-radius:inherit!important}
  .flow-token .token-avatar.has-image span{display:none!important}
  .flow-token .token-primary{position:static!important;min-width:0!important;margin:0!important;padding:0!important}
  .flow-token .token-head{display:block!important;min-width:0!important;padding:0!important}
  .flow-token .token-meta{display:block!important;min-width:0!important}
  .flow-token .token-top{display:flex!important;align-items:center!important;gap:4px!important;width:100%!important;min-width:0!important;height:22px!important;padding:0 31px 0 0!important}
  .flow-token .token-name,.flow-token .token-mint{min-width:36px!important;max-width:104px!important;font-size:9px!important;font-weight:780!important;line-height:1!important}
  .flow-token .token-source-link.pump.mf-pump-logo-link,.flow-token .token-source-link.pump.mf-external-arrow-link{width:18px!important;height:18px!important;min-width:18px!important;display:inline-grid!important;place-items:center!important;border:0!important;border-radius:5px!important;background:transparent!important;box-shadow:none!important}
  .flow-token .mf-external-arrow-icon{width:13px!important;height:13px!important}
  .flow-token .token-state{height:18px!important;min-height:18px!important;padding:0 5px!important;border-radius:5px!important;font-size:7px!important;font-weight:820!important;letter-spacing:.045em!important;line-height:1!important;white-space:nowrap!important}
  .flow-token>.mf-open-pnl-slot,.flow-token>.mf-score-slot,.flow-token.open>.mf-open-pnl-slot,.flow-token:not(.open)>.mf-score-slot{position:absolute!important;top:33px!important;right:43px!important;display:flex!important;align-items:baseline!important;gap:3px!important;width:auto!important;height:18px!important;min-width:0!important;margin:0!important;padding:0!important;border:0!important}
  .flow-token>.mf-open-pnl-slot span,.flow-token>.mf-score-slot span{display:inline!important;font-size:7px!important;letter-spacing:.05em!important}
  .flow-token>.mf-open-pnl-slot strong,.flow-token>.mf-score-slot strong{display:inline!important;margin:0!important;font-size:8.5px!important;line-height:1!important}
  .flow-token .details-button,.flow-token .mf-details-toggle-v28{position:absolute!important;top:7px!important;right:7px!important;width:27px!important;min-width:27px!important;height:27px!important;padding:0!important;border:0!important;border-radius:7px!important;background:transparent!important;box-shadow:none!important;color:#8498a5!important}
  .flow-token .mf-details-toggle-v28 svg{width:15px!important;height:15px!important}
  .flow-token .mf-open-market-strip,.flow-token .mf-regular-market-strip{position:absolute!important;left:88px!important;right:8px!important;bottom:6px!important;width:auto!important;display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:2px!important;margin:0!important;padding-top:5px!important;border-top:1px solid rgba(147,178,202,.07)!important}
  .flow-token .mf-open-market-stat,.flow-token .mf-regular-market-stat{min-width:0!important;padding-left:3px!important;border-left:1px solid rgba(147,178,202,.07)!important}
  .flow-token .mf-open-market-stat:first-child,.flow-token .mf-regular-market-stat:first-child{padding-left:0!important;border-left:0!important}
  .flow-token .mf-open-market-stat span,.flow-token .mf-regular-market-stat span{font-size:6.5px!important;letter-spacing:.035em!important;line-height:1!important}
  .flow-token .mf-open-market-stat strong,.flow-token .mf-regular-market-stat strong{margin-top:2px!important;font-size:7.5px!important;line-height:1!important}
  .flow-token.expanded .token-details{position:relative!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:5px!important;width:calc(100% + 80px)!important;margin:60px 0 0 -80px!important;padding-top:7px!important}
}

@media(max-width:390px){
  .flow-token,.flow-token.open,.flow-token:not(.open){padding-left:80px!important}
  .flow-token .token-avatar{left:9px!important;width:62px!important;min-width:62px!important}
  .flow-token .token-name,.flow-token .token-mint{max-width:82px!important;font-size:8.4px!important}
  .flow-token .token-state{padding:0 4px!important;font-size:6.6px!important}
  .flow-token .mf-open-market-strip,.flow-token .mf-regular-market-strip{left:80px!important}
  .flow-token.expanded .token-details{width:calc(100% + 72px)!important;margin-left:-72px!important}
}
'''

html, css_count = re.subn(r'/system-tokens\.css\?v=[^"]+', '/system-tokens.css?v=token-card-left-media-v28b-20260903', html, count=1)
html, js_count = re.subn(r'/system-tokens\.js\?v=[^"]+', '/system-tokens.js?v=token-card-left-media-v28b-20260903', html, count=1)
if css_count != 1 or js_count != 1:
    raise SystemExit("ERROR: cache-bust asset references not found.")

for token in ["MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28","mf-external-arrow-link","detailsToggleIconV28","syncDetailsButtonV28"]:
    if token not in js:
        raise SystemExit(f"ERROR: post-patch JS check failed: {token}")
if "pump-logomark.svg" in js:
    raise SystemExit("ERROR: Pump logo still remains in card JS.")
if "token-card-left-media-v28b-20260903" not in html:
    raise SystemExit("ERROR: HTML cache-bust check failed.")

js_path.write_text(js)
css_path.write_text(css)
html_path.write_text(html)
print("Patched:", js_path)
print("Patched:", css_path)
print("Patched:", html_path)
PY

echo "== Syntax check =="
node --check "$JS"

echo "== Patch markers =="
grep -n "MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28" "$JS" | head
grep -n "MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28" "$CSS" | head
grep -n "token-card-left-media-v28b-20260903" "$HTML"

if [ -f "$APP_DIR/package.json" ]; then
  echo "== Existing UI tests =="
  (
    cd "$APP_DIR"
    npm run test:ui
  )
fi

echo "== Diff summary =="
git diff --stat -- "$JS" "$CSS" "$HTML" || true

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add "$JS" "$CSS" "$HTML"
  git commit -m "style(token-flow): left media card layout v28b"
  git push origin HEAD
  echo "Committed and pushed current branch."
fi

echo
echo "DONE."
echo "Collapsed mobile card remains 82px."
echo "Token image is now a tall left-side media block."
echo "Pump.fun stays clickable via external-link arrow."
echo "Status badge is smaller; full label remains."
echo "MC stays in the original bottom metrics row."
echo "Details is now a chevron open/close control."
echo
echo "Local file backup: $BACKUP_DIR"
