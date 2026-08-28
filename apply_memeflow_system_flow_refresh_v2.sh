#!/usr/bin/env bash
set -euo pipefail

ROOT="${MEMEFLOW_ROOT:-$(pwd)}"
HTML="$ROOT/memeflow-app/system.html"
CSS="$ROOT/memeflow-app/system.css"

if [[ ! -f "$HTML" || ! -f "$CSS" ]]; then
  echo "ERROR: Run this script from the repository root." >&2
  echo "Expected: memeflow-app/system.html and memeflow-app/system.css" >&2
  exit 1
fi

python3 - "$HTML" "$CSS" <<'PY'
from pathlib import Path
import re
import sys

html_path = Path(sys.argv[1])
css_path = Path(sys.argv[2])

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")

V1_START = "/* ===== MEMEFLOW_CAPTION_FLOW_FIX_V1 ===== */"
V1_END = "/* ===== /MEMEFLOW_CAPTION_FLOW_FIX_V1 ===== */"
V2_START = "/* ===== MEMEFLOW_SYSTEM_PAGE_FLOW_REFRESH_V2 ===== */"
V2_END = "/* ===== /MEMEFLOW_SYSTEM_PAGE_FLOW_REFRESH_V2 ===== */"

# 1) Force Safari/Replit preview to load the new stylesheet instead of a cached old one.
html, css_link_count = re.subn(
    r'href="/system\.css\?v=[^"]+"',
    'href="/system.css?v=system-flow-refresh-v2"',
    html,
    count=1
)
if css_link_count != 1:
    raise SystemExit("ERROR: Could not update system.css cache-busting URL.")

# 2) Scope the new layout fix with a new class so cached V1 selectors cannot be confused.
html = html.replace(
    'class="system-shell mf-caption-flow-fix-v1"',
    'class="system-shell mf-system-page-flow-v2"',
    1
)
if 'class="system-shell mf-system-page-flow-v2"' not in html:
    html = html.replace(
        'class="system-shell"',
        'class="system-shell mf-system-page-flow-v2"',
        1
    )

# 3) Remove old copies of our previous fix and any re-run of V2.
for start, end in ((V1_START, V1_END), (V2_START, V2_END)):
    css = re.sub(
        re.escape(start) + r".*?" + re.escape(end) + r"\s*",
        "",
        css,
        flags=re.S,
    )

fix = r'''
/* ===== MEMEFLOW_SYSTEM_PAGE_FLOW_REFRESH_V2 =====
   Fixes two independent problems on the simplified System Overview page:
   1) after removing lower sibling cards, the old mobile grid stretches the
      gallery row and the page caption appears too low / overlaps in landscape;
   2) legacy mobile rules lock html/body with overflow:hidden and
      overscroll-behavior:none, which disables normal Safari pull-to-refresh.

   Deleted architecture / legend / telemetry / TOKEN FLOW blocks stay deleted.
*/

/* Natural document flow: header -> gallery -> active-page caption. */
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

.system-shell.mf-system-page-flow-v2 > .viewport-wrap {
  position: relative !important;
  display: block !important;
  flex: none !important;
  margin: 6px 0 0 !important;
}

/* Caption is always a normal sibling immediately below the gallery box. */
.system-shell.mf-system-page-flow-v2 > .mfpg-caption {
  position: relative !important;
  inset: auto !important;
  display: block !important;
  clear: both !important;

  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;

  margin: -2px 0 14px !important;
  padding: 0 18px !important;

  transform: none !important;
  translate: none !important;
  z-index: 12 !important;
}

.system-shell.mf-system-page-flow-v2
> .mfpg-caption
> .mfpg-caption-inner {
  min-height: 74px !important;
}

/*
  Restore native page scrolling on phones/tablets.
  The old V29 mobile rule used:
    overflow:hidden;
    overscroll-behavior:none;
  on html/body, which prevents Safari's pull-to-refresh.
*/
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

  #mfPageGallery {
    touch-action: pan-y pinch-zoom !important;
  }
}

@media (max-width: 600px) {
  .system-shell.mf-system-page-flow-v2 > .viewport-wrap {
    margin-top: 6px !important;
  }

  .system-shell.mf-system-page-flow-v2 > .mfpg-caption {
    margin-top: -1px !important;
    margin-bottom: 12px !important;
    padding-left: 14px !important;
    padding-right: 14px !important;
  }

  .system-shell.mf-system-page-flow-v2
  > .mfpg-caption
  > .mfpg-caption-inner {
    min-height: 68px !important;
  }
}

/*
  Short landscape screens need a gallery height that fits the actual viewport.
  The legacy 430px tablet/landscape height can be taller than Safari's visible
  area and makes the following caption appear visually inside the cards.
*/
@media (max-width: 900px) and (orientation: landscape) and (max-height: 600px) {
  .system-shell.mf-system-page-flow-v2 > .viewport-wrap {
    height: clamp(250px, 72dvh, 320px) !important;
    min-height: clamp(250px, 72dvh, 320px) !important;
    max-height: clamp(250px, 72dvh, 320px) !important;
  }
}
/* ===== /MEMEFLOW_SYSTEM_PAGE_FLOW_REFRESH_V2 ===== */
'''

css = css.rstrip() + "\n\n" + fix.strip() + "\n"

# Safety: deleted UI must remain deleted.
for forbidden in (
    'class="scene-title glass mf-architecture-title-standalone-v3"',
    'class="legend glass mf-legend-standalone-v4"',
    'class="telemetry glass mf-telemetry-standalone-v3"',
    'class="activity-panel glass"',
    "TOKEN FLOW",
    "Recent pipeline state",
    "Live MEMEFLOW pipeline",
):
    if forbidden in html:
        raise SystemExit(
            f"ERROR: Deleted block unexpectedly exists again: {forbidden}"
        )

if '<section id="mfPageCaption" class="mfpg-caption"' not in html:
    raise SystemExit("ERROR: mfPageCaption is missing.")

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")

print("OK: layout flow, cache-busting and native mobile pull-to-refresh CSS fixed.")
PY

echo
echo "--- diff ---"
git diff -- memeflow-app/system.html memeflow-app/system.css

if git diff --quiet -- memeflow-app/system.html memeflow-app/system.css; then
  echo "No changes to commit."
  exit 0
fi

git add memeflow-app/system.html memeflow-app/system.css
git commit -m "Fix System Overview flow and mobile pull to refresh"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" || -z "$BRANCH" ]]; then
  echo "ERROR: Detached HEAD; commit created locally but push was not attempted." >&2
  exit 1
fi

git push origin "$BRANCH"

echo
echo "DONE: System Overview layout + native pull-to-refresh fix pushed to $BRANCH."
