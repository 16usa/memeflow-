#!/usr/bin/env bash
set -euo pipefail

PATCH_NAME="MEMEFLOW Token Flow V29 cache-bust fix"
HTML="memeflow-app/system-tokens.html"
CSS="memeflow-app/system-tokens.css"
NEW_VER="token-flow-left-media-v29-20260904-0415"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/token-flow-cache-bust-v30-${STAMP}"

echo "==> ${PATCH_NAME}"
git rev-parse --is-inside-work-tree >/dev/null
test -f "$HTML"
test -f "$CSS"

CURRENT_BRANCH="$(git branch --show-current)"
OLD_HEAD="$(git rev-parse HEAD)"

if [ -z "$CURRENT_BRANCH" ]; then
  echo "ERROR: detached HEAD."
  exit 1
fi

# V29 must actually exist in the local CSS before cache-busting it.
if ! grep -q "MEMEFLOW_TOKEN_FLOW_LEFT_MEDIA_V29" "$CSS"; then
  echo "ERROR: V29 CSS marker is not present locally."
  echo "Nothing changed."
  exit 1
fi

# Do not disturb any staged HTML work.
if ! git diff --cached --quiet -- "$HTML"; then
  echo "ERROR: $HTML has staged changes. Nothing changed."
  exit 1
fi

echo "==> Current branch: $CURRENT_BRANCH"
echo "==> Current CSS href:"
grep -o 'system-tokens\.css?v=[^"]*' "$HTML" | head -1 || true

echo "==> Creating exact backup of CURRENT working HTML/CSS..."
TMP_INDEX="$(mktemp)"
trap 'rm -f "$TMP_INDEX"; [ -n "${TMP_WT:-}" ] && git worktree remove --force "$TMP_WT" >/dev/null 2>&1 || true' EXIT
rm -f "$TMP_INDEX"

GIT_INDEX_FILE="$TMP_INDEX" git read-tree HEAD
GIT_INDEX_FILE="$TMP_INDEX" git add -- "$HTML" "$CSS"
TREE_SHA="$(GIT_INDEX_FILE="$TMP_INDEX" git write-tree)"
BACKUP_COMMIT="$(
  printf '%s\n' "backup: exact Token Flow HTML/CSS before V30 cache bust" |
  git commit-tree "$TREE_SHA" -p "$OLD_HEAD"
)"
git branch "$BACKUP_BRANCH" "$BACKUP_COMMIT"

if ! git push origin "$BACKUP_BRANCH"; then
  git branch -D "$BACKUP_BRANCH" >/dev/null 2>&1 || true
  echo "ERROR: backup push failed. Nothing changed."
  exit 1
fi

echo "==> Backup pushed: $BACKUP_BRANCH"

# First update the live Replit working file, preserving every unrelated local edit.
python3 - <<PY
from pathlib import Path
import re

p = Path("$HTML")
s = p.read_text(encoding="utf-8")
new, n = re.subn(
    r'(href="/system-tokens\.css\?v=)[^"]+(")',
    r'\g<1>$NEW_VER\2',
    s,
    count=1,
)
if n != 1:
    raise SystemExit("ERROR: expected exactly one system-tokens.css link")
p.write_text(new, encoding="utf-8")
print("Working HTML cache key updated.")
PY

# Create a clean one-line Git commit from HEAD in a detached temporary worktree,
# so unrelated local HTML edits are NOT included in the commit.
TMP_WT="$(mktemp -d)"
rmdir "$TMP_WT"
git worktree add --detach "$TMP_WT" "$OLD_HEAD" >/dev/null

python3 - <<PY
from pathlib import Path
import re

p = Path("$TMP_WT") / "$HTML"
s = p.read_text(encoding="utf-8")
new, n = re.subn(
    r'(href="/system-tokens\.css\?v=)[^"]+(")',
    r'\g<1>$NEW_VER\2',
    s,
    count=1,
)
if n != 1:
    raise SystemExit("ERROR: expected exactly one system-tokens.css link in clean worktree")
p.write_text(new, encoding="utf-8")
PY

(
  cd "$TMP_WT"
  git add "$HTML"
  git diff --cached --check
  git commit -m "fix(token-flow): bust CSS cache for left-media v29" >/dev/null
)

NEW_COMMIT="$(git -C "$TMP_WT" rev-parse HEAD)"

echo "==> Pushing one-line cache-bust commit..."
git push origin "$NEW_COMMIT:refs/heads/$CURRENT_BRANCH"

# Advance local branch ref to the same commit without touching unrelated worktree files,
# then sync only this file's index to the new HEAD. Working file keeps all local edits.
git update-ref "refs/heads/$CURRENT_BRANCH" "$NEW_COMMIT" "$OLD_HEAD"
git reset --mixed HEAD -- "$HTML" >/dev/null

echo "==> New CSS href:"
grep -o 'system-tokens\.css?v=[^"]*' "$HTML" | head -1 || true

echo
echo "DONE"
echo "Commit: $NEW_COMMIT"
echo "Backup branch: $BACKUP_BRANCH"
echo "Cache key: $NEW_VER"
echo "Unrelated local changes preserved."
