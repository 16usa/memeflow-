#!/usr/bin/env bash
set -euo pipefail

ROOT="${MEMEFLOW_ROOT:-$(pwd)}"
HTML="$ROOT/memeflow-app/system.html"
CSS="$ROOT/memeflow-app/system.css"
JS="$ROOT/memeflow-app/system.js"

if [[ ! -f "$HTML" || ! -f "$CSS" || ! -f "$JS" ]]; then
  echo "ERROR: Run this script from the repository root." >&2
  echo "Expected files:" >&2
  echo "  memeflow-app/system.html" >&2
  echo "  memeflow-app/system.css" >&2
  echo "  memeflow-app/system.js" >&2
  exit 1
fi

python3 - "$HTML" "$CSS" "$JS" <<'PY'
from pathlib import Path
import re
import sys

html_path = Path(sys.argv[1])
css_path = Path(sys.argv[2])
js_path = Path(sys.argv[3])

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

CSS_START = "/* ===== MEMEFLOW_REMOVE_LIVE_INSPECTOR_V3 ===== */"
CSS_END = "/* ===== /MEMEFLOW_REMOVE_LIVE_INSPECTOR_V3 ===== */"
JS_BLOCK_START = "/* ===== MEMEFLOW_LIVE_INSPECTOR_STANDALONE_V1 ====="
JS_NEXT_MARKER = "/* ===== MEMEFLOW_3D_VIEWPORT_FREE_ORBIT_FIT_V4 ===== */"

# 1) Force Safari/Replit preview to reload both page assets.
html = re.sub(
    r'href="/system\.css\?v=[^"]+"',
    'href="/system.css?v=remove-live-inspector-v3"',
    html,
    count=1
)
html = re.sub(
    r'src="/system\.js\?v=[^"]+"',
    'src="/system.js?v=remove-live-inspector-v3"',
    html,
    count=1
)

# 2) Keep the inspector DOM for JS safety, but make it permanently hidden/inert.
if 'id="inspector"' not in html:
    raise SystemExit("ERROR: #inspector not found in system.html")

html = html.replace(
    '<aside id="inspector" class="inspector glass">',
    '<aside id="inspector" class="inspector glass mf-live-inspector-removed-v3" hidden aria-hidden="true">',
    1
)

# 3) Remove old copy of our CSS patch if rerun.
css = re.sub(
    re.escape(CSS_START) + r".*?" + re.escape(CSS_END) + r"\s*",
    "",
    css,
    flags=re.S,
)

css_patch = '''
/* ===== MEMEFLOW_REMOVE_LIVE_INSPECTOR_V3 =====
   User requested full removal of the visible LIVE INSPECTOR block
   from the System Overview page.

   We intentionally keep the inspector DOM node hidden/inert instead of
   hard-deleting it, because other System page JS may still reference
   those element IDs. This removes the block from layout and from view,
   while keeping the page stable.
*/
#inspector,
.inspector.mf-live-inspector-removed-v3,
.inspector.mf-live-inspector-standalone-v1,
html.mf-live-inspector-standalone-layout-v1 #inspector {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;

  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;

  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;

  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  overflow: hidden !important;

  box-shadow: none !important;
  background: transparent !important;
}

html.mf-live-inspector-standalone-layout-v1 {
  --mf-live-inspector-removed: 1;
}
/* ===== /MEMEFLOW_REMOVE_LIVE_INSPECTOR_V3 ===== */
'''
css = css.rstrip() + "\n\n" + css_patch.strip() + "\n"

# 4) Replace the JS block that tries to move/show the Live Inspector.
start = js.find(JS_BLOCK_START)
if start == -1:
    raise SystemExit("ERROR: MEMEFLOW_LIVE_INSPECTOR_STANDALONE_V1 block not found in system.js")

end = js.find(JS_NEXT_MARKER, start)
if end == -1:
    raise SystemExit("ERROR: Next marker after MEMEFLOW_LIVE_INSPECTOR_STANDALONE_V1 not found in system.js")

replacement = '''/* ===== MEMEFLOW_LIVE_INSPECTOR_STANDALONE_V1 =====
   Disabled because LIVE INSPECTOR was removed from the System Overview page.
   Keep the DOM node hidden/inert so other system JS can safely keep references.
*/
(() => {
  'use strict';

  function removeLiveInspectorV3() {
    document.documentElement.classList.remove(
      'mf-live-inspector-standalone-layout-v1'
    );

    const inspector = document.getElementById('inspector');
    if (!inspector) return;

    inspector.classList.remove('mf-live-inspector-standalone-v1');
    inspector.classList.add('mf-live-inspector-removed-v3');
    inspector.hidden = true;
    inspector.setAttribute('aria-hidden', 'true');
    inspector.style.display = 'none';
    inspector.style.pointerEvents = 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      removeLiveInspectorV3,
      { once: true }
    );
  } else {
    removeLiveInspectorV3();
  }
})();

'''
js = js[:start] + replacement + js[end:]

# Safety checks: blocks that user explicitly asked removed must stay removed.
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

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

print("OK: Live Inspector removed from the visible page and disabled in JS.")
PY

echo
echo "--- diff ---"
git diff -- memeflow-app/system.html memeflow-app/system.css memeflow-app/system.js

if git diff --quiet -- memeflow-app/system.html memeflow-app/system.css memeflow-app/system.js; then
  echo "No changes to commit."
  exit 0
fi

git add memeflow-app/system.html memeflow-app/system.css memeflow-app/system.js
git commit -m "Remove Live Inspector from System Overview page"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" || -z "$BRANCH" ]]; then
  echo "ERROR: Detached HEAD; commit created locally but push was not attempted." >&2
  exit 1
fi

git push origin "$BRANCH"

echo
echo "DONE: Live Inspector removed and pushed to $BRANCH."
