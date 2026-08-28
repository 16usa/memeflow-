#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Smart Vault Phase A — FIX 3 / rustfmt =="
echo "Installs the missing rustfmt component in the project-local Rust toolchain."
echo "No deploy. No transaction. Mainnet remains blocked."

if [[ -d "memeflow-app/smart-vault" ]]; then
  cd memeflow-app/smart-vault
elif [[ -f "Anchor.toml" && -f "programs/memeflow_smart_vault/src/lib.rs" ]]; then
  :
elif [[ -d "smart-vault" && -f "smart-vault/Anchor.toml" ]]; then
  cd smart-vault
else
  echo "ERROR: smart-vault project not found." >&2
  exit 1
fi

# shellcheck disable=SC1091
source "./scripts/toolchain-env.sh"

echo
echo "Toolchain:"
rustc --version
cargo --version
solana --version
anchor --version

echo
echo "Installing rustfmt into the isolated project Rust toolchain..."
rustup component add rustfmt

echo
echo "Verifying rustfmt..."
cargo fmt --version

echo
echo "Formatting Smart Vault sources..."
cargo fmt

echo
echo "Checking previous E0282/E0283 fix is still present..."
if grep -n "map_err(Into::into)" programs/memeflow_smart_vault/src/lib.rs; then
  echo "ERROR: ambiguous map_err(Into::into) is still present." >&2
  exit 2
fi
echo "conversion check: OK"

echo
echo "Running Rust unit tests..."
cargo test -p memeflow-smart-vault

echo
echo "Running JS policy model..."
node tests/policy-model.mjs

echo
echo "Running full Anchor DEVNET build gate..."
anchor build

echo
echo "== SMART VAULT PHASE A FIX 3 COMPLETE =="
echo "rustfmt: installed"
echo "Rust unit tests: OK"
echo "Policy model: OK"
echo "Anchor build: OK"
echo
echo "Nothing was deployed."
echo "No transaction was sent."
echo "AUTO LIVE remains locked."
echo "Mainnet remains blocked."
echo
echo "STOP HERE after this script."
echo "Do NOT run anchor deploy yet."
