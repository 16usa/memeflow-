#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2"
COMMIT_MESSAGE="Remove legacy flow layer behind page gallery"
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
echo "MEMEFLOW Page Gallery CLEAN V2"
echo "Fix: remove the legacy memeflow-flow-v4 layer that was drawing"
echo "RAW STREAM / INFERENCE PATHS / WAITING / BLOCKED behind the new cards."
echo

grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" "$CSS" || {
  echo "ERROR: Page Gallery V1 CSS marker is missing." >&2
  exit 1
}
grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" "$JS" || {
  echo "ERROR: Page Gallery V1 JS marker is missing." >&2
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
  if ! git -C "$ROOT" diff --quiet -- "$rel" || \
     ! git -C "$ROOT" diff --cached --quiet -- "$rel"; then
    echo "ERROR: target file has local/staged edits: $rel" >&2
    echo "Commit/stash it first; nothing was changed." >&2
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
BACKUP="$ROOT/.patch-backups/page-gallery-clean-v2-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$CSS" "$JS" "$BACKUP"/
echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring the exact three pre-patch files..."
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

PATCH_ID = "MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2"

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

flow_css_pattern = re.compile(
    r'\s*<link\s+rel=["\']stylesheet["\']\s+href=["\']/memeflow-flow-v4\.css(?:\?[^"\']*)?["\']\s*/?>\s*',
    re.I
)
flow_js_pattern = re.compile(
    r'\s*<script\s+src=["\']/memeflow-flow-v4\.js(?:\?[^"\']*)?["\']\s+defer\s*></script>\s*',
    re.I
)

html, css_removed = flow_css_pattern.subn("\n", html, count=1)
html, js_removed = flow_js_pattern.subn("\n", html, count=1)

if css_removed != 1:
    raise SystemExit(f"ERROR: expected one memeflow-flow-v4.css include, removed {css_removed}")
if js_removed != 1:
    raise SystemExit(f"ERROR: expected one memeflow-flow-v4.js include, removed {js_removed}")

old_viewport = '<section class="viewport-wrap mf-true3d-clean-v3">'
new_viewport = '<section class="viewport-wrap mf-true3d-clean-v3 mf-page-gallery-host mf-page-gallery-clean-v2">'
if old_viewport in html:
    html = html.replace(old_viewport, new_viewport, 1)
elif "mf-page-gallery-clean-v2" not in html:
    raise SystemExit("ERROR: expected viewport-wrap opening tag was not found")

CSS_BLOCK = r'''
/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2 ===== */
.viewport-wrap.mf-page-gallery-clean-v2 > #systemCanvas,
.viewport-wrap.mf-page-gallery-clean-v2 > #memeflowTrue3DHost,
.viewport-wrap.mf-page-gallery-clean-v2 > .scene-labels,
.viewport-wrap.mf-page-gallery-clean-v2 > .scene-hint,
.viewport-wrap.mf-page-gallery-clean-v2 > .mf-flow-v4 {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.viewport-wrap.mf-page-gallery-clean-v2 .mf-flow-v4,
.viewport-wrap.mf-page-gallery-clean-v2 .mf-flow-v4 canvas,
.viewport-wrap.mf-page-gallery-clean-v2 .mf-flow-v4-topline,
.viewport-wrap.mf-page-gallery-clean-v2 .mf-flow-v4-foot {
  display: none !important;
}

.viewport-wrap.mf-page-gallery-clean-v2 #mfPageGallery {
  display: grid !important;
  opacity: 1 !important;
  visibility: visible !important;
  z-index: 100 !important;
}
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2 ===== */
'''

JS_BLOCK = r'''
/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2 ===== */
(() => {
  'use strict';

  function removeLegacyFlowLayer() {
    const viewport = document.querySelector(
      '.viewport-wrap.mf-page-gallery-clean-v2, .viewport-wrap.mf-page-gallery-host'
    );
    if (!viewport) return;

    viewport.classList.add('mf-page-gallery-host', 'mf-page-gallery-clean-v2');

    viewport.querySelectorAll('.mf-flow-v4').forEach(node => node.remove());

    const oldCanvas = viewport.querySelector('#systemCanvas');
    const oldTrue3D = viewport.querySelector('#memeflowTrue3DHost');
    const oldLabels = viewport.querySelector('.scene-labels');
    const oldHint = viewport.querySelector('.scene-hint');

    for (const node of [oldCanvas, oldTrue3D, oldLabels, oldHint]) {
      if (!node) continue;
      node.setAttribute('aria-hidden', 'true');
      node.style.display = 'none';
      node.style.pointerEvents = 'none';
    }

    try {
      const old3D = window.__memeflowTrue3D;
      if (old3D && typeof old3D.dispose === 'function') old3D.dispose();
      window.__memeflowTrue3D = null;
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeLegacyFlowLayer, { once: true });
  } else {
    removeLegacyFlowLayer();
  }

  const startGuard = () => {
    const viewport = document.querySelector('.viewport-wrap');
    if (!viewport || typeof MutationObserver !== 'function') return;

    const observer = new MutationObserver(() => {
      const legacy = viewport.querySelector('.mf-flow-v4');
      if (legacy) removeLegacyFlowLayer();
    });

    observer.observe(viewport, { childList: true, subtree: false });

    window.setTimeout(() => {
      observer.disconnect();
    }, 4000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGuard, { once: true });
  } else {
    startGuard();
  }
})();
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2 ===== */
'''

if PATCH_ID in css or PATCH_ID in js:
    raise SystemExit("ERROR: partial CLEAN V2 marker already exists")

css = css.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"
js = js.rstrip() + "\n\n" + JS_BLOCK.strip() + "\n"

html, n_css = re.subn(
    r'href="/system\.css(?:\?[^"]*)?"',
    'href="/system.css?v=page-gallery-clean-v2"',
    html,
    count=1
)
html, n_js = re.subn(
    r'src="/system\.js(?:\?[^"]*)?"',
    'src="/system.js?v=page-gallery-clean-v2"',
    html,
    count=1
)

if n_css != 1:
    raise SystemExit(f"ERROR: system.css cache link count={n_css}")
if n_js != 1:
    raise SystemExit(f"ERROR: system.js cache link count={n_js}")

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
final_css = css_path.read_text(encoding="utf-8")
final_js = js_path.read_text(encoding="utf-8")

checks = {
    "legacy flow CSS include removed": "/memeflow-flow-v4.css" not in final_html,
    "legacy flow JS include removed": "/memeflow-flow-v4.js" not in final_html,
    "static gallery viewport class": "mf-page-gallery-clean-v2" in final_html,
    "gallery v1 preserved":
        "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" in final_css
        and "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" in final_js,
    "clean v2 CSS installed": PATCH_ID in final_css,
    "clean v2 JS installed": PATCH_ID in final_js,
    "Trading scan preserved": "/memeflow-gallery/trading-terminal.webp" in final_js,
    "Settings scan preserved": "/memeflow-gallery/system-settings.webp" in final_js,
    "Pipeline scan preserved": "/memeflow-gallery/live-token-states.webp" in final_js,
    "HTML CSS cache v2": "/system.css?v=page-gallery-clean-v2" in final_html,
    "HTML JS cache v2": "/system.js?v=page-gallery-clean-v2" in final_html,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

print("CLEAN V2 structural validation: PASS")
print("Removed legacy memeflow-flow-v4 CSS/JS from the page.")
print("Gallery is now the only visible architecture viewport layer.")
PY

node --check "$JS"
git -C "$ROOT" diff --check -- "${TARGETS[@]}"

echo
echo "Expected diff:"
git -C "$ROOT" diff --stat -- "${TARGETS[@]}"

for asset in \
  "$APP/memeflow-gallery/trading-terminal.webp" \
  "$APP/memeflow-gallery/system-settings.webp" \
  "$APP/memeflow-gallery/live-token-states.webp"
do
  [[ -s "$asset" ]] || {
    echo "ERROR: page scan asset missing: $asset" >&2
    exit 1
  }
done

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact three CLEAN V2 files." >&2
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
    echo "ERROR: origin/$BRANCH changed while CLEAN V2 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: CLEAN V2 committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: CLEAN V2 installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - legacy memeflow-flow-v4 renderer removed from system.html"
echo "  - RAW STREAM / INFERENCE PATHS / WAITING-BLOCKED old layer gone"
echo "  - old WebGL/system canvas hidden from first paint"
echo "  - exactly 3 page scans remain in the architecture viewport"
echo "  - click transitions/navigation preserved"
echo "  - telemetry / Live Inspector / trading logic untouched"
echo "Backup: $BACKUP"
