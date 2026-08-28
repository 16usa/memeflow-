#!/usr/bin/env bash
set -euo pipefail

PATCH_NAME="MEMEFLOW instant live ranking reorder V23"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "==> ${PATCH_NAME}"

# Locate the app whether the script is run from ~/workspace or memeflow-app.
if [[ -f "system-tokens.js" && -f "package.json" ]]; then
  APP_DIR="$PWD"
elif [[ -f "memeflow-app/system-tokens.js" && -f "memeflow-app/package.json" ]]; then
  APP_DIR="$PWD/memeflow-app"
else
  echo "ERROR: cannot find system-tokens.js/package.json."
  echo "Run this script from the Replit project root or memeflow-app directory."
  exit 1
fi

cd "$APP_DIR"
echo "==> App: $APP_DIR"

for f in system-tokens.js system-tokens.html package.json; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f"; exit 1; }
done

mkdir -p ".patch-backups/v23-$STAMP"
cp -p system-tokens.js system-tokens.html package.json ".patch-backups/v23-$STAMP/"

python3 <<'PY'
from pathlib import Path
import json
import re

ui_path = Path("system-tokens.js")
html_path = Path("system-tokens.html")
pkg_path = Path("package.json")
test_path = Path("tests/live-ranking-reorder-v23.mjs")

ui = ui_path.read_text(encoding="utf-8")
original_ui = ui

# ---------------------------------------------------------------------------
# 1) OPEN POSITION order: P&L changes must move cards on the same live tick.
# ---------------------------------------------------------------------------
open_start = ui.find("async function __mfRefreshOpenPositionsV16({")
open_end = ui.find("// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18", open_start)
if open_start < 0 or open_end < 0:
    raise SystemExit("ERROR: open-position refresh function was not found.")

open_block = ui[open_start:open_end]
if "MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23" not in open_block:
    old = """    if(membershipChanged){
      __mfReconcileVisibleCardsV183();
    }

    if(patchDom){
"""
    new = """    // MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23
    // OPEN POSITION P&L is mutable ranking data. Reconcile on EVERY successful
    // live position snapshot, not only when position membership changes.
    // Existing DOM nodes are moved; cards are not destroyed/recreated.
    __mfReconcileVisibleCardsV183();

    if(patchDom){
"""
    if old not in open_block:
        raise SystemExit(
            "ERROR: expected OPEN POSITION membership-only reconcile block was not found."
        )
    open_block = open_block.replace(old, new, 1)
    ui = ui[:open_start] + open_block + ui[open_end:]

# ---------------------------------------------------------------------------
# 2) Regular cards: when Score/market facts change on the 1-second mutable
#    batch, immediately recompute filteredRows()/sortRows() and MOVE the DOM
#    cards before the tick finishes. No 10-second structure wait.
# ---------------------------------------------------------------------------
load_start = ui.find("async function loadTokens(){")
load_end = ui.find("\ndocument\n  .querySelectorAll(", load_start)
if load_start < 0 or load_end < 0:
    raise SystemExit("ERROR: loadTokens() block was not found.")

load_block = ui[load_start:load_end]
if "MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23" not in load_block:
    needle = """    for(
      const card of document.querySelectorAll(
        '.flow-token[data-mint]'
      )
    ){
"""
    insertion = """    // MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23
    // state.rows now contains this exact 1-second batch's Score/market truth.
    // Re-sort + move existing keyed cards NOW, in this same tick. This is what
    // makes a card jump immediately when 80 -> 97 instead of waiting for the
    // 10-second structural membership fallback.
    __mfReconcileVisibleCardsV183();

"""
    if needle not in load_block:
        raise SystemExit(
            "ERROR: mutable-card patch loop anchor was not found inside loadTokens()."
        )
    load_block = load_block.replace(needle, insertion + needle, 1)
    ui = ui[:load_start] + load_block + ui[load_end:]

if ui == original_ui and "MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23" not in ui:
    raise SystemExit("ERROR: system-tokens.js was not patched.")

ui_path.write_text(ui, encoding="utf-8")
print("patched system-tokens.js: same-tick ranking reorder")

# ---------------------------------------------------------------------------
# 3) Cache-bust the browser module so iPhone/Replit does not keep old JS.
# ---------------------------------------------------------------------------
html = html_path.read_text(encoding="utf-8")
target = 'src="/system-tokens.js?v=instant-rank-v23-20260827"'
if target not in html:
    html2, count = re.subn(
        r'src="/system-tokens\.js\?v=[^"]+"',
        target,
        html,
        count=1,
    )
    if count != 1:
        raise SystemExit(
            f"ERROR: expected one system-tokens.js cache-bust reference, found {count}."
        )
    html_path.write_text(html2, encoding="utf-8")
    print("patched system-tokens.html: V23 cache bust")
else:
    print("system-tokens.html: V23 cache bust already present")

# ---------------------------------------------------------------------------
# 4) Regression test: prove same-tick score/P&L reordering stays wired.
# ---------------------------------------------------------------------------
test_path.parent.mkdir(parents=True, exist_ok=True)
test_path.write_text(r"""import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

assert.match(
  ui,
  /MEMEFLOW_WATCH_WAITING_SCORE_ORDER_V22/,
  'WATCH and WAITING must remain one score-ranked visual pool'
);

assert.match(
  ui,
  /watch:\s*2,\s*waiting:\s*2,/s,
  'WATCH and WAITING must have identical visual priority'
);

const loadStart=ui.indexOf('async function loadTokens(){');
const loadEnd=ui.indexOf(
  "\ndocument\n  .querySelectorAll(",
  loadStart
);
assert.ok(loadStart>=0&&loadEnd>loadStart,'loadTokens block missing');

const loadBlock=ui.slice(loadStart,loadEnd);
assert.match(
  loadBlock,
  /MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/,
  'same-tick Score reorder marker missing'
);

const stateMerge=loadBlock.indexOf('state.rows=');
const instantReorder=loadBlock.indexOf(
  '__mfReconcileVisibleCardsV183();',
  stateMerge
);
const mutablePatchLoop=loadBlock.indexOf(
  "const card of document.querySelectorAll(",
  stateMerge
);

assert.ok(stateMerge>=0,'state.rows mutable merge missing');
assert.ok(
  instantReorder>stateMerge,
  'ranking reconcile must happen after new mutable Score is merged'
);
assert.ok(
  mutablePatchLoop>instantReorder,
  'ranking reconcile must happen before the mutable DOM patch loop finishes'
);

const openStart=ui.indexOf(
  'async function __mfRefreshOpenPositionsV16({'
);
const openEnd=ui.indexOf(
  '// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18',
  openStart
);
assert.ok(openStart>=0&&openEnd>openStart,'open-position refresh block missing');

const openBlock=ui.slice(openStart,openEnd);
assert.match(
  openBlock,
  /MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23/,
  'same-tick OPEN POSITION ranking marker missing'
);

const positionsAssign=openBlock.indexOf('state.positions=');
const openReorder=openBlock.indexOf(
  '__mfReconcileVisibleCardsV183();',
  positionsAssign
);
assert.ok(
  openReorder>positionsAssign,
  'OPEN POSITION ranking must reconcile after fresh P&L snapshot'
);

assert.doesNotMatch(
  openBlock,
  /if\s*\(\s*membershipChanged\s*\)\s*\{\s*__mfReconcileVisibleCardsV183\(\)/s,
  'OPEN POSITION reorder must not wait for membership changes'
);

const reconcileStart=ui.indexOf(
  'function __mfReconcileVisibleCardsV183(){'
);
const reconcileEnd=ui.indexOf(
  '\n\nasync function loadDiscoveryStatus',
  reconcileStart
);
assert.ok(
  reconcileStart>=0&&reconcileEnd>reconcileStart,
  'keyed reconcile function missing'
);

const reconcileBlock=ui.slice(reconcileStart,reconcileEnd);
assert.match(
  reconcileBlock,
  /list\.append\(card\)/,
  'ranking refresh must MOVE existing keyed DOM nodes'
);

console.log('live ranking reorder v23 ok');
""", encoding="utf-8")
print("wrote tests/live-ranking-reorder-v23.mjs")

# Persist regression test in npm test.
pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
scripts = pkg.setdefault("scripts", {})
current = scripts.get("test", "")
test_cmd = "node tests/live-ranking-reorder-v23.mjs"
if test_cmd not in current:
    scripts["test"] = f"{test_cmd} && {current}" if current else test_cmd
    pkg_path.write_text(
        json.dumps(pkg, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )
    print("patched package.json: V23 regression added to npm test")
else:
    print("package.json: V23 regression already present")
PY

echo "==> Syntax check"
node --check system-tokens.js
node --check tests/live-ranking-reorder-v23.mjs

echo "==> Focused V23 regression"
node tests/live-ranking-reorder-v23.mjs

echo "==> Full test suite"
npm test

echo "==> Git diff check"
git diff --check

echo "==> Changes"
git diff -- system-tokens.js system-tokens.html package.json tests/live-ranking-reorder-v23.mjs

git add \
  system-tokens.js \
  system-tokens.html \
  package.json \
  tests/live-ranking-reorder-v23.mjs

if git diff --cached --quiet; then
  echo "==> No new changes to commit (V23 already applied)."
else
  git commit -m "fix: reorder live token cards immediately on score changes"
fi

echo "==> Push"
git push

echo
echo "============================================================"
echo "V23 DONE"
echo "- Score changes reorder cards in the SAME 1-second live tick"
echo "- WATCH + WAITING stay one Score-ranked pool"
echo "- OPEN POSITION P&L changes reorder open cards immediately"
echo "- Existing card nodes are moved, not recreated"
echo "- 10s structure refresh remains only a membership/fallback sync"
echo "- Browser module cache-busted for the new JS"
echo "- Full npm test passed before commit/push"
echo "============================================================"
