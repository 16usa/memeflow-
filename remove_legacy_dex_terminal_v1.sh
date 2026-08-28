#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
JS="$ROOT/memeflow-app/trading.js"
HTML="$ROOT/memeflow-app/trading.html"

if [[ ! -f "$JS" || ! -f "$HTML" ]]; then
  echo "ERROR: run this from the MEMEFLOW repository root (expected memeflow-app/trading.js and trading.html)."
  exit 1
fi

python3 - "$JS" "$HTML" <<'PY'
from pathlib import Path
import re
import sys

js_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])

js = js_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")
original_js = js
original_html = html

# 1) Remove the legacy persisted DEX-pool filter helper completely.
js, n = re.subn(
    r"""const DEX_POOL_FILTER_KEY = 'memeflow:dex-pool-filter';\n\nfunction dexPoolFilterEnabled\(\) \{\n  try \{\n    return localStorage\.getItem\(DEX_POOL_FILTER_KEY\) === '1';\n  \} catch \{\n    return false;\n  \}\n\}\n\n""",
    "",
    js,
    count=1,
)
if n != 1:
    raise SystemExit("ERROR: legacy DEX helper block not found exactly once; refusing a blind patch.")

# 2) Candidate count must never prepend DEX.
old = """function updateCandidateCount() {
  const dexOnly = dexPoolFilterEnabled();
  $('candidateCount').textContent =
    `${dexOnly ? 'DEX · ' : ''}${mergedCandidates().length} candidates`;
}"""
new = """function updateCandidateCount() {
  $('candidateCount').textContent =
    `${mergedCandidates().length} candidates`;
}"""
if old not in js:
    raise SystemExit("ERROR: updateCandidateCount legacy DEX block not found.")
js = js.replace(old, new, 1)

# 3) Candidate API must use the normal feed only; remove &dexPool=1 and the second DEX-prefixed count.
old = """async function loadCandidates({ redrawChart = true } = {}) {
  const dexOnly = dexPoolFilterEnabled();
  const payload =
    await api(
      `/api/ai/decisions?scope=all&limit=100${dexOnly ? '&dexPool=1' : ''}`
    );

  state.candidates =
    Array.isArray(payload.decisions)
      ? payload.decisions
      : [];

  $('candidateCount').textContent =
    `${dexOnly ? 'DEX · ' : ''}${mergedCandidates().length} candidates`;"""
new = """async function loadCandidates({ redrawChart = true } = {}) {
  const payload =
    await api('/api/ai/decisions?scope=all&limit=100');

  state.candidates =
    Array.isArray(payload.decisions)
      ? payload.decisions
      : [];

  $('candidateCount').textContent =
    `${mergedCandidates().length} candidates`;"""
if old not in js:
    raise SystemExit("ERROR: loadCandidates legacy DEX block not found.")
js = js.replace(old, new, 1)

# 4) Force Safari/Replit to request the new trading.js instead of a cached copy.
html, n = re.subn(
    r'(<script type="module" src="/trading\.js\?v=)([^"]+)("></script>)',
    r'\1no-dex-terminal-v1-20260826\3',
    html,
    count=1,
)
if n != 1:
    raise SystemExit("ERROR: trading.js script tag not found for cache-bust.")

# Safety verification: none of the legacy terminal DEX hooks may remain in trading.js.
for needle in (
    "DEX_POOL_FILTER_KEY",
    "dexPoolFilterEnabled",
    "dexPool=1",
    "DEX · ",
    "memeflow:dex-pool-filter",
):
    if needle in js:
        raise SystemExit(f"ERROR: legacy DEX token still remains in trading.js: {needle}")

if js == original_js and html == original_html:
    print("No changes needed.")
    raise SystemExit(0)

js_path.write_text(js, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
print("Patched:", js_path)
print("Patched:", html_path)
PY

node --check "$JS"
git -C "$ROOT" diff --check -- memeflow-app/trading.js memeflow-app/trading.html

echo
echo "Verification:"
grep -nE 'DEX_POOL_FILTER_KEY|dexPoolFilterEnabled|dexPool=1|DEX · |memeflow:dex-pool-filter' "$JS" && {
  echo "ERROR: DEX residue still found."
  exit 1
} || true
grep -n 'no-dex-terminal-v1-20260826' "$HTML"

if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" add memeflow-app/trading.js memeflow-app/trading.html
  if ! git -C "$ROOT" diff --cached --quiet; then
    git -C "$ROOT" commit -m "fix(trading): remove legacy DEX candidate filter"
    git -C "$ROOT" push origin HEAD
    echo "Committed and pushed."
  else
    echo "Nothing new to commit."
  fi
fi

echo
echo "DONE: Trading Terminal now shows only '<count> candidates' and no longer requests the legacy dexPool filter."
