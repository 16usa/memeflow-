#!/usr/bin/env bash
set -Eeuo pipefail

MARK="MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V203"
TRADING="memeflow-app/trading.js"
HTML="memeflow-app/trading.html"
TEST="memeflow-app/tests/terminal-candidates-entry-filter-v203.mjs"
CACHE_VERSION="candidates-entry-filter-v203-20260927"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this from the existing MEMEFLOW Replit Shell/workspace."
  exit 1
fi
cd "$ROOT"

for f in "$TRADING" "$HTML"; do
  [[ -f "$f" ]] || { echo "ERROR: required file missing: $f"; exit 1; }
done

BRANCH="$(git branch --show-current)"
[[ -n "$BRANCH" ]] || { echo "ERROR: detached HEAD is not supported."; exit 1; }

if [[ -n "$(git ls-files -u)" ]]; then
  echo "ERROR: unresolved merge conflicts already exist."
  git ls-files -u
  exit 1
fi

# We stage only this patch. Existing staged work is too easy to mix into a commit.
if ! git diff --cached --quiet; then
  echo "ERROR: staged local changes exist. Commit/unstage them first."
  git status --short
  exit 1
fi

echo "==> MEMEFLOW Candidates / Entry Filters V203"
echo "Branch: $BRANCH"
echo "No server restart will be performed."

# Make sure we do not accidentally push unrelated local commits.
git fetch origin "$BRANCH" >/dev/null 2>&1 || git fetch origin >/dev/null 2>&1 || true
if git rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1; then
  LOCAL_HEAD="$(git rev-parse HEAD)"
  REMOTE_HEAD="$(git rev-parse "origin/$BRANCH")"
  if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    echo "ERROR: local HEAD and origin/$BRANCH are not identical."
    echo "local : $LOCAL_HEAD"
    echo "remote: $REMOTE_HEAD"
    echo "Refusing to push unrelated commits or overwrite newer remote work."
    exit 1
  fi
fi

# Already installed = no-op.
if grep -q "$MARK" "$TRADING"; then
  echo "V203 is already installed in $TRADING."
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d "/tmp/memeflow-candidates-entry-v203-${STAMP}-XXXXXX")"
COMMITTED=0
PATCH_COMMIT=""

cleanup_on_error() {
  rc=$?
  set +e
  if [[ "$rc" -ne 0 && "$COMMITTED" -eq 0 ]]; then
    echo
    echo "ERROR: V203 validation failed. Restoring only V203 work..."
    git reset --mixed HEAD -- "$TRADING" "$HTML" "$TEST" >/dev/null 2>&1 || true
    [[ -f "$TMP/current-trading.before" ]] && cp "$TMP/current-trading.before" "$TRADING"
    [[ -f "$TMP/current-html.before" ]] && cp "$TMP/current-html.before" "$HTML"
    if [[ -f "$TMP/test-existed" ]]; then
      [[ -f "$TMP/current-test.before" ]] && cp "$TMP/current-test.before" "$TEST"
    else
      rm -f "$TEST"
    fi
    echo "Original local work preserved. No commit/push was made."
  elif [[ "$rc" -ne 0 && "$COMMITTED" -eq 1 ]]; then
    echo
    echo "ERROR after commit. Local V203 commit was kept: $PATCH_COMMIT"
    echo "Nothing was reset."
  fi
  rm -rf "$TMP"
  exit "$rc"
}
trap cleanup_on_error ERR INT TERM

cp "$TRADING" "$TMP/current-trading.before"
cp "$HTML" "$TMP/current-html.before"
if [[ -e "$TEST" ]]; then
  touch "$TMP/test-existed"
  cp "$TEST" "$TMP/current-test.before"
fi

git show "HEAD:$TRADING" > "$TMP/base-trading.js"
git show "HEAD:$HTML" > "$TMP/base-trading.html"

# Refuse only if LOCAL edits overlap the exact logic/tag we need.
python3 - "$TMP/base-trading.js" "$TRADING" "$TMP/base-trading.html" "$HTML" <<'PY'
from pathlib import Path
import re, sys

base_js = Path(sys.argv[1]).read_text(encoding="utf-8")
cur_js  = Path(sys.argv[2]).read_text(encoding="utf-8")
base_h  = Path(sys.argv[3]).read_text(encoding="utf-8")
cur_h   = Path(sys.argv[4]).read_text(encoding="utf-8")

def merged_region(s):
    start = s.find("function mergedCandidates() {")
    if start < 0:
        raise SystemExit("V203 REFUSED: mergedCandidates() not found.")
    m = re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(", s[start+1:])
    if not m:
        raise SystemExit("V203 REFUSED: next top-level function after mergedCandidates() not found.")
    end = start + 1 + m.start()
    return s[start:end]

def trading_tag(s):
    m = re.search(
        r'<script\b[^>]*\bsrc=(["\'])/trading\.js(?:\?v=[^"\']*)?\1[^>]*>\s*</script>',
        s,
        flags=re.I
    )
    if not m:
        raise SystemExit("V203 REFUSED: /trading.js script tag not found.")
    return m.group(0)

if merged_region(base_js) != merged_region(cur_js):
    raise SystemExit(
        "V203 REFUSED: local edits overlap mergedCandidates(). "
        "Nothing changed; push/commit that logic first."
    )

if trading_tag(base_h) != trading_tag(cur_h):
    raise SystemExit(
        "V203 REFUSED: local edits overlap the trading.js script tag. "
        "Nothing changed."
    )

print("Preflight OK: unrelated local edits can stay in the worktree.")
PY

cat > "$TMP/transform.py" <<'PY'
from pathlib import Path
import re, sys

mode = sys.argv[1]
path = Path(sys.argv[2])
text = path.read_text(encoding="utf-8")

MARK = "MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V203"
CACHE = "candidates-entry-filter-v203-20260927"

HELPER = r"""
// MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V203
// Candidates is an actionable trading surface:
// - explicit ADMITTED / tradeEligible=true => keep
// - PENDING / REJECTED / displayOnly / tradeEligible=false => hide
// - legacy strict /api/ai/decisions rows may not carry UI admission fields;
//   that feed is already Entry-Admission-gated on the server, so keep them.
// OPEN positions are added later by mergedCandidates() and are never removed.
function __mfCandidatePassesEntryFiltersV203(candidate) {
  if (!candidate?.mint) return false;

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

  // Old supplemental Pipeline WATCH rows must never bypass Entry Filters.
  if (candidate?.__pipelineWatch === true) return false;

  // Compatibility for strict trading-feed rows that are already admitted
  // server-side and therefore have no frontend admission annotations.
  return true;
}

"""

GATE = r"""
  // MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V203
  // Apply the SAME canonical Entry Admission used by trading before any
  // Candidates tab (ALL / BUY READY / WATCH / WAITING / BLOCKED) is rendered.
  // Do this before OPEN positions are pinned, so active positions always remain
  // manageable even if settings change after entry.
  for (const [mint, candidate] of [...byMint.entries()]) {
    if (!__mfCandidatePassesEntryFiltersV203(candidate)) {
      byMint.delete(mint);
    }
  }

"""

if mode == "trading":
    if MARK in text:
        raise SystemExit("V203 already present.")

    start = text.find("function mergedCandidates() {")
    if start < 0:
        raise SystemExit("V203: mergedCandidates() missing.")

    m = re.search(r"\nfunction\s+[A-Za-z0-9_$]+\s*\(", text[start+1:])
    if not m:
        raise SystemExit("V203: mergedCandidates() boundary missing.")
    end = start + 1 + m.start()

    region = text[start:end]
    if "byMint" not in region:
        raise SystemExit("V203: mergedCandidates() has no byMint authority.")

    pinned = re.search(r"\n(\s*)const\s+pinned\s*=\s*\[\s*\]\s*;", region)
    if not pinned:
        raise SystemExit("V203: OPEN-position pinning anchor missing.")

    # Helper sits immediately before mergedCandidates().
    text = text[:start] + HELPER + text[start:]
    start += len(HELPER)
    end += len(HELPER)
    region = text[start:end]

    pinned = re.search(r"\n(\s*)const\s+pinned\s*=\s*\[\s*\]\s*;", region)
    insert_at = start + pinned.start()
    text = text[:insert_at] + "\n" + GATE + text[insert_at:]

    path.write_text(text, encoding="utf-8")
    print("patched trading.js: Candidates now obey Entry Filters")

elif mode == "html":
    pattern = re.compile(
        r'(<script\b[^>]*\bsrc=(["\'])/trading\.js)(?:\?v=[^"\']*)?(\2[^>]*>\s*</script>)',
        flags=re.I
    )
    text2, n = pattern.subn(
        lambda m: f'{m.group(1)}?v={CACHE}{m.group(3)}',
        text,
        count=1
    )
    if n != 1:
        raise SystemExit(f"V203: trading.js cache-bust tag count={n}")
    path.write_text(text2, encoding="utf-8")
    print("patched trading.html: Safari cache-bust updated")
else:
    raise SystemExit("unknown transform mode")
PY

# Create patched clean-baseline copies for the index/commit.
cp "$TMP/base-trading.js" "$TMP/patched-trading.js"
cp "$TMP/base-trading.html" "$TMP/patched-trading.html"
python3 "$TMP/transform.py" trading "$TMP/patched-trading.js"
python3 "$TMP/transform.py" html "$TMP/patched-trading.html"

# Layer the exact same small patch onto the current worktree, preserving
# unrelated local edits outside the preflighted regions.
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
  /MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V203/
);

const helperStart=source.indexOf(
  'function __mfCandidatePassesEntryFiltersV203(candidate) {'
);
const mergeStart=source.indexOf(
  'function mergedCandidates() {',
  helperStart
);

assert.ok(helperStart>=0,'V203 helper missing');
assert.ok(mergeStart>helperStart,'mergedCandidates missing after V203 helper');

const helperCode=source.slice(helperStart,mergeStart);
const context={result:null};
vm.createContext(context);
vm.runInContext(
  `${helperCode}
   result=[
     __mfCandidatePassesEntryFiltersV203({
       mint:'Admitted',entryAdmissionState:'ADMITTED',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV203({
       mint:'Pending',entryAdmissionState:'PENDING',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV203({
       mint:'Rejected',entryAdmissionState:'REJECTED',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV203({
       mint:'LegacyStrict'
     }),
     __mfCandidatePassesEntryFiltersV203({
       mint:'LegacyPipeline',__pipelineWatch:true
     })
   ];`,
  context
);

assert.deepEqual(
  Array.from(context.result),
  [true,false,false,true,false]
);

const rest=source.slice(mergeStart+1);
const next=rest.match(/\nfunction\s+[A-Za-z0-9_$]+\s*\(/);
assert.ok(next,'mergedCandidates next-function boundary missing');
const mergeEnd=mergeStart+1+next.index;
const merge=source.slice(mergeStart,mergeEnd);

const gateAt=merge.indexOf(
  '__mfCandidatePassesEntryFiltersV203(candidate)'
);
const pinnedAt=merge.search(
  /const\s+pinned\s*=\s*\[\s*\]\s*;/
);

assert.ok(gateAt>=0,'Candidates Entry gate is not inside mergedCandidates');
assert.ok(pinnedAt>gateAt,'Entry gate must execute before OPEN-position pinning');
assert.match(merge,/byMint\.delete\(mint\)/);
assert.match(merge,/state\.positions/);

console.log('terminal candidates entry-filter gate v203 ok');
TESTJS

# Test against current worktree (including any unrelated local edits).
echo "==> Syntax"
node --check "$TRADING"
node --check "$TEST"

echo "==> Targeted V203 regression"
(
  cd memeflow-app
  node tests/terminal-candidates-entry-filter-v203.mjs
)

echo "==> Cache-bust verification"
grep -Fq "/trading.js?v=$CACHE_VERSION" "$HTML"

# Stage ONLY the clean HEAD+V203 versions, not unrelated unstaged work.
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
  echo "ERROR: expected exactly 3 staged V203 files."
  printf '  %s\n' "${STAGED[@]}"
  exit 1
fi

for required in "$TRADING" "$HTML" "$TEST"; do
  printf '%s\n' "${STAGED[@]}" | grep -Fxq "$required" || {
    echo "ERROR: staged V203 file missing: $required"
    exit 1
  }
done

git diff --cached --check

echo "==> Staged diff"
git --no-pager diff --cached --stat
git --no-pager diff --cached -- "$TRADING" "$HTML" "$TEST"

# Full suite is intentionally run before commit. If another local edit has
# already broken tests, V203 is restored and nothing is committed.
echo "==> Full npm test"
(
  cd memeflow-app
  npm test
)

echo "==> Commit"
git commit -m "fix: apply Entry Filters to Terminal Candidates"
PATCH_COMMIT="$(git rev-parse HEAD)"
COMMITTED=1

echo "==> Push"
git push origin "HEAD:$BRANCH"

trap - ERR INT TERM
rm -rf "$TMP"

echo
echo "============================================================"
echo "SUCCESS — MEMEFLOW CANDIDATES ENTRY FILTER V203"
echo "============================================================"
echo "Candidates now shows only tokens admitted by the SAME Entry Filters"
echo "used by trading."
echo
echo "Preserved:"
echo "  scanner still scans everything"
echo "  BUY READY / WATCH / WAITING / BLOCKED remain post-entry states"
echo "  OPEN positions remain visible/manageable"
echo "  trading execution gate is unchanged"
echo "  unrelated local work remains unstaged"
echo
echo "Commit: $PATCH_COMMIT"
echo "Branch: $BRANCH"
echo "Server restart: NOT performed"
echo "============================================================"
