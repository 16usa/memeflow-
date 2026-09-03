#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"
INDEX="memeflow-app/index.html"
ORACLE="memeflow-app/src/sol-usd-oracle.mjs"
SOURCE="memeflow-app/src/discovery-source.mjs"
DEX_FEED="memeflow-app/src/dex-discovery-feed.mjs"
DEX_GATE="memeflow-app/src/dex-verification-gate.mjs"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-remove-dex-runtime-v8-$STAMP"
mkdir -p "$BACKUP"

for f in "$APP" "$UI" "$INDEX" "$ORACLE" "$SOURCE" "$DEX_FEED" "$DEX_GATE"; do
  [ -f "$f" ] && cp "$f" "$BACKUP/$(echo "$f" | tr '/' '_')"
done

echo "=== V8 preflight ==="

# V7 may already be present locally from the previous run that stopped at verification.
if ! grep -q "MEMEFLOW_MANUAL_INDEXED_DATA_PLANE_V7" "$APP"; then
  echo "ERROR: V7 indexed-data changes are not present locally."
  echo "Do not continue; no files were deleted."
  exit 1
fi

# Before deleting the old modules, make sure no active runtime file imports/calls them.
REFS="$(
  grep -RniI \
    --include='*.mjs' \
    --include='*.js' \
    --include='*.html' \
    --exclude='dex-discovery-feed.mjs' \
    --exclude='dex-verification-gate.mjs' \
    --exclude='*.test.mjs' \
    --exclude='*.before-*' \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=.backups \
    --exclude-dir=.patch-backups \
    --exclude-dir=data \
    -E 'dex-discovery-feed|dex-verification-gate|startDexDiscoveryFeed|startDexVerification|DexVerification' \
    memeflow-app/app-server.mjs \
    memeflow-app/live-bootstrap.mjs \
    memeflow-app/system-tokens.js \
    memeflow-app/index.html \
    memeflow-app/src 2>/dev/null || true
)"

if [ -n "$REFS" ]; then
  echo "ERROR: active runtime references to old Dex modules still exist:"
  echo "$REFS"
  echo "Nothing deleted."
  exit 1
fi

echo "OK: no active runtime imports/calls of the old Dex modules."

python3 - <<'PY'
from pathlib import Path

# Pump-only discovery-source controller. Keep the public controller API so any
# caller remains compatible, but there are no dex/hybrid modes anymore.
p = Path("memeflow-app/src/discovery-source.mjs")
p.write_text("""import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_PUMP_ONLY_DISCOVERY_SOURCE_V8
// Discovery is Pump-only. DexScreener/Dex discovery modes were removed.
export class DiscoverySourceController {
  constructor({dataDir}={}) {
    if (!dataDir) throw new Error('DiscoverySourceController requires dataDir');
    this.file = path.join(dataDir, 'discovery-source.json');
    this.state = {mode:'pump',updatedAt:Date.now(),version:2};
    this.load();
  }

  load() {
    // Legacy files may contain an old mode. Ignore it and normalize to Pump.
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.state = {
        mode:'pump',
        updatedAt:Number(raw?.updatedAt)||Date.now(),
        version:2
      };
    } catch {
      this.state = {mode:'pump',updatedAt:Date.now(),version:2};
    }
    this.persist();
  }

  persist() {
    fs.mkdirSync(path.dirname(this.file), {recursive:true});
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  get mode() {
    return 'pump';
  }

  allows(source) {
    return String(source || '').trim().toLowerCase() === 'pump';
  }

  set(mode) {
    const requested = String(mode || '').trim().toLowerCase();
    if (requested !== 'pump') {
      const e = new Error('Only pump discovery is supported');
      e.code = 'INVALID_DISCOVERY_SOURCE';
      throw e;
    }
    this.state = {mode:'pump',updatedAt:Date.now(),version:2};
    this.persist();
    return this.snapshot();
  }

  snapshot() {
    return {
      mode:'pump',
      available:['pump'],
      pumpEnabled:true,
      strategy:'pump-native-live-index',
      updatedAt:this.state.updatedAt,
      version:this.state.version
    };
  }
}
""")

# Remove obsolete active Dex modules completely.
for target in [
    Path("memeflow-app/src/dex-discovery-feed.mjs"),
    Path("memeflow-app/src/dex-verification-gate.mjs")
]:
    if target.exists():
        target.unlink()

# Normalize the committed discovery state if present.
state = Path("memeflow-app/data/discovery-source.json")
if state.exists():
    state.write_text('{\n  "mode": "pump",\n  "version": 2\n}\n')
PY

node --check "$APP"
node --check "$UI"
node --check "$ORACLE"
node --check "$SOURCE"

echo
echo "=== V8 active-source verification ==="

# Build the exact active-file set. Historical *.before-* and tests are not runtime.
ACTIVE_TMP="$(mktemp)"
{
  printf '%s\n' \
    "$APP" \
    "$UI" \
    "$INDEX" \
    "$ORACLE" \
    "$SOURCE" \
    "memeflow-app/live-bootstrap.mjs"
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
  echo "ERROR: DexScreener/Dex runtime references still remain. Nothing committed."
  exit 1
fi

if [ -e "$DEX_FEED" ] || [ -e "$DEX_GATE" ]; then
  echo "ERROR: obsolete Dex module files still exist."
  exit 1
fi

echo "OK: DexScreener dependency removed from active runtime."
echo "OK: obsolete Dex discovery/verification modules removed."
echo "OK: discovery source is Pump-only."

echo
echo "=== Diff summary ==="
git diff --stat -- \
  "$APP" \
  "$UI" \
  "$ORACLE" \
  "$SOURCE" \
  "$DEX_FEED" \
  "$DEX_GATE" \
  memeflow-app/data/discovery-source.json

git add -A -- \
  "$APP" \
  "$UI" \
  "$ORACLE" \
  "$SOURCE" \
  "$DEX_FEED" \
  "$DEX_GATE" \
  memeflow-app/data/discovery-source.json

git commit -m "fix: pump-only indexed data plane and remove DexScreener runtime"
git push origin HEAD

echo
echo "DONE"
echo "Backup: $BACKUP"
echo "Commit:"
git log -1 --oneline
