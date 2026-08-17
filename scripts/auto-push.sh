#!/usr/bin/env bash
set -e

cd "$(git rev-parse --show-toplevel)"

BRANCH="$(git branch --show-current)"
MSG="${1:-MEMEFLOW auto update $(date '+%Y-%m-%d %H:%M:%S')}"

echo "=== MEMEFLOW AUTO PUSH ==="
echo "Branch: $BRANCH"

git add -A

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$MSG"
fi

echo "Pushing origin/$BRANCH..."
git push origin "$BRANCH"

echo "=== PUSH COMPLETE ==="
