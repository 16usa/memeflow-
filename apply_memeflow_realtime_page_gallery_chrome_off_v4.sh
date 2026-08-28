#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_REALTIME_PAGE_GALLERY_CHROME_OFF_V4"
COMMIT_MESSAGE="Remove viewport background and frame from realtime gallery"
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
for f in "$HTML" "$CSS"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f" >&2; exit 1; }
done

echo
echo "MEMEFLOW Page Gallery CHROME OFF V4"
echo "Fix: remove the black viewport background and the outer frame around the 3D gallery block."
echo

grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" "$CSS" || {
  echo "ERROR: gallery V1 CSS marker not found." >&2
  exit 1
}
grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2" "$CSS" || {
  echo "ERROR: CLEAN V2 CSS marker not found." >&2
  exit 1
}
grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3" "$CSS" || {
  echo "ERROR: SWIPE V3 CSS marker not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$CSS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || { echo "ERROR: detached HEAD." >&2; exit 1; }

REL_HTML="${HTML#"$ROOT"/}"
REL_CSS="${CSS#"$ROOT"/}"
TARGETS=("$REL_HTML" "$REL_CSS")

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
BACKUP="$ROOT/.patch-backups/page-gallery-chrome-off-v4-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$CSS" "$BACKUP"/
echo "Backup: $BACKUP"

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

export MF_HTML="$HTML"
export MF_CSS="$CSS"

python3 <<'PY'
from pathlib import Path
import os, re

html_path = Path(os.environ['MF_HTML'])
css_path = Path(os.environ['MF_CSS'])
PATCH_ID = 'MEMEFLOW_REALTIME_PAGE_GALLERY_CHROME_OFF_V4'

html = html_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

if PATCH_ID in css:
    raise SystemExit('ERROR: partial CHROME OFF V4 marker already exists')

CSS_BLOCK = r'''
/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_CHROME_OFF_V4 ===== */
/* Remove the black fill and the framed block around the page gallery. */
.viewport-wrap.mf-page-gallery-host,
.viewport-wrap.mf-page-gallery-clean-v2 {
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  outline: 0 !important;
  overflow: visible !important;
}

.viewport-wrap.mf-page-gallery-host::before,
.viewport-wrap.mf-page-gallery-host::after,
.viewport-wrap.mf-page-gallery-clean-v2::before,
.viewport-wrap.mf-page-gallery-clean-v2::after {
  display: none !important;
  content: none !important;
}

.viewport-wrap.mf-page-gallery-clean-v2 #mfPageGallery,
.viewport-wrap.mf-page-gallery-host #mfPageGallery {
  background: transparent !important;
}

/* Remove the inner scanner background plane, ring and black tray. */
.viewport-wrap.mf-page-gallery-clean-v2 #mfPageGallery::before,
.viewport-wrap.mf-page-gallery-clean-v2 #mfPageGallery::after,
.viewport-wrap.mf-page-gallery-host #mfPageGallery::before,
.viewport-wrap.mf-page-gallery-host #mfPageGallery::after {
  display: none !important;
  content: none !important;
}

/* Let the cards float without the boxed viewport chrome. */
.viewport-wrap.mf-page-gallery-clean-v2 {
  padding: 0 !important;
  min-height: clamp(300px, 56vw, 430px) !important;
}

.viewport-wrap.mf-page-gallery-clean-v2 .mfpg-deck,
.viewport-wrap.mf-page-gallery-host .mfpg-deck {
  inset: 7% 0 4% !important;
}

.viewport-wrap.mf-page-gallery-clean-v2 .mfpg-head,
.viewport-wrap.mf-page-gallery-host .mfpg-head {
  top: 2.4% !important;
}

.viewport-wrap.mf-page-gallery-clean-v2 .mfpg-dots,
.viewport-wrap.mf-page-gallery-host .mfpg-dots {
  bottom: 1.8% !important;
}

@media (max-width: 600px) {
  .viewport-wrap.mf-page-gallery-clean-v2,
  .viewport-wrap.mf-page-gallery-host {
    min-height: 270px !important;
  }

  .viewport-wrap.mf-page-gallery-clean-v2 .mfpg-deck,
  .viewport-wrap.mf-page-gallery-host .mfpg-deck {
    inset: 8% 0 4% !important;
  }

  .viewport-wrap.mf-page-gallery-clean-v2 .mfpg-head,
  .viewport-wrap.mf-page-gallery-host .mfpg-head {
    top: 2% !important;
  }

  .viewport-wrap.mf-page-gallery-clean-v2 .mfpg-dots,
  .viewport-wrap.mf-page-gallery-host .mfpg-dots {
    bottom: 1.4% !important;
  }
}
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_CHROME_OFF_V4 ===== */
'''

css = css.rstrip() + '\n\n' + CSS_BLOCK.strip() + '\n'
html, count = re.subn(
    r'href="/system\.css(?:\?[^"]*)?"',
    'href="/system.css?v=page-gallery-chrome-off-v4"',
    html,
    count=1,
)
if count != 1:
    raise SystemExit(f'ERROR: expected one system.css reference, found {count}')

css_path.write_text(css, encoding='utf-8')
html_path.write_text(html, encoding='utf-8')

final_html = html_path.read_text(encoding='utf-8')
final_css = css_path.read_text(encoding='utf-8')
checks = {
    'v1 kept': 'MEMEFLOW_REALTIME_PAGE_GALLERY_V1' in final_css,
    'clean v2 kept': 'MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2' in final_css,
    'swipe v3 kept': 'MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3' in final_css,
    'chrome off v4 css': PATCH_ID in final_css,
    'transparent viewport': 'background: transparent !important;' in final_css,
    'remove gallery pseudo bg': '#mfPageGallery::before' in final_css and '#mfPageGallery::after' in final_css,
    'cache bust css': '/system.css?v=page-gallery-chrome-off-v4' in final_html,
}
failed = [k for k, ok in checks.items() if not ok]
if failed:
    raise SystemExit('ERROR: validation failed: ' + ', '.join(failed))
print('CHROME OFF V4 validation: PASS')
PY

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
    echo "ERROR: staged set differs from the exact two CHROME OFF V4 files." >&2
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
    echo "ERROR: origin/$BRANCH changed while CHROME OFF V4 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"
  echo
  echo "SUCCESS: CHROME OFF V4 committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: CHROME OFF V4 installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - removed black viewport background"
echo "  - removed outer frame around the gallery block"
echo "  - cards remain swipeable and clickable"
echo "  - page logic untouched"
echo "Backup: $BACKUP"
