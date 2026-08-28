#!/usr/bin/env bash
set -euo pipefail

PATCH_NAME="MEMEFLOW V23.4 stale regression sweep"
STAMP="$(date +%Y%m%d-%H%M%S)"
OLD_VERSION="single-clock-v19-20260827"
NEW_VERSION="instant-rank-v23-20260827"

echo "==> ${PATCH_NAME}"

if [[ -f "system-tokens.js" && -f "package.json" ]]; then
  APP_DIR="$PWD"
elif [[ -f "memeflow-app/system-tokens.js" && -f "memeflow-app/package.json" ]]; then
  APP_DIR="$PWD/memeflow-app"
else
  echo "ERROR: MEMEFLOW app directory was not found."
  exit 1
fi

cd "$APP_DIR"
echo "==> App: $APP_DIR"

BACKUP_DIR=".patch-backups/v23-4-$STAMP"
mkdir -p "$BACKUP_DIR"

python3 <<'PY'
from pathlib import Path
import json
import re
import shutil
import os

OLD_VERSION = "single-clock-v19-20260827"
NEW_VERSION = "instant-rank-v23-20260827"

root = Path(".")
backup = Path(os.environ.get("BACKUP_DIR", ".patch-backups/v23-4-manual"))
backup.mkdir(parents=True, exist_ok=True)

def backup_file(path: Path):
    dest = backup / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)

required = [
    Path("system-tokens.js"),
    Path("system-tokens.html"),
    Path("package.json"),
    Path("src/live-card-market.mjs"),
]
for path in required:
    if not path.exists():
        raise SystemExit(f"ERROR: missing required file: {path}")

# Back up all files that may be touched.
candidates = [
    Path("system-tokens.js"),
    Path("system-tokens.html"),
    Path("package.json"),
]
candidates += sorted(Path("tests").glob("*.mjs"))
candidates += sorted(Path("tests").glob("*.js"))

for path in candidates:
    if path.exists():
        backup_file(path)

# 1) Keep the browser cache-bust on V23.
html_path = Path("system-tokens.html")
html = html_path.read_text(encoding="utf-8")
html, count = re.subn(
    r'src="/system-tokens\.js\?v=[^"]+"',
    f'src="/system-tokens.js?v={NEW_VERSION}"',
    html,
    count=1,
)
if count != 1:
    raise SystemExit("ERROR: system-tokens.js module reference was not found.")
html_path.write_text(html, encoding="utf-8")

# 2) Sweep every regression file for the stale cache version.
# This is intentionally global because several historical tests can assert
# the same module URL independently.
changed_tests = []
for path in sorted(Path("tests").rglob("*")):
    if not path.is_file() or path.suffix not in {".mjs", ".js", ".cjs"}:
        continue

    text = path.read_text(encoding="utf-8")
    updated = text.replace(OLD_VERSION, NEW_VERSION)

    if updated != text:
        path.write_text(updated, encoding="utf-8")
        changed_tests.append(str(path))

# 3) Repair every old Pump-reference fixture that expects 12345 without a
# fresh pumpReferenceAt. Do not weaken runtime freshness rules.
fixture_files = []
for path in sorted(Path("tests").rglob("*")):
    if not path.is_file() or path.suffix not in {".mjs", ".js", ".cjs"}:
        continue

    text = path.read_text(encoding="utf-8")
    if "pumpReportedMarketCapUsd:12345" not in text:
        continue

    updated = text
    pattern = re.compile(
        r"(pumpReportedMarketCapUsd\s*:\s*12345)(\s*)(?!,\s*pumpReferenceAt)"
    )

    # Add a fresh timestamp only when the local fixture block does not already
    # contain pumpReferenceAt.
    start = 0
    pieces = []
    changed = False

    while True:
        idx = updated.find("pumpReportedMarketCapUsd:12345", start)
        if idx < 0:
            break

        block_start = updated.rfind("token:{", 0, idx)
        block_end = updated.find("}", idx)
        if block_start < 0 or block_end < 0:
            start = idx + 1
            continue

        block = updated[block_start:block_end]
        if "pumpReferenceAt:" not in block:
            updated = (
                updated[:idx]
                + "pumpReportedMarketCapUsd:12345,\n    pumpReferenceAt:999_500"
                + updated[idx + len("pumpReportedMarketCapUsd:12345"):]
            )
            changed = True
            start = idx + len("pumpReportedMarketCapUsd:12345,\n    pumpReferenceAt:999_500")
        else:
            start = idx + 1

    if changed:
        path.write_text(updated, encoding="utf-8")
        fixture_files.append(str(path))

# 4) Confirm the actual V23 runtime fix is present. If a previous recovery
# stopped before finishing, install it now.
ui_path = Path("system-tokens.js")
ui = ui_path.read_text(encoding="utf-8")

if not re.search(r"watch:\s*2,\s*waiting:\s*2,", ui, re.S):
    ui2, n = re.subn(
        r"(watch:\s*2,\s*waiting:\s*)3(\s*,\s*blocked:\s*4)",
        r"\g<1>2\g<2>",
        ui,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise SystemExit("ERROR: WATCH/WAITING priority block could not be repaired.")
    ui = ui2

if "MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23" not in ui:
    start = ui.find("async function loadTokens(){")
    end = ui.find("\ndocument\n  .querySelectorAll(", start)
    if start < 0 or end < 0:
        raise SystemExit("ERROR: loadTokens() was not found.")

    block = ui[start:end]
    anchor = """    for(
      const card of document.querySelectorAll(
        '.flow-token[data-mint]'
      )
    ){
"""
    addition = """    // MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23
    // Recompute ranking after the mutable snapshot merge and move keyed cards now.
    __mfReconcileVisibleCardsV183();

"""
    if anchor not in block:
        raise SystemExit("ERROR: mutable card loop anchor was not found.")
    block = block.replace(anchor, addition + anchor, 1)
    ui = ui[:start] + block + ui[end:]

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
    // Fresh P&L changes ranking, so move OPEN POSITION cards immediately.
    __mfReconcileVisibleCardsV183();

    if(patchDom){
"""
    if old not in block:
        raise SystemExit("ERROR: OPEN POSITION membership-only block was not found.")
    block = block.replace(old, new, 1)
    ui = ui[:start] + block + ui[end:]

ui_path.write_text(ui, encoding="utf-8")

# 5) Ensure the focused V23 regression exists.
rank_test = Path("tests/live-ranking-reorder-v23.mjs")
if not rank_test.exists():
    rank_test.write_text(
r"""import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

assert.match(ui,/watch:\s*2,\s*waiting:\s*2,/s);

const loadStart=ui.indexOf('async function loadTokens(){');
const loadEnd=ui.indexOf("\ndocument\n  .querySelectorAll(",loadStart);
assert.ok(loadStart>=0&&loadEnd>loadStart);
const load=ui.slice(loadStart,loadEnd);
assert.match(load,/MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/);

const stateAt=load.indexOf('state.rows=');
const reconcileAt=load.indexOf('__mfReconcileVisibleCardsV183();',stateAt);
assert.ok(stateAt>=0&&reconcileAt>stateAt);

const openStart=ui.indexOf('async function __mfRefreshOpenPositionsV16({');
const openEnd=ui.indexOf('// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18',openStart);
assert.ok(openStart>=0&&openEnd>openStart);
const open=ui.slice(openStart,openEnd);
assert.match(open,/MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23/);

assert.match(html,/system-tokens\.js\?v=instant-rank-v23-20260827/);

console.log('live ranking reorder v23 ok');
""",
        encoding="utf-8",
    )

# 6) Ensure npm test includes the focused ranking regression.
package_path = Path("package.json")
package = json.loads(package_path.read_text(encoding="utf-8"))
scripts = package.setdefault("scripts", {})
command = "node tests/live-ranking-reorder-v23.mjs"
current = scripts.get("test", "")
if command not in current:
    scripts["test"] = f"{command} && {current}" if current else command
    package_path.write_text(
        json.dumps(package, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

print("Changed stale-version tests:", changed_tests)
print("Changed Pump-reference fixtures:", fixture_files)
PY

echo "==> Confirm no stale cache version remains"
if grep -RIn --include='*.mjs' --include='*.js' --include='*.cjs' \
  "$OLD_VERSION" tests system-tokens.html; then
  echo "ERROR: stale cache version still exists."
  exit 1
else
  echo "No stale cache version remains."
fi

echo "==> Confirm new cache version"
grep -RIn --include='*.mjs' --include='*.js' --include='*.cjs' \
  "$NEW_VERSION" tests system-tokens.html || true

echo "==> Syntax checks"
node --check system-tokens.js
node --check tests/live-ranking-reorder-v23.mjs

for file in tests/*.mjs; do
  node --check "$file" >/dev/null
done

echo "==> Focused regressions"
if [[ -f "tests/per-mint-card-refresh-v18.mjs" ]]; then
  node tests/per-mint-card-refresh-v18.mjs
fi
node tests/live-ranking-reorder-v23.mjs
node tests/live-market-truth.mjs
node tests/open-position-live-mc-v20.mjs

echo "==> Full test suite"
npm test

echo "==> Git diff check"
git diff --check

echo "==> Git status"
git status --short

git add system-tokens.js system-tokens.html package.json tests

if git diff --cached --quiet; then
  echo "==> No new changes to commit."
else
  git commit -m "fix: complete instant ranking regression recovery"
fi

echo "==> Push"
git push

echo
echo "============================================================"
echo "V23.4 DONE"
echo "- all stale system-tokens cache assertions were swept"
echo "- stale Pump-reference fixtures were repaired"
echo "- instant score reorder is active"
echo "- OPEN POSITION instant reorder is active"
echo "- no stale cache version remains in tests"
echo "- full test suite passed before commit and push"
echo "============================================================"
