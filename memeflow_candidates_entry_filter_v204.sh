#!/usr/bin/env bash
set -Eeuo pipefail

MARK="MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V204"
TRADING="memeflow-app/trading.js"
HTML="memeflow-app/trading.html"
TEST="memeflow-app/tests/terminal-candidates-entry-filter-v204.mjs"
CACHE_VERSION="candidates-entry-filter-v204-20260927"

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

if ! git diff --cached --quiet; then
  echo "ERROR: staged changes already exist. Commit or unstage them first."
  git status --short
  exit 1
fi

echo "==> MEMEFLOW Candidates / Entry Filters V204"
echo "Branch: $BRANCH"
echo "Server restart: will NOT be performed."

if grep -q "$MARK" "$TRADING"; then
  echo "V204 is already installed."
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d "/tmp/memeflow-v204-${STAMP}-XXXXXX")"
COMMITTED=0
PATCH_COMMIT=""

on_error() {
  rc=$?
  set +e
  if [[ "$rc" -ne 0 && "$COMMITTED" -eq 0 ]]; then
    echo
    echo "ERROR: V204 failed validation. Restoring only V204 target files..."
    git reset --mixed HEAD -- "$TRADING" "$HTML" "$TEST" >/dev/null 2>&1 || true
    [[ -f "$TMP/current-trading.before" ]] && cp "$TMP/current-trading.before" "$TRADING"
    [[ -f "$TMP/current-html.before" ]] && cp "$TMP/current-html.before" "$HTML"
    if [[ -f "$TMP/test-existed" ]]; then
      [[ -f "$TMP/current-test.before" ]] && cp "$TMP/current-test.before" "$TEST"
    else
      rm -f "$TEST"
    fi
    echo "Original local work preserved. No commit/push was made."
  fi
  rm -rf "$TMP"
  exit "$rc"
}
trap on_error ERR INT TERM

cp "$TRADING" "$TMP/current-trading.before"
cp "$HTML" "$TMP/current-html.before"
if [[ -e "$TEST" ]]; then
  touch "$TMP/test-existed"
  cp "$TEST" "$TMP/current-test.before"
fi

git show "HEAD:$TRADING" > "$TMP/base-trading.js"
git show "HEAD:$HTML" > "$TMP/base-trading.html"

# Protect only the exact loadCandidates region and trading.js script tag.
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
        raise SystemExit("V204 REFUSED: loadCandidates() not found.")
    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",s[start+1:])
    if not m:
        raise SystemExit("V204 REFUSED: loadCandidates() boundary not found.")
    end=start+1+m.start()
    return s[start:end]

def tag(s):
    m=re.search(
        r'<script\b[^>]*\bsrc=(["\'])/trading\.js(?:\?v=[^"\']*)?\1[^>]*>\s*</script>',
        s,re.I
    )
    if not m:
        raise SystemExit("V204 REFUSED: /trading.js script tag not found.")
    return m.group(0)

if load_region(base_js)!=load_region(cur_js):
    raise SystemExit(
        "V204 REFUSED: local edits overlap loadCandidates(). "
        "Nothing changed; commit/push that logic first."
    )

if tag(base_h)!=tag(cur_h):
    raise SystemExit(
        "V204 REFUSED: local edits overlap the trading.js script tag."
    )

print("Preflight OK: current loadCandidates() shape is safe to patch.")
PY

cat > "$TMP/transform.py" <<'PY'
from pathlib import Path
import re, sys

mode=sys.argv[1]
path=Path(sys.argv[2])
text=path.read_text(encoding="utf-8")

MARK="MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V204"
CACHE="candidates-entry-filter-v204-20260927"

HELPER=r"""
// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V204
// Terminal Candidates is an actionable surface, so it uses the SAME backend
// Entry Admission result that gates trading.
//
// Keep:
//   ADMITTED / tradeEligible=true
//   OPEN positions (management must never disappear)
//
// Hide:
//   PENDING / REJECTED
//   displayOnly rows
//   tradeEligible=false rows
//
// Compatibility:
// legacy strict /api/ai/decisions rows may omit admission annotations because
// that endpoint is already Entry-Admission-gated server-side.
function __mfCandidatePassesEntryFiltersV204(candidate) {
  if (!candidate?.mint) return false;

  const state =
    String(candidate?.state || candidate?.displayState || '')
      .trim()
      .toUpperCase();

  if (
    state === 'OPEN POSITION' ||
    state === 'OPEN' ||
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

  // Strict trading-feed compatibility: no annotations means the server-side
  // strict feed already admitted this token.
  return true;
}

"""

FILTER=r"""
  // MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V204
  // `state.candidates` may come from the broad Real-Time Pipeline. Before the
  // module renders ALL / BUY READY / WATCH / WAITING / BLOCKED, remove every
  // row that did not pass canonical Entry Admission.
  state.candidates =
    (Array.isArray(state.candidates) ? state.candidates : [])
      .filter(__mfCandidatePassesEntryFiltersV204);

"""

if mode=="trading":
    if MARK in text:
        raise SystemExit("V204 already present.")

    start=text.find("async function loadCandidates(")
    if start<0:
        raise SystemExit("V204: loadCandidates() missing.")

    m=re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(",text[start+1:])
    if not m:
        raise SystemExit("V204: loadCandidates() boundary missing.")
    end=start+1+m.start()
    region=text[start:end]

    if "state.candidates" not in region:
        raise SystemExit("V204: loadCandidates() does not assign state.candidates.")

    # Insert filter after candidate assignment, before secondary feeds / merge.
    anchors=[
        "  state.liveWatchCandidates",
        "  const rows = mergedCandidates();",
        "  const rows=mergedCandidates();",
        "  const rows = mergedCandidates()",
        "  const rows=mergedCandidates()",
        "  syncSelectedCandidate();"
    ]

    anchor_pos=-1
    for a in anchors:
        p=region.find(a)
        if p>=0:
            anchor_pos=p
            break

    if anchor_pos<0:
        raise SystemExit(
            "V204: safe post-assignment anchor not found in loadCandidates()."
        )

    # Ensure our anchor is after the first state.candidates occurrence.
    first_candidates=region.find("state.candidates")
    if anchor_pos<=first_candidates:
        raise SystemExit("V204: candidate filter anchor is before assignment.")

    text=text[:start]+HELPER+text[start:]
    start+=len(HELPER)
    end+=len(HELPER)

    # Recompute current region and anchor after helper insertion.
    region=text[start:end]
    anchor_pos=-1
    for a in anchors:
        p=region.find(a)
        if p>=0:
            anchor_pos=p
            break

    insert_at=start+anchor_pos
    text=text[:insert_at]+FILTER+text[insert_at:]

    path.write_text(text,encoding="utf-8")
    print("patched trading.js: broad Pipeline rows now pass Entry Admission before Candidates")

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
        raise SystemExit(f"V204: trading.js cache tag count={n}")
    path.write_text(text2,encoding="utf-8")
    print("patched trading.html: Safari cache-bust updated")
else:
    raise SystemExit("unknown transform mode")
PY

# Produce exact clean HEAD+patch content for the commit.
cp "$TMP/base-trading.js" "$TMP/patched-trading.js"
cp "$TMP/base-trading.html" "$TMP/patched-trading.html"
python3 "$TMP/transform.py" trading "$TMP/patched-trading.js"
python3 "$TMP/transform.py" html "$TMP/patched-trading.html"

# Apply the same patch to current worktree, preserving unrelated local edits.
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
  /MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V204/
);

const helperStart=source.indexOf(
  'function __mfCandidatePassesEntryFiltersV204(candidate) {'
);
const loadStart=source.indexOf(
  'async function loadCandidates(',
  helperStart
);

assert.ok(helperStart>=0,'V204 helper missing');
assert.ok(loadStart>helperStart,'loadCandidates missing after V204 helper');

const helperCode=source.slice(helperStart,loadStart);
const ctx={result:null};
vm.createContext(ctx);
vm.runInContext(
  `${helperCode}
   result=[
     __mfCandidatePassesEntryFiltersV204({
       mint:'A',entryAdmissionState:'ADMITTED',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV204({
       mint:'P',entryAdmissionState:'PENDING',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV204({
       mint:'R',entryAdmissionState:'REJECTED',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV204({
       mint:'T',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV204({
       mint:'F',tradeEligible:false
     }),
     __mfCandidatePassesEntryFiltersV204({
       mint:'O',state:'OPEN POSITION',tradeEligible:false
     }),
     __mfCandidatePassesEntryFiltersV204({
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
const filter=load.indexOf('.filter(__mfCandidatePassesEntryFiltersV204)');
assert.ok(assign>=0,'state.candidates assignment missing');
assert.ok(filter>assign,'V204 Entry filter must run after candidate load');

assert.match(
  load,
  /Array\.isArray\(state\.candidates\)[\s\S]*filter\(__mfCandidatePassesEntryFiltersV204\)/
);

console.log('terminal candidates entry-filter gate v204 ok');
TESTJS

echo "==> Syntax"
node --check "$TRADING"
node --check "$TEST"

echo "==> Targeted V204 regression"
(
  cd memeflow-app
  node tests/terminal-candidates-entry-filter-v204.mjs
)

echo "==> Cache-bust verification"
grep -Fq "/trading.js?v=$CACHE_VERSION" "$HTML"

# Stage ONLY HEAD+V204 snapshots so unrelated unstaged edits never enter commit.
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
  echo "ERROR: expected exactly 3 staged V204 files."
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

echo "==> Staged V204 diff"
git --no-pager diff --cached --stat

echo "==> Full npm test"
(
  cd memeflow-app
  npm test
)

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
echo "SUCCESS — MEMEFLOW CANDIDATES ENTRY FILTER V204"
echo "============================================================"
echo "Candidates ALL/BUY READY/WATCH/WAITING/BLOCKED now use"
echo "the same canonical Entry Admission result as trading."
echo
echo "OPEN positions remain visible."
echo "Scanner inventory remains unchanged."
echo "No server restart was performed."
echo "Commit: $PATCH_COMMIT"
echo "Branch: $BRANCH"
echo "============================================================"
