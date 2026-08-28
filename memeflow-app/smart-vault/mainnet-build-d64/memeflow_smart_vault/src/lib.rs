#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    pubkey,
};

declare_id!("FsTTvzRLFBBeYR96iCuqDno97LdFURpez92fdfnws5xy");

/// Official Pump bonding-curve program.
pub const PUMP_PROGRAM_ID: Pubkey = pubkey!("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

/// Wrapped SOL is passed as quote_mint for SOL-paired Pump v2 coins.
/// Actual quote transfers remain native SOL.
pub const WSOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");

/// Anchor discriminators:
/// sha256("global:buy_v2")[0..8]
pub const PUMP_BUY_V2_DISC: [u8; 8] = [184, 23, 238, 97, 103, 197, 211, 61];

/// sha256("global:sell_v2")[0..8]
pub const PUMP_SELL_V2_DISC: [u8; 8] = [93, 246, 130, 60, 231, 233, 64, 178];

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
        require!(executor != Pubkey::default(), VaultError::InvalidExecutor);
        require!(max_buy_debit_lamports > 0, VaultError::InvalidLimit);
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
        )?;
        Ok(())
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
        let signer: &[&[&[u8]]] = &[&[b"vault", owner.as_ref(), &[bump]]];

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
        )?;
        Ok(())
    }

    pub fn update_policy(
        ctx: Context<OwnerPolicyAction>,
        executor: Pubkey,
        max_buy_debit_lamports: u64,
        daily_debit_limit_lamports: u64,
        max_exit_overhead_lamports: u64,
    ) -> Result<()> {
        require!(executor != Pubkey::default(), VaultError::InvalidExecutor);
        require!(max_buy_debit_lamports > 0, VaultError::InvalidLimit);
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
    pub fn set_entries_paused(ctx: Context<OwnerPolicyAction>, paused: bool) -> Result<()> {
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
    pub fn execute_pump_v2(ctx: Context<ExecutePumpV2>, instruction_data: Vec<u8>) -> Result<()> {
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
            require!(quote_limit <= remaining, VaultError::DailyLimitExceeded);
        }

        let before = ctx.accounts.vault.to_account_info().lamports();

        let mut metas = Vec::with_capacity(expected_accounts);
        let mut infos = Vec::with_capacity(expected_accounts);

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

        let cpi = Instruction {
            program_id: PUMP_PROGRAM_ID,
            accounts: metas,
            data: instruction_data,
        };

        let owner = policy.owner;
        let bump = policy.vault_bump;
        let signer: &[&[&[u8]]] = &[&[b"vault", owner.as_ref(), &[bump]]];

        invoke_signed(&cpi, &infos, signer)?;

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
