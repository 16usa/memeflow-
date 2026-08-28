#!/usr/bin/env bash
set -euo pipefail

PATCH_NAME="MEMEFLOW V23.1 instant ranking recovery"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "==> ${PATCH_NAME}"

if [[ -f "system-tokens.js" && -f "package.json" ]]; then
  APP_DIR="$PWD"
elif [[ -f "memeflow-app/system-tokens.js" && -f "memeflow-app/package.json" ]]; then
  APP_DIR="$PWD/memeflow-app"
else
  echo "ERROR: cannot find MEMEFLOW app."
  echo "Run from ~/workspace or from memeflow-app."
  exit 1
fi

cd "$APP_DIR"
echo "==> App: $APP_DIR"

mkdir -p ".patch-backups/v23-1-$STAMP"
for f in \
  system-tokens.js \
  system-tokens.html \
  package.json \
  tests/per-mint-card-refresh-v18.mjs \
  tests/live-ranking-reorder-v23.mjs
do
  [[ -f "$f" ]] && cp -p "$f" ".patch-backups/v23-1-$STAMP/$(basename "$f")"
done

python3 <<'PY'
from pathlib import Path
import json
import re

ui_path = Path("system-tokens.js")
html_path = Path("system-tokens.html")
pkg_path = Path("package.json")
legacy_test_path = Path("tests/per-mint-card-refresh-v18.mjs")
v23_test_path = Path("tests/live-ranking-reorder-v23.mjs")

ui = ui_path.read_text(encoding="utf-8")

# ----------------------------------------------------------------------
# A. Recover/apply the actual V23 runtime fix if the previous run stopped
#    before fully applying it.
# ----------------------------------------------------------------------

# WATCH + WAITING must remain the same visual lane (V22 prerequisite).
if not re.search(r"watch:\s*2,\s*waiting:\s*2,", ui, re.S):
    old = """    watch: 2,
    waiting: 3,
    blocked: 4"""
    new = """    watch: 2,
    waiting: 2,
    blocked: 4"""
    if old in ui:
        ui = ui.replace(old, new, 1)
    else:
        raise SystemExit(
            "ERROR: WATCH/WAITING priority block is not in expected V22/V23 shape."
        )

# Regular cards: move them immediately after the 1-second mutable batch
# has been merged into state.rows.
if "MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23" not in ui:
    load_start = ui.find("async function loadTokens(){")
    load_end = ui.find("\ndocument\n  .querySelectorAll(", load_start)
    if load_start < 0 or load_end < 0:
        raise SystemExit("ERROR: loadTokens() not found.")

    block = ui[load_start:load_end]
    anchor = """    for(
      const card of document.querySelectorAll(
        '.flow-token[data-mint]'
      )
    ){
"""
    addition = """    // MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23
    // The exact one-second mutable snapshot is already merged into state.rows.
    // Recompute ranking and MOVE keyed DOM cards immediately in this same tick.
    __mfReconcileVisibleCardsV183();

"""
    if anchor not in block:
        raise SystemExit("ERROR: loadTokens mutable DOM loop anchor not found.")
    block = block.replace(anchor, addition + anchor, 1)
    ui = ui[:load_start] + block + ui[load_end:]

# OPEN POSITION: P&L changes are also ranking changes; don't wait for
# membershipChanged.
if "MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23" not in ui:
    start = ui.find("async function __mfRefreshOpenPositionsV16({")
    end = ui.find("// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18", start)
    if start < 0 or end < 0:
        raise SystemExit("ERROR: OPEN POSITION refresh function not found.")

    block = ui[start:end]
    old = """    if(membershipChanged){
      __mfReconcileVisibleCardsV183();
    }

    if(patchDom){
"""
    new = """    // MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23
    // Fresh P&L is ranking data. Reconcile every successful live snapshot.
    __mfReconcileVisibleCardsV183();

    if(patchDom){
"""
    if old not in block:
        raise SystemExit(
            "ERROR: OPEN POSITION membership-only reconcile block not found."
        )
    block = block.replace(old, new, 1)
    ui = ui[:start] + block + ui[end:]

ui_path.write_text(ui, encoding="utf-8")

# ----------------------------------------------------------------------
# B. Cache bust. Previous V23 run already changed this in the screenshot,
#    but keep recovery idempotent.
# ----------------------------------------------------------------------
html = html_path.read_text(encoding="utf-8")
new_src = 'src="/system-tokens.js?v=instant-rank-v23-20260827"'

if new_src not in html:
    html, count = re.subn(
        r'src="/system-tokens\.js\?v=[^"]+"',
        new_src,
        html,
        count=1
    )
    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one system-tokens.js module reference, got {count}."
        )
    html_path.write_text(html, encoding="utf-8")

# ----------------------------------------------------------------------
# C. FIX THE FAILURE SHOWN ON SCREEN:
#    the old V18 regression hard-coded the OLD JS cache version.
#    The runtime is correct; the assertion was stale.
# ----------------------------------------------------------------------
if not legacy_test_path.exists():
    raise SystemExit("ERROR: tests/per-mint-card-refresh-v18.mjs not found.")

legacy = legacy_test_path.read_text(encoding="utf-8")

old_assert = r"/system-tokens\\.js\\?v=single-clock-v19-20260827/"
new_assert = r"/system-tokens\\.js\\?v=instant-rank-v23-20260827/"

if old_assert in legacy:
    legacy = legacy.replace(old_assert, new_assert)
elif new_assert not in legacy:
    # Handle a literal/format variation safely.
    legacy2, count = re.subn(
        r"/system-tokens\\\\\.js\\\\\?v=[^/]+/",
        new_assert,
        legacy,
        count=1
    )
    if count != 1:
        raise SystemExit(
            "ERROR: stale cache-bust assertion could not be located in per-mint test."
        )
    legacy = legacy2

legacy_test_path.write_text(legacy, encoding="utf-8")

# ----------------------------------------------------------------------
# D. Ensure the focused V23 regression exists even if the prior script
#    stopped before creating it.
# ----------------------------------------------------------------------
if not v23_test_path.exists():
    v23_test_path.write_text(r"""import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

assert.match(ui,/watch:\s*2,\s*waiting:\s*2,/s);

const loadStart=ui.indexOf('async function loadTokens(){');
const loadEnd=ui.indexOf("\ndocument\n  .querySelectorAll(",loadStart);
assert.ok(loadStart>=0&&loadEnd>loadStart);
const load=ui.slice(loadStart,loadEnd);
assert.match(load,/MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/);

const mergeAt=load.indexOf('state.rows=');
const reorderAt=load.indexOf('__mfReconcileVisibleCardsV183();',mergeAt);
const patchAt=load.indexOf("const card of document.querySelectorAll(",mergeAt);
assert.ok(mergeAt>=0);
assert.ok(reorderAt>mergeAt);
assert.ok(patchAt>reorderAt);

const openStart=ui.indexOf('async function __mfRefreshOpenPositionsV16({');
const openEnd=ui.indexOf('// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18',openStart);
assert.ok(openStart>=0&&openEnd>openStart);
const open=ui.slice(openStart,openEnd);
assert.match(open,/MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23/);
assert.doesNotMatch(
  open,
  /if\s*\(\s*membershipChanged\s*\)\s*\{\s*__mfReconcileVisibleCardsV183\(\)/s
);

assert.match(
  html,
  /system-tokens\.js\?v=instant-rank-v23-20260827/
);

console.log('live ranking reorder v23 ok');
""", encoding="utf-8")

# Ensure npm test includes both the V23 regression and the older per-mint test.
pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
scripts = pkg.setdefault("scripts", {})
test_cmd = "node tests/live-ranking-reorder-v23.mjs"
current = scripts.get("test", "")
if test_cmd not in current:
    scripts["test"] = f"{test_cmd} && {current}" if current else test_cmd
    pkg_path.write_text(
        json.dumps(pkg, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )

print("V23.1 runtime + stale regression assertion repaired.")
PY

echo "==> Verify cache-bust references"
grep -n "system-tokens.*instant-rank-v23-20260827" \
  system-tokens.html \
  tests/per-mint-card-refresh-v18.mjs || true

echo "==> Syntax checks"
node --check system-tokens.js
node --check tests/live-ranking-reorder-v23.mjs
node --check tests/per-mint-card-refresh-v18.mjs

echo "==> Focused tests"
node tests/live-ranking-reorder-v23.mjs
node tests/per-mint-card-refresh-v18.mjs

echo "==> Full test suite"
npm test

echo "==> Git diff check"
git diff --check

echo "==> Files changed"
git status --short

git add \
  system-tokens.js \
  system-tokens.html \
  package.json \
  tests/live-ranking-reorder-v23.mjs \
  tests/per-mint-card-refresh-v18.mjs

if git diff --cached --quiet; then
  echo "==> No new changes to commit."
else
  git commit -m "fix: reorder live cards immediately and update cache regression"
fi

echo "==> Push"
git push

echo
echo "=============================================================="
echo "V23.1 DONE"
echo "- fixed the stale test assertion shown in your screenshot"
echo "- Score changes reorder cards in the SAME 1-second tick"
echo "- WATCH + WAITING stay in one score-ranked lane"
echo "- OPEN POSITION P&L reorder is immediate"
echo "- old 10s structure timer is only fallback/membership sync"
echo "- npm test passed before commit/push"
echo "=============================================================="
