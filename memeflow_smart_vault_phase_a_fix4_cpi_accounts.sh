#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Smart Vault Phase A — FIX 4 / CPI account lifetime =="
echo "Removes the redundant Pump program AccountInfo from ExecutePumpV2."
echo "The official Pump program account already exists as the final Pump v2 account."
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
cp -p "$SRC" "$SRC.backup-fix4-$STAMP"

python3 - <<'PY'
from pathlib import Path

p = Path("programs/memeflow_smart_vault/src/lib.rs")
s = p.read_text()

# 1) The Pump program is already account #27 for buy_v2 and #26 for sell_v2.
#    Keeping it AGAIN as ctx.accounts.pump_program creates a second AccountInfo
#    lifetime. Pushing that second lifetime into Vec<AccountInfo<'info>> built
#    from ctx.remaining_accounts is exactly the E0282-style lifetime failure
#    shown by rustc.
#
#    We hardcode Instruction.program_id to PUMP_PROGRAM_ID and validate the
#    final remaining account against the same ID, so the separate field adds no
#    security and is redundant.

block = """        require_keys_eq!(
            ctx.accounts.pump_program.key(),
            PUMP_PROGRAM_ID,
            VaultError::UnapprovedProgram
        );
"""
if block in s:
    s = s.replace(block, "", 1)

# 2) All CPI AccountInfos now come from the single remaining_accounts lifetime.
s = s.replace(
    "let mut infos = Vec::with_capacity(expected_accounts + 1);",
    "let mut infos = Vec::with_capacity(expected_accounts);",
    1,
)

extra_push = """        // The runtime also needs the executable program AccountInfo.
        infos.push(ctx.accounts.pump_program.to_account_info());

"""
if extra_push in s:
    s = s.replace(extra_push, "", 1)

# rustfmt may have changed the comment whitespace but not the statement.
if "infos.push(ctx.accounts.pump_program.to_account_info());" in s:
    s = s.replace(
        "        infos.push(ctx.accounts.pump_program.to_account_info());\n",
        "",
        1,
    )

# 3) Remove redundant fixed account from ExecutePumpV2. The official Pump docs
#    include `program` as the last account of buy_v2/sell_v2, and our handler
#    already checks that last remaining account == PUMP_PROGRAM_ID.
field = """    /// CHECK: hard allowlisted to the official Pump program.
    #[account(address = PUMP_PROGRAM_ID @ VaultError::UnapprovedProgram)]
    pub pump_program: UncheckedAccount<'info>,
"""
if field in s:
    s = s.replace(field, "", 1)
else:
    # Be robust to rustfmt line wrapping.
    import re
    s2, n = re.subn(
        r'\n\s*/// CHECK: hard allowlisted to the official Pump program\.\n'
        r'\s*#\[account\(address = PUMP_PROGRAM_ID @ VaultError::UnapprovedProgram\)\]\n'
        r'\s*pub pump_program: UncheckedAccount<\'info>,\n',
        '\n',
        s,
        count=1,
    )
    s = s2
    if n == 0 and "pub pump_program: UncheckedAccount<'info>" in s:
        raise SystemExit("FIX 4: pump_program field found but exact block changed; refusing blind removal")

# Safety assertions: we MUST retain the on-chain allowlist checks.
required = [
    "program_id: PUMP_PROGRAM_ID",
    "ctx.remaining_accounts[expected_accounts - 1].key()",
    "VaultError::UnapprovedProgram",
    "USER_INDEX",
    "PUMP_BUY_V2_DISC",
    "PUMP_SELL_V2_DISC",
]
for needle in required:
    if needle not in s:
        raise SystemExit(f"FIX 4 safety assertion missing after patch: {needle}")

if "ctx.accounts.pump_program" in s:
    raise SystemExit("FIX 4 incomplete: ctx.accounts.pump_program reference remains")

p.write_text(s)
print("patched:", p)
PY

# shellcheck disable=SC1091
source "./scripts/toolchain-env.sh"

echo
echo "Formatting..."
cargo fmt

echo
echo "Static CPI safety checks..."
grep -q 'program_id: PUMP_PROGRAM_ID' "$SRC"
grep -q 'ctx.remaining_accounts\[expected_accounts - 1\].key()' "$SRC"
grep -q 'PUMP_BUY_V2_DISC' "$SRC"
grep -q 'PUMP_SELL_V2_DISC' "$SRC"
grep -q 'USER_INDEX: usize = 13' "$SRC"

if grep -q 'ctx.accounts.pump_program' "$SRC"; then
  echo "ERROR: redundant Pump AccountInfo reference still exists." >&2
  exit 2
fi

echo "CPI account model: OK"

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
echo "== SMART VAULT PHASE A FIX 4 COMPLETE =="
echo "Rust unit tests: OK"
echo "Policy model: OK"
echo "Anchor build: OK"
echo
echo "Lifetime cause fixed:"
echo "  all Pump CPI AccountInfos now come from ONE remaining_accounts lifetime."
echo "  Pump program remains hardcoded + validated as the final Pump v2 account."
echo
echo "Nothing was deployed."
echo "No transaction was sent."
echo "AUTO LIVE remains locked."
echo "Mainnet remains blocked."
echo
echo "STOP HERE. Do NOT run anchor deploy yet."
