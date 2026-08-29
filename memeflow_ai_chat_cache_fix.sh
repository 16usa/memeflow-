#!/usr/bin/env bash
set -euo pipefail

echo "[patch] MEMEFLOW AI Chat cache-bust fix"

if [ -f "/home/runner/workspace/memeflow-app/trading.html" ]; then
  APP="/home/runner/workspace/memeflow-app"
elif [ -f "./memeflow-app/trading.html" ]; then
  APP="$(cd ./memeflow-app && pwd)"
else
  echo "[patch] ERROR: trading.html not found"
  exit 1
fi

HTML="$APP/trading.html"
JS="$APP/trading-ai-chat.js"

STAMP="$(date +%Y%m%d%H%M%S)"

cp "$HTML" "$HTML.ai-cache-fix-$STAMP.bak"

python3 - "$HTML" "$STAMP" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
stamp = sys.argv[2]

text = path.read_text(encoding="utf-8")

text = re.sub(
    r'/trading-ai-chat\.css\?v=[^"\']+',
    f'/trading-ai-chat.css?v=offline-{stamp}',
    text
)

text = re.sub(
    r'/trading-ai-chat\.js\?v=[^"\']+',
    f'/trading-ai-chat.js?v=offline-{stamp}',
    text
)

path.write_text(text, encoding="utf-8")
PY

if ! grep -q "MEMEFLOW_AI_GRACEFUL_OFFLINE_V1" "$JS"; then
  echo "[patch] ERROR: graceful-offline JS patch is missing"
  exit 1
fi

echo
echo "[patch] SUCCESS"
echo "[patch] Browser cache version changed to: $STAMP"
echo "[patch] Graceful offline handler confirmed in JS"
echo "[patch] Trading logic unchanged"
echo
echo "[patch] Restart Replit app, then reopen Trading Terminal"
