#!/usr/bin/env bash
set -Eeuo pipefail

# MEMEFLOW V75 FINAL LOCAL RECOVERY
#
# Purpose:
#   Finalize local recovery after V75 was already pushed successfully.
#
# Why the previous recovery stopped:
#   git stash apply attempted to restore untracked files that ALREADY EXISTED
#   in the workspace. Git correctly refused to overwrite them.
#
# This script does NOT reset, stash, push, delete, or overwrite existing local
# files. It:
#   - verifies exact V75 locally + remotely
#   - reconstructs the original V75 safety stash in an isolated worktree
#   - compares all NON-VOLATILE tracked local work against that proof
#   - verifies existing untracked files
#   - restores ONLY missing untracked files from the isolated proof
#   - allows live runtime DB/state files to drift
#
# Remote is never modified.

BRANCH="chart-debug-20260829-161234"
V74="889080ff01435dd5178061f939f9984ca358e0c2"
V75="5e4cf44fcbc919c630b7cdbf4b95b22e7417b1a3"
ORIGINAL_STASH_PREFIX="1a46806e31fdd5239557c660917ef93d5dd5d84b"

ROOT="${1:-.}"
cd "$ROOT"

die(){ echo "RECOVERY REFUSED: $*" >&2; exit 1; }

REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$REPO" ]] || die "not inside MEMEFLOW git repository"
cd "$REPO"

echo "==> Verify branch / local HEAD / remote V75"

[[ "$(git branch --show-current)" == "$BRANCH" ]] || die "unexpected branch"

git fetch --quiet origin "$BRANCH"

[[ "$(git rev-parse HEAD)" == "$V75" ]] || {
  echo "expected local HEAD: $V75"
  echo "actual local HEAD:   $(git rev-parse HEAD)"
  die "local HEAD is not exact V75"
}

[[ "$(git rev-parse "origin/$BRANCH")" == "$V75" ]] || {
  echo "expected remote: $V75"
  echo "actual remote:   $(git rev-parse "origin/$BRANCH")"
  die "remote is not exact V75"
}

[[ "$(git rev-parse "$V75^")" == "$V74" ]] || die "V75 parent is not exact V74"

echo "Exact V75 local + remote: CONFIRMED"

echo "==> Locate original retained V75 safety stash"

ORIGINAL_STASH=""

for ref in $(git stash list --format='%gd'); do
  oid="$(git rev-parse "$ref" 2>/dev/null || true)"
  [[ -n "$oid" ]] || continue
  if [[ "$oid" == "$ORIGINAL_STASH_PREFIX"* ]]; then
    ORIGINAL_STASH="$oid"
    break
  fi
done

if [[ -z "$ORIGINAL_STASH" ]]; then
  while read -r ref; do
    [[ -n "$ref" ]] || continue
    msg="$(git stash list --format='%gd %s' | awk -v r="$ref" '$1==r{sub($1 FS,"");print;exit}')"
    case "$msg" in
      *"MEMEFLOW V75 preserve current local work"*|\
      *"MEMEFLOW V75.1 preserve current local work"*|\
      *"MEMEFLOW V75.2 preserve current local work"*)
        oid="$(git rev-parse "$ref")"
        base="$(git rev-parse "$oid^1" 2>/dev/null || true)"
        if [[ "$base" == "$V74" || "$base" == "22885346b48ac5231d13c00b120b76f414b0de37" ]]; then
          ORIGINAL_STASH="$oid"
          break
        fi
        ;;
    esac
  done < <(git stash list --format='%gd')
fi

[[ -n "$ORIGINAL_STASH" ]] || die "original V75 safety stash not found"

echo "Original safety stash: $ORIGINAL_STASH"

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d /tmp/memeflow-v75-final-recovery-XXXXXX)"
WT="$TMP/proof"
PROOF_ADDED=0

cleanup(){
  local rc=$?
  set +e
  cd "$REPO" >/dev/null 2>&1 || true
  [[ "$PROOF_ADDED" == "1" ]] && git worktree remove --force "$WT" >/dev/null 2>&1 || true
  git worktree prune >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true
  exit "$rc"
}
trap cleanup EXIT

echo "==> Build isolated proof of original local work on exact V75"

git worktree add --detach "$WT" "$V75" >/dev/null
PROOF_ADDED=1

RESTORE_MODE=""

if (cd "$WT" && git stash apply --index "$ORIGINAL_STASH") >"$TMP/proof-index.log" 2>&1; then
  RESTORE_MODE="index"
else
  (
    cd "$WT"
    git reset --hard "$V75" >/dev/null
    git clean -fd >/dev/null 2>&1 || true
  )

  if (cd "$WT" && git stash apply "$ORIGINAL_STASH") >"$TMP/proof-content.log" 2>&1; then
    RESTORE_MODE="content"
  else
    echo "RECOVERY STOPPED: original stash cannot be reconstructed even in clean proof worktree."
    cat "$TMP/proof-index.log" || true
    cat "$TMP/proof-content.log" || true
    echo "Nothing in main workspace or remote was changed."
    exit 2
  fi
fi

echo "Isolated proof: OK ($RESTORE_MODE)"

# Live runtime files are intentionally excluded from byte-for-byte checks.
EXCLUDES=(
  ':(exclude)memeflow-app/data/state.json'
  ':(exclude)memeflow-app/data/state.json.bak'
  ':(exclude)memeflow-app/data/platform-trade-analytics-v2.sqlite'
  ':(exclude)memeflow-app/data/platform-trade-analytics-v2.sqlite-shm'
  ':(exclude)memeflow-app/data/platform-trade-analytics-v2.sqlite-wal'
)

(
  cd "$WT"

  git diff --cached --binary HEAD -- . "${EXCLUDES[@]}" \
    > "$TMP/proof-index-nonvolatile.patch"

  git diff --binary -- . "${EXCLUDES[@]}" \
    > "$TMP/proof-working-nonvolatile.patch"

  git ls-files --others --exclude-standard -z \
    > "$TMP/proof-untracked.z"
)

echo "==> Verify current NON-VOLATILE tracked local work"

cd "$REPO"

git diff --cached --binary HEAD -- . "${EXCLUDES[@]}" \
  > "$TMP/main-index-nonvolatile.patch"

git diff --binary -- . "${EXCLUDES[@]}" \
  > "$TMP/main-working-nonvolatile.patch"

cmp -s "$TMP/proof-index-nonvolatile.patch" "$TMP/main-index-nonvolatile.patch" || {
  echo "RECOVERY STOPPED SAFELY:"
  echo "Current staged NON-VOLATILE local work differs from original stash proof."
  echo "No files were overwritten. Remote V75 is untouched."
  exit 3
}

cmp -s "$TMP/proof-working-nonvolatile.patch" "$TMP/main-working-nonvolatile.patch" || {
  echo "RECOVERY STOPPED SAFELY:"
  echo "Current working NON-VOLATILE local work differs from original stash proof."
  echo "No files were overwritten. Remote V75 is untouched."
  exit 3
}

echo "Non-volatile tracked local work: EXACT"

echo "==> Verify/restore ONLY missing untracked files"

RESTORED=0
ALREADY=0

while IFS= read -r -d '' path; do
  if [[ -e "$REPO/$path" || -L "$REPO/$path" ]]; then
    echo "already exists, keep: $path"
    ALREADY=$((ALREADY+1))
    continue
  fi

  src="$WT/$path"

  if [[ ! -e "$src" && ! -L "$src" ]]; then
    echo "ERROR: proof path missing unexpectedly: $path"
    exit 4
  fi

  mkdir -p "$REPO/$(dirname "$path")"
  cp -a -- "$src" "$REPO/$path"
  echo "restored missing: $path"
  RESTORED=$((RESTORED+1))
done < "$TMP/proof-untracked.z"

echo "Existing untracked kept: $ALREADY"
echo "Missing untracked restored: $RESTORED"

echo "==> Verify every original untracked proof path now exists"

MISSING=0
while IFS= read -r -d '' path; do
  if [[ ! -e "$REPO/$path" && ! -L "$REPO/$path" ]]; then
    echo "MISSING: $path"
    MISSING=$((MISSING+1))
  fi
done < "$TMP/proof-untracked.z"

[[ "$MISSING" == "0" ]] || die "$MISSING original untracked paths still missing"

echo "Original untracked local paths: VERIFIED"

echo "==> Verify live runtime files are present/current"

for f in \
  memeflow-app/data/state.json \
  memeflow-app/data/state.json.bak \
  memeflow-app/data/platform-trade-analytics-v2.sqlite \
  memeflow-app/data/platform-trade-analytics-v2.sqlite-shm \
  memeflow-app/data/platform-trade-analytics-v2.sqlite-wal
do
  if [[ -e "$f" ]]; then
    echo "live runtime file present: $f"
  fi
done

echo "==> Final exact V75 verification"

git fetch --quiet origin "$BRANCH"

[[ "$(git rev-parse HEAD)" == "$V75" ]] || die "local HEAD moved unexpectedly"
[[ "$(git rev-parse "origin/$BRANCH")" == "$V75" ]] || die "remote moved unexpectedly"

# Evidence is created only after all recovery checks, so it cannot interfere
# with comparisons above.
EVIDENCE=".patch-backups/v75-final-local-recovery-$STAMP"
mkdir -p "$EVIDENCE"
printf '%s\n' "$V75" > "$EVIDENCE/v75.txt"
printf '%s\n' "$ORIGINAL_STASH" > "$EVIDENCE/original-stash.txt"
git status --short > "$EVIDENCE/status-after.txt" || true

trap - EXIT
git worktree remove --force "$WT" >/dev/null
PROOF_ADDED=0
git worktree prune >/dev/null 2>&1 || true
rm -rf "$TMP"

echo
echo "============================================================"
echo "SUCCESS — V75 LOCAL RECOVERY FINALIZED"
echo "============================================================"
echo "V75 local:  exact"
echo "V75 remote: exact"
echo "Non-volatile tracked local work: EXACT"
echo "Original untracked local paths: VERIFIED"
echo "Existing untracked files were NOT overwritten"
echo "Live state/SQLite byte drift: ALLOWED"
echo "Original safety stash retained: $ORIGINAL_STASH"
echo "Evidence: $EVIDENCE"
echo "Remote was NOT modified."
echo "============================================================"
