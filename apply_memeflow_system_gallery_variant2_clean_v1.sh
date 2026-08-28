#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_SYSTEM_GALLERY_VARIANT2_CLEAN_V1"
COMMIT_MESSAGE="[MEMEFLOW_SYSTEM_GALLERY_VARIANT2_CLEAN_V1] Install clean horizontal live gallery"
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

if [[ "$ROLLBACK" == "1" ]]; then
  echo
  echo "MEMEFLOW Variant 2 gallery rollback"
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
      --grep='^\[MEMEFLOW_SYSTEM_GALLERY_VARIANT2_CLEAN_V1\] Install clean horizontal live gallery$' \
      -n 1
  )"

  if [[ -z "$INSTALL_COMMIT" ]]; then
    echo "ERROR: Variant 2 install commit was not found." >&2
    exit 1
  fi

  echo "Reverting Variant 2 commit: $INSTALL_COMMIT"
  git -C "$ROOT" revert --no-edit "$INSTALL_COMMIT"

  if [[ "$DO_PUSH" == "1" ]]; then
    git -C "$ROOT" push origin "$BRANCH"
  fi

  echo
  echo "SUCCESS: Variant 2 was cleanly removed."
  echo "The System Overview gallery is back to the exact pre-Variant-2 state."
  exit 0
fi

echo
echo "MEMEFLOW System Overview — Variant 2 / Clean Horizontal Gallery"
echo
echo "Design target:"
echo "  - active live page slightly larger and front-facing"
echo "  - left/right live pages smaller, farther back and subtly dimmed"
echo "  - mild 3D angle only; no heavy scanner frame/background"
echo "  - existing swipe, live iframe updates and click navigation stay intact"
echo "  - ONE consolidated gallery CSS layer replaces old stacked gallery layers"
echo

grep -Fq 'MEMEFLOW_REALTIME_PAGE_GALLERY_V1' "$JS" || {
  echo "ERROR: base gallery JS is missing." >&2
  exit 1
}
grep -Fq 'MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3' "$JS" || {
  echo "ERROR: gallery swipe JS is missing." >&2
  exit 1
}
grep -Fq 'MEMEFLOW_GALLERY_LIVE_IFRAMES_V1' "$JS" || {
  echo "ERROR: live iframe gallery JS is missing." >&2
  exit 1
}
grep -Fq 'mf-system-page-flow-v2' "$HTML" || {
  echo "ERROR: current simplified System page flow is missing." >&2
  exit 1
}
grep -Fq 'mf-page-gallery-host' "$HTML" || {
  echo "ERROR: System gallery host is missing." >&2
  exit 1
}
grep -Fq 'MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1' "$HTML" || {
  echo "ERROR: current burger navigation is missing." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$HTML" || grep -Fq "$PATCH_ID" "$CSS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

REL_HTML="${HTML#"$ROOT"/}"
REL_CSS="${CSS#"$ROOT"/}"
TARGETS=("$REL_HTML" "$REL_CSS")

for rel in "${TARGETS[@]}"; do
  if ! git -C "$ROOT" diff --quiet -- "$rel" || \
     ! git -C "$ROOT" diff --cached --quiet -- "$rel"; then
    echo "ERROR: target file has local/staged edits: $rel" >&2
    echo "Commit or stash them first; nothing was changed." >&2
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
BACKUP="$ROOT/.patch-backups/system-gallery-variant2-clean-v1-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$BACKUP/system.html"
cp -p "$CSS" "$BACKUP/system.css"

echo "Exact pre-Variant-2 backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/system.html" "$HTML"
    cp -p "$BACKUP/system.css" "$CSS"
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

PATCH_ID = "MEMEFLOW_SYSTEM_GALLERY_VARIANT2_CLEAN_V1"

html_path = Path(os.environ["MF_SYSTEM_HTML"])
css_path = Path(os.environ["MF_SYSTEM_CSS"])
js_path = Path(os.environ["MF_SYSTEM_JS"])

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if PATCH_ID in html or PATCH_ID in css:
    raise SystemExit("ERROR: partial Variant 2 marker already exists")

OLD_STYLE_BLOCKS = [
    "MEMEFLOW_REALTIME_PAGE_GALLERY_V1",
    "MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2",
    "MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3",
    "MEMEFLOW_REALTIME_PAGE_GALLERY_CHROME_OFF_V4",
    "MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6",
    "MEMEFLOW_GALLERY_LIVE_IFRAMES_V1",
    "MEMEFLOW_CAPTION_FLOW_FIX_V1",
    "MEMEFLOW_SYSTEM_PAGE_FLOW_REFRESH_V2",
]

def remove_marked_block(text: str, marker: str):
    pattern = re.compile(
        rf"\n?/\* ===== {re.escape(marker)}(?: =====)?(?:.*?)\*/"
        rf".*?"
        rf"/\* ===== /{re.escape(marker)}(?: =====)? \*/\s*",
        re.S,
    )
    return pattern.subn("\n", text, count=1)

for marker in OLD_STYLE_BLOCKS:
    css, count = remove_marked_block(css, marker)
    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one CSS block {marker}, removed {count}. "
            "Nothing will be left partially installed."
        )

old_viewport_open = (
    '<section class="viewport-wrap mf-true3d-clean-v3 '
    'mf-page-gallery-host mf-page-gallery-clean-v2">'
)
new_viewport_open = (
    '<section class="viewport-wrap mf-true3d-clean-v3 '
    'mf-page-gallery-host mf-page-gallery-clean-v2 mfpg-variant2-clean-v1">'
)

if html.count(old_viewport_open) != 1:
    raise SystemExit("ERROR: expected the current System gallery <section> exactly once")

html = html.replace(old_viewport_open, new_viewport_open, 1)

html, css_link_count = re.subn(
    r'href="/system\.css(?:\?[^"]*)?"',
    'href="/system.css?v=gallery-variant2-clean-v1"',
    html,
    count=1,
)

if css_link_count != 1:
    raise SystemExit(
        f"ERROR: expected exactly one /system.css link, found {css_link_count}"
    )

html = html.replace(
    "</head>",
    f"  <!-- {PATCH_ID} -->\n</head>",
    1,
)

FINAL_CSS = r'''
/* ===== MEMEFLOW_SYSTEM_GALLERY_VARIANT2_CLEAN_V1 ===== */
/*
  FINAL, CONSOLIDATED System Overview gallery presentation.

  Target: Variant 2 from the approved mockup.
  - clean horizontal spatial gallery
  - center live screen is slightly larger / nearer
  - side live screens are slightly smaller / farther / dimmer
  - very mild perspective, not the old aggressive 3D scanner
  - no black gallery tray, no frame around the module, no scan line
  - same live iframe content, swipe and click logic as before

  This replaces eight older gallery/layout CSS layers. Do not stack another
  gallery design layer on top of this block; edit this block instead.
*/

.system-shell.mf-system-page-flow-v2 {
  display: block !important;
  width: 100% !important;
  height: auto !important;
  min-height: 100dvh !important;
  overflow: visible !important;
  grid-template-rows: none !important;
  grid-auto-rows: auto !important;
  align-content: initial !important;
  touch-action: pan-y pinch-zoom !important;
}

.system-shell.mf-system-page-flow-v2 > .topbar {
  margin: 0 !important;
}

.system-shell.mf-system-page-flow-v2
> .viewport-wrap.mfpg-variant2-clean-v1 {
  position: relative !important;
  display: block !important;
  flex: none !important;
  width: 100% !important;
  height: clamp(520px, 72dvh, 720px) !important;
  min-height: clamp(520px, 72dvh, 720px) !important;
  max-height: 720px !important;
  margin: 8px 0 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  isolation: isolate;
  border: 0 !important;
  border-radius: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
}

.system-shell.mf-system-page-flow-v2
> .viewport-wrap.mfpg-variant2-clean-v1::before,
.system-shell.mf-system-page-flow-v2
> .viewport-wrap.mfpg-variant2-clean-v1::after {
  display: none !important;
  content: none !important;
}

.viewport-wrap.mfpg-variant2-clean-v1 > #systemCanvas,
.viewport-wrap.mfpg-variant2-clean-v1 > #memeflowTrue3DHost,
.viewport-wrap.mfpg-variant2-clean-v1 > .scene-labels,
.viewport-wrap.mfpg-variant2-clean-v1 > .scene-hint,
.viewport-wrap.mfpg-variant2-clean-v1 > .mf-flow-v4,
.viewport-wrap.mfpg-variant2-clean-v1 .mf-flow-v4,
.viewport-wrap.mfpg-variant2-clean-v1 .mf-flow-v4 canvas,
.viewport-wrap.mfpg-variant2-clean-v1 .mf-flow-v4-topline,
.viewport-wrap.mfpg-variant2-clean-v1 .mf-flow-v4-foot {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.viewport-wrap.mfpg-variant2-clean-v1 #mfPageGallery {
  --mfpg-rx: 0deg;
  --mfpg-ry: 0deg;
  position: absolute;
  inset: 0;
  z-index: 100;
  display: grid !important;
  place-items: center;
  overflow: visible !important;
  perspective: 1500px;
  perspective-origin: 50% 48%;
  background: transparent !important;
  opacity: 1 !important;
  visibility: visible !important;
  touch-action: pan-y pinch-zoom !important;
  user-select: none;
  -webkit-user-select: none;
}

.viewport-wrap.mfpg-variant2-clean-v1 #mfPageGallery::before,
.viewport-wrap.mfpg-variant2-clean-v1 #mfPageGallery::after {
  display: none !important;
  content: none !important;
}

.mfpg-variant2-clean-v1 .mfpg-head {
  position: absolute;
  top: 3.6%;
  left: 50%;
  z-index: 12;
  transform: translateX(-50%);
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
}

.mfpg-variant2-clean-v1 .mfpg-kicker {
  display: block;
  color: #55d9ff;
  font-size: clamp(8px, 1.02vw, 11px);
  line-height: 1;
  font-weight: 850;
  letter-spacing: .18em;
  text-transform: uppercase;
  text-shadow: 0 0 14px rgba(85, 217, 255, .20);
}

.mfpg-variant2-clean-v1 .mfpg-sub {
  display: block;
  margin-top: 7px;
  color: rgba(159, 178, 190, .74);
  font-size: clamp(7px, .9vw, 10px);
  line-height: 1;
  font-weight: 560;
  letter-spacing: .08em;
}

.mfpg-variant2-clean-v1 .mfpg-deck {
  position: absolute;
  inset: 11.5% 0 8.5%;
  z-index: 5;
  transform-style: preserve-3d;
  transform: rotateX(var(--mfpg-rx)) rotateY(var(--mfpg-ry));
  transition: transform 180ms ease-out;
}

.mfpg-variant2-clean-v1 .mfpg-card {
  appearance: none;
  -webkit-appearance: none;
  position: absolute;
  left: 50%;
  top: 50%;
  height: min(84%, 610px);
  width: auto;
  aspect-ratio: 390 / 844;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(84, 215, 246, .28);
  border-radius: clamp(12px, 1.45vw, 17px);
  outline: 0;
  background: #111820;
  color: #eef5fa;
  isolation: isolate;
  cursor: pointer;
  transform-style: preserve-3d;
  transform-origin: 50% 50%;
  will-change: transform, opacity, filter;
  box-shadow:
    0 20px 48px rgba(0, 0, 0, .42),
    0 0 0 1px rgba(112, 226, 255, .035) inset;
  transition:
    transform 340ms cubic-bezier(.22,.82,.21,1),
    opacity 260ms ease,
    filter 260ms ease,
    border-color 240ms ease,
    box-shadow 280ms ease;
  -webkit-tap-highlight-color: transparent;
}

.mfpg-variant2-clean-v1 .mfpg-card[data-slot="center"] {
  z-index: 6;
  opacity: 1;
  filter: saturate(.96) brightness(.96);
  border-color: rgba(85, 220, 255, .64);
  transform:
    translate(-50%, -50%)
    translateZ(70px)
    scale(1.055);
  box-shadow:
    0 26px 62px rgba(0, 0, 0, .54),
    0 0 0 1px rgba(112, 226, 255, .07) inset,
    0 0 30px rgba(46, 211, 255, .105);
}

.mfpg-variant2-clean-v1 .mfpg-card[data-slot="left"] {
  z-index: 2;
  opacity: .62;
  filter: saturate(.74) brightness(.73);
  transform:
    translate(-50%, -50%)
    translateX(-73%)
    rotateY(6deg)
    translateZ(-78px)
    scale(.86);
}

.mfpg-variant2-clean-v1 .mfpg-card[data-slot="right"] {
  z-index: 2;
  opacity: .62;
  filter: saturate(.74) brightness(.73);
  transform:
    translate(-50%, -50%)
    translateX(73%)
    rotateY(-6deg)
    translateZ(-78px)
    scale(.86);
}

.mfpg-variant2-clean-v1 .mfpg-card[data-slot="hidden"] {
  z-index: 0;
  opacity: 0 !important;
  pointer-events: none !important;
  filter: brightness(.5);
  transform:
    translate(-50%, -50%)
    translateZ(-220px)
    scale(.72) !important;
}

.mfpg-variant2-clean-v1 .mfpg-card:hover,
.mfpg-variant2-clean-v1 .mfpg-card:focus-visible,
.mfpg-variant2-clean-v1 .mfpg-card.is-hovered {
  outline: none;
  border-color: rgba(85, 220, 255, .78);
  filter: saturate(.98) brightness(.98);
}

.mfpg-variant2-clean-v1 .mfpg-card[data-slot="left"]:hover,
.mfpg-variant2-clean-v1 .mfpg-card[data-slot="left"]:focus-visible {
  opacity: .79;
  transform:
    translate(-50%, -50%)
    translateX(-71%)
    rotateY(4deg)
    translateZ(-18px)
    scale(.89);
}

.mfpg-variant2-clean-v1 .mfpg-card[data-slot="center"]:hover,
.mfpg-variant2-clean-v1 .mfpg-card[data-slot="center"]:focus-visible {
  transform:
    translate(-50%, -50%)
    translateZ(88px)
    scale(1.07);
}

.mfpg-variant2-clean-v1 .mfpg-card[data-slot="right"]:hover,
.mfpg-variant2-clean-v1 .mfpg-card[data-slot="right"]:focus-visible {
  opacity: .79;
  transform:
    translate(-50%, -50%)
    translateX(71%)
    rotateY(-4deg)
    translateZ(-18px)
    scale(.89);
}

.mfpg-variant2-clean-v1 .mfpg-card::before,
.mfpg-variant2-clean-v1 .mfpg-card::after {
  display: none !important;
  content: none !important;
}

.mfpg-variant2-clean-v1 .mfpg-shot {
  position: relative;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  border-radius: inherit;
  background: #111820;
  pointer-events: none;
}

.mfpg-variant2-clean-v1 .mfpg-live-viewport {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  overflow: hidden;
  border-radius: inherit;
  background: #111820;
  opacity: 0;
  visibility: hidden;
  pointer-events: none !important;
  user-select: none;
  -webkit-user-select: none;
  transition:
    opacity 240ms ease,
    visibility 240ms ease;
}

.mfpg-variant2-clean-v1 .mfpg-live-viewport.is-live {
  opacity: 1;
  visibility: visible;
}

.mfpg-variant2-clean-v1 .mfpg-live-frame {
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
  background: #111820;
  pointer-events: none !important;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none !important;
}

.mfpg-variant2-clean-v1 .mfpg-label {
  display: none !important;
}

.mfpg-variant2-clean-v1 .mfpg-card.is-selected-pulse {
  border-color: rgba(85, 224, 255, .86) !important;
  box-shadow:
    0 28px 68px rgba(0, 0, 0, .56),
    0 0 0 1px rgba(120, 230, 255, .14) inset,
    0 0 34px rgba(49, 216, 255, .20) !important;
}

.mfpg-variant2-clean-v1 .mfpg-card.is-launching {
  z-index: 30 !important;
  opacity: 1 !important;
  filter: brightness(1.02) saturate(1) !important;
  border-color: rgba(91, 231, 255, .94) !important;
  transform:
    translate(-50%, -50%)
    translateZ(190px)
    scale(1.12) !important;
  box-shadow:
    0 32px 82px rgba(0, 0, 0, .65),
    0 0 44px rgba(56, 221, 255, .24) !important;
}

.mfpg-variant2-clean-v1 #mfPageGallery.is-leaving
.mfpg-card:not(.is-launching) {
  opacity: .08 !important;
  filter: blur(1.5px) brightness(.50) !important;
  transform:
    translate(-50%, -50%)
    translateZ(-180px)
    scale(.76) !important;
}

.mfpg-variant2-clean-v1 .mfpg-pulse {
  position: absolute;
  z-index: 8;
  left: 50%;
  top: 50%;
  width: 36px;
  height: 36px;
  margin: -18px;
  border: 1px solid rgba(104, 230, 255, .72);
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  transform: scale(.2);
}

.mfpg-variant2-clean-v1 .mfpg-card.is-launching .mfpg-pulse {
  animation: mfpgVariant2Pulse 360ms ease-out forwards;
}

@keyframes mfpgVariant2Pulse {
  from { opacity: .82; transform: scale(.2); }
  to { opacity: 0; transform: scale(5.2); }
}

.mfpg-variant2-clean-v1 #mfPageGallery.is-swipe-armed .mfpg-card {
  transition-duration: 240ms !important;
}

.mfpg-variant2-clean-v1 .mfpg-dots {
  position: absolute;
  left: 50%;
  bottom: 2.4%;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 8px;
  transform: translateX(-50%);
  pointer-events: none;
}

.mfpg-variant2-clean-v1 .mfpg-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(116, 145, 162, .40);
  box-shadow: 0 0 0 1px rgba(84, 211, 242, .10);
  transition:
    transform 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.mfpg-variant2-clean-v1 .mfpg-dot.is-active {
  transform: scale(1.34);
  background: rgba(84, 220, 255, .96);
  box-shadow: 0 0 11px rgba(84, 220, 255, .32);
}

.system-shell.mf-system-page-flow-v2 > .mfpg-caption {
  position: relative !important;
  inset: auto !important;
  display: block !important;
  clear: both !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  margin: 0 0 18px !important;
  padding: 0 18px !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  transform: none !important;
  translate: none !important;
  z-index: 12 !important;
}

.mfpg-caption-inner {
  width: min(680px, 100%);
  min-height: 92px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  text-align: center;
  background: transparent;
  border: 0;
  box-shadow: none;
  transition:
    opacity 170ms ease,
    transform 220ms cubic-bezier(.22,.82,.21,1),
    filter 170ms ease;
}

.mfpg-caption-index {
  display: block;
  min-height: 13px;
  margin: 0 0 9px;
  color: rgba(85, 217, 255, .74);
  font-size: 8px;
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: .20em;
}

.mfpg-caption-title {
  margin: 0;
  padding: 0;
  color: rgba(241, 248, 252, .98);
  font-size: clamp(14px, 1.85vw, 18px);
  line-height: 1.12;
  font-weight: 880;
  letter-spacing: .045em;
  text-transform: uppercase;
}

.mfpg-caption-text {
  max-width: 610px;
  margin: 9px auto 0;
  padding: 0;
  color: rgba(134, 153, 166, .92);
  font-size: clamp(9px, 1.15vw, 11px);
  line-height: 1.55;
  font-weight: 520;
  letter-spacing: .015em;
  text-wrap: balance;
}

.mfpg-caption-inner.is-changing {
  opacity: 0;
  transform: translateY(5px);
  filter: blur(1px);
}

.mfpg-caption-inner.is-entering {
  animation: mfpgVariant2CaptionEnter 250ms cubic-bezier(.22,.82,.21,1) both;
}

@keyframes mfpgVariant2CaptionEnter {
  from {
    opacity: 0;
    transform: translateY(-4px);
    filter: blur(1px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

@media (max-width: 900px) {
  html {
    width: 100% !important;
    height: auto !important;
    min-height: 100% !important;
    overflow-x: hidden !important;
    overflow-y: visible !important;
    overscroll-behavior-x: none !important;
    overscroll-behavior-y: auto !important;
  }

  body {
    width: 100% !important;
    height: auto !important;
    min-height: 100dvh !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    overscroll-behavior-x: none !important;
    overscroll-behavior-y: auto !important;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y pinch-zoom !important;
  }

  .system-shell.mf-system-page-flow-v2 {
    height: auto !important;
    min-height: 100dvh !important;
    overflow: visible !important;
  }

  .system-shell.mf-system-page-flow-v2
  > .viewport-wrap.mfpg-variant2-clean-v1 {
    height: clamp(500px, 70dvh, 650px) !important;
    min-height: clamp(500px, 70dvh, 650px) !important;
    max-height: 650px !important;
  }
}

@media (max-width: 600px) {
  .system-shell.mf-system-page-flow-v2
  > .viewport-wrap.mfpg-variant2-clean-v1 {
    height: clamp(470px, 68dvh, 590px) !important;
    min-height: clamp(470px, 68dvh, 590px) !important;
    max-height: 590px !important;
    margin-top: 7px !important;
  }

  .mfpg-variant2-clean-v1 .mfpg-head {
    top: 3.2%;
  }

  .mfpg-variant2-clean-v1 .mfpg-kicker {
    font-size: 8px;
  }

  .mfpg-variant2-clean-v1 .mfpg-sub {
    margin-top: 6px;
    font-size: 7px;
  }

  .mfpg-variant2-clean-v1 .mfpg-deck {
    inset: 12% 0 8.5%;
  }

  .mfpg-variant2-clean-v1 .mfpg-card {
    height: min(84%, 510px);
    border-radius: 12px;
  }

  .mfpg-variant2-clean-v1 .mfpg-card[data-slot="center"] {
    transform:
      translate(-50%, -50%)
      translateZ(58px)
      scale(1.045);
  }

  .mfpg-variant2-clean-v1 .mfpg-card[data-slot="left"] {
    opacity: .60;
    transform:
      translate(-50%, -50%)
      translateX(-72%)
      rotateY(5deg)
      translateZ(-70px)
      scale(.85);
  }

  .mfpg-variant2-clean-v1 .mfpg-card[data-slot="right"] {
    opacity: .60;
    transform:
      translate(-50%, -50%)
      translateX(72%)
      rotateY(-5deg)
      translateZ(-70px)
      scale(.85);
  }

  .mfpg-variant2-clean-v1 .mfpg-dots {
    bottom: 2.1%;
    gap: 7px;
  }

  .mfpg-variant2-clean-v1 .mfpg-dot {
    width: 6px;
    height: 6px;
  }

  .system-shell.mf-system-page-flow-v2 > .mfpg-caption {
    margin-top: 0 !important;
    margin-bottom: 14px !important;
    padding-left: 14px !important;
    padding-right: 14px !important;
  }

  .mfpg-caption-inner {
    min-height: 86px;
  }

  .mfpg-caption-index {
    margin-bottom: 8px;
    font-size: 7px;
  }

  .mfpg-caption-title {
    font-size: 15px;
  }

  .mfpg-caption-text {
    max-width: 390px;
    margin-top: 8px;
    font-size: 10px;
    line-height: 1.52;
  }
}

@media (max-width: 900px) and (orientation: landscape) and (max-height: 600px) {
  .system-shell.mf-system-page-flow-v2
  > .viewport-wrap.mfpg-variant2-clean-v1 {
    height: clamp(260px, 72dvh, 330px) !important;
    min-height: clamp(260px, 72dvh, 330px) !important;
    max-height: clamp(260px, 72dvh, 330px) !important;
  }

  .mfpg-variant2-clean-v1 .mfpg-head {
    top: 1.8%;
  }

  .mfpg-variant2-clean-v1 .mfpg-deck {
    inset: 12% 0 7%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mfpg-variant2-clean-v1 .mfpg-deck,
  .mfpg-variant2-clean-v1 .mfpg-card,
  .mfpg-variant2-clean-v1 .mfpg-live-viewport,
  .mfpg-caption-inner,
  .mfpg-caption-inner.is-entering {
    animation: none !important;
    transition-duration: .01ms !important;
    filter: none;
  }
}

/* ===== /MEMEFLOW_SYSTEM_GALLERY_VARIANT2_CLEAN_V1 ===== */
'''

css = css.rstrip() + "\n\n" + FINAL_CSS.strip() + "\n"

def clean(text: str) -> str:
    return "\n".join(line.rstrip(" \t") for line in text.splitlines()) + "\n"

html = clean(html)
css = clean(css)

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
final_css = css_path.read_text(encoding="utf-8")

checks = {
    "Variant 2 HTML class": "mfpg-variant2-clean-v1" in final_html,
    "Variant 2 marker": PATCH_ID in final_html and PATCH_ID in final_css,
    "new CSS cache bust": "/system.css?v=gallery-variant2-clean-v1" in final_html,
    "center transform": 'data-slot="center"' in final_css and "translateZ(70px)" in final_css,
    "mild left angle": 'data-slot="left"' in final_css and "rotateY(6deg)" in final_css,
    "mild right angle": 'data-slot="right"' in final_css and "rotateY(-6deg)" in final_css,
    "live viewport preserved": ".mfpg-live-viewport.is-live" in final_css,
    "live frame preserved": "width: 390px !important;" in final_css and "height: 844px !important;" in final_css,
    "dots preserved": ".mfpg-dot.is-active" in final_css,
    "caption preserved": ".mfpg-caption-title" in final_css,
    "mobile native scroll restored": "overscroll-behavior-y: auto !important;" in final_css,
}

for marker in OLD_STYLE_BLOCKS:
    checks[f"old style removed: {marker}"] = marker not in final_css

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

js_checks = {
    "base gallery JS": "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" in js,
    "swipe JS": "MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3" in js,
    "caption JS": "MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6" in js,
    "live iframe JS": "MEMEFLOW_GALLERY_LIVE_IFRAMES_V1" in js,
    "Trading live destination": "'/trading.html'" in js,
    "Settings live destination": "'/settings.html'" in js,
    "Pipeline live destination": "'/system-tokens.html'" in js,
}

js_failed = [name for name, ok in js_checks.items() if not ok]
if js_failed:
    raise SystemExit("ERROR: behavior validation failed: " + ", ".join(js_failed))

for path in (html_path, css_path):
    text = path.read_text(encoding="utf-8")
    bad = [
        i for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("Variant 2 clean install validation: PASS")
print("Removed old gallery CSS layers:")
for marker in OLD_STYLE_BLOCKS:
    print(f"  - {marker}")
print("Installed one final layer:")
print(f"  - {PATCH_ID}")
print("Behavior JS untouched: live pages + swipe + click + caption remain.")
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
    echo "ERROR: staged set differs from the exact two Variant-2 files." >&2
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
    echo "ERROR: origin/$BRANCH changed while Variant 2 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: Variant 2 clean gallery committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: Variant 2 installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - center live page is larger/front-facing"
echo "  - side live pages are smaller, farther back and mildly angled"
echo "  - no old scanner background, grid, tray or scan-line layer"
echo "  - one consolidated gallery CSS layer; old gallery style patches removed"
echo "  - live iframe pages remain real-time"
echo "  - swipe/click/navigation behavior remains"
echo "  - mobile scrolling / pull-to-refresh remains"
echo
echo "Clean rollback:"
echo "  ./apply_memeflow_system_gallery_variant2_clean_v1.sh --rollback"
echo
echo "Exact pre-Variant-2 backup:"
echo "  $BACKUP"
