#!/usr/bin/env bash

INTERVAL=8

cd "$(git rev-parse --show-toplevel)" || exit 1

echo "AUTO PUSH STARTED"

while true; do

  BRANCH="$(git branch --show-current)"

  if [ -z "$BRANCH" ]; then
    echo "No active branch"
    sleep "$INTERVAL"
    continue
  fi

  if [ -n "$(git status --porcelain)" ]; then

    git add -A

    if ! git diff --cached --quiet; then

      git commit \
        -m "Auto update $(date '+%Y-%m-%d %H:%M:%S')" \
        >> auto-push.log 2>&1

      git push origin "$BRANCH" \
        >> auto-push.log 2>&1

      echo "PUSHED → $BRANCH $(date '+%H:%M:%S')" \
        >> auto-push.log
    fi
  fi

  sleep "$INTERVAL"
done
