#!/usr/bin/env bash

BRANCH="main"
INTERVAL=10

echo "AUTO PUSH STARTED → branch: $BRANCH"

while true; do
  if [ -n "$(git status --porcelain)" ]; then
    echo "Changes detected..."

    git add -A

    git commit -m "Auto update $(date '+%Y-%m-%d %H:%M:%S')" || true

    if git push origin "$BRANCH"; then
      echo "✓ PUSHED $(date '+%H:%M:%S')"
    else
      echo "✗ PUSH FAILED — will retry on next change"
    fi
  fi

  sleep "$INTERVAL"
done
