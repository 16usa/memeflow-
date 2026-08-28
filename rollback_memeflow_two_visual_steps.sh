#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW — SAFE TWO-STEP VISUAL ROLLBACK
#
# Current visual chain:
#   4b201cc  Extend single Mission Control theme to standalone pages  <-- TARGET
#   5e3b5df  Reduce nested borders
#   37a1da2  Modernize terminal UI
#
# This restores ONLY the five visual files touched by the last two UI passes
# to their exact state at 4b201cc.
#
# It does NOT touch:
# - runtime JSON/state
# - API/server code
# - trading logic
# - chart JS/data
# - 3D renderer JS/CSS
# - old backups / untracked files

TARGET_COMMIT="4b201ccbd3bf4df5d1866573312f86ab77576ce3"

if [[ -d "memeflow-app" ]]; then
  APP="memeflow-app"
elif [[ -f "memeflow-brand.css" ]]; then
  APP="."
else
  echo "ERROR: Run this from the MEMEFLOW repository root or memeflow-app." >&2
  exit 1
fi

FILES=(
  "$APP/index.html"
  "$APP/memeflow-brand.css"
  "$APP/system.html"
  "$APP/system-tokens.html"
  "$APP/trading.html"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "ERROR: Missing $f" >&2; exit 1; }
done

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: Current branch is '$BRANCH'. Switch to main first." >&2
  exit 1
fi

git fetch origin

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"

if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "ERROR: Local main is not identical to origin/main." >&2
  echo "Local : $LOCAL_HEAD" >&2
  echo "Remote: $REMOTE_HEAD" >&2
  echo "Rollback stopped safely." >&2
  exit 1
fi

# Make sure target commit is available locally.
git cat-file -e "${TARGET_COMMIT}^{commit}" 2>/dev/null || {
  echo "ERROR: Target commit $TARGET_COMMIT is not available." >&2
  exit 1
}

# Unrelated dirty runtime files are allowed.
# Only the visual files we are about to restore must not contain uncommitted edits.
if ! git diff --quiet -- "${FILES[@]}"; then
  echo "ERROR: One of the five visual files has uncommitted local edits." >&2
  git status --short -- "${FILES[@]}"
  echo "Rollback stopped; nothing was changed." >&2
  exit 1
fi

if ! git diff --cached --quiet -- "${FILES[@]}"; then
  echo "ERROR: One of the visual files is already staged." >&2
  git status --short -- "${FILES[@]}"
  echo "Rollback stopped; nothing was changed." >&2
  exit 1
fi

# Never absorb unrelated staged files into the rollback commit.
STAGED_OTHER="$(git diff --cached --name-only || true)"
if [[ -n "$STAGED_OTHER" ]]; then
  echo "ERROR: Unrelated files are currently staged:" >&2
  printf '%s\n' "$STAGED_OTHER" >&2
  echo "Unstage them first. Rollback stopped safely." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-before-two-step-rollback-$STAMP"
mkdir -p "$BACKUP"

for f in "${FILES[@]}"; do
  cp "$f" "$BACKUP/$(basename "$f")"
done

echo "Backup of current visual files: $BACKUP"
echo
echo "Restoring exact visual state from:"
git show -s --format='  %h  %s' "$TARGET_COMMIT"

# Restore the five visual files exactly as they existed at 4b201cc.
git restore --source="$TARGET_COMMIT" --worktree -- "${FILES[@]}"

# Sanity checks.
git diff --check -- "${FILES[@]}"

echo
echo "Rollback diff:"
git diff --stat -- "${FILES[@]}"

# Confirm the restored files exactly match the target commit byte-for-byte in Git.
for f in "${FILES[@]}"; do
  if ! git diff --quiet "$TARGET_COMMIT" -- "$f"; then
    echo "ERROR: $f does not exactly match target commit after restore." >&2
    echo "Restoring backup..." >&2
    for bf in "$BACKUP"/*; do
      base="$(basename "$bf")"
      for original in "${FILES[@]}"; do
        if [[ "$(basename "$original")" == "$base" ]]; then
          cp "$bf" "$original"
        fi
      done
    done
    exit 1
  fi
done

echo "Exact-target verification passed."

git add -- "${FILES[@]}"

echo
echo "Staged rollback files only:"
git diff --cached --name-only

git commit \
  -m "Rollback last two MEMEFLOW visual refinements" \
  -- "${FILES[@]}"

git push origin main

echo
echo "DONE — visual UI restored exactly to commit 4b201cc."
echo "Removed from the live tree:"
echo "  - 5e3b5df Reduce nested borders"
echo "  - 37a1da2 Modernize terminal UI"
echo "Runtime data and application logic were untouched."
