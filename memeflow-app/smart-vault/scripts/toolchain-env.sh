#!/usr/bin/env bash

_MF_VAULT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export MEMEFLOW_SMART_VAULT_TOOLCHAIN="$_MF_VAULT_ROOT/.toolchain"

# Isolate all blockchain development credentials/config from the Replit account
# and from the production MEMEFLOW runtime.
export HOME="$MEMEFLOW_SMART_VAULT_TOOLCHAIN/home"
export CARGO_HOME="$MEMEFLOW_SMART_VAULT_TOOLCHAIN/cargo"
export RUSTUP_HOME="$MEMEFLOW_SMART_VAULT_TOOLCHAIN/rustup"

export PATH="$CARGO_HOME/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

unset _MF_VAULT_ROOT
