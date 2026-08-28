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

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

# Remove visible blocks from the System Settings page.
patterns = [
    # 1) Real-Time Architecture title block
    re.compile(
        r'\n\s*<div class="scene-title glass mf-architecture-title-standalone-v3">.*?</div>\s*',
        re.S,
    ),
    # 2) Decision legend strip (WAITING / WATCH / BLOCKED / BUY READY)
    re.compile(
        r'\n\s*<aside class="legend glass mf-legend-standalone-v4"[^>]*>.*?</aside>\s*',
        re.S,
    ),
    # 3) Telemetry counters block (Events / Trade events / Holder queue / ...)
    re.compile(
        r'\n\s*<section class="telemetry glass mf-telemetry-standalone-v3"[^>]*>.*?</section>\s*',
        re.S,
    ),
    # 4) Old TOKEN FLOW block, if still present
    re.compile(
        r'\n\s*<section class="activity-panel glass">.*?<div id="tokenRail" class="token-rail"></div>\s*</section>\s*',
        re.S,
    ),
]

for rx in patterns:
    html = rx.sub('\n', html, count=1)

# Remove compatibility placeholders if an earlier patch added hidden anchors.
html = re.sub(r'\n\s*<!-- TOKEN FLOW panel intentionally removed\..*?-->\s*', '\n', html, count=1, flags=re.S)
html = re.sub(r'\n\s*<div id="tokenRail"[^>]*></div>\s*', '\n', html, count=1, flags=re.S)
html = re.sub(r'\n\s*<span id="telemetryMode"[^>]*>.*?</span>\s*', '\n', html, count=1, flags=re.S)

# JS guards so missing DOM nodes do not throw.
old_render = "function renderRail(sample = []) {\n  $('tokenRail').innerHTML = sample.length"
new_render = "function renderRail(sample = []) {\n  const tokenRailEl = $('tokenRail');\n  if (!tokenRailEl) return;\n  tokenRailEl.innerHTML = sample.length"
if old_render in js:
    js = js.replace(old_render, new_render, 1)
elif "const tokenRailEl = $('tokenRail');" not in js:
    raise SystemExit("ERROR: Could not safely patch renderRail() in system.js. No files were changed.")

old_metrics = "  $('eventCount').textContent = discovery?.eventsReceived ?? '—';\n  $('tradeCount').textContent = diag?.liveTradeFeed?.tradeEventsDecoded ?? discovery?.liveTradeFeed?.tradeEventsDecoded ?? '—';\n  $('holderQueue').textContent = discovery?.holderQueueDepth ?? '—';\n  $('activeUsers').textContent = discovery?.activeEvaluationUsers ?? '—';\n  $('freshBacklog').textContent = diag?.bridge?.currentFreshBacklog ?? '—';\n  $('lastEvent').textContent = ago(discovery?.lastEventAt);\n  $('lastSync').textContent = `updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;"
new_metrics = "  const eventCountEl = $('eventCount');\n  if (eventCountEl) eventCountEl.textContent = discovery?.eventsReceived ?? '—';\n  const tradeCountEl = $('tradeCount');\n  if (tradeCountEl) tradeCountEl.textContent = diag?.liveTradeFeed?.tradeEventsDecoded ?? discovery?.liveTradeFeed?.tradeEventsDecoded ?? '—';\n  const holderQueueEl = $('holderQueue');\n  if (holderQueueEl) holderQueueEl.textContent = discovery?.holderQueueDepth ?? '—';\n  const activeUsersEl = $('activeUsers');\n  if (activeUsersEl) activeUsersEl.textContent = discovery?.activeEvaluationUsers ?? '—';\n  const freshBacklogEl = $('freshBacklog');\n  if (freshBacklogEl) freshBacklogEl.textContent = diag?.bridge?.currentFreshBacklog ?? '—';\n  const lastEventEl = $('lastEvent');\n  if (lastEventEl) lastEventEl.textContent = ago(discovery?.lastEventAt);\n  const lastSyncEl = $('lastSync');\n  if (lastSyncEl) lastSyncEl.textContent = `updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;"
if old_metrics in js:
    js = js.replace(old_metrics, new_metrics, 1)
elif "const eventCountEl = $('eventCount');" not in js:
    raise SystemExit("ERROR: Could not safely patch telemetry counters in system.js. No files were changed.")

old_mode = "  $('telemetryMode').classList.toggle('offline', !(diag || discovery));\n  $('telemetryMode').lastChild.textContent = (diag || discovery) ? 'LIVE' : 'DEGRADED';"
new_mode = "  const telemetryModeEl = $('telemetryMode');\n  if (telemetryModeEl) {\n    telemetryModeEl.classList.toggle('offline', !(diag || discovery));\n    if (telemetryModeEl.lastChild) {\n      telemetryModeEl.lastChild.textContent = (diag || discovery) ? 'LIVE' : 'DEGRADED';\n    }\n  }"
if old_mode in js:
    js = js.replace(old_mode, new_mode, 1)
elif "const telemetryModeEl = $('telemetryMode');" not in js:
    raise SystemExit("ERROR: Could not safely patch telemetry mode in system.js. No files were changed.")

# Clean up excessive blank lines.
html = re.sub(r'\n{3,}', '\n\n', html)

# Verification: these visible page blocks should be gone.
for forbidden in [
    'class="scene-title glass mf-architecture-title-standalone-v3"',
    'class="legend glass mf-legend-standalone-v4"',
    'class="telemetry glass mf-telemetry-standalone-v3"',
    'class="activity-panel glass"',
    'TOKEN FLOW',
    'Recent pipeline state',
    'Live MEMEFLOW pipeline',
]:
    if forbidden in html:
        raise SystemExit(f"ERROR: Verification failed: {forbidden!r} is still present in system.html")

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
print('OK: Removed architecture title, legend, telemetry, and TOKEN FLOW blocks; system.js patched safely.')
PY

echo
echo "--- diff ---"
git diff -- memeflow-app/system.html memeflow-app/system.js

if git diff --quiet -- memeflow-app/system.html memeflow-app/system.js; then
  echo "No changes to commit."
  exit 0
fi

git add memeflow-app/system.html memeflow-app/system.js
git commit -m "Remove extra architecture and telemetry blocks from system page"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" || -z "$BRANCH" ]]; then
  echo "ERROR: Detached HEAD; commit created locally but push was not attempted." >&2
  exit 1
fi

git push origin "$BRANCH"

echo
echo "DONE: Removed the marked blocks from System Settings and pushed to $BRANCH."
