#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW token-card left-media patch v28c =="

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
BACKUP_DIR="$APP_DIR/.patch-backups/token-card-left-media-v28c-$STAMP"

mkdir -p "$BACKUP_DIR"
cp "$JS" "$CSS" "$HTML" "$BACKUP_DIR/"
echo "Backup: $BACKUP_DIR"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BACKUP_BRANCH="backup/token-card-left-media-v28c-$STAMP"
  git branch "$BACKUP_BRANCH" "$(git rev-parse HEAD)"
  echo "Git backup branch: $BACKUP_BRANCH"
fi

python3 - "$JS" "$CSS" "$HTML" <<'PY'
from pathlib import Path
import re, sys

js_path, css_path, html_path = map(Path, sys.argv[1:4])
js = js_path.read_text()
css = css_path.read_text()
html = html_path.read_text()

MARK = 'MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28C'
if MARK in js or MARK in css:
    raise SystemExit('Patch v28c is already installed.')

# 1) Pump.fun: preserve the existing working href, only replace the logo visual.
pump_pat = re.compile(r'''(?s)(<a\s+class="token-source-link pump mf-pump-logo-link"\s+href="\$\{escapeHtml\(links\.pump\)\}".*?>)\s*<img\s+class="mf-pump-logo".*?>\s*(</a>)''')
pump_repl = r'''\1
        <svg class="mf-external-arrow-icon-v28c" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 16L16 8"></path>
          <path d="M10 8H16V14"></path>
        </svg>
      \2'''
js, n_pump = pump_pat.subn(pump_repl, js, count=1)
if n_pump != 1:
    raise SystemExit('ERROR: Pump.fun card link template not found; no files were written.')

# Add marker class to that same anchor without touching href/target/rel.
js = js.replace(
    'class="token-source-link pump mf-pump-logo-link"',
    'class="token-source-link pump mf-pump-logo-link mf-external-arrow-link-v28c"',
    1
)

# 2) Details button: arrow only. MC is deliberately untouched.
old_button = '''      <button
        class="details-button"
        type="button"
      >
        Details
      </button>'''
new_button = '''      <button
        class="details-button mf-details-toggle-v28c"
        type="button"
        aria-expanded="false"
        aria-label="Open details"
        title="Open details"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 9.5L12 14.5L17 9.5"></path>
        </svg>
      </button>'''
if old_button not in js:
    raise SystemExit('ERROR: Details button template not found; no files were written.')
js = js.replace(old_button, new_button, 1)

# Helper updates accessibility/title only; never replaces SVG innerHTML.
anchor = '\nfunction render() {'
helper = r'''

// MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28C
function __mfSyncDetailsToggleV28C(button,expanded){
  if(!button)return;
  button.setAttribute('aria-expanded',expanded?'true':'false');
  button.setAttribute('aria-label',expanded?'Close details':'Open details');
  button.title=expanded?'Close details':'Open details';
}
'''
if anchor not in js:
    raise SystemExit('ERROR: render() anchor not found; no files were written.')
js = js.replace(anchor, helper + anchor, 1)

# Replace both normal card handlers regardless of whitespace style.
handler_pat = re.compile(r'''button\.textContent\s*=\s*expanded\s*\?\s*['"]Close['"]\s*:\s*['"]Details['"]\s*;''')
js, n_handlers = handler_pat.subn('__mfSyncDetailsToggleV28C(button,expanded);', js)
if n_handlers < 2:
    raise SystemExit(f'ERROR: found only {n_handlers} card Details handlers; expected at least 2; no files were written.')

# Standalone analyzer can programmatically expand an existing card.
js = re.sub(
    r'''if\(button\)button\.textContent=['"]Close['"];''',
    "if(button)__mfSyncDetailsToggleV28C(button,true);",
    js
)

# 3) Final CSS override. This is last on purpose, so old V24/V25/V26 mobile rules cannot win.
css += r'''

/* ==========================================================================\n   MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28C\n   MC stays exactly in the existing lower 6-column market strip.\n   ========================================================================== */

.mf-external-arrow-link-v28c {
  overflow: hidden !important;
}
.mf-external-arrow-link-v28c .mf-external-arrow-icon-v28c {
  width: 14px;
  height: 14px;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mf-details-toggle-v28c {
  display: inline-grid;
  place-items: center;
}
.mf-details-toggle-v28c svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform .16s ease;
}
.flow-token.expanded .mf-details-toggle-v28c svg {
  transform: rotate(180deg);
}

@media (max-width: 760px) {
  .flow-token,
  .flow-token.open,
  .flow-token:not(.open) {
    position: relative !important;
    display: block !important;
    min-height: 82px !important;
    height: 82px !important;
    padding: 7px 8px 7px 88px !important;
    border-radius: 10px !important;
    overflow: hidden !important;
  }

  .flow-token.expanded {
    height: auto !important;
    min-height: 82px !important;
    overflow: visible !important;
    padding-bottom: 9px !important;
  }

  .flow-token::before {
    top: 7px !important;
    bottom: 7px !important;
  }

  /* Large token image at the left, without increasing collapsed card height. */
  .flow-token .token-avatar {
    position: absolute !important;
    left: 10px !important;
    top: 7px !important;
    bottom: 7px !important;
    width: 68px !important;
    height: auto !important;
    min-width: 68px !important;
    margin: 0 !important;
    flex: none !important;
    border-radius: 9px !important;
    overflow: hidden !important;
  }
  .flow-token .token-avatar img {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    object-fit: cover !important;
    object-position: center !important;
    border-radius: inherit !important;
  }
  .flow-token .token-avatar.has-image span {
    display: none !important;
  }

  /* Everything else lives to the right of the image. */
  .flow-token .token-primary {
    position: static !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .flow-token .token-head,
  .flow-token .token-meta {
    display: block !important;
    min-width: 0 !important;
    padding: 0 !important;
  }
  .flow-token .token-top {
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    width: 100% !important;
    min-width: 0 !important;
    height: 25px !important;
    padding: 0 31px 0 0 !important;
  }
  .flow-token .token-name,
  .flow-token .token-mint {
    min-width: 36px !important;
    max-width: 108px !important;
    font-size: 9px !important;
    font-weight: 780 !important;
    line-height: 1 !important;
  }

  /* Compact external-link arrow; href remains the same Pump.fun URL. */
  .flow-token .token-source-link.pump.mf-pump-logo-link,
  .flow-token .mf-external-arrow-link-v28c {
    width: 18px !important;
    height: 18px !important;
    min-width: 18px !important;
    display: inline-grid !important;
    place-items: center !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 5px !important;
    background: transparent !important;
    box-shadow: none !important;
  }
  .flow-token .mf-external-arrow-icon-v28c {
    width: 13px !important;
    height: 13px !important;
  }

  /* Full status wording, smaller badge. */
  .flow-token .token-state {
    height: 18px !important;
    min-height: 18px !important;
    padding: 0 5px !important;
    border-radius: 5px !important;
    font-size: 7px !important;
    font-weight: 820 !important;
    letter-spacing: .045em !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  /* Score/P&L remains above the metric strip. */
  .flow-token > .mf-open-pnl-slot,
  .flow-token > .mf-score-slot,
  .flow-token.open > .mf-open-pnl-slot,
  .flow-token:not(.open) > .mf-score-slot {
    position: absolute !important;
    top: 32px !important;
    right: 9px !important;
    display: flex !important;
    align-items: baseline !important;
    gap: 3px !important;
    width: auto !important;
    height: 16px !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
  }
  .flow-token > .mf-open-pnl-slot span,
  .flow-token > .mf-score-slot span {
    display: inline !important;
    font-size: 7px !important;
    letter-spacing: .05em !important;
  }
  .flow-token > .mf-open-pnl-slot strong,
  .flow-token > .mf-score-slot strong {
    display: inline !important;
    margin: 0 !important;
    font-size: 8.5px !important;
    line-height: 1 !important;
  }

  /* Details text button -> compact open/close chevron. */
  .flow-token .details-button,
  .flow-token .mf-details-toggle-v28c {
    position: absolute !important;
    top: 5px !important;
    right: 6px !important;
    width: 27px !important;
    min-width: 27px !important;
    height: 27px !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 7px !important;
    background: transparent !important;
    box-shadow: none !important;
    color: #8498a5 !important;
    font-size: 0 !important;
  }
  .flow-token .mf-details-toggle-v28c svg {
    width: 15px !important;
    height: 15px !important;
  }

  /* KEEP ALL SIX LOWER METRICS, INCLUDING MC. */
  .flow-token .mf-open-market-strip,
  .flow-token .mf-regular-market-strip {
    position: absolute !important;
    left: 88px !important;
    right: 8px !important;
    bottom: 6px !important;
    width: auto !important;
    display: grid !important;
    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
    gap: 2px !important;
    margin: 0 !important;
    padding-top: 5px !important;
    border-top: 1px solid rgba(147,178,202,.07) !important;
  }
  .flow-token .mf-open-market-stat,
  .flow-token .mf-regular-market-stat {
    min-width: 0 !important;
    padding-left: 3px !important;
    border-left: 1px solid rgba(147,178,202,.07) !important;
  }
  .flow-token .mf-open-market-stat:first-child,
  .flow-token .mf-regular-market-stat:first-child {
    padding-left: 0 !important;
    border-left: 0 !important;
  }
  .flow-token .mf-open-market-stat span,
  .flow-token .mf-regular-market-stat span {
    font-size: 6.4px !important;
    letter-spacing: .03em !important;
    line-height: 1 !important;
  }
  .flow-token .mf-open-market-stat strong,
  .flow-token .mf-regular-market-stat strong {
    margin-top: 2px !important;
    font-size: 7.3px !important;
    line-height: 1 !important;
  }

  .flow-token.expanded .token-details {
    position: relative !important;
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 5px !important;
    width: calc(100% + 80px) !important;
    margin: 60px 0 0 -80px !important;
    padding-top: 7px !important;
  }
}

@media (max-width: 390px) {
  .flow-token,
  .flow-token.open,
  .flow-token:not(.open) {
    padding-left: 80px !important;
  }
  .flow-token .token-avatar {
    left: 9px !important;
    width: 62px !important;
    min-width: 62px !important;
  }
  .flow-token .token-name,
  .flow-token .token-mint {
    max-width: 84px !important;
    font-size: 8.4px !important;
  }
  .flow-token .token-state {
    padding: 0 4px !important;
    font-size: 6.6px !important;
  }
  .flow-token .mf-open-market-strip,
  .flow-token .mf-regular-market-strip {
    left: 80px !important;
  }
  .flow-token.expanded .token-details {
    width: calc(100% + 72px) !important;
    margin-left: -72px !important;
  }
}
'''

# Cache bust only; no MC template/JS changes.
html, n_css = re.subn(r'/system-tokens\.css\?v=[^"]+', '/system-tokens.css?v=token-card-left-media-v28c-20260904', html, count=1)
html, n_js = re.subn(r'/system-tokens\.js\?v=[^"]+', '/system-tokens.js?v=token-card-left-media-v28c-20260904', html, count=1)
if n_css != 1 or n_js != 1:
    raise SystemExit('ERROR: asset cache-bust references not found; no files were written.')

# Sanity: MC remains in BOTH lower templates.
if '<span>MC</span>' not in js:
    raise SystemExit('ERROR: MC disappeared unexpectedly; no files were written.')
if js.count('<span>MC</span>') < 2:
    raise SystemExit('ERROR: expected MC in both market strips; no files were written.')
if 'pump-logomark.svg' in js:
    raise SystemExit('ERROR: Pump.fun logo was not removed; no files were written.')
if MARK not in js or MARK not in css:
    raise SystemExit('ERROR: patch marker check failed; no files were written.')

# All checks passed: write atomically at the end.
js_path.write_text(js)
css_path.write_text(css)
html_path.write_text(html)
print('Patched:', js_path)
print('Patched:', css_path)
print('Patched:', html_path)
PY

echo "== JS syntax check =="
node --check "$JS"

echo "== Marker/cache checks =="
grep -n "MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28C" "$JS" | head -3
grep -n "MEMEFLOW_TOKEN_CARD_LEFT_MEDIA_V28C" "$CSS" | head -3
grep -n "token-card-left-media-v28c-20260904" "$HTML"

echo "== MC preserved =="
grep -n -A2 -B1 '<span>MC</span>' "$JS" | head -20

if [ -f "$APP_DIR/package.json" ]; then
  echo "== Existing UI tests =="
  (cd "$APP_DIR" && npm run test:ui)
fi

echo "== Diff =="
git diff --stat -- "$JS" "$CSS" "$HTML" || true

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add "$JS" "$CSS" "$HTML"
  git commit -m "style(token-flow): left media cards v28c"
  git push origin HEAD
  echo "Committed and pushed current branch."
fi

echo
echo "DONE: image left, content right, Pump.fun arrow, smaller badge, Details chevron; MC unchanged in lower strip."
echo "Backup: $BACKUP_DIR"
