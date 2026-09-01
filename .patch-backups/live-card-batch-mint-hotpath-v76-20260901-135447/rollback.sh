#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_COMMIT="17b2787ecf75f92a8ff6450ac1eb039bd3c66446"
BRANCH="chart-debug-20260829-161234"

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

git fetch --quiet origin "$BRANCH"
REMOTE="$(git rev-parse "origin/$BRANCH")"

git merge-base --is-ancestor "$PATCH_COMMIT" "$REMOTE" || {
  echo "Rollback refused: V76 is not an ancestor of remote."
  exit 1
}

TMP="$(mktemp -d /tmp/memeflow-v76-rollback-XXXXXX)"
WT="$TMP/wt"

git worktree add --detach "$WT" "$REMOTE" >/dev/null

cleanup(){
  set +e
  cd "$ROOT" >/dev/null 2>&1 || true
  git worktree remove --force "$WT" >/dev/null 2>&1 || true
  git worktree prune >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cd "$WT"
git revert --no-edit "$PATCH_COMMIT"
(cd memeflow-app && npm test)

git fetch --quiet origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$REMOTE" ]] || {
  echo "Rollback refused: remote moved during validation."
  exit 1
}

git push origin "HEAD:$BRANCH"
echo "V76 reverted and pushed."
echo "Main workspace untouched."
