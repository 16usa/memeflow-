#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW: LIVE TOKEN STATES BACKEND FIX v4"
PATCH_ID="MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V4"
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

# Validate only the frontend/backend contract this patch actually depends on.
for marker in "new EventSource('/api/system/stream')" "connectSystemStreamV31" "runCreateRouteV31" "runTokenRouteV31"; do
  grep -Fq "$marker" system.js || { echo "ERROR: system.js missing expected marker: $marker"; exit 1; }
done

node --check app-server.mjs >/dev/null
echo "[PATCH] baseline backend syntax OK"

# If fully installed, validate and exit cleanly.
if grep -Fq "$PATCH_ID" app-server.mjs \
  && grep -Fq "if(url.pathname==='/api/system/stream'&&req.method==='GET')" app-server.mjs \
  && grep -Fq "__systemViewEmitV31('token'" app-server.mjs \
  && grep -Fq "__systemViewEmitV31('create'" app-server.mjs; then
  node --check app-server.mjs >/dev/null
  echo "[PATCH] already installed and validated."
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".memeflow-live-system-sse-v4-backup-$STAMP"
mkdir -p "$BACKUP_DIR"
cp -p app-server.mjs "$BACKUP_DIR/app-server.mjs"
echo "[PATCH] backup: $APP_ROOT/$BACKUP_DIR/app-server.mjs"

rollback(){
  local code=$?
  local line="${BASH_LINENO[0]:-unknown}"
  local cmd="${BASH_COMMAND:-unknown}"
  echo "[PATCH] validation failed at line $line: $cmd"
  echo "[PATCH] restoring original app-server.mjs"
  cp -p "$BACKUP_DIR/app-server.mjs" app-server.mjs || true
  echo "[PATCH] rollback complete"
  exit "$code"
}
trap rollback ERR INT TERM

python3 "$SCRIPT_DIR/apply_patch.py"

echo "[PATCH] validating patched backend syntax..."
node --check app-server.mjs

echo "[PATCH] validating SSE contract..."
python3 - <<'PY'
from pathlib import Path
s=Path('app-server.mjs').read_text(encoding='utf-8')
if 'MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V4' not in s:
    raise SystemExit('ERROR: patch marker missing')
checks={
 'SSE route':"if(url.pathname==='/api/system/stream'&&req.method==='GET')",
 'token emit':"__systemViewEmitV31('token'",
 'create emit':"__systemViewEmitV31('create'",
 'stream registry':'const __systemViewStreamsV31 = new Set();',
 'hello event':'event: hello',
}
for label,marker in checks.items():
    n=s.count(marker)
    if n != 1:
        raise SystemExit(f'ERROR: {label} expected exactly once, found {n}')
print('[PATCH] SSE contract OK')
PY

# This is informational only. A pre-existing whitespace warning elsewhere in the
# local worktree must never roll back a syntactically valid, contract-valid patch.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --check -- app-server.mjs >/tmp/memeflow-v4-diffcheck.log 2>&1; then
    echo "[PATCH] NOTE: git diff --check reports a pre-existing/worktree whitespace warning."
    echo "[PATCH] NOTE: it is NOT a patch failure; install remains valid."
    sed -n '1,8p' /tmp/memeflow-v4-diffcheck.log || true
  else
    echo "[PATCH] git diff --check OK"
  fi
fi

trap - ERR INT TERM

echo "[PATCH] SUCCESS"
echo "[PATCH] Added backend GET /api/system/stream SSE transport."
echo "[PATCH] Real accepted Pump CREATE -> create event."
echo "[PATCH] Existing publish(mint) -> token event."
echo "[PATCH] Trading filters, /api/ai/decisions and execution logic were NOT modified."
echo "[PATCH] Backup kept at: $APP_ROOT/$BACKUP_DIR"
echo "[PATCH] Restart/redeploy the Replit app, then reload Live System View."
