#!/usr/bin/env bash
set -Eeuo pipefail
export GIT_PAGER=cat
export PAGER=cat

PATCH_ID="MEMEFLOW_WALLET_CLUSTER_RISK_V3"
EXPECTED_HEAD="3a6335b24934e7cb6091722aa699f951fea22566"
COMMIT_MSG="[MEMEFLOW_WALLET_CLUSTER_RISK_V3] Add linked-wallet cluster risk"

log(){ printf '[WALLET-RISK-V3-FINISH] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || die "Run this inside the MEMEFLOW Git repository."
cd "$ROOT"

REMOTE="$(git remote get-url origin 2>/dev/null || true)"
[[ "$REMOTE" == *"16usa/memeflow-"* ]] || die "Unexpected origin: $REMOTE"

BRANCH="$(git branch --show-current)"
[[ "$BRANCH" == "main" ]] || die "Expected branch main, found '$BRANCH'."

git fetch origin main
REMOTE_SHA="$(git rev-parse origin/main)"
LOCAL_SHA="$(git rev-parse HEAD)"

[[ "$REMOTE_SHA" == "$EXPECTED_HEAD" ]] || die "origin/main moved to $REMOTE_SHA. Do not finish the old staged patch."
[[ "$LOCAL_SHA" == "$EXPECTED_HEAD" ]] || die "Local HEAD moved to $LOCAL_SHA. Expected the pre-patch HEAD $EXPECTED_HEAD."

if [[ -d "$ROOT/memeflow-app" ]]; then
  PREFIX="memeflow-app/"
  APP="$ROOT/memeflow-app"
else
  PREFIX=""
  APP="$ROOT"
fi

EXPECTED=(
  "${PREFIX}app-server.mjs"
  "${PREFIX}src/enrich.mjs"
  "${PREFIX}src/evaluate.mjs"
  "${PREFIX}src/settings-gate.mjs"
  "${PREFIX}src/settings.mjs"
  "${PREFIX}src/wallet-cluster-risk.mjs"
  "${PREFIX}tests/wallet-cluster-risk-v3.mjs"
)

EXPECTED_SORTED="$(printf '%s\n' "${EXPECTED[@]}" | sort)"
ACTUAL_SORTED="$(git diff --cached --name-only | sort)"

if [[ "$ACTUAL_SORTED" != "$EXPECTED_SORTED" ]]; then
  printf '[WALLET-RISK-V3-FINISH] STOP: staged set is not the exact V3 set.\nExpected:\n%s\nActual:\n%s\n' \
    "$EXPECTED_SORTED" "$ACTUAL_SORTED" >&2
  exit 1
fi

# There must be no extra unstaged edits on the seven V3-owned files.
for rel in "${EXPECTED[@]}"; do
  git diff --quiet -- "$rel" || die "Unstaged edit detected on V3-owned file: $rel"
done

cd "$APP"

for f in \
  app-server.mjs \
  src/enrich.mjs \
  src/evaluate.mjs \
  src/settings-gate.mjs \
  src/settings.mjs \
  src/wallet-cluster-risk.mjs \
  tests/wallet-cluster-risk-v3.mjs
do
  [[ -f "$f" ]] || die "Missing staged V3 file: $f"
done

grep -q "$PATCH_ID" app-server.mjs || die "V3 marker missing in app-server.mjs"
grep -q "$PATCH_ID" src/evaluate.mjs || die "V3 marker missing in evaluate.mjs"
grep -q "$PATCH_ID" src/settings-gate.mjs || die "V3 marker missing in settings-gate.mjs"
grep -q "$PATCH_ID" src/settings.mjs || die "V3 marker missing in settings.mjs"
grep -q "$PATCH_ID" src/wallet-cluster-risk.mjs || die "V3 marker missing in wallet-cluster-risk.mjs"
grep -q "holderRiskWallets" src/enrich.mjs || die "holderRiskWallets sample missing from enrich.mjs"

# The two controls were already present before V3 and must NOT be part of this commit.
if git -C "$ROOT" diff --cached --name-only | grep -Eq '(^|/)system\.js$|(^|/)settings-page\.js$'; then
  die "Settings UI file unexpectedly staged. V3 must reuse, not duplicate, the existing controls."
fi

log "Re-running focused V3 test..."
node tests/wallet-cluster-risk-v3.mjs

log "Re-running full MEMEFLOW test suite..."
npm test

cd "$ROOT"
git diff --cached --check

log "Final remote race check..."
git fetch origin main
LATEST_REMOTE="$(git rev-parse origin/main)"
[[ "$LATEST_REMOTE" == "$EXPECTED_HEAD" ]] || die "origin/main moved during tests to $LATEST_REMOTE. No commit/push performed."

log "Committing the already-tested staged V3 changes..."
git commit -m "$COMMIT_MSG"
NEW_SHA="$(git rev-parse HEAD)"
git push origin HEAD:main

log "SUCCESS"
log "Pushed $NEW_SHA to origin/main"
log "The previous V3 failure was only a repo-root path-prefix check (memeflow-app/), not a code/test failure."
