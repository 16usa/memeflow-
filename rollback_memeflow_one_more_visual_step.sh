#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW — SAFE ONE-MORE-STEP VISUAL ROLLBACK
#
# Target:
#   d289624  Unify all app screens with Mission Control visual system
#
# This removes the next visual step:
#   4b201cc  Extend single Mission Control theme to standalone pages
#
# It restores ONLY the 4 files changed by 4b201cc:
#   memeflow-brand.css
#   system.html
#   system-tokens.html
#   trading.html
#
# It DOES NOT touch runtime data, API/server code, trading logic,
# chart data/JS, 3D renderer files, or unrelated backups.

TARGET_COMMIT="d289624f7c3428fa3548ef1ebf2479261fd93f7b"

if [[ -d "memeflow-app" ]]; then
  APP="memeflow-app"
elif [[ -f "memeflow-brand.css" ]]; then
  APP="."
else
  echo "ERROR: Run this from the MEMEFLOW repository root or memeflow-app." >&2
  exit 1
fi

FILES=(
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

git cat-file -e "${TARGET_COMMIT}^{commit}" 2>/dev/null || {
  echo "ERROR: Target commit $TARGET_COMMIT is not available." >&2
  exit 1
}

# Dirty runtime / backup files are allowed.
# Only the four visual files being restored must be clean.
if ! git diff --quiet -- "${FILES[@]}"; then
  echo "ERROR: One of the 4 visual files has uncommitted local edits." >&2
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

STAGED_OTHER="$(git diff --cached --name-only || true)"
if [[ -n "$STAGED_OTHER" ]]; then
  echo "ERROR: Unrelated files are currently staged:" >&2
  printf '%s\n' "$STAGED_OTHER" >&2
  echo "Unstage them first. Rollback stopped safely." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-before-one-more-rollback-$STAMP"
mkdir -p "$BACKUP"

for f in "${FILES[@]}"; do
  cp "$f" "$BACKUP/$(basename "$f")"
done

echo "Backup of current visual files: $BACKUP"
echo
echo "Restoring exact visual state from:"
git show -s --format='  %h  %s' "$TARGET_COMMIT"

git restore --source="$TARGET_COMMIT" --worktree -- "${FILES[@]}"

git diff --check -- "${FILES[@]}"

echo
echo "Rollback diff:"
git diff --stat -- "${FILES[@]}"

# Byte-for-byte Git verification against d289624.
for f in "${FILES[@]}"; do
  if ! git diff --quiet "$TARGET_COMMIT" -- "$f"; then
    echo "ERROR: $f does not exactly match target commit after restore." >&2
    echo "Restoring local backup..." >&2
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
  -m "Rollback standalone Mission Control visual extension" \
  -- "${FILES[@]}"

git push origin main

echo
echo "DONE — visual UI restored exactly to commit d289624."
echo "Removed visual step:"
echo "  - 4b201cc Extend single Mission Control theme to standalone pages"
echo "Runtime data and application logic were untouched."
