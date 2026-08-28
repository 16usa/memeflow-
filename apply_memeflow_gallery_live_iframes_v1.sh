#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_GALLERY_LIVE_IFRAMES_V1"
COMMIT_MESSAGE="[MEMEFLOW_GALLERY_LIVE_IFRAMES_V1] Show live pages in System Overview"
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

HTML="$APP/system.html"
CSS="$APP/system.css"
JS="$APP/system.js"

for f in "$HTML" "$CSS" "$JS"; do
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

# ---------------------------------------------------------------------------
# CLEAN ROLLBACK MODE
# Reverts only this patch commit, leaving later unrelated commits intact.
# ---------------------------------------------------------------------------
if [[ "$ROLLBACK" == "1" ]]; then
  echo
  echo "MEMEFLOW Live Gallery rollback"
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

  LIVE_COMMIT="$(
    git -C "$ROOT" log \
      --format='%H' \
      --grep='^\[MEMEFLOW_GALLERY_LIVE_IFRAMES_V1\] Show live pages in System Overview$' \
      -n 1
  )"

  if [[ -z "$LIVE_COMMIT" ]]; then
    echo "ERROR: live-gallery install commit was not found." >&2
    exit 1
  fi

  if git -C "$ROOT" log --format='%s' "$LIVE_COMMIT"..HEAD | \
      grep -Fq "Revert \"[MEMEFLOW_GALLERY_LIVE_IFRAMES_V1] Show live pages in System Overview\""; then
    echo "Already rolled back."
    exit 0
  fi

  echo "Reverting install commit: $LIVE_COMMIT"
  git -C "$ROOT" revert --no-edit "$LIVE_COMMIT"

  if [[ "$DO_PUSH" == "1" ]]; then
    git -C "$ROOT" push origin "$BRANCH"
  fi

  echo
  echo "SUCCESS: live previews were cleanly rolled back."
  echo "The gallery is back to the exact pre-live implementation."
  exit 0
fi

echo
echo "MEMEFLOW Live System Overview V1"
echo "Replaces 5-minute screenshot captures with true live same-origin pages."
echo
echo "Live cards:"
echo "  Trading Terminal  -> /trading.html"
echo "  System Settings   -> /settings.html"
echo "  Real-Time Pipeline -> /system-tokens.html"
echo
echo "Static WEBP images remain underneath as instant fallback."
echo

grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" "$JS" || {
  echo "ERROR: gallery V1 was not found in system.js." >&2
  exit 1
}

grep -Fq "MEMEFLOW_GALLERY_AUTO_SNAPSHOTS_5M_V1" "$JS" || {
  echo "ERROR: current 5-minute snapshot patch was not found." >&2
  echo "This installer expects the exact current state so rollback is clean." >&2
  exit 1
}

grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3" "$CSS" || {
  echo "ERROR: swipe gallery CSS was not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$JS" || grep -Fq "$PATCH_ID" "$CSS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

REL_HTML="${HTML#"$ROOT"/}"
REL_CSS="${CSS#"$ROOT"/}"
REL_JS="${JS#"$ROOT"/}"
TARGETS=("$REL_HTML" "$REL_CSS" "$REL_JS")

for rel in "${TARGETS[@]}"; do
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
BACKUP="$ROOT/.patch-backups/gallery-live-iframes-v1-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$CSS" "$JS" "$BACKUP"/
echo "Exact pre-live backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-live files..."
    cp -p "$BACKUP/system.html" "$HTML"
    cp -p "$BACKUP/system.css" "$CSS"
    cp -p "$BACKUP/system.js" "$JS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_SYSTEM_HTML="$HTML"
export MF_SYSTEM_CSS="$CSS"
export MF_SYSTEM_JS="$JS"

python3 <<'PY'
from pathlib import Path
import os
import re

html_path = Path(os.environ["MF_SYSTEM_HTML"])
css_path = Path(os.environ["MF_SYSTEM_CSS"])
js_path = Path(os.environ["MF_SYSTEM_JS"])

PATCH_ID = "MEMEFLOW_GALLERY_LIVE_IFRAMES_V1"
OLD_ID = "MEMEFLOW_GALLERY_AUTO_SNAPSHOTS_5M_V1"

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if PATCH_ID in js or PATCH_ID in css:
    raise SystemExit("ERROR: partial live-gallery marker already exists")

# ---------------------------------------------------------------------
# Remove the complete 5-minute screenshot engine.
# It downloaded html2canvas, opened temporary frames, rasterized them and
# replaced image src values. None of that should run beside true live frames.
# ---------------------------------------------------------------------
old_block_re = re.compile(
    r'\n?/\* ===== MEMEFLOW_GALLERY_AUTO_SNAPSHOTS_5M_V1 ===== \*/'
    r'.*?'
    r'/\* ===== /MEMEFLOW_GALLERY_AUTO_SNAPSHOTS_5M_V1 ===== \*/\s*',
    re.S,
)

js, removed = old_block_re.subn("\n", js, count=1)

if removed != 1:
    raise SystemExit(
        f"ERROR: expected exactly one 5-minute snapshot block, removed {removed}"
    )

LIVE_JS = r'''
/* ===== MEMEFLOW_GALLERY_LIVE_IFRAMES_V1 ===== */
(() => {
  'use strict';

  /*
    TRUE LIVE PREVIEWS

    Each existing 3D gallery card keeps its WEBP <img> as a fallback.
    A same-origin iframe is mounted above that image and renders the actual
    page continuously. Because the iframe itself has pointer-events:none,
    all existing swipe/click/navigation behavior stays owned by the card.

    This is deliberately NOT a screenshot loop:
      - no html2canvas
      - no polling interval
      - no rasterization
      - no 5-minute refresh
      - the embedded page simply stays alive while System View is open
  */

  const PATCH_ID = 'MEMEFLOW_GALLERY_LIVE_IFRAMES_V1';
  const BASE_WIDTH = 390;
  const BASE_HEIGHT = 844;
  const LOAD_FADE_DELAY_MS = 450;

  const LIVE_PAGES = {
    'Trading Terminal': '/trading.html',
    'System Settings': '/settings.html',
    'Real-Time Pipeline': '/system-tokens.html'
  };

  const states = new Map();
  let resizeObserver = null;
  let stopped = false;

  function previewUrl(path) {
    const url = new URL(path, window.location.origin);
    url.searchParams.set('mfGalleryLive', '1');
    return url.href;
  }

  function cardTitle(card) {
    return String(
      card.querySelector('.mfpg-title')?.textContent || ''
    ).trim();
  }

  function scaleFrame(state) {
    const { card, frame } = state;
    if (!card?.isConnected || !frame?.isConnected) return;

    const width = Math.max(1, card.clientWidth);
    const height = Math.max(1, card.clientHeight);

    // Match the old object-fit:cover behavior:
    // fill the complete card, crop only what does not fit.
    const scale = Math.max(
      width / BASE_WIDTH,
      height / BASE_HEIGHT
    );

    frame.style.transform =
      `translate(-50%, -50%) scale(${scale.toFixed(5)})`;
  }

  function makeLiveLayer(card, title, path) {
    const shot = card.querySelector('.mfpg-shot');
    if (!shot) return null;

    const layer = document.createElement('span');
    layer.className = 'mfpg-live-viewport';
    layer.setAttribute('aria-hidden', 'true');

    const frame = document.createElement('iframe');
    frame.className = 'mfpg-live-frame';
    frame.src = previewUrl(path);
    frame.width = String(BASE_WIDTH);
    frame.height = String(BASE_HEIGHT);
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('title', `${title} live preview`);
    frame.setAttribute('loading', 'eager');

    // Important: no sandbox here. These are same-origin app pages and must
    // retain the same cookies/session/API/SSE/WebSocket behavior as when
    // opened normally.
    layer.appendChild(frame);

    // Put live page after the fallback image but before labels/pulse.
    shot.insertAdjacentElement('afterend', layer);

    const state = {
      card,
      layer,
      frame,
      title,
      path,
      loaded: false
    };

    frame.addEventListener('load', () => {
      if (stopped || !layer.isConnected) return;

      state.loaded = true;
      scaleFrame(state);

      window.setTimeout(() => {
        if (
          !stopped &&
          layer.isConnected &&
          state.loaded
        ) {
          layer.classList.add('is-live');
          card.dataset.mfLivePreview = 'ready';
        }
      }, LOAD_FADE_DELAY_MS);
    });

    frame.addEventListener('error', () => {
      card.dataset.mfLivePreview = 'fallback';
      layer.classList.remove('is-live');
    });

    return state;
  }

  function mount() {
    if (stopped) return true;

    const gallery = document.getElementById('mfPageGallery');
    if (!gallery) return false;

    const cards = Array.from(
      gallery.querySelectorAll('.mfpg-card')
    );

    if (cards.length < 3) return false;

    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const state = states.get(entry.target);
        if (state) scaleFrame(state);
      }
    });

    for (const card of cards) {
      const title = cardTitle(card);
      const path = LIVE_PAGES[title];
      if (!path || states.has(card)) continue;

      const state = makeLiveLayer(card, title, path);
      if (!state) continue;

      states.set(card, state);
      resizeObserver.observe(card);
      scaleFrame(state);
    }

    gallery.dataset.mfLivePages = '1';
    gallery.dataset.mfLiveMode = 'continuous';
    gallery.dataset.mfLivePageCount = String(states.size);

    console.log(
      `[PAGE-GALLERY] ${PATCH_ID} mounted; live pages=${states.size}`
    );

    return states.size >= 3;
  }

  function boot() {
    let attempts = 0;

    const timer = window.setInterval(() => {
      attempts += 1;

      if (mount() || attempts >= 100) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  function destroy() {
    stopped = true;

    try {
      resizeObserver?.disconnect();
    } catch (_) {}

    for (const state of states.values()) {
      try {
        state.frame.src = 'about:blank';
      } catch (_) {}

      try {
        state.layer.remove();
      } catch (_) {}
    }

    states.clear();
  }

  // Pages keep updating naturally while visible. On return from background,
  // only re-scale them; do not reload them and lose their live state.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      for (const state of states.values()) {
        scaleFrame(state);
      }
    }
  });

  window.addEventListener('pagehide', destroy, { once: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {
      once: true
    });
  } else {
    boot();
  }
})();
/* ===== /MEMEFLOW_GALLERY_LIVE_IFRAMES_V1 ===== */
'''

js = js.rstrip() + "\n\n" + LIVE_JS.strip() + "\n"

LIVE_CSS = r'''
/* ===== MEMEFLOW_GALLERY_LIVE_IFRAMES_V1 ===== */

/*
  Live page sits exactly where the old screenshot sits.
  WEBP remains below it as zero-cost instant fallback.
*/
#mfPageGallery .mfpg-card {
  isolation: isolate;
}

#mfPageGallery .mfpg-shot {
  position: relative;
  z-index: 0;
}

#mfPageGallery .mfpg-live-viewport {
  position: absolute;
  inset: 0;
  z-index: 1;

  display: block;
  overflow: hidden;

  border-radius: inherit;
  background: #0f141a;

  opacity: 0;
  visibility: hidden;

  pointer-events: none !important;
  user-select: none;
  -webkit-user-select: none;

  transition:
    opacity 260ms ease,
    visibility 260ms ease;
}

#mfPageGallery .mfpg-live-viewport.is-live {
  opacity: 1;
  visibility: visible;
}

#mfPageGallery .mfpg-live-frame {
  position: absolute;
  left: 50%;
  top: 50%;

  width: 390px !important;
  height: 844px !important;
  min-width: 390px !important;
  min-height: 844px !important;

  margin: 0;
  padding: 0;
  border: 0;

  transform-origin: center center;

  background: #0f141a;

  pointer-events: none !important;
  user-select: none;
  -webkit-user-select: none;
}

/* Labels and launch FX must always stay above the living page. */
#mfPageGallery .mfpg-label,
#mfPageGallery .mfpg-pulse {
  position: relative;
  z-index: 5;
}

/*
  Prevent the embedded document from stealing touch gestures even on Safari.
  Parent .mfpg-card remains the click/swipe target.
*/
#mfPageGallery iframe.mfpg-live-frame {
  touch-action: none !important;
}

/* ===== /MEMEFLOW_GALLERY_LIVE_IFRAMES_V1 ===== */
'''

css = css.rstrip() + "\n\n" + LIVE_CSS.strip() + "\n"

# Cache bust only changed runtime files.
html, css_count = re.subn(
    r'href="/system\.css(?:\?[^"]*)?"',
    'href="/system.css?v=gallery-live-iframes-v1"',
    html,
    count=1
)

html, js_count = re.subn(
    r'src="/system\.js(?:\?[^"]*)?"',
    'src="/system.js?v=gallery-live-iframes-v1"',
    html,
    count=1
)

if css_count != 1:
    raise SystemExit(
        f"ERROR: expected one system.css reference, found {css_count}"
    )

if js_count != 1:
    raise SystemExit(
        f"ERROR: expected one system.js reference, found {js_count}"
    )

def clean(text: str) -> str:
    return "\n".join(line.rstrip(" \t") for line in text.splitlines()) + "\n"

html = clean(html)
css = clean(css)
js = clean(js)

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
final_css = css_path.read_text(encoding="utf-8")
final_js = js_path.read_text(encoding="utf-8")

checks = {
    "5-minute engine removed":
        OLD_ID not in final_js,
    "html2canvas removed":
        "html2canvas@1.4.1" not in final_js,
    "live JS installed":
        PATCH_ID in final_js,
    "live CSS installed":
        PATCH_ID in final_css,
    "Trading live":
        "'Trading Terminal': '/trading.html'" in final_js,
    "Settings live":
        "'System Settings': '/settings.html'" in final_js,
    "Pipeline live":
        "'Real-Time Pipeline': '/system-tokens.html'" in final_js,
    "iframe pointer events off":
        "pointer-events: none !important;" in final_css,
    "WEBP fallback preserved":
        "/memeflow-gallery/trading-terminal.webp" in final_js
        and "/memeflow-gallery/system-settings.webp" in final_js
        and "/memeflow-gallery/live-token-states.webp" in final_js,
    "swipe preserved":
        "MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3" in final_js,
    "caption preserved":
        "MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6" in final_js,
    "CSS cache bust":
        "/system.css?v=gallery-live-iframes-v1" in final_html,
    "JS cache bust":
        "/system.js?v=gallery-live-iframes-v1" in final_html,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit(
        "ERROR: validation failed: " + ", ".join(failed)
    )

for path, text in (
    (html_path, final_html),
    (css_path, final_css),
    (js_path, final_js),
):
    bad = [
        i
        for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("Live Gallery V1 structural validation: PASS")
print("Removed: 5-minute screenshot engine")
print("Installed: 3 continuous same-origin live iframe previews")
print("Preserved: WEBP fallback + 3D + swipe + click + captions")
PY

node --check "$JS"
git -C "$ROOT" diff --check -- "${TARGETS[@]}"

echo
echo "Changed:"
git -C "$ROOT" status --short -- "${TARGETS[@]}"
git -C "$ROOT" diff --stat -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact three live-gallery files." >&2
    git -C "$ROOT" reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"

  git -C "$ROOT" fetch origin "$BRANCH"
  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while patch was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: live System Overview previews committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: live previews installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - previews are actual live pages, not screenshots"
echo "  - Trading / Settings / Pipeline stay live continuously"
echo "  - WEBP screenshots remain underneath as fallback"
echo "  - existing 3D swipe/click behavior is preserved"
echo "  - the old 5-minute snapshot engine is removed"
echo
echo "Clean rollback command:"
echo "  ./$0 --rollback"
echo
echo "Or, using this downloaded filename:"
echo "  ./apply_memeflow_gallery_live_iframes_v1.sh --rollback"
echo
echo "Exact pre-live backup:"
echo "  $BACKUP"
