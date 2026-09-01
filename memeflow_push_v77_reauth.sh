#!/usr/bin/env bash
set -Eeuo pipefail

BRANCH="chart-debug-20260829-161234"
V76="17b2787ecf75f92a8ff6450ac1eb039bd3c66446"
V77_PREFIX="c7028a55"
V77_EXPECTED="c7028a550774b819668d62cfa1630cb117d9fc23"
V77_SUBJECT="perf: linearize active scanner user ids"

ROOT="${1:-.}"
cd "$ROOT"

REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$REPO" ]] || { echo "ERROR: run inside MEMEFLOW git repository."; exit 1; }
cd "$REPO"

die(){ echo "PUSH REFUSED: $*" >&2; exit 1; }

echo "==> Locate already-created V77 commit"

V77="$(git rev-parse "${V77_PREFIX}^{commit}" 2>/dev/null || true)"

[[ -n "$V77" ]] || {
  echo "ERROR: existing V77 commit $V77_PREFIX not found locally."
  echo "Nothing was changed."
  exit 1
}

echo "Found V77: $V77"

[[ "$V77" == "$V77_EXPECTED" ]] || {
  echo "ERROR: V77 hash mismatch."
  echo "Expected: $V77_EXPECTED"
  echo "Actual:   $V77"
  exit 1
}

echo "==> Verify exact V77 lineage + subject"

PARENT="$(git rev-parse "${V77}^")"
[[ "$PARENT" == "$V76" ]] || {
  echo "Expected parent: $V76"
  echo "Actual parent:   $PARENT"
  die "V77 parent is not exact V76"
}

SUBJECT="$(git show -s --format=%s "$V77")"
[[ "$SUBJECT" == "$V77_SUBJECT" ]] || {
  echo "Expected subject: $V77_SUBJECT"
  echo "Actual subject:   $SUBJECT"
  die "V77 subject mismatch"
}

echo "Lineage: EXACT"
echo "Subject: EXACT"

echo "==> Verify remote is still exact V76"

git fetch --quiet origin "$BRANCH"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [[ "$REMOTE" == "$V77" ]]; then
  echo
  echo "============================================================"
  echo "SUCCESS — MEMEFLOW V77 ALREADY PUSHED"
  echo "============================================================"
  echo "Remote: $REMOTE"
  echo "Nothing else was changed."
  echo "============================================================"
  exit 0
fi

[[ "$REMOTE" == "$V76" ]] || {
  echo "Expected remote V76: $V76"
  echo "Actual remote:       $REMOTE"
  die "remote moved; do not push V77 blindly"
}

echo "Remote exact V76: CONFIRMED"

echo "==> Authenticate GitHub if necessary"

if command -v gh >/dev/null 2>&1; then
  if ! gh auth status --hostname github.com >/dev/null 2>&1; then
    echo
    echo "GitHub authentication is required."
    echo "Complete the GitHub login flow shown below."
    echo
    gh auth login --hostname github.com --git-protocol https --web
  fi
  gh auth setup-git
else
  echo "ERROR: GitHub CLI (gh) is not available."
  exit 1
fi

echo "==> Re-check remote immediately before push"

git fetch --quiet origin "$BRANCH"
REMOTE="$(git rev-parse "origin/$BRANCH")"

[[ "$REMOTE" == "$V76" ]] || {
  echo "Expected remote V76: $V76"
  echo "Actual remote:       $REMOTE"
  die "remote changed during authentication"
}

echo "==> Push EXISTING V77 — no rebuild"
git push origin "${V77}:refs/heads/${BRANCH}"

echo "==> Verify exact remote V77"

git fetch --quiet origin "$BRANCH"
REMOTE_AFTER="$(git rev-parse "origin/$BRANCH")"

[[ "$REMOTE_AFTER" == "$V77" ]] || {
  echo "Expected remote V77: $V77"
  echo "Actual remote:       $REMOTE_AFTER"
  echo "ERROR: post-push verification failed."
  exit 2
}

echo
echo "============================================================"
echo "SUCCESS — MEMEFLOW V77 RECOVERED + PUSHED"
echo "============================================================"
echo "Branch: $BRANCH"
echo "V76:    $V76"
echo "V77:    $V77"
echo "Remote: exact V77 verified"
echo "V77 was NOT rebuilt."
echo "Main workspace was NOT switched/reset/stashed."
echo "============================================================"
