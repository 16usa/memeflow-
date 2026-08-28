#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3"
COMMIT_MESSAGE="Add swipe carousel behavior to realtime page gallery"
DO_PUSH=1

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    *)
      echo "Usage: $0 [--push|--no-push]" >&2
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
elif [[ -f "$ROOT/system.html" ]]; then
  APP="$ROOT"
else
  echo "ERROR: memeflow-app was not found." >&2
  exit 1
fi

HTML="$APP/system.html"
CSS="$APP/system.css"
JS="$APP/system.js"
for f in "$HTML" "$CSS" "$JS"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f" >&2; exit 1; }
done

echo
echo "MEMEFLOW Page Gallery SWIPE V3"
echo "Fix: add real horizontal swipe/browse behavior for the 3 page cards."
echo

grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" "$CSS" || {
  echo "ERROR: gallery V1 CSS marker not found." >&2
  exit 1
}
grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2" "$CSS" || {
  echo "ERROR: CLEAN V2 CSS marker not found." >&2
  exit 1
}
grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" "$JS" || {
  echo "ERROR: gallery V1 JS marker not found." >&2
  exit 1
}
grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2" "$JS" || {
  echo "ERROR: CLEAN V2 JS marker not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$CSS" && grep -Fq "$PATCH_ID" "$JS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || { echo "ERROR: detached HEAD." >&2; exit 1; }

REL_HTML="${HTML#"$ROOT"/}"
REL_CSS="${CSS#"$ROOT"/}"
REL_JS="${JS#"$ROOT"/}"
TARGETS=("$REL_HTML" "$REL_CSS" "$REL_JS")

for rel in "${TARGETS[@]}"; do
  if ! git -C "$ROOT" diff --quiet -- "$rel" || ! git -C "$ROOT" diff --cached --quiet -- "$rel"; then
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
    echo "Local : $LOCAL_HEAD" >&2
    echo "Remote: $REMOTE_HEAD" >&2
    echo "Nothing changed." >&2
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.patch-backups/page-gallery-swipe-v3-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$CSS" "$JS" "$BACKUP"/
echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/system.html" "$HTML"
    cp -p "$BACKUP/system.css" "$CSS"
    cp -p "$BACKUP/system.js" "$JS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_HTML="$HTML"
export MF_CSS="$CSS"
export MF_JS="$JS"

python3 <<'PY'
from pathlib import Path
import os, re

html_path = Path(os.environ["MF_HTML"])
css_path = Path(os.environ["MF_CSS"])
js_path = Path(os.environ["MF_JS"])
PATCH_ID = "MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3"

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if PATCH_ID in css or PATCH_ID in js:
    raise SystemExit("ERROR: partial SWIPE V3 marker already exists")

CSS_BLOCK = r'''
/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3 ===== */
#mfPageGallery {
  touch-action: pan-y pinch-zoom;
}

#mfPageGallery .mfpg-card {
  will-change: transform, opacity, filter;
}

#mfPageGallery.is-swipe-armed .mfpg-card {
  transition-duration: 240ms !important;
}

#mfPageGallery .mfpg-card[data-slot="hidden"] {
  opacity: 0 !important;
  pointer-events: none !important;
  transform: translate(-50%, -50%) translateZ(-180px) scale(.78) !important;
}

#mfPageGallery .mfpg-card[data-slot="left"],
#mfPageGallery .mfpg-card[data-slot="right"] {
  cursor: pointer;
}

#mfPageGallery .mfpg-card[data-slot="center"] {
  cursor: pointer;
}

#mfPageGallery .mfpg-card.is-selected-pulse {
  box-shadow:
    0 26px 58px rgba(0,0,0,.62),
    0 0 0 1px rgba(120,230,255,.18) inset,
    0 0 40px rgba(49,216,255,.28) !important;
}

.mfpg-dots {
  position: absolute;
  left: 50%;
  bottom: 4.2%;
  z-index: 12;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 7px;
  pointer-events: none;
}

.mfpg-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(124, 154, 171, .45);
  box-shadow: 0 0 0 1px rgba(84, 211, 242, .12);
  transition: transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}

.mfpg-dot.is-active {
  transform: scale(1.38);
  background: rgba(84, 220, 255, .96);
  box-shadow: 0 0 10px rgba(84, 220, 255, .36);
}

@media (max-width: 600px) {
  .mfpg-dots {
    bottom: 4.6%;
    gap: 6px;
  }

  .mfpg-dot {
    width: 5px;
    height: 5px;
  }
}
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3 ===== */
'''

JS_BLOCK = r'''
/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3 ===== */
(() => {
  'use strict';

  const PATCH_ID = 'MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3';
  const MIN_SWIPE_X = 46;
  const AXIS_LOCK_GAP = 8;
  const CLICK_SUPPRESS_MS = 320;

  function wrapIndex(index, length) {
    return ((index % length) + length) % length;
  }

  function getGalleryState() {
    const gallery = document.getElementById('mfPageGallery');
    if (!gallery) return null;
    const deck = gallery.querySelector('.mfpg-deck');
    if (!deck) return null;

    const cards = Array.from(deck.querySelectorAll('.mfpg-card'));
    if (cards.length < 3) return null;

    cards.sort((a, b) => {
      const order = { left: 0, center: 1, right: 2 };
      return (order[a.dataset.slot] ?? 99) - (order[b.dataset.slot] ?? 99);
    });

    let activeIndex = cards.findIndex(card => card.dataset.slot === 'center');
    if (activeIndex < 0) activeIndex = 1;

    return {
      gallery,
      deck,
      cards,
      activeIndex,
      swipe: null,
      suppressClickUntil: 0,
      dots: []
    };
  }

  function ensureDots(state) {
    let dotsWrap = state.gallery.querySelector('.mfpg-dots');
    if (!dotsWrap) {
      dotsWrap = document.createElement('div');
      dotsWrap.className = 'mfpg-dots';
      dotsWrap.setAttribute('aria-hidden', 'true');
      state.gallery.appendChild(dotsWrap);
    }

    dotsWrap.innerHTML = '';
    state.dots = state.cards.map(() => {
      const dot = document.createElement('span');
      dot.className = 'mfpg-dot';
      dotsWrap.appendChild(dot);
      return dot;
    });
  }

  function updateDots(state) {
    state.dots.forEach((dot, index) => {
      dot.classList.toggle('is-active', index == state.activeIndex);
    });
  }

  function render(state, pulseCard = null) {
    const n = state.cards.length;
    state.cards.forEach((card, index) => {
      const diff = (index - state.activeIndex + n) % n;
      let slot = 'hidden';
      if (diff === 0) slot = 'center';
      else if (diff === 1) slot = 'right';
      else if (diff === n - 1) slot = 'left';

      card.dataset.slot = slot;
      card.setAttribute('aria-current', slot === 'center' ? 'true' : 'false');
      card.classList.toggle('is-selected-pulse', pulseCard === card && slot === 'center');
    });
    updateDots(state);
  }

  function shift(state, direction) {
    state.activeIndex = wrapIndex(state.activeIndex + direction, state.cards.length);
    state.gallery.classList.add('is-swipe-armed');
    render(state, state.cards[state.activeIndex]);
    window.setTimeout(() => {
      state.gallery.classList.remove('is-swipe-armed');
      state.cards.forEach(card => card.classList.remove('is-selected-pulse'));
    }, 260);
  }

  function focusCard(state, card) {
    const nextIndex = state.cards.indexOf(card);
    if (nextIndex < 0 || nextIndex === state.activeIndex) return false;
    state.activeIndex = nextIndex;
    state.gallery.classList.add('is-swipe-armed');
    render(state, card);
    window.setTimeout(() => {
      state.gallery.classList.remove('is-swipe-armed');
      state.cards.forEach(item => item.classList.remove('is-selected-pulse'));
    }, 260);
    return true;
  }

  function installInteraction(state) {
    ensureDots(state);
    render(state);

    state.gallery.addEventListener('click', event => {
      const card = event.target.closest('.mfpg-card');
      if (!card) return;

      if (Date.now() < state.suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (card.dataset.slot !== 'center') {
        event.preventDefault();
        event.stopImmediatePropagation();
        focusCard(state, card);
      }
    }, true);

    let startX = 0;
    let startY = 0;
    let axis = null;

    state.gallery.addEventListener('touchstart', event => {
      if (!event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      axis = null;
    }, { passive: true });

    state.gallery.addEventListener('touchmove', event => {
      if (!event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (axis == null) {
        if (Math.abs(dx) > Math.abs(dy) + AXIS_LOCK_GAP) axis = 'x';
        else if (Math.abs(dy) > Math.abs(dx) + AXIS_LOCK_GAP) axis = 'y';
      }

      if (axis === 'x') {
        event.preventDefault();
      }
    }, { passive: false });

    state.gallery.addEventListener('touchend', event => {
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const horizontal = Math.abs(dx) > Math.abs(dy) + AXIS_LOCK_GAP;

      if (horizontal && Math.abs(dx) >= MIN_SWIPE_X) {
        state.suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
        shift(state, dx < 0 ? 1 : -1);
      }

      axis = null;
    }, { passive: true });

    state.gallery.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        shift(state, -1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        shift(state, 1);
      }
    });

    console.log(`[PAGE-GALLERY] ${PATCH_ID} mounted`);
  }

  function boot() {
    const state = getGalleryState();
    if (!state || state.gallery.dataset.swipeReady === '1') return;
    state.gallery.dataset.swipeReady = '1';
    installInteraction(state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.setTimeout(boot, 0);
      window.setTimeout(boot, 350);
    }, { once: true });
  } else {
    window.setTimeout(boot, 0);
    window.setTimeout(boot, 350);
  }
})();
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3 ===== */
'''

css = css.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"
js = js.rstrip() + "\n\n" + JS_BLOCK.strip() + "\n"

html, css_count = re.subn(
    r'href="/system\.css(?:\?[^"]*)?"',
    'href="/system.css?v=page-gallery-swipe-v3"',
    html,
    count=1
)
html, js_count = re.subn(
    r'src="/system\.js(?:\?[^"]*)?"',
    'src="/system.js?v=page-gallery-swipe-v3"',
    html,
    count=1
)

if css_count != 1:
    raise SystemExit(f"ERROR: expected one system.css reference, found {css_count}")
if js_count != 1:
    raise SystemExit(f"ERROR: expected one system.js reference, found {js_count}")

html_path.write_text(html, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')

final_html = html_path.read_text(encoding='utf-8')
final_css = css_path.read_text(encoding='utf-8')
final_js = js_path.read_text(encoding='utf-8')
checks = {
    'gallery v1 kept': 'MEMEFLOW_REALTIME_PAGE_GALLERY_V1' in final_js and 'MEMEFLOW_REALTIME_PAGE_GALLERY_V1' in final_css,
    'clean v2 kept': 'MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2' in final_js and 'MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2' in final_css,
    'swipe v3 css': PATCH_ID in final_css,
    'swipe v3 js': PATCH_ID in final_js,
    'touch events': 'touchstart' in final_js and 'touchmove' in final_js and 'touchend' in final_js,
    'focus side cards': "card.dataset.slot !== 'center'" in final_js,
    'dots added': 'mfpg-dots' in final_css and 'mfpg-dots' in final_js,
    'cache bust css': '/system.css?v=page-gallery-swipe-v3' in final_html,
    'cache bust js': '/system.js?v=page-gallery-swipe-v3' in final_html,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('ERROR: validation failed: ' + ', '.join(failed))
print('SWIPE V3 validation: PASS')
PY

node --check "$JS"
git -C "$ROOT" diff --check -- "${TARGETS[@]}"

echo
echo "Expected diff:"
git -C "$ROOT" diff --stat -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"
  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact three SWIPE V3 files." >&2
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
    echo "ERROR: origin/$BRANCH changed while SWIPE V3 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"
  echo
  echo "SUCCESS: SWIPE V3 committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: SWIPE V3 installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - horizontal swipe rotates the 3 page cards"
echo "  - tap a side card to bring it to center"
echo "  - tap the centered card to open that page"
echo "  - vertical page scrolling is preserved"
echo "Backup: $BACKUP"
