#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW: FIX LIVE TOKEN STATES ==="

ROOT="memeflow-app"
[ -d "$ROOT" ] || ROOT="."

PATCHED_FILE="$(
python3 - <<'PY'
from pathlib import Path
import sys

root = Path("memeflow-app") if Path("memeflow-app").is_dir() else Path(".")
SKIP = {".git", "node_modules", "dist", "build", ".next", "coverage", ".cache"}
EXTS = {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".html", ".htm"}
endpoint = "/api/ai/decisions"
files = []

for p in root.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in EXTS:
        continue
    if any(part in SKIP for part in p.parts):
        continue
    try:
        text = p.read_text(encoding="utf-8")
    except Exception:
        continue
    if endpoint in text and "view=items" in text:
        files.append((p, text))

preferred = []
for p, text in files:
    low = text.lower()
    if "live token states" in low or "search mint" in low or "real-time pipeline" in low:
        preferred.append((p, text))

targets = preferred if preferred else files

if len(targets) != 1:
    print(f"ERROR: expected exactly 1 Live Token States request file, found {len(targets)}", file=sys.stderr)
    for p, _ in targets:
        print(f"  candidate: {p}", file=sys.stderr)
    if not targets and files:
        print("Endpoint candidates:", file=sys.stderr)
        for p, _ in files:
            print(f"  {p}", file=sys.stderr)
    sys.exit(20)

p, text = targets[0]
lines = text.splitlines(keepends=True)
changed = 0
out = []

for line in lines:
    if endpoint in line and "view=items" in line:
        original = line
        if "scope=candidates" in line:
            line = line.replace("scope=candidates", "scope=all")
        elif "scope=all" not in line:
            line = line.replace("view=items", "view=items&scope=all", 1)
        if line != original:
            changed += 1
    out.append(line)

if changed == 0:
    if any(endpoint in line and "view=items" in line and "scope=all" in line for line in lines):
        print(str(p))
        sys.exit(0)
    print("ERROR: API call found, but patch could not safely modify it.", file=sys.stderr)
    sys.exit(21)

if changed != 1:
    print(f"ERROR: would modify {changed} calls; refusing unsafe bulk patch.", file=sys.stderr)
    sys.exit(22)

p.write_text("".join(out), encoding="utf-8")
print(str(p))
PY
)"

echo
echo "Patched file: $PATCHED_FILE"
echo

echo "=== VERIFY REQUEST ==="
grep -nE '/api/ai/decisions.*view=items' "$PATCHED_FILE" || true

echo
echo "=== GIT DIFF CHECK ==="
git diff --check
git diff -- "$PATCHED_FILE"

echo
echo "=== COMMIT + PUSH ==="
git add "$PATCHED_FILE"

if git diff --cached --quiet -- "$PATCHED_FILE"; then
  echo "Already patched — no new commit needed."
else
  git commit -m "fix: show all states in Live Token States"
  git push
fi

echo
echo "=========================================="
echo "FIX COMPLETE"
echo "Live Token States now requests:"
echo "/api/ai/decisions?view=items&scope=all"
echo "=========================================="
