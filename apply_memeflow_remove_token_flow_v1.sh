#!/usr/bin/env bash
set -euo pipefail

ROOT="${MEMEFLOW_ROOT:-$(pwd)}"
HTML="$ROOT/memeflow-app/system.html"
JS="$ROOT/memeflow-app/system.js"

if [[ ! -f "$HTML" || ! -f "$JS" ]]; then
  echo "ERROR: Run this script from the repository root (expected memeflow-app/system.html and memeflow-app/system.js)." >&2
  exit 1
fi

python3 - "$HTML" "$JS" <<'PY'
from pathlib import Path
import re
import sys

html_path = Path(sys.argv[1])
js_path = Path(sys.argv[2])

html = html_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

# Remove only the visible TOKEN FLOW / Recent pipeline state panel.
panel_re = re.compile(
    r'\n\s*<section class="activity-panel glass">\s*'
    r'<div class="activity-head">\s*'
    r'<div><span class="eyebrow">TOKEN FLOW</span><h2>Recent pipeline state</h2></div>.*?'
    r'<div id="tokenRail" class="token-rail"></div>\s*'
    r'</section>\s*',
    re.S,
)

html_new, count = panel_re.subn("\n", html, count=1)
if count != 1:
    if "TOKEN FLOW" not in html and "Recent pipeline state" not in html:
        print("TOKEN FLOW panel is already absent from system.html")
        html_new = html
    else:
        raise SystemExit("ERROR: TOKEN FLOW panel was found but did not match the expected structure. No files were changed.")

# Keep system.js safe after the tokenRail element is removed from the DOM.
old_render = "function renderRail(sample = []) {\n  $('tokenRail').innerHTML = sample.length"
new_render = "function renderRail(sample = []) {\n  const tokenRailEl = $('tokenRail');\n  if (!tokenRailEl) return;\n  tokenRailEl.innerHTML = sample.length"
if old_render in js:
    js = js.replace(old_render, new_render, 1)
elif "const tokenRailEl = $('tokenRail');" not in js:
    raise SystemExit("ERROR: Could not safely patch renderRail() in system.js. No files were changed.")

old_mode = "  $('telemetryMode').classList.toggle('offline', !(diag || discovery));\n  $('telemetryMode').lastChild.textContent = (diag || discovery) ? 'LIVE' : 'DEGRADED';"
new_mode = "  const telemetryModeEl = $('telemetryMode');\n  if (telemetryModeEl) {\n    telemetryModeEl.classList.toggle('offline', !(diag || discovery));\n    if (telemetryModeEl.lastChild) {\n      telemetryModeEl.lastChild.textContent = (diag || discovery) ? 'LIVE' : 'DEGRADED';\n    }\n  }"
if old_mode in js:
    js = js.replace(old_mode, new_mode, 1)
elif "const telemetryModeEl = $('telemetryMode');" not in js:
    raise SystemExit("ERROR: Could not safely patch telemetryMode access in system.js. No files were changed.")

# Final visual-content checks.
for forbidden in ("TOKEN FLOW", "Recent pipeline state", 'class="activity-panel glass"', 'id="tokenRail"'):
    if forbidden in html_new:
        raise SystemExit(f"ERROR: Removal verification failed: {forbidden!r} is still present in system.html")

html_path.write_text(html_new, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")
print("OK: TOKEN FLOW panel removed; system.js guarded for missing DOM elements.")
PY

echo
echo "--- diff ---"
git diff -- memeflow-app/system.html memeflow-app/system.js

if git diff --quiet -- memeflow-app/system.html memeflow-app/system.js; then
  echo "No changes to commit."
  exit 0
fi

git add memeflow-app/system.html memeflow-app/system.js
git commit -m "Remove TOKEN FLOW panel from system page"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" || -z "$BRANCH" ]]; then
  echo "ERROR: Detached HEAD; commit created locally but push was not attempted." >&2
  exit 1
fi

git push origin "$BRANCH"

echo
echo "DONE: TOKEN FLOW / Recent pipeline state removed and pushed to $BRANCH."
