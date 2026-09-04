#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BAD_COMMIT="66e26e18"
BASE_COMMIT="ed73d638"

echo "=== MEMEFLOW V10 cleanup accidental V9 scope ==="

CURRENT="$(git rev-parse --short HEAD)"
if [ "$CURRENT" != "$BAD_COMMIT" ]; then
  echo "ERROR: expected HEAD $BAD_COMMIT but found $CURRENT"
  echo "Nothing changed."
  exit 1
fi

TMP="$(mktemp -d)"

# Preserve only the intended V7/V8 files from the current commit.
cp memeflow-app/app-server.mjs "$TMP/app-server.mjs"
cp memeflow-app/system-tokens.js "$TMP/system-tokens.js"
cp memeflow-app/src/sol-usd-oracle.mjs "$TMP/sol-usd-oracle.mjs"
cp memeflow-app/src/discovery-source.mjs "$TMP/discovery-source.mjs"
cp memeflow-app/data/discovery-source.json "$TMP/discovery-source.json"

# Restore the entire repository to the clean parent, which removes the
# accidental scripts/backups/sqlite/state/gallery/settings changes committed by
# the overly-broad "git add -A".
git restore --source="$BASE_COMMIT" --staged --worktree .

# Put back only the intended data-plane/runtime changes.
cp "$TMP/app-server.mjs" memeflow-app/app-server.mjs
cp "$TMP/system-tokens.js" memeflow-app/system-tokens.js
cp "$TMP/sol-usd-oracle.mjs" memeflow-app/src/sol-usd-oracle.mjs
cp "$TMP/discovery-source.mjs" memeflow-app/src/discovery-source.mjs
cp "$TMP/discovery-source.json" memeflow-app/data/discovery-source.json

# These two legacy active modules are intentionally removed.
rm -f memeflow-app/src/dex-discovery-feed.mjs
rm -f memeflow-app/src/dex-verification-gate.mjs

node --check memeflow-app/app-server.mjs
node --check memeflow-app/system-tokens.js
node --check memeflow-app/src/sol-usd-oracle.mjs
node --check memeflow-app/src/discovery-source.mjs

echo
echo "=== Expected diff only ==="
git diff --name-status "$BASE_COMMIT" -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/src/sol-usd-oracle.mjs \
  memeflow-app/src/discovery-source.mjs \
  memeflow-app/src/dex-discovery-feed.mjs \
  memeflow-app/src/dex-verification-gate.mjs \
  memeflow-app/data/discovery-source.json

echo
echo "=== Guard: no unrelated changes may remain ==="
ALLOWED='^(memeflow-app/app-server\.mjs|memeflow-app/system-tokens\.js|memeflow-app/src/sol-usd-oracle\.mjs|memeflow-app/src/discovery-source\.mjs|memeflow-app/src/dex-discovery-feed\.mjs|memeflow-app/src/dex-verification-gate\.mjs|memeflow-app/data/discovery-source\.json)$'

BAD="$(
  git diff --name-only "$BASE_COMMIT" | grep -Ev "$ALLOWED" || true
)"

if [ -n "$BAD" ]; then
  echo "ERROR: unrelated files are still changed:"
  echo "$BAD"
  echo "Nothing committed."
  exit 1
fi

echo "OK: only intended MEMEFLOW data-plane files remain."

git add \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/src/sol-usd-oracle.mjs \
  memeflow-app/src/discovery-source.mjs \
  memeflow-app/data/discovery-source.json

git add -u \
  memeflow-app/src/dex-discovery-feed.mjs \
  memeflow-app/src/dex-verification-gate.mjs

git commit -m "fix: clean V7/V8 data-plane scope after accidental broad commit"
git push origin HEAD

echo
echo "DONE"
git log -2 --oneline
