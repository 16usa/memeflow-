#!/usr/bin/env bash

set -u

ROOT="$HOME/workspace"

echo "[PROJECT V66] Starting MEMEFLOW watchdog..."

cd "$ROOT/memeflow-app" || exit 1

STOPPING=0
CHILD=""

shutdown() {
  STOPPING=1

  echo "[PROJECT V66] stopping..."

  if [ -n "${CHILD:-}" ]; then
    kill -TERM "$CHILD" 2>/dev/null || true
    wait "$CHILD" 2>/dev/null || true
  fi

  exit 0
}

trap shutdown TERM INT HUP


while true; do

  STARTED_AT="$(date +%s)"

  echo "[PROJECT V66] launching app-server.mjs"

  node app-server.mjs &

  CHILD=$!

  wait "$CHILD"

  CODE=$?

  CHILD=""

  if [ "$STOPPING" -eq 1 ]; then
    exit 0
  fi

  NOW="$(date +%s)"
  RUNTIME=$((NOW - STARTED_AT))

  echo \
    "[PROJECT V66] server exited code=$CODE runtime=${RUNTIME}s"

  # Avoid a hot restart loop if startup itself is failing.
  if [ "$RUNTIME" -lt 5 ]; then
    echo "[PROJECT V66] rapid failure; retrying in 5s"
    sleep 5
  else
    echo "[PROJECT V66] unexpected exit; restarting in 2s"
    sleep 2
  fi

done
