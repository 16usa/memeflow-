#!/usr/bin/env bash
set -Eeuo pipefail

# MEMEFLOW_WALLET_RISK_SAMPLE_HOTPATH_V75_1_INSTALLER
#
# Corrected V75 installer.
#
# The first V75 attempt failed ONLY because its structural regression test
# searched for ".filter(Boolean)" inside the whole function text and matched
# that literal phrase inside the new explanatory comment. Production code was
# not pushed. Remote remains exact V74.
#
# V75.1 removes that false-positive test condition while preserving the exact
# intended production optimization:
#   normalize holderRiskWallets only until the first 10 VALID holder rows.
#
# This script also knows how to reuse a retained safety stash from the failed
# V75 attempt, so local state.json / backups / untracked work can be restored
# on top of the new V75 commit after a successful push.

V73="22885346b48ac5231d13c00b120b76f414b0de37"
V74="889080ff01435dd5178061f939f9984ca358e0c2"
BRANCH="chart-debug-20260829-161234"
V74_SUBJECT="perf: reuse scanner prune live membership"

SERVER="memeflow-app/app-server.mjs"
PACKAGE="memeflow-app/package.json"
TEST="memeflow-app/tests/wallet-risk-sample-hotpath-v75.mjs"

ROOT="${1:-.}"
cd "$ROOT"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$REPO_ROOT" ]] || { echo "ERROR: run inside MEMEFLOW git repository."; exit 1; }
cd "$REPO_ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP_ROOT="$(mktemp -d "/tmp/memeflow-v75-1-${STAMP}-XXXXXX")"
PATCH_WT="$TMP_ROOT/patch"
VERIFY_WT="$TMP_ROOT/verify"
BACKUP_REL=".patch-backups/wallet-risk-sample-hotpath-v75-1-$STAMP"
BACKUP="$REPO_ROOT/$BACKUP_REL"

PATCH_WT_ADDED=0
VERIFY_WT_ADDED=0
LOCAL_STASH=""
CREATED_STASH=0
PATCH_COMMIT=""
LOCAL_BASE=""
PUSHED=0
MAIN_RESET=0

restore_created_stash_on_failure(){
  if [[ "$CREATED_STASH" != "1" || "$PUSHED" == "1" || -z "$LOCAL_STASH" ]]; then
    return 0
  fi

  set +e
  cd "$REPO_ROOT" >/dev/null 2>&1 || return 0

  if [[ "$(git rev-parse HEAD 2>/dev/null)" != "$LOCAL_BASE" ]]; then
    git reset --hard "$LOCAL_BASE" >/dev/null 2>&1 || return 0
  fi

  if git stash apply --index "$LOCAL_STASH" >/dev/null 2>&1; then
    echo "Original local work restored after failed V75.1 attempt."
  else
    git reset --hard "$LOCAL_BASE" >/dev/null 2>&1 || true
    if git stash apply "$LOCAL_STASH" >/dev/null 2>&1; then
      echo "Original local work restored (content mode) after failed V75.1 attempt."
    else
      echo "WARNING: automatic local restore failed; safety stash retained: $LOCAL_STASH"
    fi
  fi
}

cleanup(){
  local rc=$?
  set +e
  [[ "$rc" != "0" ]] && restore_created_stash_on_failure
  cd "$REPO_ROOT" >/dev/null 2>&1 || true
  [[ "$VERIFY_WT_ADDED" == "1" ]] && git worktree remove --force "$VERIFY_WT" >/dev/null 2>&1 || true
  [[ "$PATCH_WT_ADDED" == "1" ]] && git worktree remove --force "$PATCH_WT" >/dev/null 2>&1 || true
  git worktree prune >/dev/null 2>&1 || true
  rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true
  exit "$rc"
}
trap cleanup EXIT

echo "==> V75.1 exact branch / remote preflight"

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "PATCH REFUSED: unexpected branch."
  exit 1
}

LOCAL_BASE="$(git rev-parse HEAD)"

if [[ "$LOCAL_BASE" != "$V73" && "$LOCAL_BASE" != "$V74" ]]; then
  echo "PATCH REFUSED: local HEAD is neither exact V73 nor exact V74."
  echo "local: $LOCAL_BASE"
  exit 1
fi

git fetch --quiet origin "$BRANCH"

[[ "$(git rev-parse origin/$BRANCH)" == "$V74" ]] || {
  echo "PATCH REFUSED: remote is not exact V74."
  echo "expected: $V74"
  echo "actual:   $(git rev-parse origin/$BRANCH)"
  exit 1
}

[[ "$(git rev-parse "$V74^")" == "$V73" ]] || {
  echo "PATCH REFUSED: V74 parent is not exact V73."
  exit 1
}

[[ "$(git show -s --format=%s "$V74")" == "$V74_SUBJECT" ]] || {
  echo "PATCH REFUSED: V74 subject changed."
  exit 1
}

echo "Remote exact V74: CONFIRMED"
echo "Local base: ${LOCAL_BASE:0:8}"

mkdir -p "$BACKUP"
printf '%s\n' "$V74" > "$BACKUP/base-commit.txt"
printf '%s\n' "$LOCAL_BASE" > "$BACKUP/local-base.txt"
printf '%s\n' "$BRANCH" > "$BACKUP/branch.txt"

echo "==> Preserve/recover local-work source"

if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
  git stash push --include-untracked \
    -m "MEMEFLOW V75.1 preserve current local work $STAMP" >/dev/null

  LOCAL_STASH="$(git rev-parse stash@{0})"
  CREATED_STASH=1

  [[ "$(git rev-parse "$LOCAL_STASH^1")" == "$LOCAL_BASE" ]] || {
    echo "PATCH REFUSED: new safety stash base mismatch."
    exit 1
  }

  echo "New safety stash: $LOCAL_STASH"
else
  # The failed V75 attempt may already have moved the user's local changes into
  # a retained stash. Reuse the newest matching V75/V75.1 stash whose first
  # parent is V73 or V74.
  while read -r ref; do
    [[ -n "$ref" ]] || continue
    msg="$(git stash list --format='%gd %s' | awk -v r="$ref" '$1==r{sub($1 FS,"");print;exit}')"
    case "$msg" in
      *"MEMEFLOW V75 preserve current local work"*|*"MEMEFLOW V75.1 preserve current local work"*)
        oid="$(git rev-parse "$ref")"
        base="$(git rev-parse "$oid^1" 2>/dev/null || true)"
        if [[ "$base" == "$V73" || "$base" == "$V74" ]]; then
          LOCAL_STASH="$oid"
          echo "Reusing retained V75 safety stash: $LOCAL_STASH"
          break
        fi
        ;;
    esac
  done < <(git stash list --format='%gd')

  if [[ -z "$LOCAL_STASH" ]]; then
    echo "Workspace is clean and no retained V75 local-work stash was needed/found."
  fi
fi

[[ -z "$LOCAL_STASH" ]] || printf '%s\n' "$LOCAL_STASH" > "$BACKUP/local-work-stash.txt"

echo "==> Create isolated V75.1 patch worktree from exact V74"

git worktree add --detach "$PATCH_WT" "$V74" >/dev/null
PATCH_WT_ADDED=1
cd "$PATCH_WT"

cat > "$TMP_ROOT/v75_transform.py" <<'PY'
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
            f"V75.1 REFUSED: {label}: expected exactly 1 target, found {n}"
        )
    text=text.replace(old,new,1)

if mode=="server":
    if "MEMEFLOW_WALLET_RISK_SAMPLE_HOTPATH_V75" in text:
        raise SystemExit("V75.1 REFUSED: server marker already exists")

    once(
"""  const holderRows=
    (
      Array.isArray(token.holderRiskWallets)
        ? token.holderRiskWallets
        : []
    )
      .map(row=>{
        let wallet='';
        let pct;

        if(typeof row==='string'){
          wallet=row.trim();
          pct=undefined;
        }else if(Array.isArray(row)){
          wallet=String(row[0]||'').trim();
          pct=row[1];
        }else{
          wallet=
            String(
              row?.wallet ||
              row?.address ||
              row?.owner ||
              ''
            ).trim();

          pct=
            row?.pct ??
            row?.percentage ??
            row?.sharePct;
        }

        if(!wallet)return '';

        return (
          wallet +
          '@' +
          pctKey(pct)
        );
      })
      .filter(Boolean)
      // scanWalletClusterRisk hard-caps maxWallets at 10.
      .slice(0,10)
      .join('|');
""",
"""  // MEMEFLOW_WALLET_RISK_SAMPLE_HOTPATH_V75
  // Preserve the exact "first 10 valid normalized rows" semantics, but stop
  // scanning once those 10 valid rows have been produced.
  const holderParts=[];
  const holderRiskRows=
    Array.isArray(token.holderRiskWallets)
      ? token.holderRiskWallets
      : [];

  for(const row of holderRiskRows){
    let wallet='';
    let pct;

    if(typeof row==='string'){
      wallet=row.trim();
      pct=undefined;
    }else if(Array.isArray(row)){
      wallet=String(row[0]||'').trim();
      pct=row[1];
    }else{
      wallet=
        String(
          row?.wallet ||
          row?.address ||
          row?.owner ||
          ''
        ).trim();

      pct=
        row?.pct ??
        row?.percentage ??
        row?.sharePct;
    }

    if(!wallet){
      continue;
    }

    holderParts.push(
      wallet +
      '@' +
      pctKey(pct)
    );

    if(holderParts.length>=10){
      break;
    }
  }

  const holderRows=
    holderParts.join('|');
""",
"wallet-risk holderRows normalization"
    )

elif mode=="package":
    old='node tests/scanner-prune-membership-hotpath-v74.mjs'
    new=old+' && node tests/wallet-risk-sample-hotpath-v75.mjs'
    if 'node tests/wallet-risk-sample-hotpath-v75.mjs' in text:
        raise SystemExit("V75.1 REFUSED: package already contains V75")
    once(old,new,"test:core V74 tail")
else:
    raise SystemExit("unknown transform mode")

path.write_text(text,encoding='utf-8')
PY

python3 "$TMP_ROOT/v75_transform.py" server "$SERVER"
python3 "$TMP_ROOT/v75_transform.py" package "$PACKAGE"

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
  'function __mfWalletRiskSampleKey(token={}){'
);
const end=app.indexOf(
  'function __mfWalletRiskCacheFresh(',
  start
);

assert.ok(start>=0 && end>start);
const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_WALLET_RISK_SAMPLE_HOTPATH_V75/
);

assert.match(
  block,
  /const holderParts=\[\]/
);

assert.match(
  block,
  /for\(const row of holderRiskRows\)/
);

assert.match(
  block,
  /if\(holderParts\.length>=10\)\{\s*break;\s*\}/
);

// Structural check only the executable legacy holderRows chain. Do not scan
// arbitrary comments for those words.
assert.doesNotMatch(
  block,
  /const holderRows=\s*\([\s\S]*?Array\.isArray\(token\.holderRiskWallets\)[\s\S]*?\.map\(row=>\{/
);

function pctKey(value){
  if(
    value===null ||
    value===undefined ||
    value===''
  )return '?';

  const n=Number(value);
  if(!Number.isFinite(n))return '?';

  const clamped=Math.max(0,Math.min(100,n));

  return (
    Math.round(clamped*1000)/1000
  ).toFixed(3);
}

function oldHolderRows(rows){
  return (
    Array.isArray(rows)
      ? rows
      : []
  )
    .map(row=>{
      let wallet='';
      let pct;

      if(typeof row==='string'){
        wallet=row.trim();
        pct=undefined;
      }else if(Array.isArray(row)){
        wallet=String(row[0]||'').trim();
        pct=row[1];
      }else{
        wallet=String(
          row?.wallet ||
          row?.address ||
          row?.owner ||
          ''
        ).trim();

        pct=
          row?.pct ??
          row?.percentage ??
          row?.sharePct;
      }

      if(!wallet)return '';

      return wallet+'@'+pctKey(pct);
    })
    .filter(Boolean)
    .slice(0,10)
    .join('|');
}

function newHolderRows(rows){
  const parts=[];
  const source=Array.isArray(rows)?rows:[];

  for(const row of source){
    let wallet='';
    let pct;

    if(typeof row==='string'){
      wallet=row.trim();
      pct=undefined;
    }else if(Array.isArray(row)){
      wallet=String(row[0]||'').trim();
      pct=row[1];
    }else{
      wallet=String(
        row?.wallet ||
        row?.address ||
        row?.owner ||
        ''
      ).trim();

      pct=
        row?.pct ??
        row?.percentage ??
        row?.sharePct;
    }

    if(!wallet)continue;

    parts.push(wallet+'@'+pctKey(pct));

    if(parts.length>=10)break;
  }

  return parts.join('|');
}

{
  const rows=[];

  for(let i=0;i<100_000;i++){
    if(i%4===0){
      rows.push(null);
    }else if(i%4===1){
      rows.push({wallet:'',pct:i});
    }else if(i%4===2){
      rows.push(['wallet-'+i,(i%137)-20]);
    }else{
      rows.push({
        address:'wallet-'+i,
        percentage:(i%113)+0.123456
      });
    }
  }

  assert.equal(
    newHolderRows(rows),
    oldHolderRows(rows)
  );
}

{
  const rows=[
    '   ',
    null,
    ['a',1.23456],
    {wallet:'b',pct:5},
    {address:'c',percentage:6.7777},
    {owner:'d',sharePct:101},
    {wallet:'e',pct:-9},
    ['f',null],
    'g',
    {wallet:''},
    {address:'h',pct:'12.3456'},
    {owner:'i',percentage:'bad'},
    ['j',50],
    ['k',60],
    ['l',70]
  ];

  assert.equal(
    newHolderRows(rows),
    oldHolderRows(rows)
  );
}

assert.equal(newHolderRows(null),oldHolderRows(null));
assert.equal(newHolderRows({}),oldHolderRows({}));

assert.match(
  block,
  /V48:V3_ONE_HOP_COMMON_FUNDER/
);

assert.match(
  block,
  /process\.env\.WALLET_CLUSTER_MAX_WALLETS \?\? '5'/
);

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/wallet-risk-sample-hotpath-v75\.mjs/
);

console.log('wallet risk sample hotpath v75 ok');
TESTJS

echo "==> Syntax / JSON / diff"

node --check "$SERVER"
node --check "$TEST"
node --input-type=module -e \
  "import fs from 'node:fs';JSON.parse(fs.readFileSync('$PACKAGE','utf8'));console.log('package json ok')"
git diff --check -- "$SERVER" "$PACKAGE" "$TEST"

echo "==> Targeted V75.1 regressions"

(
  cd memeflow-app
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
  node tests/wallet-risk-fingerprint-v48.mjs
  node tests/wallet-risk-disabled-sample-guard-v49.mjs
  node tests/strict-entry-admission.mjs
  node tests/realtime-update-path.mjs
)

echo "==> Full npm test BEFORE commit"
(cd memeflow-app && npm test)

echo "==> Remove test-generated non-V75 mutations"

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

echo "==> Verify intended V75 files only"

mapfile -t MODIFIED < <(git diff --name-only)
mapfile -t UNTRACKED_AFTER < <(git ls-files --others --exclude-standard)

[[ "${#MODIFIED[@]}" -eq 2 ]] || {
  echo "ERROR: expected exactly 2 modified tracked V75 files."
  printf '  %s\n' "${MODIFIED[@]}"
  exit 1
}

[[ "${#UNTRACKED_AFTER[@]}" -eq 1 ]] || {
  echo "ERROR: expected exactly 1 untracked V75 test file."
  printf '  %s\n' "${UNTRACKED_AFTER[@]}"
  exit 1
}

for required in "$SERVER" "$PACKAGE"; do
  printf '%s\n' "${MODIFIED[@]}" | grep -Fxq "$required" || exit 1
done
printf '%s\n' "${UNTRACKED_AFTER[@]}" | grep -Fxq "$TEST" || exit 1

git add -- "$SERVER" "$PACKAGE" "$TEST"

echo "==> Commit V75 in isolated worktree"
git commit -m "perf: bound wallet risk sample normalization"
PATCH_COMMIT="$(git rev-parse HEAD)"
printf '%s\n' "$PATCH_COMMIT" > "$BACKUP/patch-commit.txt"

RESTORE_MODE="none"

if [[ -n "$LOCAL_STASH" ]]; then
  echo "==> Prove local-work reconstruction on V75 BEFORE push"

  cd "$REPO_ROOT"
  git worktree add --detach "$VERIFY_WT" "$PATCH_COMMIT" >/dev/null
  VERIFY_WT_ADDED=1

  if (cd "$VERIFY_WT" && git stash apply --index "$LOCAL_STASH") >"$TMP_ROOT/index.log" 2>&1; then
    RESTORE_MODE="index"
  else
    (
      cd "$VERIFY_WT"
      git reset --hard "$PATCH_COMMIT" >/dev/null
      git clean -fd >/dev/null 2>&1 || true
    )

    if (cd "$VERIFY_WT" && git stash apply "$LOCAL_STASH") >"$TMP_ROOT/content.log" 2>&1; then
      RESTORE_MODE="content"
    else
      echo "PATCH REFUSED BEFORE PUSH: local work conflicts with V75."
      cat "$TMP_ROOT/index.log" || true
      cat "$TMP_ROOT/content.log" || true
      echo "Safety stash retained: $LOCAL_STASH"
      exit 1
    fi
  fi

  (
    cd "$VERIFY_WT"
    git diff --cached --binary HEAD > "$TMP_ROOT/proven-index.patch"
    git diff --binary > "$TMP_ROOT/proven-working.patch"
    git ls-files --others --exclude-standard -z > "$TMP_ROOT/proven-untracked.zlist"

    if [[ -s "$TMP_ROOT/proven-untracked.zlist" ]]; then
      tar --null -T "$TMP_ROOT/proven-untracked.zlist" \
        -czf "$TMP_ROOT/proven-untracked.tar.gz"
    fi
  )

  echo "Local-work V75 proof: OK ($RESTORE_MODE)"
fi

echo "==> Re-check remote immediately before push"
cd "$PATCH_WT"
git fetch --quiet origin "$BRANCH"

[[ "$(git rev-parse origin/$BRANCH)" == "$V74" ]] || {
  echo "PATCH REFUSED: remote moved during V75 validation."
  exit 1
}

echo "==> Push V75"
git push origin "HEAD:$BRANCH"
PUSHED=1

echo "==> Move main workspace to V75 + reconstruct proven local state"
cd "$REPO_ROOT"
git reset --hard "$PATCH_COMMIT" >/dev/null
MAIN_RESET=1

git clean -fd \
  -e .patch-backups/ \
  -e "$(basename "$0")" \
  >/dev/null 2>&1 || true

if [[ -n "$LOCAL_STASH" ]]; then
  [[ ! -s "$TMP_ROOT/proven-index.patch" ]] || \
    git apply --index --whitespace=nowarn "$TMP_ROOT/proven-index.patch"

  [[ ! -s "$TMP_ROOT/proven-working.patch" ]] || \
    git apply --whitespace=nowarn "$TMP_ROOT/proven-working.patch"

  [[ ! -f "$TMP_ROOT/proven-untracked.tar.gz" ]] || \
    tar -xzf "$TMP_ROOT/proven-untracked.tar.gz" -C "$REPO_ROOT"

  git diff --cached --binary HEAD > "$TMP_ROOT/main-index.patch"
  git diff --binary > "$TMP_ROOT/main-working.patch"

  cmp -s "$TMP_ROOT/proven-index.patch" "$TMP_ROOT/main-index.patch" || {
    echo "ERROR: staged reconstruction differs from V75 proof."
    echo "V75 WAS pushed. Safety stash retained: $LOCAL_STASH"
    exit 1
  }

  cmp -s "$TMP_ROOT/proven-working.patch" "$TMP_ROOT/main-working.patch" || {
    echo "ERROR: working reconstruction differs from V75 proof."
    echo "V75 WAS pushed. Safety stash retained: $LOCAL_STASH"
    exit 1
  }
fi

mkdir -p "$BACKUP"

cat > "$BACKUP/rollback.sh" <<ROLLBACK
#!/usr/bin/env bash
set -Eeuo pipefail
PATCH_COMMIT="$PATCH_COMMIT"
BRANCH="$BRANCH"
ROOT="\$(git rev-parse --show-toplevel)"
cd "\$ROOT"
git fetch --quiet origin "\$BRANCH"
REMOTE="\$(git rev-parse "origin/\$BRANCH")"
git merge-base --is-ancestor "\$PATCH_COMMIT" "\$REMOTE" || { echo "Rollback refused."; exit 1; }
TMP="\$(mktemp -d /tmp/memeflow-v75-rollback-XXXXXX)"
WT="\$TMP/wt"
git worktree add --detach "\$WT" "\$REMOTE" >/dev/null
cleanup(){ set +e; cd "\$ROOT" >/dev/null 2>&1 || true; git worktree remove --force "\$WT" >/dev/null 2>&1 || true; git worktree prune >/dev/null 2>&1 || true; rm -rf "\$TMP"; }
trap cleanup EXIT
cd "\$WT"
git revert --no-edit "\$PATCH_COMMIT"
(cd memeflow-app && npm test)
git fetch --quiet origin "\$BRANCH"
[[ "\$(git rev-parse origin/\$BRANCH)" == "\$REMOTE" ]] || { echo "Rollback refused: remote moved."; exit 1; }
git push origin "HEAD:\$BRANCH"
echo "V75 reverted and pushed. Main workspace untouched."
ROLLBACK

chmod +x "$BACKUP/rollback.sh"

echo "==> Final V75 integrity"
git fetch --quiet origin "$BRANCH"
[[ "$(git rev-parse HEAD)" == "$PATCH_COMMIT" ]] || exit 1
[[ "$(git rev-parse origin/$BRANCH)" == "$PATCH_COMMIT" ]] || exit 1

if [[ "$VERIFY_WT_ADDED" == "1" ]]; then
  git worktree remove --force "$VERIFY_WT" >/dev/null
  VERIFY_WT_ADDED=0
fi
git worktree remove --force "$PATCH_WT" >/dev/null
PATCH_WT_ADDED=0
git worktree prune >/dev/null 2>&1 || true

trap - EXIT
rm -rf "$TMP_ROOT"

echo
echo "============================================================"
echo "SUCCESS — MEMEFLOW V75"
echo "============================================================"
echo "Fixed:"
echo "  holder-risk sample normalization stops after first 10 valid rows"
echo "  false-positive V75 structural regression test corrected"
echo
echo "Preserved:"
echo "  exact V48 wallet-risk fingerprint"
echo "  exact first-10-valid semantics"
echo "  wallet-risk thresholds / graph / admission / score / ranking"
echo "  paper/live execution"
echo
echo "Commit:   ${PATCH_COMMIT:0:8}"
echo "Rollback: bash $BACKUP_REL/rollback.sh"
[[ -z "$LOCAL_STASH" ]] || echo "Safety stash retained: $LOCAL_STASH"
echo "============================================================"
