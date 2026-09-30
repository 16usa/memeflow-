#!/usr/bin/env bash
set -Eeuo pipefail

MARK="MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V206"
OLD_MARKS=(
  "MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V204"
  "MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V205"
)

TRADING="memeflow-app/trading.js"
HTML="memeflow-app/trading.html"
TEST="memeflow-app/tests/terminal-candidates-entry-filter-v206.mjs"
OLD_TESTS=(
  "memeflow-app/tests/terminal-candidates-entry-filter-v204.mjs"
  "memeflow-app/tests/terminal-candidates-entry-filter-v205.mjs"
)
CACHE_VERSION="candidates-entry-filter-v206-20260927"

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

echo "==> MEMEFLOW Candidates / Entry Filters V206"
echo "Branch: $BRANCH"
echo "Server restart: will NOT be performed."

# ---------------------------------------------------------------------------
# 0) Clean ONLY residue from failed V204/V205 attempts, if any exists.
# ---------------------------------------------------------------------------
if ! git diff --cached --quiet; then
  mapfile -t STAGED_NOW < <(git diff --cached --name-only)
  ALLOWED=1
  for p in "${STAGED_NOW[@]}"; do
    case "$p" in
      "$TRADING"|"$HTML"|\
      "memeflow-app/tests/terminal-candidates-entry-filter-v204.mjs"|\
      "memeflow-app/tests/terminal-candidates-entry-filter-v205.mjs")
        ;;
      *)
        ALLOWED=0
        ;;
    esac
  done

  if [[ "$ALLOWED" -eq 1 ]]; then
    OLD_STAGE=0
    if git show ":$TRADING" 2>/dev/null | grep -Eq \
      'MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V20[45]'; then
      OLD_STAGE=1
    fi

    for f in "${OLD_TESTS[@]}"; do
      if [[ -e "$f" ]] && ! git cat-file -e "HEAD:$f" 2>/dev/null; then
        OLD_STAGE=1
      fi
    done

    if [[ "$OLD_STAGE" -eq 1 ]]; then
      echo "==> Cleaning staged residue from failed V204/V205"
      git reset HEAD -- \
        "$TRADING" "$HTML" \
        "${OLD_TESTS[@]}" \
        >/dev/null 2>&1 || true
    else
      echo "ERROR: staged changes exist and are not recognized as failed V204/V205 residue."
      git status --short
      exit 1
    fi
  else
    echo "ERROR: unrelated staged changes exist."
    git status --short
    exit 1
  fi
fi

# Restore only the exact V204/V205-modified regions from HEAD if markers remain.
if grep -Eq 'MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V20[45]' "$TRADING"; then
  echo "==> Repairing old V204/V205 worktree residue"

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
        raise SystemExit("V206 recovery: loadCandidates() missing.")
    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",s[start+1:])
    if not m:
        raise SystemExit("V206 recovery: loadCandidates() boundary missing.")
    end=start+1+m.start()
    return start,end,s[start:end]

_,_,head_region=load_region(head)

# Remove old V204/V205 helper blocks that were inserted immediately before
# loadCandidates(), then restore exact HEAD loadCandidates().
for marker in (
    "// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V204",
    "// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V205",
):
    ms=cur.find(marker)
    cs=cur.find("async function loadCandidates(")
    if ms>=0 and cs>ms:
        cur=cur[:ms]+cur[cs:]

cs,ce,_=load_region(cur)
cur=cur[:cs]+head_region+cur[ce:]
tr.write_text(cur,encoding="utf-8")

# Restore only /trading.js script tag from HEAD.
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
    raise SystemExit("V206 recovery: trading.js script tag missing.")

curh=curh[:mc.start()]+mh.group(0)+curh[mc.end():]
html.write_text(curh,encoding="utf-8")

print("Old V204/V205 residue repaired without touching unrelated local edits.")
PY
fi

for f in "${OLD_TESTS[@]}"; do
  if [[ -e "$f" ]] && ! git cat-file -e "HEAD:$f" 2>/dev/null; then
    rm -f "$f"
  fi
done

if grep -q "$MARK" "$TRADING"; then
  echo "V206 is already installed."
  exit 0
fi

if ! git diff --cached --quiet; then
  echo "ERROR: staged changes remain after residue cleanup."
  git status --short
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d "/tmp/memeflow-v206-${STAMP}-XXXXXX")"
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

  # Prevent ERR trap recursion / duplicate rollback messages.
  trap - ERR INT TERM
  set +e
  cd "$ROOT" 2>/dev/null || true

  if [[ "$rc" -ne 0 && "$COMMITTED" -eq 0 ]]; then
    echo
    echo "ERROR: V206 failed validation. Restoring only V206 target files..."
    git reset HEAD -- "$TRADING" "$HTML" "$TEST" >/dev/null 2>&1 || true

    cp "$TMP/current-trading.before" "$ROOT/$TRADING" 2>/dev/null || true
    cp "$TMP/current-html.before" "$ROOT/$HTML" 2>/dev/null || true

    if [[ -f "$TMP/test-existed" ]]; then
      cp "$TMP/current-test.before" "$ROOT/$TEST" 2>/dev/null || true
    else
      rm -f "$ROOT/$TEST"
    fi

    echo "Original local work preserved. No V206 commit/push was made."
  elif [[ "$rc" -ne 0 && "$COMMITTED" -eq 1 ]]; then
    echo
    echo "ERROR after V206 commit. Commit retained: $PATCH_COMMIT"
  fi

  rm -rf "$TMP"
  exit "$rc"
}
trap on_error ERR INT TERM

git show "HEAD:$TRADING" > "$TMP/base-trading.js"
git show "HEAD:$HTML" > "$TMP/base-trading.html"

# ---------------------------------------------------------------------------
# 1) Preflight only the exact region/tag V206 will modify.
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
        raise SystemExit("V206 REFUSED: loadCandidates() not found.")
    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",s[start+1:])
    if not m:
        raise SystemExit("V206 REFUSED: loadCandidates() boundary not found.")
    end=start+1+m.start()
    return s[start:end]

def tag(s):
    m=re.search(
        r'<script\b[^>]*\bsrc=(["\'])/trading\.js(?:\?v=[^"\']*)?\1[^>]*>\s*</script>',
        s,re.I
    )
    if not m:
        raise SystemExit("V206 REFUSED: /trading.js script tag not found.")
    return m.group(0)

if load_region(base_js)!=load_region(cur_js):
    raise SystemExit(
        "V206 REFUSED: local edits overlap loadCandidates(). "
        "Nothing changed; commit/push that logic first."
    )

if tag(base_h)!=tag(cur_h):
    raise SystemExit(
        "V206 REFUSED: local edits overlap the trading.js script tag."
    )

print("Preflight OK: current Candidates loader is safe to patch.")
PY

# ---------------------------------------------------------------------------
# 2) Baseline full suite.
# IMPORTANT: use IF, not set +e, so ERR trap cannot fire on known failure.
# ---------------------------------------------------------------------------
echo "==> Baseline npm test (before V206)"
if (
  cd "$ROOT/memeflow-app" &&
  npm test > "$TMP/npm-before.log" 2>&1
); then
  BASE_NPM_RC=0
  echo "Baseline npm test: PASS"
else
  BASE_NPM_RC=$?
  echo "Baseline npm test: already FAILING before V206"
  BASE_FP="$(
    grep -m1 -E "expected:|AssertionError|ERR_ASSERTION" "$TMP/npm-before.log" \
      | sed 's/[[:space:]]\+/ /g' || true
  )"
  echo "Baseline fingerprint: ${BASE_FP:-<not found>}"
fi

cat > "$TMP/transform.py" <<'PY'
from pathlib import Path
import re, sys

mode=sys.argv[1]
path=Path(sys.argv[2])
text=path.read_text(encoding="utf-8")

MARK="MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V206"
CACHE="candidates-entry-filter-v206-20260927"

HELPER=r"""
// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V206
// Terminal Candidates is an actionable trading surface, therefore cards use
// the SAME backend Entry Admission result that gates trading.
//
// Keep:
//   ADMITTED / tradeEligible=true
//   OPEN positions (position management must never disappear)
//
// Hide:
//   PENDING / REJECTED
//   displayOnly rows
//   tradeEligible=false rows
//
// Compatibility:
// legacy strict /api/ai/decisions rows can omit frontend admission annotations
// because that endpoint is already Entry-Admission-gated server-side.
function __mfCandidatePassesEntryFiltersV206(candidate) {
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
  // MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V206
  // The Real-Time Pipeline may contain rows that have not passed Entry
  // Filters. Remove them BEFORE ALL / BUY READY / WATCH / WAITING / BLOCKED
  // are rendered. Scanner inventory and execution logic stay unchanged.
  state.candidates =
    (Array.isArray(state.candidates) ? state.candidates : [])
      .filter(__mfCandidatePassesEntryFiltersV206);

"""

if mode=="trading":
    if MARK in text:
        raise SystemExit("V206 already present.")

    start=text.find("async function loadCandidates(")
    if start<0:
        raise SystemExit("V206: loadCandidates() missing.")

    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",text[start+1:])
    if not m:
        raise SystemExit("V206: loadCandidates() boundary missing.")
    end=start+1+m.start()
    region=text[start:end]

    first_candidates=region.find("state.candidates")
    if first_candidates<0:
        raise SystemExit("V206: loadCandidates() does not assign state.candidates.")

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
    for a in anchors:
        p=region.find(a)
        if p>first_candidates:
            choices.append((p,a))

    if not choices:
        raise SystemExit(
            "V206: safe post-assignment anchor not found in loadCandidates()."
        )

    anchor_pos,anchor=min(choices,key=lambda x:x[0])

    # Helper immediately before loader.
    text=text[:start]+HELPER+text[start:]
    start+=len(HELPER)

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
        raise SystemExit(f"V206: trading.js cache tag count={n}")
    path.write_text(text2,encoding="utf-8")
    print("patched trading.html cache-bust")
else:
    raise SystemExit("unknown transform mode")
PY

# ---------------------------------------------------------------------------
# 3) Build exact clean HEAD+V206 commit and layer same tiny patch on worktree.
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
  /MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V206/
);

const helperStart=source.indexOf(
  'function __mfCandidatePassesEntryFiltersV206(candidate) {'
);
const loadStart=source.indexOf(
  'async function loadCandidates(',
  helperStart
);

assert.ok(helperStart>=0,'V206 helper missing');
assert.ok(loadStart>helperStart,'loadCandidates missing after V206 helper');

const helperCode=source.slice(helperStart,loadStart);
const ctx={result:null};
vm.createContext(ctx);

vm.runInContext(
  `${helperCode}
   result=[
     __mfCandidatePassesEntryFiltersV206({
       mint:'A',entryAdmissionState:'ADMITTED',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV206({
       mint:'P',entryAdmissionState:'PENDING',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV206({
       mint:'R',entryAdmissionState:'REJECTED',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV206({
       mint:'T',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV206({
       mint:'F',tradeEligible:false
     }),
     __mfCandidatePassesEntryFiltersV206({
       mint:'O',state:'OPEN POSITION',tradeEligible:false
     }),
     __mfCandidatePassesEntryFiltersV206({
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
const filter=load.indexOf('.filter(__mfCandidatePassesEntryFiltersV206)');

assert.ok(assign>=0,'state.candidates assignment missing');
assert.ok(filter>assign,'V206 filter must run after candidate load');

assert.match(
  load,
  /Array\.isArray\(state\.candidates\)[\s\S]*filter\(__mfCandidatePassesEntryFiltersV206\)/
);

console.log('terminal candidates entry-filter gate v206 ok');
TESTJS

echo "==> Syntax"
node --check "$TRADING"
node --check "$TEST"

echo "==> Targeted V206 regression"
(
  cd "$ROOT/memeflow-app"
  node tests/terminal-candidates-entry-filter-v206.mjs
)

echo "==> Safari cache-bust verification"
grep -Fq "/trading.js?v=$CACHE_VERSION" "$HTML"

# ---------------------------------------------------------------------------
# 4) Stage ONLY clean HEAD+V206 snapshots.
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
  echo "ERROR: expected exactly 3 staged V206 files."
  printf '  %s\n' "${STAGED[@]}"
  exit 1
fi

for required in "$TRADING" "$HTML" "$TEST"; do
  printf '%s\n' "${STAGED[@]}" | grep -Fxq "$required" || {
    echo "ERROR: staged V206 target missing: $required"
    exit 1
  }
done

git diff --cached --check
echo "==> Staged V206 diff"
git --no-pager diff --cached --stat

# ---------------------------------------------------------------------------
# 5) Full suite AFTER V206.
# Again: use IF so ERR trap cannot fire on an expected pre-existing red suite.
# ---------------------------------------------------------------------------
echo "==> npm test after V206"
if (
  cd "$ROOT/memeflow-app" &&
  npm test > "$TMP/npm-after.log" 2>&1
); then
  POST_NPM_RC=0
  echo "Post-V206 npm test: PASS"
else
  POST_NPM_RC=$?
  POST_FP="$(
    grep -m1 -E "expected:|AssertionError|ERR_ASSERTION" "$TMP/npm-after.log" \
      | sed 's/[[:space:]]\+/ /g' || true
  )"
  echo "Post-V206 npm test: FAIL"
  echo "Post fingerprint: ${POST_FP:-<not found>}"
fi

if [[ "$BASE_NPM_RC" -eq 0 ]]; then
  if [[ "$POST_NPM_RC" -ne 0 ]]; then
    echo "ERROR: npm test was green before V206 and red after V206."
    tail -n 180 "$TMP/npm-after.log"
    exit 1
  fi
else
  if [[ "$POST_NPM_RC" -ne 0 ]]; then
    BASE_FP="$(
      grep -m1 -E "expected:|AssertionError|ERR_ASSERTION" "$TMP/npm-before.log" \
        | sed 's/[[:space:]]\+/ /g' || true
    )"
    POST_FP="$(
      grep -m1 -E "expected:|AssertionError|ERR_ASSERTION" "$TMP/npm-after.log" \
        | sed 's/[[:space:]]\+/ /g' || true
    )"

    if [[ -z "$BASE_FP" || "$BASE_FP" != "$POST_FP" ]]; then
      echo "ERROR: full-suite failure changed after V206."
      echo "Before: ${BASE_FP:-<no fingerprint>}"
      echo "After : ${POST_FP:-<no fingerprint>}"
      tail -n 180 "$TMP/npm-after.log"
      exit 1
    fi

    echo "Full npm suite remains red for the SAME pre-existing assertion."
    echo "No new suite failure was introduced by V206."
  fi
fi

# ---------------------------------------------------------------------------
# 6) Commit and push. No restart.
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
echo "SUCCESS — MEMEFLOW CANDIDATES ENTRY FILTER V206"
echo "============================================================"
echo "Candidates ALL / BUY READY / WATCH / WAITING / BLOCKED"
echo "now use the SAME canonical Entry Admission result as trading."
echo
echo "OPEN positions remain visible/manageable."
echo "Scanner inventory remains unchanged."
echo "Trade execution logic remains unchanged."
echo "No server restart was performed."
echo
echo "Commit: $PATCH_COMMIT"
echo "Branch: $BRANCH"
echo "============================================================"
