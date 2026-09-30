#!/usr/bin/env bash
set -Eeuo pipefail

MARK="MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V205"
OLD_MARK="MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V204"

TRADING="memeflow-app/trading.js"
HTML="memeflow-app/trading.html"
TEST="memeflow-app/tests/terminal-candidates-entry-filter-v205.mjs"
OLD_TEST="memeflow-app/tests/terminal-candidates-entry-filter-v204.mjs"
CACHE_VERSION="candidates-entry-filter-v205-20260927"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run inside the existing MEMEFLOW Replit workspace."
  exit 1
fi
cd "$ROOT"

for f in "$TRADING" "$HTML"; do
  [[ -f "$f" ]] || { echo "ERROR: required file missing: $f"; exit 1; }
done

BRANCH="$(git branch --show-current)"
[[ -n "$BRANCH" ]] || { echo "ERROR: detached HEAD is not supported."; exit 1; }

if [[ -n "$(git ls-files -u)" ]]; then
  echo "ERROR: unresolved merge entries already exist."
  git ls-files -u
  exit 1
fi

echo "==> MEMEFLOW Candidates / Entry Filters V205"
echo "Branch: $BRANCH"
echo "Server restart: will NOT be performed."

# ---------------------------------------------------------------------------
# 0) Repair the interrupted V204 attempt, if its marker/staging survived.
#    V204 preflight had already proven that the modified loadCandidates region
#    and trading.js tag matched HEAD before it wrote anything, so restoring
#    those exact regions from HEAD is safe and preserves unrelated local edits.
# ---------------------------------------------------------------------------
if ! git diff --cached --quiet; then
  mapfile -t STAGED_NOW < <(git diff --cached --name-only)
  ALLOWED=1
  for p in "${STAGED_NOW[@]}"; do
    case "$p" in
      "$TRADING"|"$HTML"|"$OLD_TEST") ;;
      *) ALLOWED=0 ;;
    esac
  done

  if [[ "$ALLOWED" -eq 1 ]] && \
     { git show ":$TRADING" 2>/dev/null | grep -q "$OLD_MARK" || \
       [[ -e "$OLD_TEST" ]]; }; then
    echo "==> Cleaning staged residue from failed V204"
    git reset HEAD -- "$TRADING" "$HTML" "$OLD_TEST" >/dev/null 2>&1 || true
  else
    echo "ERROR: staged changes unrelated to the failed V204 attempt exist."
    git status --short
    exit 1
  fi
fi

if grep -q "$OLD_MARK" "$TRADING"; then
  echo "==> Repairing V204 worktree residue"

  python3 - "$TRADING" "$HTML" <<'PY'
from pathlib import Path
import re, subprocess, sys

tr=Path(sys.argv[1])
html=Path(sys.argv[2])

cur=tr.read_text(encoding="utf-8")
head=subprocess.check_output(
    ["git","show",f"HEAD:{tr.as_posix()}"],
    text=True
)

def load_region(s):
    start=s.find("async function loadCandidates(")
    if start<0:
        raise SystemExit("V205 recovery: loadCandidates() missing.")
    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",s[start+1:])
    if not m:
        raise SystemExit("V205 recovery: loadCandidates() boundary missing.")
    end=start+1+m.start()
    return start,end,s[start:end]

hs,he,hregion=load_region(head)

# Remove V204 helper immediately before loadCandidates, if present.
marker="// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V204"
ms=cur.find(marker)
cs=cur.find("async function loadCandidates(")
if ms>=0 and cs>ms:
    cur=cur[:ms]+cur[cs:]

# Replace the V204-modified loadCandidates region with exact HEAD region.
cs,ce,cregion=load_region(cur)
cur=cur[:cs]+hregion+cur[ce:]
tr.write_text(cur,encoding="utf-8")

# V204 preflight proved this script tag matched HEAD; restore only that tag.
curh=html.read_text(encoding="utf-8")
headh=subprocess.check_output(
    ["git","show",f"HEAD:{html.as_posix()}"],
    text=True
)
pat=re.compile(
    r'<script\b[^>]*\bsrc=(["\'])/trading\.js(?:\?v=[^"\']*)?\1[^>]*>\s*</script>',
    re.I
)
mh=pat.search(headh)
mc=pat.search(curh)
if not mh or not mc:
    raise SystemExit("V205 recovery: trading.js script tag missing.")
curh=curh[:mc.start()]+mh.group(0)+curh[mc.end():]
html.write_text(curh,encoding="utf-8")

print("V204 residue repaired without touching unrelated local edits.")
PY
fi

if [[ -e "$OLD_TEST" ]] && ! git cat-file -e "HEAD:$OLD_TEST" 2>/dev/null; then
  rm -f "$OLD_TEST"
fi

# If V205 was already installed by an earlier successful run, stop.
if grep -q "$MARK" "$TRADING"; then
  echo "V205 is already installed."
  exit 0
fi

if ! git diff --cached --quiet; then
  echo "ERROR: staged changes remain after V204 cleanup."
  git status --short
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d "/tmp/memeflow-v205-${STAMP}-XXXXXX")"
COMMITTED=0
PATCH_COMMIT=""

# Save CURRENT local state after V204 cleanup.
cp "$TRADING" "$TMP/current-trading.before"
cp "$HTML" "$TMP/current-html.before"
if [[ -e "$TEST" ]]; then
  touch "$TMP/test-existed"
  cp "$TEST" "$TMP/current-test.before"
fi

on_error() {
  rc=$?
  set +e
  cd "$ROOT" 2>/dev/null || true

  if [[ "$rc" -ne 0 && "$COMMITTED" -eq 0 ]]; then
    echo
    echo "ERROR: V205 failed validation. Restoring only V205 target files..."
    git reset HEAD -- "$TRADING" "$HTML" "$TEST" >/dev/null 2>&1 || true

    cp "$TMP/current-trading.before" "$ROOT/$TRADING" 2>/dev/null || true
    cp "$TMP/current-html.before" "$ROOT/$HTML" 2>/dev/null || true

    if [[ -f "$TMP/test-existed" ]]; then
      cp "$TMP/current-test.before" "$ROOT/$TEST" 2>/dev/null || true
    else
      rm -f "$ROOT/$TEST"
    fi

    echo "Original local work preserved. No V205 commit/push was made."
  elif [[ "$rc" -ne 0 && "$COMMITTED" -eq 1 ]]; then
    echo
    echo "ERROR after V205 commit. Commit retained: $PATCH_COMMIT"
  fi

  rm -rf "$TMP"
  exit "$rc"
}
trap on_error ERR INT TERM

git show "HEAD:$TRADING" > "$TMP/base-trading.js"
git show "HEAD:$HTML" > "$TMP/base-trading.html"

# ---------------------------------------------------------------------------
# 1) Preflight exact region V205 will modify.
# ---------------------------------------------------------------------------
python3 - "$TMP/base-trading.js" "$TRADING" "$TMP/base-trading.html" "$HTML" <<'PY'
from pathlib import Path
import re, sys

base_js=Path(sys.argv[1]).read_text(encoding="utf-8")
cur_js=Path(sys.argv[2]).read_text(encoding="utf-8")
base_h=Path(sys.argv[3]).read_text(encoding="utf-8")
cur_h=Path(sys.argv[4]).read_text(encoding="utf-8")

def load_region(s):
    start=s.find("async function loadCandidates(")
    if start<0:
        raise SystemExit("V205 REFUSED: loadCandidates() not found.")
    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",s[start+1:])
    if not m:
        raise SystemExit("V205 REFUSED: loadCandidates() boundary not found.")
    end=start+1+m.start()
    return s[start:end]

def tag(s):
    m=re.search(
        r'<script\b[^>]*\bsrc=(["\'])/trading\.js(?:\?v=[^"\']*)?\1[^>]*>\s*</script>',
        s,re.I
    )
    if not m:
        raise SystemExit("V205 REFUSED: /trading.js script tag not found.")
    return m.group(0)

if load_region(base_js)!=load_region(cur_js):
    raise SystemExit(
        "V205 REFUSED: local edits overlap loadCandidates(). "
        "Nothing changed; commit/push that logic first."
    )

if tag(base_h)!=tag(cur_h):
    raise SystemExit(
        "V205 REFUSED: local edits overlap the trading.js script tag."
    )

print("Preflight OK: current Candidates loader is safe to patch.")
PY

# ---------------------------------------------------------------------------
# 2) Record CURRENT full-suite state before V205.
#    This prevents an unrelated already-red suite from blocking the patch.
# ---------------------------------------------------------------------------
echo "==> Baseline npm test (before V205)"
set +e
(
  cd "$ROOT/memeflow-app"
  npm test > "$TMP/npm-before.log" 2>&1
)
BASE_NPM_RC=$?
set -e

if [[ "$BASE_NPM_RC" -eq 0 ]]; then
  echo "Baseline npm test: PASS"
else
  echo "Baseline npm test: already FAILING before V205"
  grep -m1 -E "expected:|AssertionError|ERR_ASSERTION" "$TMP/npm-before.log" || true
fi

cat > "$TMP/transform.py" <<'PY'
from pathlib import Path
import re, sys

mode=sys.argv[1]
path=Path(sys.argv[2])
text=path.read_text(encoding="utf-8")

MARK="MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V205"
CACHE="candidates-entry-filter-v205-20260927"

HELPER=r"""
// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V205
// Terminal Candidates is an actionable surface, so it follows the SAME
// canonical Entry Admission result that gates trading.
//
// KEEP:
//   ADMITTED / tradeEligible=true
//   OPEN positions (management must never disappear)
//
// HIDE:
//   PENDING / REJECTED
//   displayOnly rows
//   tradeEligible=false rows
//
// Compatibility: legacy strict /api/ai/decisions rows may omit admission
// annotations because that server endpoint is already Entry-Admission-gated.
function __mfCandidatePassesEntryFiltersV205(candidate) {
  if (!candidate?.mint) return false;

  const displayState =
    String(candidate?.state || candidate?.displayState || '')
      .trim()
      .toUpperCase();

  if (
    displayState === 'OPEN POSITION' ||
    displayState === 'OPEN' ||
    candidate?.openPositionOverride === true ||
    candidate?.__openPosition
  ) {
    return true;
  }

  const admission =
    String(candidate?.entryAdmissionState || '')
      .trim()
      .toUpperCase();

  if (admission) {
    return admission === 'ADMITTED';
  }

  if (candidate?.tradeEligible === true) return true;
  if (candidate?.tradeEligible === false) return false;
  if (candidate?.displayOnly === true) return false;

  return true;
}

"""

FILTER=r"""
  // MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V205
  // The Real-Time Pipeline can contain rows that have not passed Entry
  // Filters. Remove them BEFORE ALL / BUY READY / WATCH / WAITING / BLOCKED
  // are rendered. This changes display only; execution gating is untouched.
  state.candidates =
    (Array.isArray(state.candidates) ? state.candidates : [])
      .filter(__mfCandidatePassesEntryFiltersV205);

"""

if mode=="trading":
    if MARK in text:
        raise SystemExit("V205 already present.")

    start=text.find("async function loadCandidates(")
    if start<0:
        raise SystemExit("V205: loadCandidates() missing.")

    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",text[start+1:])
    if not m:
        raise SystemExit("V205: loadCandidates() boundary missing.")
    end=start+1+m.start()
    region=text[start:end]

    first_candidates=region.find("state.candidates")
    if first_candidates<0:
        raise SystemExit("V205: loadCandidates() does not assign state.candidates.")

    # Insert after state.candidates has been built but before rows are merged /
    # counted/rendered. Prefer the earliest known post-assignment anchor.
    anchors=[
        "  state.liveWatchCandidates",
        "  const rows = mergedCandidates();",
        "  const rows=mergedCandidates();",
        "  const rows = mergedCandidates()",
        "  const rows=mergedCandidates()",
        "  syncSelectedCandidate();"
    ]

    choices=[]
    for a in anchors:
        p=region.find(a)
        if p>first_candidates:
            choices.append((p,a))

    if not choices:
        raise SystemExit(
            "V205: safe post-assignment anchor not found in loadCandidates()."
        )

    anchor_pos,anchor=min(choices,key=lambda x:x[0])

    text=text[:start]+HELPER+text[start:]
    start+=len(HELPER)
    end+=len(HELPER)
    insert_at=start+anchor_pos

    text=text[:insert_at]+FILTER+text[insert_at:]
    path.write_text(text,encoding="utf-8")
    print(f"patched trading.js before anchor: {anchor}")

elif mode=="html":
    pattern=re.compile(
        r'(<script\b[^>]*\bsrc=(["\'])/trading\.js)(?:\?v=[^"\']*)?(\2[^>]*>\s*</script>)',
        re.I
    )
    text2,n=pattern.subn(
        lambda m:f'{m.group(1)}?v={CACHE}{m.group(3)}',
        text,
        count=1
    )
    if n!=1:
        raise SystemExit(f"V205: trading.js cache tag count={n}")
    path.write_text(text2,encoding="utf-8")
    print("patched trading.html cache-bust")
else:
    raise SystemExit("unknown transform mode")
PY

# ---------------------------------------------------------------------------
# 3) Build clean HEAD+V205 commit content and layer same change on current tree.
# ---------------------------------------------------------------------------
cp "$TMP/base-trading.js" "$TMP/patched-trading.js"
cp "$TMP/base-trading.html" "$TMP/patched-trading.html"

python3 "$TMP/transform.py" trading "$TMP/patched-trading.js"
python3 "$TMP/transform.py" html "$TMP/patched-trading.html"

python3 "$TMP/transform.py" trading "$TRADING"
python3 "$TMP/transform.py" html "$HTML"

cat > "$TEST" <<'TESTJS'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(
  new URL('../trading.js',import.meta.url),
  'utf8'
);

assert.match(
  source,
  /MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V205/
);

const helperStart=source.indexOf(
  'function __mfCandidatePassesEntryFiltersV205(candidate) {'
);
const loadStart=source.indexOf(
  'async function loadCandidates(',
  helperStart
);

assert.ok(helperStart>=0,'V205 helper missing');
assert.ok(loadStart>helperStart,'loadCandidates missing after V205 helper');

const helperCode=source.slice(helperStart,loadStart);
const ctx={result:null};
vm.createContext(ctx);

vm.runInContext(
  `${helperCode}
   result=[
     __mfCandidatePassesEntryFiltersV205({
       mint:'A',entryAdmissionState:'ADMITTED',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV205({
       mint:'P',entryAdmissionState:'PENDING',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV205({
       mint:'R',entryAdmissionState:'REJECTED',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV205({
       mint:'T',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV205({
       mint:'F',tradeEligible:false
     }),
     __mfCandidatePassesEntryFiltersV205({
       mint:'O',state:'OPEN POSITION',tradeEligible:false
     }),
     __mfCandidatePassesEntryFiltersV205({
       mint:'LegacyStrict'
     })
   ];`,
  ctx
);

assert.deepEqual(
  Array.from(ctx.result),
  [true,false,false,true,false,true,true]
);

const rest=source.slice(loadStart+1);
const next=rest.match(/\nfunction\s+[A-Za-z0-9_$]+\s*\(/);
assert.ok(next,'loadCandidates boundary missing');

const loadEnd=loadStart+1+next.index;
const load=source.slice(loadStart,loadEnd);

const assign=load.indexOf('state.candidates');
const filter=load.indexOf('.filter(__mfCandidatePassesEntryFiltersV205)');

assert.ok(assign>=0,'state.candidates assignment missing');
assert.ok(filter>assign,'V205 filter must run after candidate load');

assert.match(
  load,
  /Array\.isArray\(state\.candidates\)[\s\S]*filter\(__mfCandidatePassesEntryFiltersV205\)/
);

console.log('terminal candidates entry-filter gate v205 ok');
TESTJS

echo "==> Syntax"
node --check "$TRADING"
node --check "$TEST"

echo "==> Targeted V205 regression"
(
  cd "$ROOT/memeflow-app"
  node tests/terminal-candidates-entry-filter-v205.mjs
)

echo "==> Safari cache-bust verification"
grep -Fq "/trading.js?v=$CACHE_VERSION" "$HTML"

# ---------------------------------------------------------------------------
# 4) Stage ONLY clean HEAD+V205 snapshots, never unrelated local edits.
# ---------------------------------------------------------------------------
mode_js="$(git ls-files -s "$TRADING" | awk 'NR==1{print $1}')"
mode_html="$(git ls-files -s "$HTML" | awk 'NR==1{print $1}')"
[[ -n "$mode_js" && -n "$mode_html" ]] || {
  echo "ERROR: trading target files are not tracked."
  exit 1
}

blob_js="$(git hash-object -w "$TMP/patched-trading.js")"
blob_html="$(git hash-object -w "$TMP/patched-trading.html")"
blob_test="$(git hash-object -w "$TEST")"

git update-index --add --cacheinfo "$mode_js,$blob_js,$TRADING"
git update-index --add --cacheinfo "$mode_html,$blob_html,$HTML"
git update-index --add --cacheinfo "100644,$blob_test,$TEST"

mapfile -t STAGED < <(git diff --cached --name-only)
if [[ "${#STAGED[@]}" -ne 3 ]]; then
  echo "ERROR: expected exactly 3 staged V205 files."
  printf '  %s\n' "${STAGED[@]}"
  exit 1
fi

for required in "$TRADING" "$HTML" "$TEST"; do
  printf '%s\n' "${STAGED[@]}" | grep -Fxq "$required" || {
    echo "ERROR: staged V205 target missing: $required"
    exit 1
  }
done

git diff --cached --check

echo "==> Staged V205 diff"
git --no-pager diff --cached --stat

# ---------------------------------------------------------------------------
# 5) Full suite AFTER V205.
#    - If baseline was green, V205 MUST keep it green.
#    - If baseline was already red, allow ONLY the same first expected/assert
#      fingerprint; a new/different failure aborts.
# ---------------------------------------------------------------------------
echo "==> npm test after V205"
set +e
(
  cd "$ROOT/memeflow-app"
  npm test > "$TMP/npm-after.log" 2>&1
)
POST_NPM_RC=$?
set -e

if [[ "$BASE_NPM_RC" -eq 0 ]]; then
  if [[ "$POST_NPM_RC" -ne 0 ]]; then
    echo "ERROR: npm test was green before V205 and is red after V205."
    tail -n 180 "$TMP/npm-after.log"
    exit 1
  fi
  echo "Full npm test: PASS"
else
  if [[ "$POST_NPM_RC" -eq 0 ]]; then
    echo "Full npm test: PASS (V205 also cleared the previous unrelated failure)"
  else
    BASE_FP="$(
      grep -m1 -E "expected:|AssertionError|ERR_ASSERTION" "$TMP/npm-before.log" \
        | sed 's/[[:space:]]\+/ /g' || true
    )"
    POST_FP="$(
      grep -m1 -E "expected:|AssertionError|ERR_ASSERTION" "$TMP/npm-after.log" \
        | sed 's/[[:space:]]\+/ /g' || true
    )"

    if [[ -z "$BASE_FP" || "$BASE_FP" != "$POST_FP" ]]; then
      echo "ERROR: full-suite failure changed after V205."
      echo "Before: ${BASE_FP:-<no fingerprint>}"
      echo "After : ${POST_FP:-<no fingerprint>}"
      echo
      echo "Last post-V205 test lines:"
      tail -n 180 "$TMP/npm-after.log"
      exit 1
    fi

    echo "Full npm suite remains red for the SAME pre-existing assertion:"
    echo "  $POST_FP"
    echo "V205 targeted regression + syntax passed; no new suite failure detected."
  fi
fi

# ---------------------------------------------------------------------------
# 6) Commit / push. No restart.
# ---------------------------------------------------------------------------
echo "==> Commit"
git commit -m "fix: gate Terminal Candidates by Entry Filters"
PATCH_COMMIT="$(git rev-parse HEAD)"
COMMITTED=1

echo "==> Push"
git push origin "HEAD:$BRANCH"

trap - ERR INT TERM
rm -rf "$TMP"

echo
echo "============================================================"
echo "SUCCESS — MEMEFLOW CANDIDATES ENTRY FILTER V205"
echo "============================================================"
echo "Candidates ALL / BUY READY / WATCH / WAITING / BLOCKED"
echo "now follow the SAME Entry Admission result as trading."
echo
echo "OPEN positions remain visible/manageable."
echo "Scanner inventory remains unchanged."
echo "Trade execution logic remains unchanged."
echo "No server restart was performed."
echo
echo "Commit: $PATCH_COMMIT"
echo "Branch: $BRANCH"
echo "============================================================"
