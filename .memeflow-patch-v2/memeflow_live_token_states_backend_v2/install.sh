#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW: LIVE TOKEN STATES BACKEND FIX v2 ==="

if [ -f "memeflow-app/app-server.mjs" ]; then
  TARGET="memeflow-app/app-server.mjs"
elif [ -f "app-server.mjs" ]; then
  TARGET="app-server.mjs"
else
  echo "ERROR: app-server.mjs not found. Run this from the project root."
  exit 20
fi

python3 - "$TARGET" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
text = p.read_text(encoding="utf-8")

route = "url.pathname === '/api/ai/decisions'"
old = "const _scopeRaw = String(url.searchParams.get('scope') || 'candidates').toLowerCase();"
new = "const _scopeRaw = String(url.searchParams.get('scope') || 'all').toLowerCase();"

if route not in text:
    print("ERROR: /api/ai/decisions route not found.", file=sys.stderr)
    sys.exit(21)

if new in text:
    print(f"Already patched: {p}")
    sys.exit(0)

count = text.count(old)
if count != 1:
    print(f"ERROR: expected exactly one default-scope line, found {count}.", file=sys.stderr)
    sys.exit(22)

text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8")
print(f"Patched: {p}")
PY

echo
echo "=== VERIFY ==="
grep -nE "url.pathname === '/api/ai/decisions'|_scopeRaw = String\\(url.searchParams.get\\('scope'\\)" "$TARGET" | head -20 || true

echo
echo "=== SYNTAX CHECK ==="
node --check "$TARGET"

echo
echo "=== GIT DIFF CHECK ==="
git diff --check
git diff -- "$TARGET"

git add "$TARGET"

if git diff --cached --quiet -- "$TARGET"; then
  echo "Already patched — no new commit needed."
else
  git commit -m "fix: expose all token states in decisions API"
  if git push; then
    echo "Git push: OK"
  else
    echo "WARNING: patch was committed locally, but git push failed."
    echo "Run: git push"
    exit 30
  fi
fi

echo
echo "=========================================="
echo "FIX COMPLETE"
echo "GET /api/ai/decisions now defaults to scope=all"
echo "Explicit ?scope=candidates still works."
echo "Trading decision logic was not changed."
echo "=========================================="
