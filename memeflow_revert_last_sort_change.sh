#!/usr/bin/env bash
set -euo pipefail

TARGET_COMMIT="8e07ada588ddefa5bd25d7f1f8596c6300198e03"
PARENT_COMMIT="02112f38f8068a6b9d83f02f75443bb302f7ab3a"
PUSH=0

if [[ "${1:-}" == "--push" ]]; then
  PUSH=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: bash memeflow_revert_last_sort_change.sh [--push]" >&2
  exit 64
fi

find_repo() {
  local candidate
  for candidate in "$PWD" "$HOME/workspace/memeflow-app" "$HOME/workspace"; do
    if git -C "$candidate" rev-parse --show-toplevel >/dev/null 2>&1; then
      git -C "$candidate" rev-parse --show-toplevel
      return 0
    fi
  done
  return 1
}

REPO="$(find_repo || true)"
if [[ -z "$REPO" ]]; then
  echo "ERROR: Git repository not found." >&2
  exit 1
fi

cd "$REPO"
echo "Repository: $REPO"

git fetch origin main --quiet

git cat-file -e "${TARGET_COMMIT}^{commit}"
git cat-file -e "${PARENT_COMMIT}^{commit}"

CURRENT_HEAD="$(git rev-parse HEAD)"
if [[ "$CURRENT_HEAD" != "$TARGET_COMMIT" ]]; then
  echo "ERROR: HEAD is not the commit that should be reverted." >&2
  echo "Expected: $TARGET_COMMIT" >&2
  echo "Actual:   $CURRENT_HEAD" >&2
  echo "No changes were made." >&2
  exit 2
fi

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  if ! git diff --quiet -- "$file" || ! git diff --cached --quiet -- "$file"; then
    echo "ERROR: Local changes overlap the commit being reverted: $file" >&2
    echo "No changes were made." >&2
    exit 3
  fi
done < <(git diff-tree --no-commit-id --name-only -r "$TARGET_COMMIT")

STASHED=0
if [[ -n "$(git status --porcelain)" ]]; then
  git stash push -u -m "memeflow-auto-stash-before-sort-revert" >/dev/null
  STASHED=1
  echo "Unrelated local changes were safely stashed."
fi

restore_stash() {
  if [[ "$STASHED" -eq 1 ]]; then
    if git stash apply stash@{0}; then
      git stash drop stash@{0} >/dev/null
      echo "Local changes restored."
    else
      echo "WARNING: The rollback succeeded, but local changes could not be auto-restored." >&2
      echo "The stash was kept as stash@{0}." >&2
      return 1
    fi
  fi
}

if ! git revert --no-edit "$TARGET_COMMIT"; then
  git revert --abort >/dev/null 2>&1 || true
  restore_stash || true
  echo "ERROR: Revert failed. Repository rollback was aborted." >&2
  exit 4
fi

EXPECTED_TREE="$(git rev-parse "${PARENT_COMMIT}^{tree}")"
ACTUAL_TREE="$(git rev-parse "HEAD^{tree}")"
if [[ "$ACTUAL_TREE" != "$EXPECTED_TREE" ]]; then
  echo "ERROR: Postcheck failed: reverted tree does not match the previous version." >&2
  echo "Expected tree: $EXPECTED_TREE" >&2
  echo "Actual tree:   $ACTUAL_TREE" >&2
  exit 5
fi

echo "Postcheck OK: repository tree exactly matches $PARENT_COMMIT."

if [[ "$PUSH" -eq 1 ]]; then
  git push origin HEAD:main
  echo "Push OK: main now contains the rollback commit."
fi

restore_stash

echo "Rollback complete."
echo "Current HEAD: $(git rev-parse --short HEAD)"
echo "Restored state: $PARENT_COMMIT"
