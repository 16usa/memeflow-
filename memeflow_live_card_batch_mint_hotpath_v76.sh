#!/usr/bin/env bash
set -Eeuo pipefail

# MEMEFLOW_LIVE_CARD_BATCH_MINT_HOTPATH_V76_INSTALLER
#
# Exact baseline:
#   branch: chart-debug-20260829-161234
#   V75:    5e4cf44fcbc919c630b7cdbf4b95b22e7417b1a3
#
# V76 optimizes ONLY /api/system/live-token-card-batch request-mint normalization.
#
# Before V76:
#   requested
#     .map(normalize every item)
#     .filter(Boolean)
#     -> new Set(all unique normalized mints)
#     -> spread all unique mints to array
#     -> slice(0,200)
#
# The route never uses more than 200 unique valid mints, so V76 builds the
# first 200 unique normalized mints directly and stops. This is exactly
# equivalent to map -> filter -> Set -> spread -> slice(0,200), including
# duplicate order, invalid rows, whitespace, numbers, booleans and nullish
# values under the current String(mint||'').trim() semantics.
#
# No card selection, visibility, holder refresh, OPEN-position handling,
# Entry Admission, score/ranking, wallet-risk, holder metrics or execution
# logic changes.
#
# Local-work restoration is volatile-aware:
#   state.json/state.json.bak and platform-trade-analytics SQLite files may
#   legitimately change while the app is running and are NOT byte-compared.

BRANCH="chart-debug-20260829-161234"
V74="889080ff01435dd5178061f939f9984ca358e0c2"
V75="5e4cf44fcbc919c630b7cdbf4b95b22e7417b1a3"
V75_SUBJECT="perf: bound wallet risk sample normalization"

SERVER="memeflow-app/app-server.mjs"
PACKAGE="memeflow-app/package.json"
TEST="memeflow-app/tests/live-card-batch-mint-hotpath-v76.mjs"

ROOT="${1:-.}"
cd "$ROOT"

REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$REPO" ]] || { echo "ERROR: run inside MEMEFLOW git repository."; exit 1; }
cd "$REPO"

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d "/tmp/memeflow-v76-${STAMP}-XXXXXX")"
PATCH_WT="$TMP/patch"
VERIFY_WT="$TMP/verify"

PATCH_WT_ADDED=0
VERIFY_WT_ADDED=0
LOCAL_STASH=""
PATCH_COMMIT=""
PUSHED=0
RESTORE_MODE="none"

cleanup(){
  local rc=$?
  set +e
  cd "$REPO" >/dev/null 2>&1 || true
  [[ "$VERIFY_WT_ADDED" == "1" ]] && git worktree remove --force "$VERIFY_WT" >/dev/null 2>&1 || true
  [[ "$PATCH_WT_ADDED" == "1" ]] && git worktree remove --force "$PATCH_WT" >/dev/null 2>&1 || true
  git worktree prune >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true
  exit "$rc"
}
trap cleanup EXIT

die(){ echo "PATCH REFUSED: $*" >&2; exit 1; }

echo "==> V76 exact branch / local / remote preflight"

[[ "$(git branch --show-current)" == "$BRANCH" ]] || die "unexpected branch"

[[ "$(git rev-parse HEAD)" == "$V75" ]] || {
  echo "expected local HEAD: $V75"
  echo "actual local HEAD:   $(git rev-parse HEAD)"
  die "local HEAD is not exact V75"
}

git fetch --quiet origin "$BRANCH"

[[ "$(git rev-parse "origin/$BRANCH")" == "$V75" ]] || {
  echo "expected remote: $V75"
  echo "actual remote:   $(git rev-parse "origin/$BRANCH")"
  die "remote is not exact V75"
}

[[ "$(git rev-parse "$V75^")" == "$V74" ]] || die "V75 parent is not exact V74"

[[ "$(git show -s --format=%s "$V75")" == "$V75_SUBJECT" ]] || die "V75 subject changed"

echo "Exact V75 local + remote: CONFIRMED"

echo "==> Preserve ALL current local work"

if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
  git stash push -u -m "MEMEFLOW V76 preserve current local work $STAMP" >/dev/null
  LOCAL_STASH="$(git rev-parse stash@{0})"

  [[ "$(git rev-parse "$LOCAL_STASH^1")" == "$V75" ]] || die "safety stash base mismatch"

  echo "Safety stash: $LOCAL_STASH"
else
  echo "Workspace had no local changes."
fi

echo "==> Create isolated V76 worktree from exact V75"

git worktree add --detach "$PATCH_WT" "$V75" >/dev/null
PATCH_WT_ADDED=1
cd "$PATCH_WT"

cat > "$TMP/v76_transform.py" <<'PY'
from pathlib import Path
import sys

mode=sys.argv[1]
path=Path(sys.argv[2])
text=path.read_text(encoding='utf-8')

def once(old,new,label):
    global text
    n=text.count(old)
    if n!=1:
        raise SystemExit(
            f"V76 REFUSED: {label}: expected exactly 1 target, found {n}"
        )
    text=text.replace(old,new,1)

if mode=="server":
    if "MEMEFLOW_LIVE_CARD_BATCH_MINT_HOTPATH_V76" in text:
        raise SystemExit("V76 REFUSED: server marker already exists")

    once(
"""  const mints=[
    ...new Set(
      requested
        .map(mint=>String(mint||'').trim())
        .filter(Boolean)
    )
  ].slice(0,200);
""",
"""  // MEMEFLOW_LIVE_CARD_BATCH_MINT_HOTPATH_V76
  // Exact first-200 unique normalized semantics without normalizing/spreading
  // the rest of an oversized request.
  const mints=[];
  const seenMints=new Set();

  for(const rawMint of requested){
    const mint=
      String(rawMint||'').trim();

    if(
      !mint ||
      seenMints.has(mint)
    ){
      continue;
    }

    seenMints.add(mint);
    mints.push(mint);

    if(mints.length>=200){
      break;
    }
  }
""",
"live-card batch mint normalization"
    )

elif mode=="package":
    old='node tests/wallet-risk-sample-hotpath-v75.mjs'
    new=old+' && node tests/live-card-batch-mint-hotpath-v76.mjs'
    if 'node tests/live-card-batch-mint-hotpath-v76.mjs' in text:
        raise SystemExit("V76 REFUSED: package already contains V76")
    once(old,new,"test:core V75 tail")
else:
    raise SystemExit("unknown transform mode")

path.write_text(text,encoding='utf-8')
PY

echo "==> Verify exact V75 live-card target shape"

python3 - "$SERVER" "$PACKAGE" <<'PY'
from pathlib import Path
import sys

app=Path(sys.argv[1]).read_text(encoding='utf-8')
pkg=Path(sys.argv[2]).read_text(encoding='utf-8')

start=app.index('// MEMEFLOW_LIVE_CARD_BATCH_V18')
end=app.index('const settings=store.settings(u.id)||{};',start)
block=app[start:end]

required=[
  "Array.isArray(requestBody?.mints)",
  "...new Set(",
  ".map(mint=>String(mint||'').trim())",
  ".filter(Boolean)",
  "].slice(0,200);",
  "__mfTouchVisibleHolderMintsV4(mints);"
]

for marker in required:
    if marker not in block:
        raise SystemExit(
            "V76 REFUSED: exact V75 marker missing: "+marker
        )

if "node tests/wallet-risk-sample-hotpath-v75.mjs" not in pkg:
    raise SystemExit("V76 REFUSED: V75 package tail missing")

print("V75 live-card batch target: CONFIRMED")
PY

echo "==> Apply V76 transforms"

python3 "$TMP/v76_transform.py" server "$SERVER"
python3 "$TMP/v76_transform.py" package "$PACKAGE"

cat > "$TEST" <<'TESTJS'
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const pkg=JSON.parse(
  fs.readFileSync(
    new URL('../package.json',import.meta.url),
    'utf8'
  )
);

const start=app.indexOf(
  '// MEMEFLOW_LIVE_CARD_BATCH_V18'
);
const end=app.indexOf(
  'const settings=store.settings(u.id)||{};',
  start
);

assert.ok(start>=0 && end>start);
const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_LIVE_CARD_BATCH_MINT_HOTPATH_V76/
);

assert.match(
  block,
  /const mints=\[\]/
);

assert.match(
  block,
  /const seenMints=new Set\(\)/
);

assert.match(
  block,
  /for\(const rawMint of requested\)/
);

assert.match(
  block,
  /if\(mints\.length>=200\)\{\s*break;\s*\}/
);

assert.doesNotMatch(
  block,
  /\.\.\.new Set\(/
);

function oldMints(requested){
  return [
    ...new Set(
      requested
        .map(mint=>String(mint||'').trim())
        .filter(Boolean)
    )
  ].slice(0,200);
}

function newMints(requested){
  const mints=[];
  const seen=new Set();

  for(const rawMint of requested){
    const mint=String(rawMint||'').trim();

    if(!mint||seen.has(mint))continue;

    seen.add(mint);
    mints.push(mint);

    if(mints.length>=200)break;
  }

  return mints;
}

// Large request with invalids + duplicates after and before unique values.
{
  const requested=[];

  for(let i=0;i<100_000;i++){
    if(i%11===0){
      requested.push(null);
    }else if(i%11===1){
      requested.push('');
    }else if(i%11===2){
      requested.push('   ');
    }else if(i%11===3){
      requested.push('mint-'+(i%37));
    }else if(i%11===4){
      requested.push('  mint-'+i+'  ');
    }else if(i%11===5){
      requested.push(i);
    }else if(i%11===6){
      requested.push(false);
    }else if(i%11===7){
      requested.push(true);
    }else{
      requested.push('mint-'+i);
    }
  }

  assert.deepEqual(
    newMints(requested),
    oldMints(requested)
  );

  assert.equal(
    newMints(requested).length,
    200
  );
}

// Exact insertion-order / duplicate / String(...||'') behavior.
{
  const requested=[
    ' a ',
    'a',
    'b',
    0,
    false,
    null,
    undefined,
    true,
    1,
    '1',
    '   ',
    'c',
    'b',
    'd'
  ];

  assert.deepEqual(
    newMints(requested),
    oldMints(requested)
  );
}

// Under-200 requests remain exact.
{
  const requested=[
    'x',
    ' y ',
    'x',
    '',
    'z'
  ];

  assert.deepEqual(
    newMints(requested),
    ['x','y','z']
  );

  assert.deepEqual(
    newMints(requested),
    oldMints(requested)
  );
}

assert.match(
  block,
  /__mfTouchVisibleHolderMintsV4\(mints\)/
);

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/live-card-batch-mint-hotpath-v76\.mjs/
);

console.log('live card batch mint hotpath v76 ok');
TESTJS

echo "==> Syntax / JSON / diff"

node --check "$SERVER"
node --check "$TEST"

node --input-type=module -e \
  "import fs from 'node:fs';JSON.parse(fs.readFileSync('$PACKAGE','utf8'));console.log('package json ok')"

git diff --check -- "$SERVER" "$PACKAGE" "$TEST"

echo "==> Targeted V76 regressions"

(
  cd memeflow-app
  node tests/live-card-batch-mint-hotpath-v76.mjs
  node tests/per-mint-card-refresh-v18.mjs
  node tests/wallet-risk-sample-hotpath-v75.mjs
  node tests/scanner-prune-membership-hotpath-v74.mjs
  node tests/pre-admission-state-cleanup-v73.mjs
  node tests/history-eval-queue-hotpath-v72.mjs
  node tests/terminal-holder-truth-hotpath-v71.mjs
  node tests/holder-active-user-context-v70.mjs
  node tests/fast-holder-preview-hotpath-v69.mjs
  node tests/scanner-capacity-hotpath-v68.mjs
  node tests/holder-refresh-hotpath-v67.mjs
  node tests/discovery-bridge-hotpath-v66.mjs
  node tests/shadow-validation-hotpath-v65.mjs
  node tests/settings-reevaluate-hotpath-v64.mjs
  node tests/discovery-status-hotpath-v63.mjs
  node tests/pre-admission-sweep-hotpath-v62-4.mjs
  node tests/live-states-prefix-hotpath-v61.mjs
  node tests/ai-decisions-inventory-hotpath-v60.mjs
  node tests/terminal-paper-poll-hotpath-v59.mjs
  node tests/strict-entry-admission.mjs
  node tests/realtime-update-path.mjs
)

echo "==> Full npm test BEFORE commit"
(cd memeflow-app && npm test)

echo "==> Remove test-generated non-V76 mutations"

mapfile -t TRACKED_CHANGED < <(git diff --name-only)
for path in "${TRACKED_CHANGED[@]}"; do
  case "$path" in
    "$SERVER"|"$PACKAGE") ;;
    *) git restore --source=HEAD --staged --worktree -- "$path" ;;
  esac
done

mapfile -t UNTRACKED < <(git ls-files --others --exclude-standard)
for path in "${UNTRACKED[@]}"; do
  case "$path" in
    "$TEST") ;;
    *) rm -rf -- "$path" ;;
  esac
done

git diff --check -- "$SERVER" "$PACKAGE" "$TEST"

echo "==> Verify intended V76 files only"

mapfile -t MODIFIED < <(git diff --name-only)
mapfile -t UNTRACKED_AFTER < <(git ls-files --others --exclude-standard)

[[ "${#MODIFIED[@]}" -eq 2 ]] || {
  echo "ERROR: expected exactly 2 modified tracked V76 files."
  printf '  %s\n' "${MODIFIED[@]}"
  exit 1
}

[[ "${#UNTRACKED_AFTER[@]}" -eq 1 ]] || {
  echo "ERROR: expected exactly 1 untracked V76 test file."
  printf '  %s\n' "${UNTRACKED_AFTER[@]}"
  exit 1
}

for required in "$SERVER" "$PACKAGE"; do
  printf '%s\n' "${MODIFIED[@]}" | grep -Fxq "$required" || exit 1
done
printf '%s\n' "${UNTRACKED_AFTER[@]}" | grep -Fxq "$TEST" || exit 1

git add -- "$SERVER" "$PACKAGE" "$TEST"

echo "==> Commit V76 in isolated worktree"

git commit -m "perf: bound live card batch mint normalization"
PATCH_COMMIT="$(git rev-parse HEAD)"

echo "V76 commit: $PATCH_COMMIT"

EXCLUDES=(
  ':(exclude)memeflow-app/data/state.json'
  ':(exclude)memeflow-app/data/state.json.bak'
  ':(exclude)memeflow-app/data/platform-trade-analytics-v2.sqlite'
  ':(exclude)memeflow-app/data/platform-trade-analytics-v2.sqlite-shm'
  ':(exclude)memeflow-app/data/platform-trade-analytics-v2.sqlite-wal'
)

if [[ -n "$LOCAL_STASH" ]]; then
  echo "==> Prove local-work reconstruction on V76 BEFORE push"

  cd "$REPO"
  git worktree add --detach "$VERIFY_WT" "$PATCH_COMMIT" >/dev/null
  VERIFY_WT_ADDED=1

  if (cd "$VERIFY_WT" && git stash apply --index "$LOCAL_STASH") >"$TMP/proof-index.log" 2>&1; then
    RESTORE_MODE="index"
  else
    (
      cd "$VERIFY_WT"
      git reset --hard "$PATCH_COMMIT" >/dev/null
      git clean -fd >/dev/null 2>&1 || true
    )

    if (cd "$VERIFY_WT" && git stash apply "$LOCAL_STASH") >"$TMP/proof-content.log" 2>&1; then
      RESTORE_MODE="content"
    else
      echo "PATCH REFUSED BEFORE PUSH: local work conflicts with V76."
      cat "$TMP/proof-index.log" || true
      cat "$TMP/proof-content.log" || true
      echo "Safety stash retained: $LOCAL_STASH"
      exit 1
    fi
  fi

  (
    cd "$VERIFY_WT"

    git diff --cached --binary HEAD -- . "${EXCLUDES[@]}" \
      > "$TMP/proven-index-nonvolatile.patch"

    git diff --binary -- . "${EXCLUDES[@]}" \
      > "$TMP/proven-working-nonvolatile.patch"

    git ls-files --others --exclude-standard -z \
      > "$TMP/proven-untracked.z"
  )

  echo "Local-work V76 proof: OK ($RESTORE_MODE)"
fi

echo "==> Re-check remote immediately before push"

cd "$PATCH_WT"
git fetch --quiet origin "$BRANCH"

[[ "$(git rev-parse "origin/$BRANCH")" == "$V75" ]] || {
  echo "PATCH REFUSED: remote moved during V76 validation."
  exit 1
}

echo "==> Push V76"
git push origin "HEAD:$BRANCH"
PUSHED=1

echo "==> Move main workspace to V76"
cd "$REPO"
git reset --hard "$PATCH_COMMIT" >/dev/null

# Do not create any new repo-local recovery artifacts before applying the stash.
if [[ -n "$LOCAL_STASH" ]]; then
  echo "==> Restore original local work on V76"

  if [[ "$RESTORE_MODE" == "index" ]]; then
    if ! git stash apply --index "$LOCAL_STASH"; then
      git reset --hard "$PATCH_COMMIT" >/dev/null
      if ! git stash apply "$LOCAL_STASH"; then
        echo "V76 WAS pushed, but local stash replay conflicted."
        echo "Safety stash retained: $LOCAL_STASH"
        exit 2
      fi
      RESTORE_MODE="content"
    fi
  else
    if ! git stash apply "$LOCAL_STASH"; then
      echo "V76 WAS pushed, but local stash replay conflicted."
      echo "Safety stash retained: $LOCAL_STASH"
      exit 2
    fi
  fi

  echo "==> Verify NON-VOLATILE tracked local reconstruction"

  git diff --cached --binary HEAD -- . "${EXCLUDES[@]}" \
    > "$TMP/main-index-nonvolatile.patch"

  git diff --binary -- . "${EXCLUDES[@]}" \
    > "$TMP/main-working-nonvolatile.patch"

  cmp -s "$TMP/proven-index-nonvolatile.patch" "$TMP/main-index-nonvolatile.patch" || {
    echo "V76 WAS pushed."
    echo "ERROR: staged NON-VOLATILE reconstruction differs from proof."
    echo "Safety stash retained: $LOCAL_STASH"
    exit 3
  }

  cmp -s "$TMP/proven-working-nonvolatile.patch" "$TMP/main-working-nonvolatile.patch" || {
    echo "V76 WAS pushed."
    echo "ERROR: working NON-VOLATILE reconstruction differs from proof."
    echo "Safety stash retained: $LOCAL_STASH"
    exit 3
  }

  echo "Non-volatile tracked reconstruction: EXACT"

  MISSING=0
  while IFS= read -r -d '' path; do
    [[ -e "$REPO/$path" || -L "$REPO/$path" ]] || {
      echo "MISSING untracked local path: $path"
      MISSING=$((MISSING+1))
    }
  done < "$TMP/proven-untracked.z"

  [[ "$MISSING" == "0" ]] || {
    echo "V76 WAS pushed."
    echo "ERROR: $MISSING untracked local paths are missing."
    echo "Safety stash retained: $LOCAL_STASH"
    exit 4
  }

  echo "Untracked local paths: VERIFIED"
fi

echo "==> Final V76 integrity"

git fetch --quiet origin "$BRANCH"

[[ "$(git rev-parse HEAD)" == "$PATCH_COMMIT" ]] || die "local HEAD is not V76"
[[ "$(git rev-parse "origin/$BRANCH")" == "$PATCH_COMMIT" ]] || die "remote is not V76"

# Create rollback/evidence only after local recovery verification is complete.
BACKUP_REL=".patch-backups/live-card-batch-mint-hotpath-v76-$STAMP"
BACKUP="$REPO/$BACKUP_REL"
mkdir -p "$BACKUP"

printf '%s\n' "$V75" > "$BACKUP/base-commit.txt"
printf '%s\n' "$PATCH_COMMIT" > "$BACKUP/patch-commit.txt"
[[ -z "$LOCAL_STASH" ]] || printf '%s\n' "$LOCAL_STASH" > "$BACKUP/local-work-stash.txt"

cat > "$BACKUP/rollback.sh" <<ROLLBACK
#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_COMMIT="$PATCH_COMMIT"
BRANCH="$BRANCH"

ROOT="\$(git rev-parse --show-toplevel)"
cd "\$ROOT"

git fetch --quiet origin "\$BRANCH"
REMOTE="\$(git rev-parse "origin/\$BRANCH")"

git merge-base --is-ancestor "\$PATCH_COMMIT" "\$REMOTE" || {
  echo "Rollback refused: V76 is not an ancestor of remote."
  exit 1
}

TMP="\$(mktemp -d /tmp/memeflow-v76-rollback-XXXXXX)"
WT="\$TMP/wt"

git worktree add --detach "\$WT" "\$REMOTE" >/dev/null

cleanup(){
  set +e
  cd "\$ROOT" >/dev/null 2>&1 || true
  git worktree remove --force "\$WT" >/dev/null 2>&1 || true
  git worktree prune >/dev/null 2>&1 || true
  rm -rf "\$TMP" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cd "\$WT"
git revert --no-edit "\$PATCH_COMMIT"
(cd memeflow-app && npm test)

git fetch --quiet origin "\$BRANCH"

[[ "\$(git rev-parse "origin/\$BRANCH")" == "\$REMOTE" ]] || {
  echo "Rollback refused: remote moved during validation."
  exit 1
}

git push origin "HEAD:\$BRANCH"

echo "V76 reverted and pushed."
echo "Main workspace untouched."
ROLLBACK

chmod +x "$BACKUP/rollback.sh"

if [[ "$VERIFY_WT_ADDED" == "1" ]]; then
  git worktree remove --force "$VERIFY_WT" >/dev/null
  VERIFY_WT_ADDED=0
fi

git worktree remove --force "$PATCH_WT" >/dev/null
PATCH_WT_ADDED=0
git worktree prune >/dev/null 2>&1 || true

trap - EXIT
rm -rf "$TMP"

echo
echo "============================================================"
echo "SUCCESS — MEMEFLOW V76"
echo "============================================================"
echo "Fixed:"
echo "  live-card batch no longer normalizes the full oversized mint request"
echo "  normalization stops after first 200 unique valid normalized mints"
echo
echo "Preserved:"
echo "  exact String(mint||'').trim() normalization"
echo "  exact insertion-order deduplication"
echo "  exact first-200 unique semantics"
echo "  visible-holder touch behavior"
echo "  card eligibility / current-token membership"
echo "  OPEN-position inclusion"
echo "  Entry Admission / WATCH / WAITING / BUY READY"
echo "  score/ranking / holder metrics / wallet-risk"
echo "  paper/live execution"
echo
echo "Validated before push:"
echo "  exact V75 baseline 5e4cf44f"
echo "  100k-request old-vs-new equivalence"
echo "  duplicate/order/coercion regression"
echo "  V18 + V59-V75 + admission/realtime regressions"
echo "  full npm test"
if [[ -n "$LOCAL_STASH" ]]; then
  echo "  local-work proof: $RESTORE_MODE"
  echo "  non-volatile tracked reconstruction: exact"
  echo "  untracked local paths: verified"
  echo "  live state/SQLite byte drift: allowed"
fi
echo
echo "Commit:   ${PATCH_COMMIT:0:8}"
echo "Rollback: bash $BACKUP_REL/rollback.sh"
[[ -z "$LOCAL_STASH" ]] || echo "Safety stash retained: $LOCAL_STASH"
echo "============================================================"
