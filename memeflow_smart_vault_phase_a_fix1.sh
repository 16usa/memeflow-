#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Smart Vault Phase A — FIX 1 =="
echo "Fixes only the bad Base58 string-length test. No deployment. No transaction."

if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "smart-vault" ]]; then
  :
else
  echo "ERROR: run from ~/workspace or ~/workspace/memeflow-app." >&2
  exit 1
fi

TEST="smart-vault/tests/policy-model.mjs"
[[ -f "$TEST" ]] || {
  echo "ERROR: $TEST not found. Phase A scaffold is missing." >&2
  exit 1
}

cp -p "$TEST" "$TEST.backup-fix1-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path

p = Path("smart-vault/tests/policy-model.mjs")
s = p.read_text()

old = """import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const PUMP='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMPSWAP='pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const WSOL='So11111111111111111111111111111111111111112';
"""

new = """import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PublicKey} from '@solana/web3.js';

const PUMP='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMPSWAP='pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const WSOL='So11111111111111111111111111111111111111112';
"""

if old in s:
    s = s.replace(old, new, 1)
elif "import {PublicKey} from '@solana/web3.js';" not in s:
    raise SystemExit("FIX 1: import anchor changed; refusing blind edit")

old_assert = """assert.equal(PUMP.length,44);
assert.equal(PUMPSWAP.length,44);
assert.equal(WSOL.length,44);
"""

new_assert = """// Solana public keys are 32 bytes encoded as Base58.
// Their textual Base58 representation is NOT guaranteed to be 44 characters.
// Validate by decoding them as real Solana public keys instead.
for (const address of [PUMP,PUMPSWAP,WSOL]) {
  assert.doesNotThrow(()=>new PublicKey(address));
}
assert.equal(new PublicKey(PUMP).toBase58(),PUMP);
assert.equal(new PublicKey(PUMPSWAP).toBase58(),PUMPSWAP);
assert.equal(new PublicKey(WSOL).toBase58(),WSOL);
"""

if old_assert in s:
    s = s.replace(old_assert, new_assert, 1)
elif "Solana public keys are 32 bytes encoded as Base58." not in s:
    raise SystemExit("FIX 1: assertion anchor changed; refusing blind edit")

p.write_text(s)
print("patched:", p)
PY

# Also repair the installer file if it is still present, so an accidental
# future rerun does not recreate the same false assertion.
for INSTALLER in \
  "../memeflow_smart_vault_phase_a_devnet_v1.sh" \
  "memeflow_smart_vault_phase_a_devnet_v1.sh"
do
  if [[ -f "$INSTALLER" ]]; then
    python3 - "$INSTALLER" <<'PY'
from pathlib import Path
import sys

p=Path(sys.argv[1])
s=p.read_text()

if "import {PublicKey} from '@solana/web3.js';" not in s:
    s=s.replace(
        "import crypto from 'node:crypto';\n\nconst PUMP=",
        "import crypto from 'node:crypto';\nimport {PublicKey} from '@solana/web3.js';\n\nconst PUMP=",
        1
    )

s=s.replace(
"""assert.equal(PUMP.length,44);
assert.equal(PUMPSWAP.length,44);
assert.equal(WSOL.length,44);
""",
"""// Solana Base58 public-key strings are variable length; validate 32-byte keys.
for (const address of [PUMP,PUMPSWAP,WSOL]) {
  assert.doesNotThrow(()=>new PublicKey(address));
}
assert.equal(new PublicKey(PUMP).toBase58(),PUMP);
assert.equal(new PublicKey(PUMPSWAP).toBase58(),PUMPSWAP);
assert.equal(new PublicKey(WSOL).toBase58(),WSOL);
""",
1
)

p.write_text(s)
print("repaired installer:", p)
PY
  fi
done

echo
echo "Running corrected policy tests..."
node "$TEST"

echo
echo "Static checks..."
grep -q '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P' \
  smart-vault/programs/memeflow_smart_vault/src/lib.rs
grep -q 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA' \
  "$TEST"
grep -q 'PUMP_BUY_V2_DISC' \
  smart-vault/programs/memeflow_smart_vault/src/lib.rs
grep -q 'USER_INDEX: usize = 13' \
  smart-vault/programs/memeflow_smart_vault/src/lib.rs
grep -q 'entries_paused = true' \
  smart-vault/programs/memeflow_smart_vault/src/lib.rs

if command -v cargo >/dev/null 2>&1; then
  echo
  echo "cargo detected -> workspace metadata/format check..."
  (
    cd smart-vault
    cargo fmt
    cargo metadata --no-deps --format-version 1 >/dev/null
  )
else
  echo
  echo "cargo not installed -> Rust build remains deferred."
fi

echo
echo "Preflight..."
node smart-vault/scripts/preflight.mjs

echo
echo "== FIX 1 COMPLETE =="
echo "Cause: the test incorrectly assumed every Solana Base58 address has 44 characters."
echo "PumpSwap's valid public key is 43 characters here; Base58 text length is variable."
echo
echo "Nothing was deployed and no funds moved."
echo
echo "Next:"
if command -v anchor >/dev/null 2>&1 && command -v solana >/dev/null 2>&1; then
  echo "  cd ~/workspace/memeflow-app/smart-vault"
  echo "  ./scripts/build-devnet.sh"
else
  echo "  cd ~/workspace/memeflow-app/smart-vault"
  echo "  ./scripts/install-anchor-toolchain.sh"
  echo "  # then open a fresh Shell and run ./scripts/build-devnet.sh"
fi
