#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6"
COMMIT_MESSAGE="Add dynamic page caption to realtime gallery"
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
echo "MEMEFLOW Page Gallery CAPTION V6"
echo "Adds a dynamic title + description under the active 3D page."
echo "Caption changes together with swipe/focus."
echo

# Verify the exact gallery stack already installed.
grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_TOP_V5_1" "$HTML" || {
  echo "ERROR: TOP V5.1 marker not found in system.html." >&2
  exit 1
}
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
grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_CHROME_OFF_V4" "$CSS" || {
  echo "ERROR: CHROME OFF V4 CSS marker not found." >&2
  exit 1
}
grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3" "$JS" || {
  echo "ERROR: SWIPE V3 JS marker not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$HTML" || grep -Fq "$PATCH_ID" "$CSS" || grep -Fq "$PATCH_ID" "$JS"; then
  echo "Already installed or partially present: $PATCH_ID"
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
BACKUP="$ROOT/.patch-backups/page-gallery-caption-v6-$STAMP"
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

PATCH_ID = "MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6"

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if PATCH_ID in html or PATCH_ID in css or PATCH_ID in js:
    raise SystemExit("ERROR: partial CAPTION V6 marker already exists")

# ------------------------------------------------------------
# HTML: insert the caption immediately AFTER the gallery viewport,
# before the REAL-TIME ARCHITECTURE block.
# ------------------------------------------------------------
viewport_re = re.compile(
    r'(<section class="viewport-wrap[^"]*mf-page-gallery-clean-v2[^"]*">.*?</section>)',
    re.S,
)

matches = list(viewport_re.finditer(html))
if len(matches) != 1:
    raise SystemExit(
        f"ERROR: expected exactly one page-gallery viewport, found {len(matches)}"
    )

match = matches[0]
caption_html = r'''
<!-- MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6 -->
<section id="mfPageCaption" class="mfpg-caption" aria-live="polite" aria-atomic="true">
  <div class="mfpg-caption-inner">
    <span id="mfPageCaptionIndex" class="mfpg-caption-index">02 / 03</span>
    <h2 id="mfPageCaptionTitle" class="mfpg-caption-title">SYSTEM SETTINGS</h2>
    <p id="mfPageCaptionText" class="mfpg-caption-text">Configure trading mode, AI thresholds, risk filters and execution rules.</p>
  </div>
</section>
'''.strip()

insert_at = match.end()
html = html[:insert_at] + "\n\n" + caption_html + html[insert_at:]

# Cache bust only our two modified runtime files.
html, css_count = re.subn(
    r'href="/system\.css(?:\?[^"]*)?"',
    'href="/system.css?v=page-gallery-caption-v6"',
    html,
    count=1,
)
html, js_count = re.subn(
    r'src="/system\.js(?:\?[^"]*)?"',
    'src="/system.js?v=page-gallery-caption-v6"',
    html,
    count=1,
)

if css_count != 1:
    raise SystemExit(f"ERROR: expected one system.css link, found {css_count}")
if js_count != 1:
    raise SystemExit(f"ERROR: expected one system.js script, found {js_count}")

CSS_BLOCK = r'''
/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6 ===== */
.mfpg-caption {
  width: 100%;
  margin: -2px 0 14px;
  padding: 0 18px;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  position: relative;
  z-index: 12;
}

.mfpg-caption-inner {
  width: min(620px, 100%);
  min-height: 74px;
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
  min-height: 12px;
  margin: 0 0 5px;
  color: rgba(91, 218, 250, .58);
  font-size: 7px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: .16em;
}

.mfpg-caption-title {
  margin: 0;
  padding: 0;
  color: rgba(241, 248, 252, .96);
  font-size: clamp(12px, 1.55vw, 15px);
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: .055em;
  text-transform: uppercase;
}

.mfpg-caption-text {
  max-width: 560px;
  margin: 6px auto 0;
  padding: 0;
  color: rgba(132, 151, 164, .90);
  font-size: clamp(9px, 1.1vw, 10px);
  line-height: 1.45;
  font-weight: 520;
  letter-spacing: .012em;
  text-wrap: balance;
}

.mfpg-caption-inner.is-changing {
  opacity: 0;
  transform: translateY(5px);
  filter: blur(1px);
}

.mfpg-caption-inner.is-entering {
  animation: mfpgCaptionEnterV6 260ms cubic-bezier(.22,.82,.21,1) both;
}

@keyframes mfpgCaptionEnterV6 {
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

@media (max-width: 600px) {
  .mfpg-caption {
    margin-top: -1px;
    margin-bottom: 12px;
    padding: 0 14px;
  }

  .mfpg-caption-inner {
    min-height: 68px;
  }

  .mfpg-caption-index {
    margin-bottom: 4px;
    font-size: 6px;
  }

  .mfpg-caption-title {
    font-size: 12px;
  }

  .mfpg-caption-text {
    max-width: 360px;
    margin-top: 5px;
    font-size: 9px;
    line-height: 1.42;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mfpg-caption-inner,
  .mfpg-caption-inner.is-entering {
    animation: none !important;
    transition: none !important;
    filter: none !important;
    transform: none !important;
  }
}
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6 ===== */
'''

JS_BLOCK = r'''
/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6 ===== */
(() => {
  'use strict';

  const PATCH_ID = 'MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6';

  const PAGE_META = {
    'Trading Terminal': {
      index: '01 / 03',
      title: 'TRADING TERMINAL',
      text: 'Live workspace for chart analysis, open positions, signals and trade execution.'
    },
    'System Settings': {
      index: '02 / 03',
      title: 'SYSTEM SETTINGS',
      text: 'Configure trading mode, AI thresholds, risk filters and execution rules.'
    },
    'Real-Time Pipeline': {
      index: '03 / 03',
      title: 'REAL-TIME PIPELINE',
      text: 'Monitor live token states, candidates, decisions and active positions.'
    }
  };

  function normalizeTitle(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function titleFromCard(card) {
    if (!card) return '';

    const visibleTitle = card.querySelector('.mfpg-title');
    const title = normalizeTitle(visibleTitle?.textContent);

    if (PAGE_META[title]) return title;

    const href = String(card.dataset.href || '');

    if (href.includes('/trading.html')) return 'Trading Terminal';
    if (href.includes('mfOpenSettings=1')) return 'System Settings';
    if (href.includes('/system-tokens.html')) return 'Real-Time Pipeline';

    return title;
  }

  function currentCenterCard(gallery) {
    return gallery?.querySelector('.mfpg-card[data-slot="center"]') || null;
  }

  function renderCaption(meta, animate = true) {
    const root = document.getElementById('mfPageCaption');
    const inner = root?.querySelector('.mfpg-caption-inner');
    const index = document.getElementById('mfPageCaptionIndex');
    const title = document.getElementById('mfPageCaptionTitle');
    const text = document.getElementById('mfPageCaptionText');

    if (!root || !inner || !index || !title || !text || !meta) return;

    const apply = () => {
      index.textContent = meta.index;
      title.textContent = meta.title;
      text.textContent = meta.text;

      inner.classList.remove('is-changing');
      inner.classList.remove('is-entering');

      if (animate) {
        void inner.offsetWidth;
        inner.classList.add('is-entering');
        window.setTimeout(() => inner.classList.remove('is-entering'), 280);
      }
    };

    if (!animate) {
      apply();
      return;
    }

    inner.classList.remove('is-entering');
    inner.classList.add('is-changing');
    window.setTimeout(apply, 145);
  }

  function syncCaption(gallery, animate = true) {
    const center = currentCenterCard(gallery);
    const key = titleFromCard(center);
    const meta = PAGE_META[key];

    if (!meta) return;

    const active = document.getElementById('mfPageCaptionTitle');
    if (active?.textContent === meta.title && animate) return;

    renderCaption(meta, animate);
  }

  function install() {
    const gallery = document.getElementById('mfPageGallery');
    const caption = document.getElementById('mfPageCaption');

    if (!gallery || !caption || caption.dataset.captionReady === '1') return false;

    caption.dataset.captionReady = '1';

    syncCaption(gallery, false);

    const observer = new MutationObserver(mutations => {
      const changed = mutations.some(mutation =>
        mutation.type === 'attributes' &&
        mutation.attributeName === 'data-slot' &&
        mutation.target?.classList?.contains('mfpg-card')
      );

      if (changed) {
        window.requestAnimationFrame(() => syncCaption(gallery, true));
      }
    });

    const deck = gallery.querySelector('.mfpg-deck');
    if (deck) {
      observer.observe(deck, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-slot']
      });
    }

    console.log(`[PAGE-GALLERY] ${PATCH_ID} mounted`);
    return true;
  }

  function boot() {
    if (install()) return;

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (install() || tries >= 40) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6 ===== */
'''

css = css.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"
js = js.rstrip() + "\n\n" + JS_BLOCK.strip() + "\n"

# Remove trailing whitespace to guarantee git diff --check.
html = "\n".join(line.rstrip(" \t") for line in html.splitlines()) + "\n"
css = "\n".join(line.rstrip(" \t") for line in css.splitlines()) + "\n"
js = "\n".join(line.rstrip(" \t") for line in js.splitlines()) + "\n"

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

# ------------------------------------------------------------
# Validation.
# ------------------------------------------------------------
final_html = html_path.read_text(encoding="utf-8")
final_css = css_path.read_text(encoding="utf-8")
final_js = js_path.read_text(encoding="utf-8")

checks = {
    "caption HTML once": final_html.count('id="mfPageCaption"') == 1,
    "caption after viewport":
        final_html.index('id="mfPageCaption"') > final_html.index('class="viewport-wrap'),
    "caption before architecture":
        final_html.index('id="mfPageCaption"') < final_html.index("REAL-TIME ARCHITECTURE"),
    "caption CSS marker": PATCH_ID in final_css,
    "caption JS marker": PATCH_ID in final_js,
    "Trading Terminal meta": "'Trading Terminal'" in final_js,
    "System Settings meta": "'System Settings'" in final_js,
    "Real-Time Pipeline meta": "'Real-Time Pipeline'" in final_js,
    "observer watches center changes": "attributeFilter: ['data-slot']" in final_js,
    "CSS cache bust": "/system.css?v=page-gallery-caption-v6" in final_html,
    "JS cache bust": "/system.js?v=page-gallery-caption-v6" in final_html,
    "swipe V3 preserved": "MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3" in final_js,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

for path, text in (
    (html_path, final_html),
    (css_path, final_css),
    (js_path, final_js),
):
    bad = [
        i for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("CAPTION V6 structural validation: PASS")
print("Caption order: gallery -> dynamic page info -> REAL-TIME ARCHITECTURE")
print("Descriptions change from the active center card.")
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
    echo "ERROR: staged set differs from the exact three CAPTION V6 files." >&2
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
    echo "ERROR: origin/$BRANCH changed while CAPTION V6 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: CAPTION V6 committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: CAPTION V6 installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - active page name appears below the gallery"
echo "  - short description appears below the name"
echo "  - subtle 01/03, 02/03, 03/03 index is included"
echo "  - caption fades/slides when the active card changes"
echo "  - no new frame or black background is added"
echo "  - swipe and click navigation remain unchanged"
echo "Backup: $BACKUP"
