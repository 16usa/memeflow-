#!/usr/bin/env bash
set -Eeuo pipefail

# MEMEFLOW_ACTIVE_USER_IDS_HOTPATH_V77_PUSH_ONLY
#
# Exact baseline:
#   branch: chart-debug-20260829-161234
#   V76:    17b2787ecf75f92a8ff6450ac1eb039bd3c66446
#
# V77 optimizes ONLY __mfActiveScannerUserIds().
#
# Before:
#   Object.entries(users)
#     .filter(active)
#     .map(uid)
#
# After:
#   one linear pass over Object.entries(users)
#   pushes matching uid directly
#
# Exact semantics preserved:
#   - owner users are always active
#   - non-owner users require finite positive lastActiveAt >= cutoff
#   - enumeration/insertion order is unchanged
#   - LIVE_EVALUATION_ACTIVE_USER_HOURS behavior is unchanged
#
# This installer is PUSH-ONLY:
#   - no switch/reset/stash of the main workspace
#   - all code changes/tests/commit happen in an isolated detached worktree
#   - remote must still be exact V76 immediately before push

BRANCH="chart-debug-20260829-161234"
V76="17b2787ecf75f92a8ff6450ac1eb039bd3c66446"
V76_SUBJECT="perf: bound live card batch mint normalization"

SERVER="memeflow-app/app-server.mjs"
PACKAGE="memeflow-app/package.json"
TEST="memeflow-app/tests/active-user-ids-hotpath-v77.mjs"

ROOT="${1:-.}"
cd "$ROOT"

REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$REPO" ]] || { echo "ERROR: run inside MEMEFLOW git repository."; exit 1; }
cd "$REPO"

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d "/tmp/memeflow-v77-${STAMP}-XXXXXX")"
WT="$TMP/patch"
WT_ADDED=0
PATCH_COMMIT=""

cleanup(){
  local rc=$?
  set +e
  cd "$REPO" >/dev/null 2>&1 || true
  [[ "$WT_ADDED" == "1" ]] && git worktree remove --force "$WT" >/dev/null 2>&1 || true
  git worktree prune >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true
  exit "$rc"
}
trap cleanup EXIT

die(){ echo "PATCH REFUSED: $*" >&2; exit 1; }

echo "==> V77 PUSH-ONLY exact-remote preflight"

git fetch --quiet origin "$BRANCH"

REMOTE="$(git rev-parse "origin/$BRANCH")"

[[ "$REMOTE" == "$V76" ]] || {
  echo "expected remote: $V76"
  echo "actual remote:   $REMOTE"
  die "remote is not exact V76; regenerate from the new remote head"
}

[[ "$(git show -s --format=%s "$V76")" == "$V76_SUBJECT" ]] || {
  die "V76 subject changed"
}

echo "Remote exact V76: CONFIRMED"
echo "Main workspace: WILL NOT BE SWITCHED / RESET / STASHED"

echo "==> Create isolated V77 worktree from exact V76"
git worktree add --detach "$WT" "$V76" >/dev/null
WT_ADDED=1
cd "$WT"

cat > "$TMP/v77_transform.py" <<'PY'
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
            f"V77 REFUSED: {label}: expected exactly 1 target, found {n}"
        )
    text=text.replace(old,new,1)

if mode=="server":
    if "MEMEFLOW_ACTIVE_USER_IDS_HOTPATH_V77" in text:
        raise SystemExit("V77 REFUSED: server marker already exists")

    once(
"""function __mfActiveScannerUserIds(now=Date.now()){
  const cutoff=now-(Number(process.env.LIVE_EVALUATION_ACTIVE_USER_HOURS||24)*3600000);
  return Object.entries(store.state.users||{})
    .filter(([,u])=>u?.isOwner===true||(Number(u?.lastActiveAt||0)>0&&Number(u.lastActiveAt)>=cutoff))
    .map(([uid])=>uid);
}
""",
"""function __mfActiveScannerUserIds(now=Date.now()){
  const cutoff=
    now-(
      Number(
        process.env.LIVE_EVALUATION_ACTIVE_USER_HOURS||24
      )*3600000
    );

  // MEMEFLOW_ACTIVE_USER_IDS_HOTPATH_V77
  // Preserve exact Object.entries() order while avoiding the intermediate
  // filtered-entry array and the second map pass.
  const active=[];

  for(const [uid,u] of Object.entries(store.state.users||{})){
    if(
      u?.isOwner===true ||
      (
        Number(u?.lastActiveAt||0)>0 &&
        Number(u.lastActiveAt)>=cutoff
      )
    ){
      active.push(uid);
    }
  }

  return active;
}
""",
"active scanner user ids"
    )

elif mode=="package":
    old='node tests/live-card-batch-mint-hotpath-v76.mjs'
    new=old+' && node tests/active-user-ids-hotpath-v77.mjs'

    if 'node tests/active-user-ids-hotpath-v77.mjs' in text:
        raise SystemExit("V77 REFUSED: package already contains V77 test")

    once(old,new,"test:core V76 tail")

else:
    raise SystemExit("unknown transform mode")

path.write_text(text,encoding='utf-8')
PY

echo "==> Verify exact V76 target shape"

python3 - "$SERVER" "$PACKAGE" <<'PY'
from pathlib import Path
import sys

app=Path(sys.argv[1]).read_text(encoding='utf-8')
pkg=Path(sys.argv[2]).read_text(encoding='utf-8')

start=app.index('function __mfActiveScannerUserIds(now=Date.now()){')
end=app.index('function __mfAllActiveUsersStableBlocked(',start)
block=app[start:end]

required=[
  "Object.entries(store.state.users||{})",
  ".filter(([,u])=>",
  ".map(([uid])=>uid);",
  "LIVE_EVALUATION_ACTIVE_USER_HOURS"
]

for marker in required:
    if marker not in block:
        raise SystemExit(
            "V77 REFUSED: exact V76 active-user marker missing: "+marker
        )

if "node tests/live-card-batch-mint-hotpath-v76.mjs" not in pkg:
    raise SystemExit("V77 REFUSED: V76 package tail missing")

print("V76 active-user target: CONFIRMED")
PY

echo "==> Apply V77 transforms"

python3 "$TMP/v77_transform.py" server "$SERVER"
python3 "$TMP/v77_transform.py" package "$PACKAGE"

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
  'function __mfActiveScannerUserIds(now=Date.now()){'
);
const end=app.indexOf(
  'function __mfAllActiveUsersStableBlocked(',
  start
);

assert.ok(start>=0 && end>start);

const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_ACTIVE_USER_IDS_HOTPATH_V77/
);

assert.match(
  block,
  /for\(const \[uid,u\] of Object\.entries\(store\.state\.users\|\|\{\}\)\)/
);

assert.match(
  block,
  /active\.push\(uid\)/
);

assert.doesNotMatch(
  block,
  /\.filter\(\(\[,u\]\)=>/
);

assert.doesNotMatch(
  block,
  /\.map\(\(\[uid\]\)=>uid\)/
);

function oldIds(users,now,hours=24){
  const cutoff=now-(Number(hours||24)*3600000);

  return Object.entries(users||{})
    .filter(([,u])=>
      u?.isOwner===true ||
      (
        Number(u?.lastActiveAt||0)>0 &&
        Number(u.lastActiveAt)>=cutoff
      )
    )
    .map(([uid])=>uid);
}

function newIds(users,now,hours=24){
  const cutoff=now-(Number(hours||24)*3600000);
  const active=[];

  for(const [uid,u] of Object.entries(users||{})){
    if(
      u?.isOwner===true ||
      (
        Number(u?.lastActiveAt||0)>0 &&
        Number(u.lastActiveAt)>=cutoff
      )
    ){
      active.push(uid);
    }
  }

  return active;
}

const now=1_900_000_000_000;

// Exact edge / coercion behavior.
{
  const cutoff=now-(24*3600000);

  const users={
    ownerOld:{isOwner:true,lastActiveAt:1},
    recent:{lastActiveAt:now-1000},
    exactCutoff:{lastActiveAt:cutoff},
    tooOld:{lastActiveAt:cutoff-1},
    zero:{lastActiveAt:0},
    nullish:{lastActiveAt:null},
    numericString:{lastActiveAt:String(now-2000)},
    badString:{lastActiveAt:'nope'},
    negative:{lastActiveAt:-1},
    falseOwner:{isOwner:false,lastActiveAt:now-3000},
    missing:{}
  };

  assert.deepEqual(
    newIds(users,now),
    oldIds(users,now)
  );
}

// LIVE_EVALUATION_ACTIVE_USER_HOURS fallback semantics: 0 falls back to 24,
// strings are Number-coerced exactly like production.
{
  const users={
    a:{lastActiveAt:now-(2*3600000)},
    b:{lastActiveAt:now-(4*3600000)},
    c:{isOwner:true,lastActiveAt:0}
  };

  for(const hours of [0,'0',1,'3',24,'48']){
    assert.deepEqual(
      newIds(users,now,hours),
      oldIds(users,now,hours)
    );
  }
}

// 100k-user deterministic equivalence and Object.entries insertion order.
{
  const users={};

  for(let i=0;i<100_000;i++){
    const uid='u'+i;

    if(i%997===0){
      users[uid]={isOwner:true,lastActiveAt:0};
    }else if(i%5===0){
      users[uid]={lastActiveAt:now-(60*60*1000)};
    }else if(i%5===1){
      users[uid]={lastActiveAt:now-(30*60*60*1000)};
    }else if(i%5===2){
      users[uid]={lastActiveAt:String(now-(2*60*60*1000))};
    }else if(i%5===3){
      users[uid]={lastActiveAt:0};
    }else{
      users[uid]={};
    }
  }

  assert.deepEqual(
    newIds(users,now),
    oldIds(users,now)
  );
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/active-user-ids-hotpath-v77\.mjs/
);

console.log('active user ids hotpath v77 ok');
TESTJS

echo "==> Syntax / JSON / diff"

node --check "$SERVER"
node --check "$TEST"

node --input-type=module -e \
  "import fs from 'node:fs';JSON.parse(fs.readFileSync('$PACKAGE','utf8'));console.log('package json ok')"

git diff --check -- "$SERVER" "$PACKAGE" "$TEST"

echo "==> Targeted V77 regressions"

(
  cd memeflow-app
  node tests/active-user-ids-hotpath-v77.mjs
  node tests/holder-active-user-context-v70.mjs
  node tests/live-card-batch-mint-hotpath-v76.mjs
  node tests/wallet-risk-sample-hotpath-v75.mjs
  node tests/scanner-prune-membership-hotpath-v74.mjs
  node tests/pre-admission-state-cleanup-v73.mjs
  node tests/history-eval-queue-hotpath-v72.mjs
  node tests/terminal-holder-truth-hotpath-v71.mjs
  node tests/holder-refresh-hotpath-v67.mjs
  node tests/discovery-bridge-hotpath-v66.mjs
  node tests/settings-reevaluate-hotpath-v64.mjs
  node tests/pre-admission-sweep-hotpath-v62-4.mjs
  node tests/live-states-prefix-hotpath-v61.mjs
  node tests/ai-decisions-inventory-hotpath-v60.mjs
  node tests/terminal-paper-poll-hotpath-v59.mjs
  node tests/strict-entry-admission.mjs
  node tests/realtime-update-path.mjs
)

echo "==> Full npm test BEFORE commit"
(cd memeflow-app && npm test)

echo "==> Remove test-generated non-V77 mutations"

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

echo "==> Verify intended V77 files only"

mapfile -t MODIFIED < <(git diff --name-only)
mapfile -t UNTRACKED_AFTER < <(git ls-files --others --exclude-standard)

[[ "${#MODIFIED[@]}" -eq 2 ]] || {
  echo "ERROR: expected exactly 2 modified tracked V77 files."
  printf '  %s\n' "${MODIFIED[@]}"
  exit 1
}

[[ "${#UNTRACKED_AFTER[@]}" -eq 1 ]] || {
  echo "ERROR: expected exactly 1 untracked V77 test file."
  printf '  %s\n' "${UNTRACKED_AFTER[@]}"
  exit 1
}

for required in "$SERVER" "$PACKAGE"; do
  printf '%s\n' "${MODIFIED[@]}" | grep -Fxq "$required" || exit 1
done
printf '%s\n' "${UNTRACKED_AFTER[@]}" | grep -Fxq "$TEST" || exit 1

git add -- "$SERVER" "$PACKAGE" "$TEST"

echo "==> Commit V77 in isolated worktree"
git commit -m "perf: linearize active scanner user ids"
PATCH_COMMIT="$(git rev-parse HEAD)"

echo "V77 commit: $PATCH_COMMIT"

echo "==> Re-check remote immediately before push"

git fetch --quiet origin "$BRANCH"

[[ "$(git rev-parse "origin/$BRANCH")" == "$V76" ]] || {
  echo "PATCH REFUSED: remote moved during V77 validation."
  echo "V77 was NOT pushed."
  exit 1
}

echo "==> Push V77"
git push origin "HEAD:$BRANCH"

echo "==> Verify exact remote V77"
git fetch --quiet origin "$BRANCH"

[[ "$(git rev-parse "origin/$BRANCH")" == "$PATCH_COMMIT" ]] || {
  echo "ERROR: post-push remote verification failed."
  exit 2
}

BACKUP_REL=".patch-backups/active-user-ids-hotpath-v77-$STAMP"
BACKUP="$REPO/$BACKUP_REL"
mkdir -p "$BACKUP"
printf '%s\n' "$V76" > "$BACKUP/base-commit.txt"
printf '%s\n' "$PATCH_COMMIT" > "$BACKUP/patch-commit.txt"

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
  echo "Rollback refused: V77 is not an ancestor of remote."
  exit 1
}

TMP="\$(mktemp -d /tmp/memeflow-v77-rollback-XXXXXX)"
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

echo "V77 reverted and pushed."
echo "Main workspace untouched."
ROLLBACK

chmod +x "$BACKUP/rollback.sh"

git worktree remove --force "$WT" >/dev/null
WT_ADDED=0
git worktree prune >/dev/null 2>&1 || true

trap - EXIT
rm -rf "$TMP"

echo
echo "============================================================"
echo "SUCCESS — MEMEFLOW V77 PUSHED (PUSH-ONLY)"
echo "============================================================"
echo "Fixed:"
echo "  active scanner user-id discovery is now one linear pass"
echo "  intermediate filter/map arrays are removed"
echo
echo "Preserved:"
echo "  owner-always-active semantics"
echo "  LIVE_EVALUATION_ACTIVE_USER_HOURS cutoff semantics"
echo "  exact Number(lastActiveAt) coercion"
echo "  exact Object.entries user ordering"
echo "  holder scheduling / Entry Admission behavior"
echo "  WATCH / WAITING / BUY READY"
echo "  score/ranking / holders / wallet-risk"
echo "  paper/live execution"
echo
echo "Validated:"
echo "  exact V76 baseline 17b2787e"
echo "  100k-user old-vs-new equivalence"
echo "  owner/cutoff/coercion edge cases"
echo "  V59-V76 + V70/admission/realtime regressions"
echo "  full npm test"
echo
echo "Commit:   ${PATCH_COMMIT:0:8}"
echo "Rollback: bash $BACKUP_REL/rollback.sh"
echo "Main workspace was NOT switched/reset/stashed."
echo "============================================================"
