#!/usr/bin/env bash
set -euo pipefail

echo "[patch] MEMEFLOW OWNER TRUTH FIX V3.1 SAFE"

if [ -f "/home/runner/workspace/memeflow-app/owner-intelligence.js" ]; then
  APP="/home/runner/workspace/memeflow-app"
elif [ -f "./memeflow-app/owner-intelligence.js" ]; then
  APP="$(cd ./memeflow-app && pwd)"
else
  echo "[patch] ERROR: owner-intelligence.js not found"
  exit 1
fi

JS="$APP/owner-intelligence.js"
HTML="$APP/owner-intelligence.html"

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$APP/.owner-intelligence-v31-$STAMP.tmp.js"
BACKUP="$JS.truth-v31-$STAMP.bak"

echo "[patch] checking current JS first..."

node --check "$JS" >/dev/null

cp "$JS" "$BACKUP"
cp "$JS" "$TMP"

python3 - "$TMP" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

MARKER = "MEMEFLOW_OWNER_TRUTH_FIX_V31"

if MARKER in text:
    print("[patch] V3.1 already present")
    raise SystemExit(0)

# ------------------------------------------------------------
# 1. Honest OpenAI status
# ------------------------------------------------------------

old = """function renderAiStatus(ai={}){
  const node=$('aiStatus');

  const status=
    ai.configured!==true
      ? 'offline'
      : String(ai.lastStatus||'unknown');

  node.className=
    `oi-ai-status ${
      status==='online'
        ? 'online'
        : status==='offline'
          ? 'offline'
          : ''
    }`;

  if(ai.configured!==true){
    node.textContent='AI · NOT CONFIGURED';
    return;
  }

  if(status==='offline'){
    node.textContent='AI · OFFLINE';
    return;
  }

  if(status==='online'){
    node.textContent='AI · ONLINE';
    return;
  }

  node.textContent='AI · READY';
}"""

new = """function renderAiStatus(ai={}){
  /* MEMEFLOW_OWNER_TRUTH_FIX_V31 */

  const node=$('aiStatus');
  if(!node)return;

  const configured=
    ai?.configured===true;

  const status=
    String(ai?.lastStatus||'unknown')
      .toLowerCase();

  const lastError=
    String(ai?.lastError||'');

  node.className='oi-ai-status';

  if(!configured){
    node.classList.add('offline');
    node.textContent='AI · NOT CONFIGURED';
    node.title='OpenAI API key is not configured.';
    return;
  }

  if(lastError==='AI_CREDITS_REQUIRED'){
    node.classList.add('offline');
    node.textContent='AI · NO CREDITS';
    node.title='OpenAI API billing/credits are unavailable.';
    return;
  }

  if(status==='online'){
    node.classList.add('online');
    node.textContent='AI · ONLINE';
    node.title='A successful Owner AI request was confirmed.';
    return;
  }

  if(status==='offline'){
    node.classList.add('offline');
    node.textContent='AI · OFFLINE';
    node.title='The most recent Owner AI request failed.';
    return;
  }

  node.textContent='AI · CONFIGURED';
  node.title=
    'OpenAI is configured, but online API access has not yet been confirmed.';
}"""

if old not in text:
    raise SystemExit(
        "[patch] ERROR: renderAiStatus block differs from expected version. "
        "Nothing was changed."
    )

text = text.replace(old, new, 1)

# ------------------------------------------------------------
# 2. "AI score" -> truthful "Score" in Top Reasons display
# ------------------------------------------------------------

old_reason = "${esc(r.name)}"
new_reason = "${esc(String(r.name||'').replace('AI score','Score'))}"

if old_reason not in text:
    raise SystemExit(
        "[patch] ERROR: Top Reasons rendering anchor not found. "
        "Nothing was changed."
    )

text = text.replace(
    old_reason,
    new_reason,
    1
)

# ------------------------------------------------------------
# 3. Historical factor-data message
# ------------------------------------------------------------

old_message = "Not enough completed trades yet"

new_message = (
    "Waiting for trades with saved entry snapshots. "
    "Older backfilled trades may not contain these entry metrics; "
    "new trades will populate this factor automatically."
)

if old_message not in text:
    print(
        "[patch] factor empty-state text already changed "
        "or not present"
    )
else:
    text = text.replace(
        old_message,
        new_message
    )

path.write_text(
    text,
    encoding="utf-8"
)

print("[patch] temporary JS prepared")
PY

echo "[patch] validating NEW JavaScript before installation..."

if ! node --check "$TMP"; then
  echo
  echo "[patch] ERROR: new JS failed validation"
  echo "[patch] ORIGINAL FILE WAS NOT TOUCHED"
  rm -f "$TMP"
  exit 1
fi

echo "[patch] validation passed"

mv "$TMP" "$JS"

# ------------------------------------------------------------
# Cache bust only after valid JS is installed
# ------------------------------------------------------------

python3 - "$HTML" "$STAMP" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
stamp = sys.argv[2]

text = path.read_text(encoding="utf-8")

text = re.sub(
    r'/owner-intelligence\.js\?v=[^"\']+',
    f'/owner-intelligence.js?v=truth-v31-{stamp}',
    text
)

text = re.sub(
    r'/owner-intelligence\.css\?v=[^"\']+',
    f'/owner-intelligence.css?v=truth-v31-{stamp}',
    text
)

path.write_text(
    text,
    encoding="utf-8"
)
PY

# Final safety check
node --check "$JS"

echo
echo "============================================================"
echo "[patch] SUCCESS — OWNER TRUTH FIX V3.1"
echo "============================================================"
echo
echo "FIXED:"
echo "  AI · READY -> AI · CONFIGURED"
echo "  Successful request -> AI · ONLINE"
echo "  Billing failure -> AI · NO CREDITS"
echo "  Failed request -> AI · OFFLINE"
echo "  AI score -> Score"
echo "  Historical entry-data message corrected"
echo
echo "NOT TOUCHED:"
echo "  Trading Engine"
echo "  BUY / SELL"
echo "  Score calculation"
echo "  Risk Engine"
echo "  Platform Learning database"
echo "  User settings"
echo "  Open positions"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "NEXT:"
echo "  1. Restart Replit"
echo "  2. Reload OWNER INTELLIGENCE"
echo "============================================================"
