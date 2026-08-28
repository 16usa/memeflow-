#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1"
COMMIT_MESSAGE="[MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1] Add shared right drawer navigation"
DO_PUSH=1
ROLLBACK=0

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    --rollback) ROLLBACK=1 ;;
    *)
      echo "Usage: $0 [--push|--no-push|--rollback]" >&2
      exit 2
      ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this inside the MEMEFLOW git repository." >&2
  exit 1
fi

if [[ -d "$ROOT/memeflow-app" ]]; then
  APP="$ROOT/memeflow-app"
else
  APP="$ROOT"
fi

SYSTEM_HTML="$APP/system.html"
TRADING_HTML="$APP/trading.html"
SETTINGS_HTML="$APP/settings.html"
TOKENS_HTML="$APP/system-tokens.html"
NAV_CSS="$APP/memeflow-nav.css"
NAV_JS="$APP/memeflow-nav.js"

EXISTING=(
  "$SYSTEM_HTML"
  "$TRADING_HTML"
  "$SETTINGS_HTML"
  "$TOKENS_HTML"
)

for f in "${EXISTING[@]}"; do
  [[ -f "$f" ]] || {
    echo "ERROR: missing $f" >&2
    exit 1
  }
done

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || {
  echo "ERROR: detached HEAD." >&2
  exit 1
}

if [[ "$ROLLBACK" == "1" ]]; then
  echo
  echo "MEMEFLOW right-drawer menu rollback"
  echo

  if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
    echo "ERROR: working tree is not clean. Commit/stash changes first." >&2
    exit 1
  fi

  if [[ "$DO_PUSH" == "1" ]]; then
    git -C "$ROOT" fetch origin "$BRANCH"
    if [[ "$(git -C "$ROOT" rev-parse HEAD)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
      echo "ERROR: local $BRANCH differs from origin/$BRANCH." >&2
      exit 1
    fi
  fi

  INSTALL_COMMIT="$(
    git -C "$ROOT" log \
      --format='%H' \
      --grep='^\[MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1\] Add shared right drawer navigation$' \
      -n 1
  )"

  if [[ -z "$INSTALL_COMMIT" ]]; then
    echo "ERROR: menu install commit was not found." >&2
    exit 1
  fi

  echo "Reverting: $INSTALL_COMMIT"
  git -C "$ROOT" revert --no-edit "$INSTALL_COMMIT"

  if [[ "$DO_PUSH" == "1" ]]; then
    git -C "$ROOT" push origin "$BRANCH"
  fi

  echo
  echo "SUCCESS: shared menu was cleanly removed."
  exit 0
fi

echo
echo "MEMEFLOW Global Right Drawer Navigation V1"
echo
echo "Adds the same navigation to:"
echo "  - System Overview"
echo "  - Trading Terminal"
echo "  - System Settings"
echo "  - Real-Time Pipeline"
echo
echo "Interaction:"
echo "  - two-line menu button"
echo "  - lines morph into X"
echo "  - drawer slides right -> left"
echo "  - backdrop click / Escape / link closes it"
echo

if [[ -e "$NAV_CSS" || -e "$NAV_JS" ]]; then
  echo "ERROR: memeflow-nav.css or memeflow-nav.js already exists." >&2
  echo "Refusing to overwrite an unknown implementation." >&2
  exit 1
fi

for f in "${EXISTING[@]}"; do
  if grep -Fq "$PATCH_ID" "$f"; then
    echo "ERROR: partial menu marker already exists in $f" >&2
    exit 1
  fi
done

grep -Fq '<header class="topbar' "$SYSTEM_HTML" || {
  echo "ERROR: System header not found." >&2
  exit 1
}
grep -Fq '<div class="top-actions">' "$TRADING_HTML" || {
  echo "ERROR: Trading top-actions not found." >&2
  exit 1
}
grep -Fq '<header class="mf-settings-page-header">' "$SETTINGS_HTML" || {
  echo "ERROR: Settings header not found." >&2
  exit 1
}
grep -Fq '<header class="flow-header">' "$TOKENS_HTML" || {
  echo "ERROR: Token Flow header not found." >&2
  exit 1
}

REL_SYSTEM="${SYSTEM_HTML#"$ROOT"/}"
REL_TRADING="${TRADING_HTML#"$ROOT"/}"
REL_SETTINGS="${SETTINGS_HTML#"$ROOT"/}"
REL_TOKENS="${TOKENS_HTML#"$ROOT"/}"
REL_NAV_CSS="${NAV_CSS#"$ROOT"/}"
REL_NAV_JS="${NAV_JS#"$ROOT"/}"

EXISTING_RELS=(
  "$REL_SYSTEM"
  "$REL_TRADING"
  "$REL_SETTINGS"
  "$REL_TOKENS"
)

TARGETS=(
  "$REL_SYSTEM"
  "$REL_TRADING"
  "$REL_SETTINGS"
  "$REL_TOKENS"
  "$REL_NAV_CSS"
  "$REL_NAV_JS"
)

for rel in "${EXISTING_RELS[@]}"; do
  if ! git -C "$ROOT" diff --quiet -- "$rel" || \
     ! git -C "$ROOT" diff --cached --quiet -- "$rel"; then
    echo "ERROR: target file has local/staged edits: $rel" >&2
    echo "Commit or stash it first; nothing was changed." >&2
    exit 1
  fi
done

if [[ -n "$(git -C "$ROOT" diff --cached --name-only)" ]]; then
  echo "ERROR: unrelated files are already staged. Unstage them first." >&2
  git -C "$ROOT" diff --cached --name-only >&2
  exit 1
fi

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" fetch origin "$BRANCH"
  LOCAL_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
  REMOTE_HEAD="$(git -C "$ROOT" rev-parse "origin/$BRANCH")"

  if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    echo "ERROR: local $BRANCH differs from origin/$BRANCH." >&2
    echo "Nothing changed." >&2
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.patch-backups/global-right-drawer-nav-v1-$STAMP"
mkdir -p "$BACKUP"

cp -p "$SYSTEM_HTML" "$BACKUP/system.html"
cp -p "$TRADING_HTML" "$BACKUP/trading.html"
cp -p "$SETTINGS_HTML" "$BACKUP/settings.html"
cp -p "$TOKENS_HTML" "$BACKUP/system-tokens.html"

echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-menu files..."
    cp -p "$BACKUP/system.html" "$SYSTEM_HTML"
    cp -p "$BACKUP/trading.html" "$TRADING_HTML"
    cp -p "$BACKUP/settings.html" "$SETTINGS_HTML"
    cp -p "$BACKUP/system-tokens.html" "$TOKENS_HTML"
    rm -f "$NAV_CSS" "$NAV_JS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_SYSTEM_HTML="$SYSTEM_HTML"
export MF_TRADING_HTML="$TRADING_HTML"
export MF_SETTINGS_HTML="$SETTINGS_HTML"
export MF_TOKENS_HTML="$TOKENS_HTML"
export MF_NAV_CSS="$NAV_CSS"
export MF_NAV_JS="$NAV_JS"

python3 <<'PY'
from pathlib import Path
import os
import re

PATCH_ID = "MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1"

system_path = Path(os.environ["MF_SYSTEM_HTML"])
trading_path = Path(os.environ["MF_TRADING_HTML"])
settings_path = Path(os.environ["MF_SETTINGS_HTML"])
tokens_path = Path(os.environ["MF_TOKENS_HTML"])
css_path = Path(os.environ["MF_NAV_CSS"])
js_path = Path(os.environ["MF_NAV_JS"])

paths = [system_path, trading_path, settings_path, tokens_path]
htmls = {p: p.read_text(encoding="utf-8") for p in paths}

NAV_CSS = r'''
/* ===== MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1 ===== */

:root {
  --mf-nav-bg: #0f141a;
  --mf-nav-surface: rgba(17, 24, 32, .965);
  --mf-nav-surface-2: rgba(20, 28, 37, .965);
  --mf-nav-line: rgba(145, 173, 198, .085);
  --mf-nav-line-strong: rgba(145, 188, 216, .15);
  --mf-nav-text: #eaf2f6;
  --mf-nav-muted: #70818f;
  --mf-nav-cyan: #55d9ff;
  --mf-nav-green: #4de6a1;
}

.mf-nav-host {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.top-actions > .mf-nav-host {
  margin-left: 1px;
}

.mf-settings-page-header .mf-settings-page-live,
.flow-header .live-status {
  margin-left: auto;
}

.mf-settings-page-header > .mf-nav-host,
.flow-header > .mf-nav-host {
  margin-left: 8px;
}

.mf-nav-toggle {
  appearance: none;
  -webkit-appearance: none;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0;
  border: 1px solid var(--mf-nav-line);
  border-radius: 10px;
  background: rgba(255, 255, 255, .015);
  color: var(--mf-nav-text);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  z-index: 2147483200;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;
}

.mf-nav-toggle:hover,
.mf-nav-toggle:focus-visible {
  border-color: rgba(85, 217, 255, .22);
  background: rgba(85, 217, 255, .035);
  outline: none;
}

.mf-nav-toggle:active {
  transform: scale(.96);
}

.mf-nav-toggle-lines {
  width: 17px;
  height: 13px;
  position: relative;
  display: block;
}

.mf-nav-toggle-line {
  position: absolute;
  left: 0;
  width: 17px;
  height: 1.5px;
  border-radius: 99px;
  background: #b7c8d1;
  transform-origin: 50% 50%;
  transition:
    top 220ms cubic-bezier(.22,.82,.21,1),
    transform 260ms cubic-bezier(.22,.82,.21,1),
    background-color 180ms ease;
}

.mf-nav-toggle-line:first-child {
  top: 3px;
}

.mf-nav-toggle-line:last-child {
  top: 9px;
}

html[data-mf-nav-open="1"] .mf-nav-toggle-line:first-child {
  top: 6px;
  transform: rotate(45deg);
}

html[data-mf-nav-open="1"] .mf-nav-toggle-line:last-child {
  top: 6px;
  transform: rotate(-45deg);
}

html[data-mf-nav-open="1"] .mf-nav-toggle-line {
  background: #e8f1f5;
}

.mf-nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  border: 0;
  margin: 0;
  padding: 0;
  background: rgba(2, 6, 9, .46);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  transition:
    opacity 260ms ease,
    visibility 260ms ease;
}

html[data-mf-nav-open="1"] .mf-nav-backdrop {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.mf-nav-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483100;
  width: min(360px, calc(100vw - 18px));
  max-width: 100%;
  display: flex;
  flex-direction: column;
  padding:
    max(18px, env(safe-area-inset-top))
    16px
    max(18px, env(safe-area-inset-bottom));
  border-left: 1px solid var(--mf-nav-line);
  background:
    radial-gradient(circle at 72% 4%, rgba(85, 217, 255, .045), transparent 24%),
    linear-gradient(
      180deg,
      var(--mf-nav-surface-2),
      var(--mf-nav-surface)
    );
  box-shadow: -26px 0 70px rgba(0, 0, 0, .28);
  transform: translate3d(105%, 0, 0);
  transition:
    transform 340ms cubic-bezier(.22,.82,.21,1);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

html[data-mf-nav-open="1"] .mf-nav-drawer {
  transform: translate3d(0, 0, 0);
}

.mf-nav-drawer-head {
  min-height: 48px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 3px 46px 15px 4px;
  border-bottom: 1px solid var(--mf-nav-line);
}

.mf-nav-kicker {
  display: block;
  color: var(--mf-nav-cyan);
  font-size: 7px;
  line-height: 1;
  font-weight: 850;
  letter-spacing: .18em;
  text-transform: uppercase;
}

.mf-nav-drawer-title {
  display: block;
  margin-top: 7px;
  color: var(--mf-nav-text);
  font-size: 17px;
  line-height: 1;
  font-weight: 850;
  letter-spacing: -.025em;
}

.mf-nav-list {
  display: grid;
  gap: 0;
  margin: 9px 0 0;
  padding: 0;
  list-style: none;
}

.mf-nav-link {
  min-height: 68px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 11px 6px 11px 7px;
  border-bottom: 1px solid rgba(145, 173, 198, .055);
  color: inherit;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color 170ms ease,
    padding-left 200ms ease;
}

.mf-nav-link:hover,
.mf-nav-link:focus-visible {
  padding-left: 11px;
  background: rgba(85, 217, 255, .022);
  outline: none;
}

.mf-nav-link-copy {
  min-width: 0;
}

.mf-nav-link-title {
  display: block;
  color: #dde8ed;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 760;
  letter-spacing: .012em;
}

.mf-nav-link-sub {
  display: block;
  margin-top: 5px;
  color: var(--mf-nav-muted);
  font-size: 8px;
  line-height: 1.35;
  font-weight: 550;
  letter-spacing: .02em;
}

.mf-nav-link-arrow {
  color: #566a76;
  font-size: 14px;
  line-height: 1;
  transform: translateX(-2px);
  transition:
    transform 180ms ease,
    color 180ms ease;
}

.mf-nav-link:hover .mf-nav-link-arrow,
.mf-nav-link:focus-visible .mf-nav-link-arrow {
  color: #95aab4;
  transform: translateX(1px);
}

.mf-nav-link[aria-current="page"] .mf-nav-link-title {
  color: #f0f7fa;
}

.mf-nav-link[aria-current="page"] .mf-nav-link-sub {
  color: #7ca0ae;
}

.mf-nav-link[aria-current="page"] .mf-nav-link-arrow {
  width: 6px;
  height: 6px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--mf-nav-green);
  color: transparent;
  box-shadow: 0 0 10px rgba(77, 230, 161, .34);
}

.mf-nav-foot {
  margin-top: auto;
  padding: 16px 6px 2px;
  border-top: 1px solid var(--mf-nav-line);
}

.mf-nav-foot strong {
  display: block;
  color: #778b97;
  font-size: 8px;
  line-height: 1.2;
  font-weight: 750;
  letter-spacing: .12em;
}

.mf-nav-foot span {
  display: block;
  margin-top: 5px;
  color: #526571;
  font-size: 7px;
  line-height: 1.4;
}

html[data-mf-nav-open="1"],
html[data-mf-nav-open="1"] body {
  overflow: hidden !important;
  overscroll-behavior: none !important;
}

html[data-mf-gallery-live-preview="1"] .mf-nav-host,
html[data-mf-gallery-live-preview="1"] .mf-nav-backdrop,
html[data-mf-gallery-live-preview="1"] .mf-nav-drawer {
  display: none !important;
}

@media (max-width: 600px) {
  .mf-nav-toggle {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
    border-radius: 9px;
  }

  .mf-nav-drawer {
    width: min(340px, calc(100vw - 12px));
    padding-left: 14px;
    padding-right: 14px;
  }

  .mf-nav-drawer-head {
    padding-right: 42px;
  }

  .mf-nav-link {
    min-height: 64px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mf-nav-toggle,
  .mf-nav-toggle-line,
  .mf-nav-backdrop,
  .mf-nav-drawer,
  .mf-nav-link,
  .mf-nav-link-arrow {
    transition-duration: .01ms !important;
  }
}

/* ===== /MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1 ===== */
'''

NAV_JS = r'''
/* ===== MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1 ===== */
(() => {
  'use strict';

  if (window.__mfGlobalRightDrawerNavV1) return;
  window.__mfGlobalRightDrawerNavV1 = true;

  const PATCH_ID = 'MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1';
  const url = new URL(window.location.href);

  if (url.searchParams.get('mfGalleryLive') === '1') {
    document.documentElement.dataset.mfGalleryLivePreview = '1';
    return;
  }

  const NAV_ITEMS = [
    {
      href: '/system.html',
      title: 'System Overview',
      sub: 'Live architecture and system state'
    },
    {
      href: '/trading.html',
      title: 'Trading Terminal',
      sub: 'Charts, candidates, positions and execution'
    },
    {
      href: '/settings.html',
      title: 'System Settings',
      sub: 'Trading mode, filters, risk and exits'
    },
    {
      href: '/system-tokens.html',
      title: 'Real-Time Pipeline',
      sub: 'Live token states and decision flow'
    }
  ];

  function normalizedPath(pathname = window.location.pathname) {
    return String(pathname || '/').replace(/\/+$/, '') || '/';
  }

  function resolveHeaderHost() {
    const path = normalizedPath();

    if (path.endsWith('/trading.html')) {
      return document.querySelector('.topbar .top-actions');
    }

    if (path.endsWith('/settings.html')) {
      return document.querySelector('.mf-settings-page-header');
    }

    if (path.endsWith('/system-tokens.html')) {
      return document.querySelector('.flow-header');
    }

    if (path.endsWith('/system.html')) {
      return document.querySelector('.topbar .top-actions');
    }

    return (
      document.querySelector('.topbar .top-actions') ||
      document.querySelector('.mf-settings-page-header') ||
      document.querySelector('.flow-header')
    );
  }

  function makeToggle() {
    const host = document.createElement('div');
    host.className = 'mf-nav-host';
    host.dataset.mfNavHost = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mf-nav-toggle';
    button.setAttribute('aria-label', 'Open navigation');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'mfGlobalNavDrawer');

    button.innerHTML = `
      <span class="mf-nav-toggle-lines" aria-hidden="true">
        <span class="mf-nav-toggle-line"></span>
        <span class="mf-nav-toggle-line"></span>
      </span>
    `;

    host.appendChild(button);
    return { host, button };
  }

  function makeBackdrop() {
    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'mf-nav-backdrop';
    backdrop.setAttribute('aria-label', 'Close navigation');
    backdrop.tabIndex = -1;
    return backdrop;
  }

  function makeDrawer() {
    const drawer = document.createElement('aside');
    drawer.id = 'mfGlobalNavDrawer';
    drawer.className = 'mf-nav-drawer';
    drawer.setAttribute('aria-label', 'MEMEFLOW navigation');
    drawer.setAttribute('aria-hidden', 'true');

    const current = normalizedPath();

    const items = NAV_ITEMS.map(item => {
      const itemPath = normalizedPath(item.href);
      const active = current === itemPath;

      return `
        <li>
          <a
            class="mf-nav-link"
            href="${item.href}"
            ${active ? 'aria-current="page"' : ''}
          >
            <span class="mf-nav-link-copy">
              <span class="mf-nav-link-title">${item.title}</span>
              <span class="mf-nav-link-sub">${item.sub}</span>
            </span>
            <span class="mf-nav-link-arrow" aria-hidden="true">→</span>
          </a>
        </li>
      `;
    }).join('');

    drawer.innerHTML = `
      <div class="mf-nav-drawer-head">
        <div>
          <span class="mf-nav-kicker">MEMEFLOW</span>
          <strong class="mf-nav-drawer-title">Navigation</strong>
        </div>
      </div>

      <nav aria-label="Primary">
        <ul class="mf-nav-list">
          ${items}
        </ul>
      </nav>

      <div class="mf-nav-foot">
        <strong>LIVE SYSTEM</strong>
        <span>Non-custodial automated trading platform</span>
      </div>
    `;

    return drawer;
  }

  function install() {
    if (document.querySelector('[data-mf-nav-host="1"]')) {
      return true;
    }

    const headerHost = resolveHeaderHost();
    if (!headerHost) return false;

    const { host, button } = makeToggle();
    const backdrop = makeBackdrop();
    const drawer = makeDrawer();

    headerHost.appendChild(host);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    let open = false;
    let lastFocused = null;

    const setOpen = (next, { restoreFocus = true } = {}) => {
      const desired = Boolean(next);

      if (desired === open) return;
      open = desired;

      if (open) {
        lastFocused =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : button;

        document.documentElement.dataset.mfNavOpen = '1';
        button.setAttribute('aria-expanded', 'true');
        button.setAttribute('aria-label', 'Close navigation');
        drawer.setAttribute('aria-hidden', 'false');

        const activeLink =
          drawer.querySelector('[aria-current="page"]') ||
          drawer.querySelector('.mf-nav-link');

        window.setTimeout(() => {
          activeLink?.focus?.({ preventScroll: true });
        }, 280);
      } else {
        delete document.documentElement.dataset.mfNavOpen;
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', 'Open navigation');
        drawer.setAttribute('aria-hidden', 'true');

        if (restoreFocus) {
          window.setTimeout(() => {
            if (lastFocused?.isConnected) {
              lastFocused.focus?.({ preventScroll: true });
            } else {
              button.focus?.({ preventScroll: true });
            }
          }, 20);
        }
      }
    };

    button.addEventListener('click', () => {
      setOpen(!open);
    });

    backdrop.addEventListener('click', () => {
      setOpen(false);
    });

    drawer.addEventListener('click', event => {
      const link = event.target.closest('.mf-nav-link');
      if (!link) return;
      setOpen(false, { restoreFocus: false });
    });

    document.addEventListener('keydown', event => {
      if (!open) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key === 'Tab') {
        const focusables = [
          button,
          ...drawer.querySelectorAll('a[href], button:not([disabled])')
        ].filter(node => (
          node instanceof HTMLElement &&
          node.offsetParent !== null
        ));

        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    window.addEventListener('pagehide', () => {
      delete document.documentElement.dataset.mfNavOpen;
    }, { once: true });

    console.log(`[NAV] ${PATCH_ID} mounted`);
    return true;
  }

  function boot() {
    let attempts = 0;

    const timer = window.setInterval(() => {
      attempts += 1;

      if (install() || attempts >= 80) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {
      once: true
    });
  } else {
    boot();
  }
})();
/* ===== /MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1 ===== */
'''

css_path.write_text(NAV_CSS.strip() + "\n", encoding="utf-8")
js_path.write_text(NAV_JS.strip() + "\n", encoding="utf-8")

def inject_shared_assets(html: str) -> str:
    if PATCH_ID in html:
        raise SystemExit("ERROR: partial HTML marker already exists")

    if '/memeflow-nav.css' in html or '/memeflow-nav.js' in html:
        raise SystemExit("ERROR: unknown existing shared-nav asset reference")

    head_close = re.search(r'</head>', html, flags=re.I)
    if not head_close:
        raise SystemExit("ERROR: </head> not found")

    css_link = (
        f'  <!-- {PATCH_ID} -->\n'
        '  <link rel="stylesheet" href="/memeflow-nav.css?v=global-right-drawer-v1">\n'
    )

    html = (
        html[:head_close.start()]
        + css_link
        + html[head_close.start():]
    )

    body_close = re.search(r'</body>', html, flags=re.I)
    if not body_close:
        raise SystemExit("ERROR: </body> not found")

    js_script = (
        '  <script src="/memeflow-nav.js?v=global-right-drawer-v1" defer></script>\n'
    )

    html = (
        html[:body_close.start()]
        + js_script
        + html[body_close.start():]
    )

    return html

for path in paths:
    html = inject_shared_assets(htmls[path])
    html = "\n".join(
        line.rstrip(" \t") for line in html.splitlines()
    ) + "\n"
    path.write_text(html, encoding="utf-8")

final_css = css_path.read_text(encoding="utf-8")
final_js = js_path.read_text(encoding="utf-8")
final_htmls = {p: p.read_text(encoding="utf-8") for p in paths}

checks = {
    "CSS marker": PATCH_ID in final_css,
    "JS marker": PATCH_ID in final_js,
    "two bars": final_js.count('mf-nav-toggle-line') >= 2,
    "X transform first": "transform: rotate(45deg);" in final_css,
    "X transform second": "transform: rotate(-45deg);" in final_css,
    "right drawer starts hidden":
        "transform: translate3d(105%, 0, 0);" in final_css,
    "right drawer opens":
        "transform: translate3d(0, 0, 0);" in final_css,
    "backdrop": ".mf-nav-backdrop" in final_css,
    "escape closes": "event.key === 'Escape'" in final_js,
    "System Overview item": "title: 'System Overview'" in final_js,
    "Trading item": "title: 'Trading Terminal'" in final_js,
    "Settings item": "title: 'System Settings'" in final_js,
    "Pipeline item": "title: 'Real-Time Pipeline'" in final_js,
    "preview suppression":
        "mfGalleryLive" in final_js and "mfGalleryLivePreview" in final_js,
}

for path, html in final_htmls.items():
    checks[f"{path.name} CSS link"] = (
        '/memeflow-nav.css?v=global-right-drawer-v1' in html
    )
    checks[f"{path.name} JS link"] = (
        '/memeflow-nav.js?v=global-right-drawer-v1' in html
    )
    checks[f"{path.name} marker"] = PATCH_ID in html

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit(
        "ERROR: validation failed: " + ", ".join(failed)
    )

for path in [*paths, css_path, js_path]:
    text = path.read_text(encoding="utf-8")
    bad = [
        i for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("Global Right Drawer Navigation V1 validation: PASS")
print("Pages: system / trading / settings / system-tokens")
print("Shared assets: memeflow-nav.css + memeflow-nav.js")
print("Live iframe previews suppress their nested burger automatically.")
PY

node --check "$NAV_JS"
git -C "$ROOT" diff --check -- "${EXISTING_RELS[@]}"

echo
echo "Changed:"
git -C "$ROOT" status --short -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact six menu files." >&2
    echo "Expected:" >&2
    printf '%s\n' "$EXPECTED" >&2
    echo "Actual:" >&2
    printf '%s\n' "$ACTUAL" >&2
    git -C "$ROOT" reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"

  git -C "$ROOT" fetch origin "$BRANCH"
  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while menu patch was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: shared right-drawer navigation committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: menu installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - two-line burger is added to the right side of each page header"
echo "  - burger morphs into an X"
echo "  - drawer slides in from right to left"
echo "  - backdrop / Escape / page selection closes the drawer"
echo "  - active page is marked"
echo "  - body scrolling is locked only while menu is open"
echo "  - live 3D iframe previews do not render a duplicate nested burger"
echo
echo "Clean rollback:"
echo "  ./apply_memeflow_global_right_drawer_nav_v1.sh --rollback"
echo
echo "Backup:"
echo "  $BACKUP"
