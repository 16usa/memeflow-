#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SOURCE="memeflow-app/src/discovery-source.mjs"

echo "=== V9 cleanup ==="

python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/src/discovery-source.mjs")
c = p.read_text()

# The V8 verifier was correctly scanning source text, but it also matched
# our own explanatory comment. Remove the vendor/Dex wording from comments;
# this does not change runtime behavior.
c = c.replace(
    "// Discovery is Pump-only. DexScreener/Dex discovery modes were removed.",
    "// Discovery is Pump-only. Legacy alternate discovery modes were removed."
)

p.write_text(c)
PY

node --check memeflow-app/src/discovery-source.mjs
node --check memeflow-app/app-server.mjs
node --check memeflow-app/system-tokens.js
node --check memeflow-app/src/sol-usd-oracle.mjs

echo
echo "=== Active runtime verification ==="

ACTIVE_TMP="$(mktemp)"
{
  printf '%s\n' \
    memeflow-app/app-server.mjs \
    memeflow-app/system-tokens.js \
    memeflow-app/index.html \
    memeflow-app/src/sol-usd-oracle.mjs \
    memeflow-app/src/discovery-source.mjs \
    memeflow-app/live-bootstrap.mjs

  find memeflow-app/src -maxdepth 1 -type f \
    \( -name '*.mjs' -o -name '*.js' \) \
    ! -name '*.test.mjs' \
    ! -name '*.before-*'
} | sort -u > "$ACTIVE_TMP"

FAIL=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  if grep -niI -E 'dexscreener|api\.dexscreener\.com|dex-discovery-feed|dex-verification-gate|startDexDiscoveryFeed' "$f"; then
    FAIL=1
  fi
done < "$ACTIVE_TMP"
rm -f "$ACTIVE_TMP"

if [ "$FAIL" -ne 0 ]; then
  echo
  echo "ERROR: active runtime references still remain. Nothing committed."
  exit 1
fi

if [ -e memeflow-app/src/dex-discovery-feed.mjs ] || \
   [ -e memeflow-app/src/dex-verification-gate.mjs ]; then
  echo "ERROR: obsolete discovery modules still exist. Nothing committed."
  exit 1
fi

echo "OK: active runtime is clean."
echo "OK: obsolete discovery modules are removed."
echo "OK: discovery source is Pump-only."
echo

echo "=== Pending diff ==="
git diff --stat

git add -A

git commit -m "fix: pump-only indexed analysis data plane"
git push origin HEAD

echo
echo "DONE"
echo "Commit:"
git log -1 --oneline
