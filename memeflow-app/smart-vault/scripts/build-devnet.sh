#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source "./scripts/toolchain-env.sh"

echo "== Smart Vault DEVNET build =="
command -v cargo >/dev/null || { echo "MISSING: cargo"; exit 2; }
command -v anchor >/dev/null || { echo "MISSING: anchor"; exit 2; }
command -v solana >/dev/null || { echo "MISSING: solana"; exit 2; }

echo "Anchor: $(anchor --version)"
echo "Solana: $(solana --version)"
echo "Rust:   $(rustc --version)"

node tests/policy-model.mjs
cargo test -p memeflow-smart-vault
anchor build

echo
echo "BUILD OK."
echo "No deployment was performed."
echo "Next command (only after review): anchor deploy --provider.cluster devnet"
