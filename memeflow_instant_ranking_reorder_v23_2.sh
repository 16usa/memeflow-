#!/usr/bin/env bash
set -euo pipefail

PATCH_NAME="MEMEFLOW V23.2 instant ranking recovery"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "==> ${PATCH_NAME}"

if [[ -f "system-tokens.js" && -f "package.json" ]]; then
  APP_DIR="$PWD"
elif [[ -f "memeflow-app/system-tokens.js" && -f "memeflow-app/package.json" ]]; then
  APP_DIR="$PWD/memeflow-app"
else
  echo "ERROR: MEMEFLOW app directory was not found."
  echo "Run this script from the Replit project root or memeflow-app."
  exit 1
fi

cd "$APP_DIR"
echo "==> App: $APP_DIR"

for file in system-tokens.js system-tokens.html package.json tests/per-mint-card-refresh-v18.mjs; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: missing required file: $file"
    exit 1
  fi
done

BACKUP_DIR=".patch-backups/v23-2-$STAMP"
mkdir -p "$BACKUP_DIR"

for file in \
  system-tokens.js \
  system-tokens.html \
  package.json \
  tests/per-mint-card-refresh-v18.mjs \
  tests/live-ranking-reorder-v23.mjs
do
  if [[ -f "$file" ]]; then
    cp -p "$file" "$BACKUP_DIR/$(basename "$file")"
  fi
done

python3 <<'PY'
from pathlib import Path
import json
import re

ui_path = Path("system-tokens.js")
html_path = Path("system-tokens.html")
package_path = Path("package.json")
legacy_test_path = Path("tests/per-mint-card-refresh-v18.mjs")
rank_test_path = Path("tests/live-ranking-reorder-v23.mjs")

ui = ui_path.read_text(encoding="utf-8")

# Keep WATCH and WAITING in the same visual ranking lane.
if not re.search(r"watch:\s*2,\s*waiting:\s*2,", ui, re.S):
    changed = False

    for old in (
        "watch: 2,\n    waiting: 3,\n    blocked: 4",
        "watch:2,\n    waiting:3,\n    blocked:4",
    ):
        if old in ui:
            ui = ui.replace(
                old,
                old.replace("waiting: 3", "waiting: 2").replace("waiting:3", "waiting:2"),
                1
            )
            changed = True
            break

    if not changed:
        raise SystemExit(
            "ERROR: WATCH/WAITING priority block was not found in a supported shape."
        )

# Reorder regular cards immediately after each 1-second mutable batch merge.
if "MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23" not in ui:
    start = ui.find("async function loadTokens(){")
    end = ui.find("\ndocument\n  .querySelectorAll(", start)

    if start < 0 or end < 0:
        raise SystemExit("ERROR: loadTokens() block was not found.")

    block = ui[start:end]

    anchor = """    for(
      const card of document.querySelectorAll(
        '.flow-token[data-mint]'
      )
    ){
"""

    addition = """    // MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23
    // The latest mutable snapshot is already merged into state.rows.
    // Recompute ranking now and move existing keyed DOM cards in the same tick.
    __mfReconcileVisibleCardsV183();

"""

    if anchor not in block:
        raise SystemExit(
            "ERROR: mutable card patch loop was not found inside loadTokens()."
        )

    block = block.replace(anchor, addition + anchor, 1)
    ui = ui[:start] + block + ui[end:]

# Reorder OPEN POSITION cards immediately when live P&L changes.
if "MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23" not in ui:
    start = ui.find("async function __mfRefreshOpenPositionsV16({")
    end = ui.find("// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18", start)

    if start < 0 or end < 0:
        raise SystemExit("ERROR: open position refresh block was not found.")

    block = ui[start:end]

    old = """    if(membershipChanged){
      __mfReconcileVisibleCardsV183();
    }

    if(patchDom){
"""

    new = """    // MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23
    // Fresh P&L is ranking data, so move OPEN POSITION cards immediately.
    __mfReconcileVisibleCardsV183();

    if(patchDom){
"""

    if old not in block:
        raise SystemExit(
            "ERROR: membership-only OPEN POSITION reconcile block was not found."
        )

    block = block.replace(old, new, 1)
    ui = ui[:start] + block + ui[end:]

ui_path.write_text(ui, encoding="utf-8")

# Force the browser to request the new module.
html = html_path.read_text(encoding="utf-8")
target_version = "instant-rank-v23-20260827"

if target_version not in html:
    html, count = re.subn(
        r'src="/system-tokens\.js\?v=[^"]+"',
        f'src="/system-tokens.js?v={target_version}"',
        html,
        count=1,
    )

    if count != 1:
        raise SystemExit(
            "ERROR: system-tokens.js module reference was not found in system-tokens.html."
        )

    html_path.write_text(html, encoding="utf-8")

# Repair the exact stale regression assertion that stopped V23/V23.1.
# Use a plain version substring replacement so JS regex escaping cannot break matching.
legacy = legacy_test_path.read_text(encoding="utf-8")
old_version = "single-clock-v19-20260827"
new_version = "instant-rank-v23-20260827"

if old_version in legacy:
    legacy = legacy.replace(old_version, new_version)

if new_version not in legacy:
    raise SystemExit(
        "ERROR: system-tokens cache version assertion was not found in per-mint regression test."
    )

legacy_test_path.write_text(legacy, encoding="utf-8")

# Add or replace the focused V23 ranking regression.
rank_test_path.write_text(
r"""import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

const html=fs.readFileSync(
  new URL('../system-tokens.html',import.meta.url),
  'utf8'
);

assert.match(
  ui,
  /watch:\s*2,\s*waiting:\s*2,/s,
  'WATCH and WAITING must share one visual ranking lane'
);

const loadStart=ui.indexOf('async function loadTokens(){');
const loadEnd=ui.indexOf(
  "\ndocument\n  .querySelectorAll(",
  loadStart
);

assert.ok(loadStart>=0&&loadEnd>loadStart,'loadTokens() block missing');

const loadBlock=ui.slice(loadStart,loadEnd);

assert.match(
  loadBlock,
  /MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/,
  'instant score reorder marker missing'
);

const stateMergeAt=loadBlock.indexOf('state.rows=');
const rankReconcileAt=loadBlock.indexOf(
  '__mfReconcileVisibleCardsV183();',
  stateMergeAt
);
const mutablePatchAt=loadBlock.indexOf(
  "const card of document.querySelectorAll(",
  stateMergeAt
);

assert.ok(stateMergeAt>=0,'mutable state merge missing');
assert.ok(
  rankReconcileAt>stateMergeAt,
  'ranking reconcile must happen after mutable state is merged'
);
assert.ok(
  mutablePatchAt>rankReconcileAt,
  'ranking reconcile must happen before the mutable DOM patch loop completes'
);

const openStart=ui.indexOf(
  'async function __mfRefreshOpenPositionsV16({'
);
const openEnd=ui.indexOf(
  '// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18',
  openStart
);

assert.ok(
  openStart>=0&&openEnd>openStart,
  'open position refresh block missing'
);

const openBlock=ui.slice(openStart,openEnd);

assert.match(
  openBlock,
  /MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23/,
  'instant OPEN POSITION reorder marker missing'
);

assert.doesNotMatch(
  openBlock,
  /if\s*\(\s*membershipChanged\s*\)\s*\{\s*__mfReconcileVisibleCardsV183\(\)/s,
  'OPEN POSITION ranking must not wait for membership changes'
);

assert.match(
  html,
  /system-tokens\.js\?v=instant-rank-v23-20260827/,
  'browser cache-bust version is stale'
);

console.log('live ranking reorder v23 ok');
""",
encoding="utf-8"
)

# Ensure the focused regression is part of the full suite.
package = json.loads(package_path.read_text(encoding="utf-8"))
scripts = package.setdefault("scripts", {})
test_command = "node tests/live-ranking-reorder-v23.mjs"
current = scripts.get("test", "")

if test_command not in current:
    scripts["test"] = (
        f"{test_command} && {current}"
        if current
        else test_command
    )

    package_path.write_text(
        json.dumps(package, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )

print("Runtime and regression recovery applied.")
PY

echo "==> Verify version references"
grep -n "instant-rank-v23-20260827" \
  system-tokens.html \
  tests/per-mint-card-refresh-v18.mjs \
  tests/live-ranking-reorder-v23.mjs

echo "==> Syntax checks"
node --check system-tokens.js
node --check tests/per-mint-card-refresh-v18.mjs
node --check tests/live-ranking-reorder-v23.mjs

echo "==> Focused regressions"
node tests/per-mint-card-refresh-v18.mjs
node tests/live-ranking-reorder-v23.mjs

echo "==> Full test suite"
npm test

echo "==> Git diff check"
git diff --check

echo "==> Git status"
git status --short

git add \
  system-tokens.js \
  system-tokens.html \
  package.json \
  tests/per-mint-card-refresh-v18.mjs \
  tests/live-ranking-reorder-v23.mjs

if git diff --cached --quiet; then
  echo "==> No new changes to commit."
else
  git commit -m "fix: reorder live cards immediately on score updates"
fi

echo "==> Push"
git push

echo
echo "============================================================"
echo "V23.2 DONE"
echo "- stale cache regression assertion repaired"
echo "- regular cards reorder in the same 1-second update cycle"
echo "- WATCH and WAITING remain one score-ranked lane"
echo "- OPEN POSITION cards reorder immediately when P&L changes"
echo "- full test suite passed before commit and push"
echo "============================================================"
