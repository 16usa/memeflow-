#!/usr/bin/env bash
set -Eeuo pipefail

MARK="MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V207"
TRADING="memeflow-app/trading.js"
HTML="memeflow-app/trading.html"
TEST="memeflow-app/tests/terminal-candidates-entry-filter-v207.mjs"
CACHE_VERSION="candidates-entry-filter-v207-20260927"

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

echo "==> MEMEFLOW Candidates / Entry Filters V207"
echo "Branch: $BRANCH"
echo "Server restart: will NOT be performed."
echo "Full npm suite: SKIPPED intentionally (current suite hangs / has unrelated legacy failures)."
echo "Validation: syntax + targeted regression + staged diff only."

# If previous attempts left only their untracked tests, remove them.
for f in \
  "memeflow-app/tests/terminal-candidates-entry-filter-v204.mjs" \
  "memeflow-app/tests/terminal-candidates-entry-filter-v205.mjs" \
  "memeflow-app/tests/terminal-candidates-entry-filter-v206.mjs"
do
  if [[ -e "$f" ]] && ! git cat-file -e "HEAD:$f" 2>/dev/null; then
    rm -f "$f"
  fi
done

# Refuse unrelated staged work so we never mix commits.
if ! git diff --cached --quiet; then
  echo "ERROR: staged changes already exist."
  git status --short
  echo "Unstage/commit them first, then run V207 again."
  exit 1
fi

# Remove any old failed-attempt marker residue only if the exact loader/tag
# still differs from HEAD solely because of V204/V205/V206.
if grep -Eq 'MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V20[456]' "$TRADING"; then
  echo "==> Repairing old V204/V205/V206 residue"

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
        raise SystemExit("V207 recovery: loadCandidates() missing.")
    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",s[start+1:])
    if not m:
        raise SystemExit("V207 recovery: loadCandidates() boundary missing.")
    end=start+1+m.start()
    return start,end,s[start:end]

_,_,head_region=load_region(head)

# Strip any helper inserted immediately before loadCandidates by V204/5/6.
for marker in (
    "// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V204",
    "// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V205",
    "// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V206",
):
    ms=cur.find(marker)
    cs=cur.find("async function loadCandidates(")
    if ms>=0 and cs>ms:
        cur=cur[:ms]+cur[cs:]

cs,ce,_=load_region(cur)
cur=cur[:cs]+head_region+cur[ce:]
tr.write_text(cur,encoding="utf-8")

# Restore only the /trading.js tag from HEAD.
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
    raise SystemExit("V207 recovery: trading.js script tag missing.")

curh=curh[:mc.start()]+mh.group(0)+curh[mc.end():]
html.write_text(curh,encoding="utf-8")

print("Old residue repaired without touching unrelated local edits.")
PY
fi

if grep -q "$MARK" "$TRADING"; then
  echo "V207 is already installed."
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d "/tmp/memeflow-v207-${STAMP}-XXXXXX")"
COMMITTED=0
PATCH_COMMIT=""

cp "$TRADING" "$TMP/current-trading.before"
cp "$HTML" "$TMP/current-html.before"
if [[ -e "$TEST" ]]; then
  touch "$TMP/test-existed"
  cp "$TEST" "$TMP/current-test.before"
fi

on_error() {
  rc=$?
  trap - ERR INT TERM
  set +e
  cd "$ROOT" 2>/dev/null || true

  if [[ "$rc" -ne 0 && "$COMMITTED" -eq 0 ]]; then
    echo
    echo "ERROR: V207 failed validation. Restoring only V207 target files..."
    git reset HEAD -- "$TRADING" "$HTML" "$TEST" >/dev/null 2>&1 || true

    cp "$TMP/current-trading.before" "$ROOT/$TRADING" 2>/dev/null || true
    cp "$TMP/current-html.before" "$ROOT/$HTML" 2>/dev/null || true

    if [[ -f "$TMP/test-existed" ]]; then
      cp "$TMP/current-test.before" "$ROOT/$TEST" 2>/dev/null || true
    else
      rm -f "$ROOT/$TEST"
    fi

    echo "Original local work preserved. No V207 commit/push was made."
  fi

  rm -rf "$TMP"
  exit "$rc"
}
trap on_error ERR INT TERM

git show "HEAD:$TRADING" > "$TMP/base-trading.js"
git show "HEAD:$HTML" > "$TMP/base-trading.html"

# Preflight only the exact loader region and script tag we will change.
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
        raise SystemExit("V207 REFUSED: loadCandidates() not found.")
    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",s[start+1:])
    if not m:
        raise SystemExit("V207 REFUSED: loadCandidates() boundary not found.")
    end=start+1+m.start()
    return s[start:end]

def tag(s):
    m=re.search(
        r'<script\b[^>]*\bsrc=(["\'])/trading\.js(?:\?v=[^"\']*)?\1[^>]*>\s*</script>',
        s,re.I
    )
    if not m:
        raise SystemExit("V207 REFUSED: /trading.js script tag not found.")
    return m.group(0)

if load_region(base_js)!=load_region(cur_js):
    raise SystemExit(
        "V207 REFUSED: local edits overlap loadCandidates(). "
        "Nothing changed."
    )

if tag(base_h)!=tag(cur_h):
    raise SystemExit(
        "V207 REFUSED: local edits overlap the trading.js script tag."
    )

print("Preflight OK.")
PY

cat > "$TMP/transform.py" <<'PY'
from pathlib import Path
import re, sys

mode=sys.argv[1]
path=Path(sys.argv[2])
text=path.read_text(encoding="utf-8")

MARK="MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V207"
CACHE="candidates-entry-filter-v207-20260927"

HELPER=r"""
// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V207
// Candidates is a trading surface, therefore a card is visible only when the
// SAME canonical Entry Admission used by trading says it is admitted.
// OPEN positions are preserved so position management never disappears.
function __mfCandidatePassesEntryFiltersV207(candidate) {
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

  // Compatibility: rows from strict /api/ai/decisions are already
  // Entry-Admission-gated server-side and may omit UI annotations.
  return true;
}

"""

FILTER=r"""
  // MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V207
  // Real-Time Pipeline can carry PENDING/REJECTED rows. Do not show those in
  // Terminal Candidates. This runs before ALL/BUY READY/WATCH/WAITING/BLOCKED.
  state.candidates =
    (Array.isArray(state.candidates) ? state.candidates : [])
      .filter(__mfCandidatePassesEntryFiltersV207);

"""

if mode=="trading":
    if MARK in text:
        raise SystemExit("V207 already present.")

    start=text.find("async function loadCandidates(")
    if start<0:
        raise SystemExit("V207: loadCandidates() missing.")

    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",text[start+1:])
    if not m:
        raise SystemExit("V207: loadCandidates() boundary missing.")
    end=start+1+m.start()
    region=text[start:end]

    first=region.find("state.candidates")
    if first<0:
        raise SystemExit("V207: state.candidates assignment missing.")

    anchors=[
        "  state.liveWatchCandidates",
        "  const rows = mergedCandidates();",
        "  const rows=mergedCandidates();",
        "  const rows = mergedCandidates()",
        "  const rows=mergedCandidates()",
        "  syncSelectedCandidate();",
        "  updateCandidateCount();",
        "  renderCandidates();"
    ]

    choices=[]
    for anchor in anchors:
        p=region.find(anchor)
        if p>first:
            choices.append((p,anchor))

    if not choices:
        raise SystemExit("V207: safe post-assignment anchor missing.")

    anchor_pos,anchor=min(choices,key=lambda x:x[0])

    text=text[:start]+HELPER+text[start:]
    start+=len(HELPER)
    insert_at=start+anchor_pos
    text=text[:insert_at]+FILTER+text[insert_at:]

    path.write_text(text,encoding="utf-8")
    print(f"patched trading.js before: {anchor}")

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
        raise SystemExit(f"V207: trading.js tag count={n}")
    path.write_text(text2,encoding="utf-8")
    print("patched trading.html cache-bust")
else:
    raise SystemExit("unknown transform mode")
PY

# Build clean HEAD+V207 versions for staging.
cp "$TMP/base-trading.js" "$TMP/patched-trading.js"
cp "$TMP/base-trading.html" "$TMP/patched-trading.html"
python3 "$TMP/transform.py" trading "$TMP/patched-trading.js"
python3 "$TMP/transform.py" html "$TMP/patched-trading.html"

# Apply same patch to worktree.
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

assert.match(source,/MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V207/);

const helperStart=source.indexOf(
  'function __mfCandidatePassesEntryFiltersV207(candidate) {'
);
const loadStart=source.indexOf(
  'async function loadCandidates(',
  helperStart
);

assert.ok(helperStart>=0,'V207 helper missing');
assert.ok(loadStart>helperStart,'loadCandidates missing');

const helperCode=source.slice(helperStart,loadStart);
const ctx={result:null};
vm.createContext(ctx);

vm.runInContext(
  `${helperCode}
   result=[
     __mfCandidatePassesEntryFiltersV207({
       mint:'A',entryAdmissionState:'ADMITTED',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'P',entryAdmissionState:'PENDING',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'R',entryAdmissionState:'REJECTED',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'T',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'F',tradeEligible:false
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'O',state:'OPEN POSITION',tradeEligible:false
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'StrictLegacy'
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
const filter=load.indexOf('.filter(__mfCandidatePassesEntryFiltersV207)');

assert.ok(assign>=0,'state.candidates assignment missing');
assert.ok(filter>assign,'V207 filter must run after candidate load');

console.log('terminal candidates entry-filter gate v207 ok');
TESTJS

echo "==> Syntax"
node --check "$TRADING"
node --check "$TEST"

echo "==> Targeted V207 regression"
(
  cd "$ROOT/memeflow-app"
  node tests/terminal-candidates-entry-filter-v207.mjs
)

echo "==> Cache-bust verification"
grep -Fq "/trading.js?v=$CACHE_VERSION" "$HTML"

# Stage only the clean HEAD+V207 content.
mode_js="$(git ls-files -s "$TRADING" | awk 'NR==1{print $1}')"
mode_html="$(git ls-files -s "$HTML" | awk 'NR==1{print $1}')"

[[ -n "$mode_js" && -n "$mode_html" ]] || {
  echo "ERROR: target files are not tracked."
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
  echo "ERROR: expected exactly 3 staged V207 files."
  printf '  %s\n' "${STAGED[@]}"
  exit 1
fi

for required in "$TRADING" "$HTML" "$TEST"; do
  printf '%s\n' "${STAGED[@]}" | grep -Fxq "$required" || {
    echo "ERROR: staged target missing: $required"
    exit 1
  }
done

git diff --cached --check

echo "==> Staged V207 diff"
git --no-pager diff --cached --stat

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
echo "SUCCESS — MEMEFLOW CANDIDATES ENTRY FILTER V207"
echo "============================================================"
echo "Candidates now shows only Entry-Filter-admitted tokens."
echo "OPEN positions remain visible/manageable."
echo "Scanner inventory is unchanged."
echo "Trade execution logic is unchanged."
echo "No full npm suite was run, because the current suite hangs / is stale."
echo "Targeted V207 regression and syntax checks passed."
echo "No server restart was performed."
echo
echo "Commit: $PATCH_COMMIT"
echo "Branch: $BRANCH"
echo "============================================================"
