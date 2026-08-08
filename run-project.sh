#!/usr/bin/env bash
set -u

ROOT="$HOME/workspace"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[PROJECT] Starting MEMEFLOW..."
(
  cd "$ROOT/memeflow-app"
  exec node app-server.mjs
) &
PIDS+=($!)

echo "[PROJECT] Starting memeflow web..."
(
  cd "$ROOT/runtime-components/memeflow-old"
  exec pnpm run replit-internal-dev
) &
PIDS+=($!)

echo "[PROJECT] Starting API Server on 8080..."
(
  cd "$ROOT/runtime-components/api-server"
  export PORT=8080
  exec pnpm run replit-internal-dev
) &
PIDS+=($!)

echo "[PROJECT] Starting mockup-sandbox on 8081..."
(
  cd "$ROOT/runtime-components/mockup-sandbox"
  export PORT=8081
  export BASE_PATH=/
  exec pnpm run replit-internal-dev
) &
PIDS+=($!)

echo "[PROJECT] All services launched."
echo "[PROJECT] PIDs: ${PIDS[*]}"

wait -n "${PIDS[@]}"
STATUS=$?

echo "[PROJECT] A service stopped with status $STATUS. Stopping all services..."
exit "$STATUS"
