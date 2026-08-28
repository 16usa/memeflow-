#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW: LIVE TOKEN STATES BACKEND FIX v3"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

echo "=== $PATCH_NAME ==="

find_root(){
  local c
  for c in \
    "$PWD" \
    "$PWD/memeflow-app" \
    "$HOME/workspace" \
    "$HOME/workspace/memeflow-app" \
    "/home/runner/workspace" \
    "/home/runner/workspace/memeflow-app" \
    "/workspace" \
    "/workspace/memeflow-app"
  do
    if [[ -f "$c/app-server.mjs" && -f "$c/system.js" ]]; then
      (cd "$c" && pwd -P)
      return 0
    fi
  done
  return 1
}

APP_ROOT="$(find_root || true)"
if [[ -z "$APP_ROOT" ]]; then
  echo "ERROR: MEMEFLOW app root not found (need app-server.mjs + system.js)."
  exit 1
fi
cd "$APP_ROOT"
echo "[PATCH] app root: $APP_ROOT"

# Fail before modifying anything if this is not the frontend that actually expects the SSE.
for marker in "new EventSource('/api/system/stream')" "connectSystemStreamV31" "runCreateRouteV31" "runTokenRouteV31"; do
  grep -Fq "$marker" system.js || { echo "ERROR: system.js missing expected marker: $marker"; exit 1; }
done

node --check app-server.mjs >/dev/null
echo "[PATCH] baseline backend syntax OK"

# If fully installed, validate and exit cleanly.
if grep -Fq 'MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V3' app-server.mjs \
  && grep -Fq "if(url.pathname==='/api/system/stream'&&req.method==='GET')" app-server.mjs \
  && grep -Fq "__systemViewEmitV31('token'" app-server.mjs \
  && grep -Fq "__systemViewEmitV31('create'" app-server.mjs; then
  node --check app-server.mjs >/dev/null
  echo "[PATCH] already installed and validated."
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".memeflow-live-system-sse-v3-backup-$STAMP"
mkdir -p "$BACKUP_DIR"
cp -p app-server.mjs "$BACKUP_DIR/app-server.mjs"
echo "[PATCH] backup: $APP_ROOT/$BACKUP_DIR/app-server.mjs"

rollback(){
  local code=$?
  echo "[PATCH] validation failed — restoring original app-server.mjs"
  cp -p "$BACKUP_DIR/app-server.mjs" app-server.mjs || true
  echo "[PATCH] rollback complete"
  exit "$code"
}
trap rollback ERR INT TERM

python3 "$SCRIPT_DIR/apply_patch.py"

node --check app-server.mjs >/dev/null

grep -Fq 'MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V3' app-server.mjs
grep -Fq "if(url.pathname==='/api/system/stream'&&req.method==='GET')" app-server.mjs
grep -Fq "__systemViewEmitV31('token'" app-server.mjs
grep -Fq "__systemViewEmitV31('create'" app-server.mjs
grep -Fq "new EventSource('/api/system/stream')" system.js

# Trading Terminal must stay on the qualified-candidate contract.
if [[ -f index.html ]]; then
  grep -Fq "/api/ai/decisions?scope=candidates&limit=50" index.html || {
    echo "ERROR: Trading Terminal candidate contract changed unexpectedly."
    false
  }
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check -- app-server.mjs >/dev/null
fi

trap - ERR INT TERM

echo "[PATCH] SUCCESS"
echo "[PATCH] Added backend GET /api/system/stream SSE transport."
echo "[PATCH] Real Pump CREATE -> create event."
echo "[PATCH] Existing publish(mint) -> token event."
echo "[PATCH] Trading candidate feed and trading rules were NOT modified."
echo "[PATCH] Backup kept at: $APP_ROOT/$BACKUP_DIR"
echo "[PATCH] Restart/redeploy the Replit app, then reload Live System View."
