#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Smart Vault — PHASE A / DEVNET V1 =="
echo "No Mainnet deployment. No real trade. Existing LIVE mode is not modified."

if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" ]]; then
  :
else
  echo "ERROR: run from ~/workspace or the memeflow-app directory." >&2
  exit 1
fi

ROOT="$PWD"
STAMP="$(date +%Y%m%d-%H%M%S)"
if [[ -d smart-vault ]]; then
  mv smart-vault "smart-vault.backup-$STAMP"
  echo "Existing smart-vault backed up -> smart-vault.backup-$STAMP"
fi

mkdir -p \
  smart-vault/programs/memeflow_smart_vault/src \
  smart-vault/scripts \
  smart-vault/tests \
  smart-vault/target/deploy

cat > smart-vault/Cargo.toml <<'EOF'
[workspace]
members = ["programs/*"]
resolver = "2"

[workspace.dependencies]
anchor-lang = "1.0.2"
solana-program = "3"
EOF

cat > smart-vault/Anchor.toml <<'EOF'
[toolchain]
anchor_version = "1.0.2"
solana_version = "3.1.10"
package_manager = "npm"

[features]
resolution = true
skip-lint = false

[programs.devnet]
memeflow_smart_vault = "PROGRAM_ID_PLACEHOLDER"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[workspace]
members = ["programs/*"]
EOF

cat > smart-vault/programs/memeflow_smart_vault/Cargo.toml <<'EOF'
[package]
name = "memeflow-smart-vault"
version = "0.1.0"
description = "MEMEFLOW non-custodial policy vault for autonomous Pump.fun execution"
edition = "2021"
license = "UNLICENSED"

[lib]
crate-type = ["cdylib", "lib"]
name = "memeflow_smart_vault"

[features]
default = []
idl-build = ["anchor-lang/idl-build"]

[dependencies]
anchor-lang = { workspace = true }
solana-program = { workspace = true }
EOF

cat > smart-vault/programs/memeflow_smart_vault/src/lib.rs <<'EOF'
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    pubkey,
};

declare_id!("PROGRAM_ID_PLACEHOLDER");

/// Official Pump bonding-curve program.
pub const PUMP_PROGRAM_ID: Pubkey =
    pubkey!("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

/// Wrapped SOL is passed as quote_mint for SOL-paired Pump v2 coins.
/// Actual quote transfers remain native SOL.
pub const WSOL_MINT: Pubkey =
    pubkey!("So11111111111111111111111111111111111111112");

/// Anchor discriminators:
/// sha256("global:buy_v2")[0..8]
pub const PUMP_BUY_V2_DISC: [u8; 8] =
    [184, 23, 238, 97, 103, 197, 211, 61];

/// sha256("global:sell_v2")[0..8]
pub const PUMP_SELL_V2_DISC: [u8; 8] =
    [93, 246, 130, 60, 231, 233, 64, 178];

const BUY_V2_ACCOUNTS: usize = 27;
const SELL_V2_ACCOUNTS: usize = 26;
const USER_INDEX: usize = 13; // official account #14
const QUOTE_MINT_INDEX: usize = 2; // official account #3

#[program]
pub mod memeflow_smart_vault {
    use super::*;

    pub fn initialize_policy(
        ctx: Context<InitializePolicy>,
        executor: Pubkey,
        max_buy_debit_lamports: u64,
        daily_debit_limit_lamports: u64,
        max_exit_overhead_lamports: u64,
    ) -> Result<()> {
        require!(
            executor != Pubkey::default(),
            VaultError::InvalidExecutor
        );
        require!(
            max_buy_debit_lamports > 0,
            VaultError::InvalidLimit
        );
        require!(
            daily_debit_limit_lamports >= max_buy_debit_lamports,
            VaultError::InvalidLimit
        );

        let owner_key = ctx.accounts.owner.key();
        let (_, vault_bump) =
            Pubkey::find_program_address(&[b"vault", owner_key.as_ref()], ctx.program_id);

        let policy = &mut ctx.accounts.policy;
        policy.version = 1;
        policy.owner = owner_key;
        policy.executor = executor;
        policy.max_buy_debit_lamports = max_buy_debit_lamports;
        policy.daily_debit_limit_lamports = daily_debit_limit_lamports;
        policy.max_exit_overhead_lamports = max_exit_overhead_lamports;
        policy.spent_today_lamports = 0;
        policy.day_index = day_index(Clock::get()?.unix_timestamp);
        policy.entries_paused = true; // fail-closed until owner explicitly arms.
        policy.policy_bump = ctx.bumps.policy;
        policy.vault_bump = vault_bump;

        emit!(PolicyInitialized {
            owner: policy.owner,
            executor: policy.executor,
            max_buy_debit_lamports,
            daily_debit_limit_lamports,
        });

        Ok(())
    }

    /// User-funded deposit. The destination is a System Program-owned PDA.
    /// The owner signs this instruction; MEMEFLOW never receives the owner's key.
    pub fn deposit(ctx: Context<OwnerVaultAction>, lamports: u64) -> Result<()> {
        require!(lamports > 0, VaultError::InvalidAmount);

        let ix = system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &ctx.accounts.vault.key(),
            lamports,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )
        .map_err(Into::into)
    }

    /// Owner-only withdrawal. The executor is never authorized to call this.
    pub fn withdraw(ctx: Context<OwnerVaultAction>, lamports: u64) -> Result<()> {
        require!(lamports > 0, VaultError::InvalidAmount);
        require_keys_eq!(
            *ctx.accounts.vault.to_account_info().owner,
            anchor_lang::system_program::ID,
            VaultError::InvalidVaultOwner
        );
        require!(
            ctx.accounts.vault.to_account_info().lamports() >= lamports,
            VaultError::InsufficientVaultBalance
        );

        let owner = ctx.accounts.policy.owner;
        let bump = ctx.accounts.policy.vault_bump;
        let signer: &[&[&[u8]]] =
            &[&[b"vault", owner.as_ref(), &[bump]]];

        let ix = system_instruction::transfer(
            &ctx.accounts.vault.key(),
            &ctx.accounts.owner.key(),
            lamports,
        );

        invoke_signed(
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

    pub fn update_policy(
        ctx: Context<OwnerPolicyAction>,
        executor: Pubkey,
        max_buy_debit_lamports: u64,
        daily_debit_limit_lamports: u64,
        max_exit_overhead_lamports: u64,
    ) -> Result<()> {
        require!(
            executor != Pubkey::default(),
            VaultError::InvalidExecutor
        );
        require!(
            max_buy_debit_lamports > 0,
            VaultError::InvalidLimit
        );
        require!(
            daily_debit_limit_lamports >= max_buy_debit_lamports,
            VaultError::InvalidLimit
        );

        let policy = &mut ctx.accounts.policy;
        policy.executor = executor;
        policy.max_buy_debit_lamports = max_buy_debit_lamports;
        policy.daily_debit_limit_lamports = daily_debit_limit_lamports;
        policy.max_exit_overhead_lamports = max_exit_overhead_lamports;

        emit!(PolicyUpdated {
            owner: policy.owner,
            executor,
            max_buy_debit_lamports,
            daily_debit_limit_lamports,
            max_exit_overhead_lamports,
        });

        Ok(())
    }

    /// Pausing entries blocks BUY but deliberately does not block SELL.
    /// This lets the bot close risk while new exposure is disabled.
    pub fn set_entries_paused(
        ctx: Context<OwnerPolicyAction>,
        paused: bool,
    ) -> Result<()> {
        ctx.accounts.policy.entries_paused = paused;
        emit!(EntriesPaused {
            owner: ctx.accounts.policy.owner,
            paused,
        });
        Ok(())
    }

    /// Execute only Pump.fun bonding-curve buy_v2 / sell_v2.
    ///
    /// The client passes the exact Pump instruction bytes plus the official
    /// Pump accounts as remaining_accounts. This program reconstructs the CPI,
    /// forces account #14 (`user`) to be this user's vault PDA, allows the PDA
    /// to be the only signer, and rejects every other program/instruction.
    ///
    /// Phase A is SOL-paired only. PumpSwap is intentionally NOT enabled yet.
    pub fn execute_pump_v2(
        ctx: Context<ExecutePumpV2>,
        instruction_data: Vec<u8>,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.pump_program.key(),
            PUMP_PROGRAM_ID,
            VaultError::UnapprovedProgram
        );
        require_keys_eq!(
            *ctx.accounts.vault.to_account_info().owner,
            anchor_lang::system_program::ID,
            VaultError::InvalidVaultOwner
        );
        require!(
            instruction_data.len() == 24,
            VaultError::MalformedTradeInstruction
        );

        let disc: [u8; 8] = instruction_data[0..8]
            .try_into()
            .map_err(|_| error!(VaultError::MalformedTradeInstruction))?;

        let side = if disc == PUMP_BUY_V2_DISC {
            TradeSide::Buy
        } else if disc == PUMP_SELL_V2_DISC {
            TradeSide::Sell
        } else {
            return err!(VaultError::UnapprovedInstruction);
        };

        let expected_accounts = match side {
            TradeSide::Buy => BUY_V2_ACCOUNTS,
            TradeSide::Sell => SELL_V2_ACCOUNTS,
        };

        require!(
            ctx.remaining_accounts.len() == expected_accounts,
            VaultError::WrongPumpAccountCount
        );

        require_keys_eq!(
            ctx.remaining_accounts[USER_INDEX].key(),
            ctx.accounts.vault.key(),
            VaultError::PumpUserMustBeVault
        );
        require!(
            ctx.remaining_accounts[USER_INDEX].is_writable,
            VaultError::PumpUserMustBeWritable
        );
        require_keys_eq!(
            ctx.remaining_accounts[QUOTE_MINT_INDEX].key(),
            WSOL_MINT,
            VaultError::OnlySolQuoteSupported
        );

        // The last Pump v2 instruction account is the Pump program account.
        require_keys_eq!(
            ctx.remaining_accounts[expected_accounts - 1].key(),
            PUMP_PROGRAM_ID,
            VaultError::UnapprovedProgram
        );

        // Pump v2 has exactly one signer: user (#14). Do not allow an executor,
        // owner, or any unrelated signer to leak extra privileges into the CPI.
        for (i, account) in ctx.remaining_accounts.iter().enumerate() {
            if i != USER_INDEX {
                require!(!account.is_signer, VaultError::UnexpectedSigner);
            }
        }

        let amount = u64::from_le_bytes(
            instruction_data[8..16]
                .try_into()
                .map_err(|_| error!(VaultError::MalformedTradeInstruction))?,
        );
        let quote_limit = u64::from_le_bytes(
            instruction_data[16..24]
                .try_into()
                .map_err(|_| error!(VaultError::MalformedTradeInstruction))?,
        );
        require!(amount > 0, VaultError::InvalidAmount);

        let now_day = day_index(Clock::get()?.unix_timestamp);
        let policy = &mut ctx.accounts.policy;

        if policy.day_index != now_day {
            policy.day_index = now_day;
            policy.spent_today_lamports = 0;
        }

        if matches!(side, TradeSide::Buy) {
            require!(!policy.entries_paused, VaultError::EntriesPaused);
            require!(
                quote_limit <= policy.max_buy_debit_lamports,
                VaultError::PerTradeLimitExceeded
            );
            let remaining = policy
                .daily_debit_limit_lamports
                .checked_sub(policy.spent_today_lamports)
                .ok_or_else(|| error!(VaultError::DailyLimitExceeded))?;
            require!(
                quote_limit <= remaining,
                VaultError::DailyLimitExceeded
            );
        }

        let before = ctx.accounts.vault.to_account_info().lamports();

        let mut metas = Vec::with_capacity(expected_accounts);
        let mut infos = Vec::with_capacity(expected_accounts + 1);

        for (i, account) in ctx.remaining_accounts.iter().enumerate() {
            let signer = i == USER_INDEX;
            let meta = if account.is_writable {
                AccountMeta::new(account.key(), signer)
            } else {
                AccountMeta::new_readonly(account.key(), signer)
            };
            metas.push(meta);
            infos.push(account.clone());
        }

        // The runtime also needs the executable program AccountInfo.
        infos.push(ctx.accounts.pump_program.to_account_info());

        let cpi = Instruction {
            program_id: PUMP_PROGRAM_ID,
            accounts: metas,
            data: instruction_data,
        };

        let owner = policy.owner;
        let bump = policy.vault_bump;
        let signer: &[&[&[u8]]] =
            &[&[b"vault", owner.as_ref(), &[bump]]];

        invoke_signed(&cpi, &infos, signer).map_err(Into::into)?;

        let after = ctx.accounts.vault.to_account_info().lamports();
        let debit = before.saturating_sub(after);

        match side {
            TradeSide::Buy => {
                // Counts the entire SOL loss, including rent/ATA initialization,
                // not just max_sol_cost. Returning an error rolls back the CPI.
                require!(
                    debit <= policy.max_buy_debit_lamports,
                    VaultError::PerTradeLimitExceeded
                );
                let new_total = policy
                    .spent_today_lamports
                    .checked_add(debit)
                    .ok_or_else(|| error!(VaultError::DailyLimitExceeded))?;
                require!(
                    new_total <= policy.daily_debit_limit_lamports,
                    VaultError::DailyLimitExceeded
                );
                policy.spent_today_lamports = new_total;
            }
            TradeSide::Sell => {
                // A sell normally credits SOL. A small debit can happen when a
                // required accumulator/account is initialized, so cap it.
                require!(
                    debit <= policy.max_exit_overhead_lamports,
                    VaultError::ExitOverheadExceeded
                );
            }
        }

        emit!(PumpTradeExecuted {
            owner: policy.owner,
            executor: policy.executor,
            side: side as u8,
            base_amount: amount,
            quote_limit,
            vault_debit_lamports: debit,
            vault_balance_after: after,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + VaultPolicy::INIT_SPACE,
        seeds = [b"policy", owner.key().as_ref()],
        bump
    )]
    pub policy: Account<'info, VaultPolicy>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerPolicyAction<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"policy", owner.key().as_ref()],
        bump = policy.policy_bump,
        has_one = owner @ VaultError::OwnerOnly
    )]
    pub policy: Account<'info, VaultPolicy>,
}

#[derive(Accounts)]
pub struct OwnerVaultAction<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"policy", owner.key().as_ref()],
        bump = policy.policy_bump,
        has_one = owner @ VaultError::OwnerOnly
    )]
    pub policy: Account<'info, VaultPolicy>,

    /// CHECK: exact PDA is enforced by seeds; it must be System-owned before
    /// any withdrawal and System Program owns it after a normal SOL deposit.
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = policy.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecutePumpV2<'info> {
    #[account(
        mut,
        seeds = [b"policy", policy.owner.as_ref()],
        bump = policy.policy_bump,
        has_one = executor @ VaultError::UnauthorizedExecutor
    )]
    pub policy: Account<'info, VaultPolicy>,

    /// CHECK: exact PDA is enforced; runtime ownership is checked in handler.
    #[account(
        mut,
        seeds = [b"vault", policy.owner.as_ref()],
        bump = policy.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,

    pub executor: Signer<'info>,

    /// CHECK: hard allowlisted to the official Pump program.
    #[account(address = PUMP_PROGRAM_ID @ VaultError::UnapprovedProgram)]
    pub pump_program: UncheckedAccount<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct VaultPolicy {
    pub version: u8,
    pub owner: Pubkey,
    pub executor: Pubkey,
    pub max_buy_debit_lamports: u64,
    pub daily_debit_limit_lamports: u64,
    pub max_exit_overhead_lamports: u64,
    pub spent_today_lamports: u64,
    pub day_index: i64,
    pub entries_paused: bool,
    pub policy_bump: u8,
    pub vault_bump: u8,
}

#[repr(u8)]
#[derive(Clone, Copy)]
enum TradeSide {
    Buy = 0,
    Sell = 1,
}

fn day_index(unix_timestamp: i64) -> i64 {
    unix_timestamp.div_euclid(86_400)
}

#[event]
pub struct PolicyInitialized {
    pub owner: Pubkey,
    pub executor: Pubkey,
    pub max_buy_debit_lamports: u64,
    pub daily_debit_limit_lamports: u64,
}

#[event]
pub struct PolicyUpdated {
    pub owner: Pubkey,
    pub executor: Pubkey,
    pub max_buy_debit_lamports: u64,
    pub daily_debit_limit_lamports: u64,
    pub max_exit_overhead_lamports: u64,
}

#[event]
pub struct EntriesPaused {
    pub owner: Pubkey,
    pub paused: bool,
}

#[event]
pub struct PumpTradeExecuted {
    pub owner: Pubkey,
    pub executor: Pubkey,
    pub side: u8,
    pub base_amount: u64,
    pub quote_limit: u64,
    pub vault_debit_lamports: u64,
    pub vault_balance_after: u64,
}

#[error_code]
pub enum VaultError {
    #[msg("Only the vault owner can perform this action")]
    OwnerOnly,
    #[msg("Executor is not authorized by this vault")]
    UnauthorizedExecutor,
    #[msg("Executor public key is invalid")]
    InvalidExecutor,
    #[msg("Invalid policy limit")]
    InvalidLimit,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("New BUY entries are paused")]
    EntriesPaused,
    #[msg("Target program is not allowlisted")]
    UnapprovedProgram,
    #[msg("Target Pump instruction is not allowlisted")]
    UnapprovedInstruction,
    #[msg("Malformed Pump trade instruction")]
    MalformedTradeInstruction,
    #[msg("Wrong account count for Pump v2 instruction")]
    WrongPumpAccountCount,
    #[msg("Pump user account must equal the MEMEFLOW vault PDA")]
    PumpUserMustBeVault,
    #[msg("Pump user account must be writable")]
    PumpUserMustBeWritable,
    #[msg("Phase A supports SOL-paired Pump coins only")]
    OnlySolQuoteSupported,
    #[msg("Unexpected external signer in Pump CPI")]
    UnexpectedSigner,
    #[msg("Per-trade vault debit limit exceeded")]
    PerTradeLimitExceeded,
    #[msg("Daily vault debit limit exceeded")]
    DailyLimitExceeded,
    #[msg("SELL overhead limit exceeded")]
    ExitOverheadExceeded,
    #[msg("Vault is not owned by the System Program")]
    InvalidVaultOwner,
    #[msg("Vault SOL balance is too low")]
    InsufficientVaultBalance,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pump_discriminators_are_distinct() {
        assert_ne!(PUMP_BUY_V2_DISC, PUMP_SELL_V2_DISC);
    }

    #[test]
    fn utc_day_index_handles_boundaries() {
        assert_eq!(day_index(0), 0);
        assert_eq!(day_index(86_399), 0);
        assert_eq!(day_index(86_400), 1);
        assert_eq!(day_index(-1), -1);
    }

    #[test]
    fn official_user_index_is_zero_based_13() {
        assert_eq!(USER_INDEX + 1, 14);
    }
}
EOF

cat > smart-vault/tests/policy-model.mjs <<'EOF'
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PublicKey} from '@solana/web3.js';

const PUMP='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMPSWAP='pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const WSOL='So11111111111111111111111111111111111111112';

function disc(name){
  return [...crypto.createHash('sha256').update(`global:${name}`).digest().subarray(0,8)];
}
assert.deepEqual(disc('buy_v2'), [184,23,238,97,103,197,211,61]);
assert.deepEqual(disc('sell_v2'), [93,246,130,60,231,233,64,178]);

// Solana Base58 public-key strings are variable length; validate 32-byte keys.
for (const address of [PUMP,PUMPSWAP,WSOL]) {
  assert.doesNotThrow(()=>new PublicKey(address));
}
assert.equal(new PublicKey(PUMP).toBase58(),PUMP);
assert.equal(new PublicKey(PUMPSWAP).toBase58(),PUMPSWAP);
assert.equal(new PublicKey(WSOL).toBase58(),WSOL);

function approveBuy({paused,maxTrade,daily,spent,quoteLimit,actualDebit}){
  if(paused) return 'PAUSED';
  if(quoteLimit>maxTrade || actualDebit>maxTrade) return 'PER_TRADE';
  if(spent+actualDebit>daily) return 'DAILY';
  return 'OK';
}

assert.equal(approveBuy({
  paused:true,maxTrade:10,daily:100,spent:0,quoteLimit:1,actualDebit:1
}),'PAUSED');
assert.equal(approveBuy({
  paused:false,maxTrade:10,daily:100,spent:0,quoteLimit:11,actualDebit:1
}),'PER_TRADE');
assert.equal(approveBuy({
  paused:false,maxTrade:10,daily:100,spent:95,quoteLimit:5,actualDebit:6
}),'DAILY');
assert.equal(approveBuy({
  paused:false,maxTrade:10,daily:100,spent:20,quoteLimit:8,actualDebit:9
}),'OK');

console.log('smart-vault policy model: OK');
console.log('Pump v2 BUY/SELL only; PumpSwap intentionally blocked in Phase A.');
EOF

cat > smart-vault/scripts/preflight.mjs <<'EOF'
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const sh = cmd => {
  try { return execFileSync('bash',['-lc',cmd],{encoding:'utf8'}).trim(); }
  catch { return null; }
};

const programId=fs.readFileSync(new URL('../.dev-program-id',import.meta.url),'utf8').trim();

console.log('MEMEFLOW Smart Vault Phase A preflight');
console.log('programId(dev only):',programId);
console.log('cargo:',sh('cargo --version')||'MISSING');
console.log('rustc:',sh('rustc --version')||'MISSING');
console.log('solana:',sh('solana --version')||'MISSING');
console.log('anchor:',sh('anchor --version')||'MISSING');
console.log('cluster target: DEVNET ONLY');
console.log('mainnet auto unlock: BLOCKED');
console.log('Pump v2 CPI: scaffolded');
console.log('PumpSwap CPI: BLOCKED until Phase B');
EOF

cat > smart-vault/scripts/build-devnet.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

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
EOF
chmod +x smart-vault/scripts/build-devnet.sh

cat > smart-vault/scripts/install-anchor-toolchain.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "This installs the current official Solana/Anchor development toolchain."
echo "It does NOT deploy a program and does NOT touch a wallet seed."
echo
echo "Official Anchor docs currently pair Anchor 1.0.2 with Solana CLI 3.1.10."
echo
read -r -p "Install development toolchain now? Type YES: " answer
[[ "$answer" == "YES" ]] || { echo "Cancelled."; exit 0; }

curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash

echo
echo "Installation command finished."
echo "Restart/open a fresh Replit Shell, then run:"
echo "  cd ~/workspace/memeflow-app/smart-vault"
echo "  ./scripts/build-devnet.sh"
EOF
chmod +x smart-vault/scripts/install-anchor-toolchain.sh

cat > smart-vault/.gitignore <<'EOF'
/target/
/.anchor/
*.log
EOF

cat > smart-vault/README.md <<'EOF'
# MEMEFLOW Smart Vault — Phase A

## Goal

Non-custodial AUTO LIVE architecture where the user keeps ownership and the
server executor can only perform narrowly allowed trades.

This phase is **DEVNET / build-only** and does not unlock AUTO LIVE in the app.

## Accounts

For each owner:

- `policy PDA = ["policy", owner]` — program-owned policy state.
- `vault PDA = ["vault", owner]` — System Program account holding only the SOL
  the user intentionally allocates to AUTO LIVE.
- token ATAs for the vault PDA hold tokens bought by the vault.

There is **no private key for the vault PDA**. The Smart Vault program can sign
for it only during CPI using its PDA seeds.

## Executor permissions

The configured `executor` may call only `execute_pump_v2`.

The program itself enforces:

- official Pump program ID only;
- `buy_v2` and `sell_v2` only;
- exact current v2 account counts;
- Pump account #14 (`user`) must equal the user's vault PDA;
- vault PDA is the only signer forwarded to Pump;
- SOL-paired coins only in Phase A;
- BUY is blocked when entries are paused;
- BUY per-trade cap;
- BUY UTC daily debit cap;
- actual vault lamport loss is measured after CPI, so rent/account creation also
  consumes the cap;
- SELL remains allowed while entries are paused;
- SELL has a small configurable maximum SOL overhead;
- executor cannot withdraw;
- only owner can change executor/policy, pause/unpause entries, or withdraw SOL.

## Why PDA + CPI

Pump `buy_v2` / `sell_v2` require `user` to be a signer. A PDA has no private
key, but the program that derives it can sign for it during CPI. This makes
offline autonomous execution possible without storing the user's Phantom key.

## Current deliberate limits

- NO Mainnet deployment.
- NO AUTO LIVE button unlock.
- NO PumpSwap CPI yet.
- NO arbitrary-program CPI.
- NO user seed phrase/private key anywhere.
- Development program keypair generated by the installer is DEVNET-only.

## Next gates

1. Build successfully with Anchor 1.0.2 / Solana 3.1.10.
2. Run local tests.
3. Deploy to Devnet.
4. Create owner policy + fund vault with Devnet SOL.
5. Simulate/execute Pump v2 route on Devnet where protocol availability permits;
   otherwise run local/forked integration fixtures.
6. Add PumpSwap as a separately allowlisted CPI path and tests.
7. Integrate MEMEFLOW server executor.
8. Security review / verifiable build.
9. Only then consider Mainnet + AUTO LIVE unlock.
EOF

# @solana/web3.js is already part of current MEMEFLOW wallet work, but ensure it.
npm install --no-audit --no-fund @solana/web3.js@latest >/dev/null

node --input-type=module <<'EOF_NODE'
import fs from 'node:fs';
import {Keypair} from '@solana/web3.js';

const kp=Keypair.generate();
fs.writeFileSync(
  'smart-vault/target/deploy/memeflow_smart_vault-keypair.json',
  JSON.stringify(Array.from(kp.secretKey))
);
fs.writeFileSync('smart-vault/.dev-program-id',kp.publicKey.toBase58()+'\n');
console.log(kp.publicKey.toBase58());
EOF_NODE

PROGRAM_ID="$(tr -d '\r\n' < smart-vault/.dev-program-id)"

python3 - "$PROGRAM_ID" <<'PY'
from pathlib import Path
import sys
pid=sys.argv[1]

for f in [
    Path("smart-vault/Anchor.toml"),
    Path("smart-vault/programs/memeflow_smart_vault/src/lib.rs"),
]:
    s=f.read_text()
    if "PROGRAM_ID_PLACEHOLDER" not in s:
        raise SystemExit(f"placeholder missing in {f}")
    f.write_text(s.replace("PROGRAM_ID_PLACEHOLDER", pid))
PY

echo "$PROGRAM_ID" > smart-vault/DEVNET_PROGRAM_ID.txt

echo
echo "Running no-funds policy tests..."
node smart-vault/tests/policy-model.mjs

echo
echo "Static checks..."
grep -q '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P' \
  smart-vault/programs/memeflow_smart_vault/src/lib.rs
grep -q 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA' \
  smart-vault/tests/policy-model.mjs
grep -q 'PUMP_BUY_V2_DISC' \
  smart-vault/programs/memeflow_smart_vault/src/lib.rs
grep -q 'USER_INDEX: usize = 13' \
  smart-vault/programs/memeflow_smart_vault/src/lib.rs
grep -q 'entries_paused = true' \
  smart-vault/programs/memeflow_smart_vault/src/lib.rs

if command -v cargo >/dev/null 2>&1; then
  echo "cargo detected -> formatting/parsing workspace..."
  (
    cd smart-vault
    cargo fmt
    cargo metadata --no-deps --format-version 1 >/dev/null
  )
else
  echo "cargo not installed -> Rust build deferred."
fi

echo
node smart-vault/scripts/preflight.mjs

echo
echo "== SMART VAULT PHASE A INSTALLED =="
echo "DEVNET program id: $PROGRAM_ID"
echo
echo "Security state:"
echo "  Existing manual LIVE: UNCHANGED"
echo "  AUTO LIVE 24/7:       STILL LOCKED"
echo "  Mainnet deployment:   NOT PERFORMED"
echo "  Real transactions:    NONE"
echo "  Pump v2 path:          SCAFFOLDED + STRICT ALLOWLIST"
echo "  PumpSwap path:         BLOCKED until Phase B"
echo
echo "Next:"
if command -v anchor >/dev/null 2>&1 && command -v solana >/dev/null 2>&1; then
  echo "  Toolchain detected. Run:"
  echo "    cd ~/workspace/memeflow-app/smart-vault"
  echo "    ./scripts/build-devnet.sh"
else
  echo "  Solana/Anchor toolchain is missing or incomplete."
  echo "  Run:"
  echo "    cd ~/workspace/memeflow-app/smart-vault"
  echo "    ./scripts/install-anchor-toolchain.sh"
  echo "  Then open a fresh Shell and run ./scripts/build-devnet.sh"
fi
