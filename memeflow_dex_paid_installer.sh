#!/usr/bin/env bash
set -euo pipefail

BRANCH="memeflow-logo-sync"
TARGET_COMMIT="ac79a33e19bc61158d0948657b5f9f49b5885aa3"

cd "$(git rev-parse --show-toplevel)"

echo "=== MEMEFLOW DEX PAID INSTALLER ==="

CURRENT_BRANCH="$(git branch --show-current)"

if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "ERROR: Expected branch '$BRANCH', current branch is '$CURRENT_BRANCH'."
  exit 1
fi

git fetch origin "$BRANCH"

if ! git cat-file -e "${TARGET_COMMIT}^{commit}" 2>/dev/null; then
  echo "ERROR: Target DEX Paid commit is not available after fetch."
  exit 1
fi

if git merge-base --is-ancestor "$TARGET_COMMIT" HEAD; then
  echo "DEX Paid patch is already installed."
else
  if ! git merge-base --is-ancestor HEAD "$TARGET_COMMIT"; then
    echo "ERROR: Local branch has diverged from the DEX Paid patch commit."
    echo "No files were changed."
    exit 1
  fi

  echo "Checking incoming files for local conflicts..."

  CONFLICTS=0

  while IFS= read -r FILE; do
    [ -z "$FILE" ] && continue

    if [ -n "$(git status --porcelain -- "$FILE")" ]; then
      echo "LOCAL CHANGE: $FILE"
      CONFLICTS=1
    fi
  done < <(git diff --name-only HEAD "$TARGET_COMMIT")

  if [ "$CONFLICTS" -ne 0 ]; then
    echo "ERROR: Local changes overlap files required by the DEX Paid patch."
    echo "No files were changed."
    exit 1
  fi

  git merge --ff-only "$TARGET_COMMIT"
fi

echo
echo "=== VALIDATION ==="

node --check memeflow-app/app-server.mjs

grep -Fq "orders/v1/solana" memeflow-app/app-server.mjs
grep -Fq "dexPaid" memeflow-app/src/dex-view-filter.mjs
git grep -q "DEX Paid" -- memeflow-app

echo "DEX Paid API check: OK"
echo "DEX Paid query compatibility: OK"
echo "DEX Paid labels: OK"

echo
echo "=== PUSH VERIFICATION ==="

git push origin "$BRANCH"

echo
echo "========================================"
echo "DONE"
echo "DEX Paid patch is installed"
echo "Existing unrelated local files were not staged or committed"
echo "Branch: $BRANCH"
echo "Commit: $TARGET_COMMIT"
echo "========================================"

git status --short
