#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Smart Vault Phase A — FIX 2 / Rust E0282-E0283 =="
echo "Fixes Anchor/Rust error-conversion ambiguity only."
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

SRC="programs/memeflow_smart_vault/src/lib.rs"
STAMP="$(date +%Y%m%d-%H%M%S)"
cp -p "$SRC" "$SRC.backup-fix2-$STAMP"

python3 - <<'PY'
from pathlib import Path

p=Path("programs/memeflow_smart_vault/src/lib.rs")
s=p.read_text()

# Anchor 1.0.2 has several From<...> implementations for anchor_lang::error::Error.
# `map_err(Into::into)` is therefore ambiguous under current Rust and produces
# E0282/E0283. The `?` operator has the concrete source type ProgramError and
# resolves the conversion correctly.

old1 = """).map_err(Into::into)
    }

    /// Owner-only withdrawal."""
new1 = """)?;
        Ok(())
    }

    /// Owner-only withdrawal."""

if old1 in s:
    s=s.replace(old1,new1,1)
elif "program::invoke(" in s and ").map_err(Into::into)" in s:
    # Fall through to structured replacements below.
    pass

old2 = """        invoke_signed(
            &ix,
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )
        .map_err(Into::into)
    }

    pub fn update_policy("""
new2 = """        invoke_signed(
            &ix,
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;
        Ok(())
    }

    pub fn update_policy("""

if old2 in s:
    s=s.replace(old2,new2,1)

old3 = """        invoke_signed(&cpi, &infos, signer).map_err(Into::into)?;

        let after = ctx.accounts.vault.to_account_info().lamports();"""
new3 = """        invoke_signed(&cpi, &infos, signer)?;

        let after = ctx.accounts.vault.to_account_info().lamports();"""

if old3 in s:
    s=s.replace(old3,new3,1)

# Repair deposit if the exact first block shape varied after rustfmt.
s=s.replace(
"""        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )
        .map_err(Into::into)
""",
"""        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        Ok(())
"""
)

remaining=s.count(".map_err(Into::into)")
if remaining:
    raise SystemExit(f"FIX 2 refused to continue: {remaining} ambiguous map_err(Into::into) occurrence(s) remain")

p.write_text(s)
print("patched:",p)
PY

echo
echo "Formatting..."
# shellcheck disable=SC1091
source "./scripts/toolchain-env.sh"
cargo fmt

echo
echo "Checking the three failing conversion sites are gone..."
if grep -n "map_err(Into::into)" "$SRC"; then
  echo "ERROR: ambiguous conversion still present." >&2
  exit 2
fi
echo "conversion check: OK"

echo
echo "Running Rust unit tests..."
cargo test -p memeflow-smart-vault

echo
echo "Running policy model..."
node tests/policy-model.mjs

echo
echo "Attempting full Anchor DEVNET build gate..."
anchor build

echo
echo "== SMART VAULT PHASE A FIX 2 COMPLETE =="
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
