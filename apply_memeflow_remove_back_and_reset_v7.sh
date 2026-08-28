#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_REMOVE_BACK_AND_RESET_V7"
COMMIT_MESSAGE="Remove back arrow and Reset view from system page"
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
echo "MEMEFLOW REMOVE BACK + RESET V7"
echo "Goal: remove the top-left back arrow and the Reset view button."
echo "CSS hides them from first paint; JS then removes them from the DOM."
echo

grep -Fq 'MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6' "$HTML" || {
  echo "ERROR: expected current gallery/caption stack not found in system.html." >&2
  exit 1
}
grep -Fq 'page-gallery-caption-v6' "$HTML" || {
  echo "ERROR: expected current cache marker not found in system.html." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$CSS" || grep -Fq "$PATCH_ID" "$JS"; then
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
BACKUP="$ROOT/.patch-backups/remove-back-reset-v7-$STAMP"
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
import os
import re

html_path = Path(os.environ["MF_HTML"])
css_path = Path(os.environ["MF_CSS"])
js_path = Path(os.environ["MF_JS"])

PATCH_ID = "MEMEFLOW_REMOVE_BACK_AND_RESET_V7"

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if PATCH_ID in html or PATCH_ID in css or PATCH_ID in js:
    raise SystemExit("ERROR: partial V7 marker already exists")

CSS_BLOCK = r'''
/* ===== MEMEFLOW_REMOVE_BACK_AND_RESET_V7 ===== */
/* Hide both elements immediately from first paint. */
.topbar .back,
#resetViewBtn,
.topbar .tool-btn[data-mf-remove="reset-view"],
.topbar .tool-btn.mf-reset-view-hidden {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.topbar .brand-block {
  gap: clamp(10px, 1.4vw, 16px);
}

.topbar .top-actions {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.1vw, 14px);
}
/* ===== /MEMEFLOW_REMOVE_BACK_AND_RESET_V7 ===== */
'''

JS_BLOCK = r'''
/* ===== MEMEFLOW_REMOVE_BACK_AND_RESET_V7 ===== */
(() => {
  'use strict';

  const PATCH_ID = 'MEMEFLOW_REMOVE_BACK_AND_RESET_V7';

  function isResetViewButton(node) {
    if (!node) return false;
    const text = String(node.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    return text === 'reset view';
  }

  function removeTargets() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return false;

    let changed = false;

    const back = topbar.querySelector('.back');
    if (back) {
      back.remove();
      changed = true;
    }

    const byId = document.getElementById('resetViewBtn');
    if (byId) {
      byId.remove();
      changed = true;
    }

    const buttons = Array.from(topbar.querySelectorAll('button, .tool-btn'));
    for (const button of buttons) {
      if (isResetViewButton(button)) {
        button.remove();
        changed = true;
      }
    }

    return changed;
  }

  function boot() {
    removeTargets();

    if (typeof MutationObserver !== 'function') return;

    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    const observer = new MutationObserver(() => {
      removeTargets();
    });

    observer.observe(topbar, { childList: true, subtree: true });

    window.setTimeout(() => observer.disconnect(), 4000);

    console.log(`[TOPBAR] ${PATCH_ID} mounted`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
/* ===== /MEMEFLOW_REMOVE_BACK_AND_RESET_V7 ===== */
'''

css = css.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"
js = js.rstrip() + "\n\n" + JS_BLOCK.strip() + "\n"

html, css_count = re.subn(
    r'href="/system\.css(?:\?[^"]*)?"',
    'href="/system.css?v=remove-back-reset-v7"',
    html,
    count=1,
)
html, js_count = re.subn(
    r'src="/system\.js(?:\?[^"]*)?"',
    'src="/system.js?v=remove-back-reset-v7"',
    html,
    count=1,
)

if css_count != 1:
    raise SystemExit(f"ERROR: expected one system.css link, found {css_count}")
if js_count != 1:
    raise SystemExit(f"ERROR: expected one system.js script, found {js_count}")

# strip trailing whitespace
html = "\n".join(line.rstrip(" \t") for line in html.splitlines()) + "\n"
css = "\n".join(line.rstrip(" \t") for line in css.splitlines()) + "\n"
js = "\n".join(line.rstrip(" \t") for line in js.splitlines()) + "\n"

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
final_css = css_path.read_text(encoding="utf-8")
final_js = js_path.read_text(encoding="utf-8")

checks = {
    "css marker": PATCH_ID in final_css,
    "js marker": PATCH_ID in final_js,
    "hide back selector": ".topbar .back" in final_css,
    "hide reset selector": "#resetViewBtn" in final_css,
    "remove back in js": "const back = topbar.querySelector('.back')" in final_js,
    "remove reset in js": "isResetViewButton" in final_js and "getElementById('resetViewBtn')" in final_js,
    "css cache bust": '/system.css?v=remove-back-reset-v7' in final_html,
    "js cache bust": '/system.js?v=remove-back-reset-v7' in final_html,
    "caption v6 preserved": 'MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6' in final_js or 'MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6' in final_html,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

for path, text in (
    (html_path, final_html),
    (css_path, final_css),
    (js_path, final_js),
):
    bad = [i for i, line in enumerate(text.splitlines(), start=1) if line.endswith((" ", "\t"))]
    if bad:
        raise SystemExit(f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}")

print("V7 validation: PASS")
print("Back arrow + Reset view will be hidden from first paint and removed from the DOM after boot.")
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
    echo "ERROR: staged set differs from the exact three V7 files." >&2
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
    echo "ERROR: origin/$BRANCH changed while V7 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: V7 committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: V7 installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - top-left back arrow is gone"
echo "  - Reset view is gone"
echo "  - Trading and Settings stay untouched"
echo "  - caption/gallery/telemetry logic remains intact"
echo "Backup: $BACKUP"
PY
