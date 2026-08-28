#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Smart Vault Phase A — FIX 5 / overflow-checks =="
echo "Enables the release overflow checks required by the Solana/Anchor build gate."
echo "No deploy. No transaction. Mainnet remains blocked."

if [[ -d "memeflow-app/smart-vault" ]]; then
  cd memeflow-app/smart-vault
elif [[ -f "Anchor.toml" && -f "Cargo.toml" && -f "programs/memeflow_smart_vault/src/lib.rs" ]]; then
  :
elif [[ -d "smart-vault" && -f "smart-vault/Anchor.toml" ]]; then
  cd smart-vault
else
  echo "ERROR: smart-vault project not found." >&2
  exit 1
fi

ROOT_CARGO="Cargo.toml"
STAMP="$(date +%Y%m%d-%H%M%S)"
cp -p "$ROOT_CARGO" "$ROOT_CARGO.backup-fix5-$STAMP"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("Cargo.toml")
s = p.read_text()

# Solana/Anchor requires overflow checks for release builds.
# Add the setting at WORKSPACE ROOT, exactly where the error requested it.
if re.search(r'(?m)^\[profile\.release\]\s*$', s):
    # Replace existing setting if present, otherwise insert below the section.
    if re.search(r'(?m)^overflow-checks\s*=', s):
        s = re.sub(
            r'(?m)^overflow-checks\s*=\s*(?:true|false)\s*$',
            'overflow-checks = true',
            s,
            count=1
        )
    else:
        s = re.sub(
            r'(?m)^(\[profile\.release\]\s*)$',
            r'\1\noverflow-checks = true',
            s,
            count=1
        )
else:
    if not s.endswith("\n"):
        s += "\n"
    s += "\n[profile.release]\noverflow-checks = true\n"

p.write_text(s)

# Validate the setting is in the workspace root and exactly true.
check = p.read_text()
if not re.search(
    r'(?ms)^\[profile\.release\]\s*$.*?^overflow-checks\s*=\s*true\s*$',
    check
):
    raise SystemExit("FIX 5: failed to establish [profile.release] overflow-checks = true")

print("patched:", p)
PY

# shellcheck disable=SC1091
source "./scripts/toolchain-env.sh"

echo
echo "Workspace release profile:"
awk '
  /^\[profile\.release\]$/ {show=1}
  show {print}
  show && /^\[/ && $0!="[profile.release]" {exit}
' "$ROOT_CARGO" | sed '$d' || true
grep -A5 '^\[profile\.release\]$' "$ROOT_CARGO" || true

echo
echo "Running Rust unit tests..."
cargo test -p memeflow-smart-vault

echo
echo "Running JS policy model..."
node tests/policy-model.mjs

echo
echo "Running full Anchor build gate..."
anchor build

echo
echo "Build artifacts:"
find target -maxdepth 3 -type f \( -name '*.so' -o -name '*.json' \) -print 2>/dev/null | sort || true

echo
echo "== SMART VAULT PHASE A FIX 5 COMPLETE =="
echo "Rust unit tests: OK"
echo "Policy model: OK"
echo "Anchor build: OK"
echo
echo "Nothing was deployed."
echo "No transaction was sent."
echo "AUTO LIVE remains locked."
echo "Mainnet remains blocked."
echo
echo "STOP HERE. Do NOT run anchor deploy yet."
