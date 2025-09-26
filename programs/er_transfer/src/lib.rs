use anchor_lang::prelude::{borsh::de, *};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{commit_and_undelegate_accounts};

declare_id!("3jZTjopbnwnbcKmTk1HboEsrzJhF8bao2BL2C4p6c1Wi");

#[ephemeral]
#[program]
pub mod er_transfer {
    use super::*;

    pub fn initialize(ctx: Context<Initialze>) -> Result<()> {
        let balance_account = &mut ctx.accounts.balance;
        balance_account.balance = 0;
        Ok(())
    }

    pub fn delegate_balance(ctx: Context<DelegateBalance>, parms: DelegateParams) -> Result<()> {
        let config = DelegateConfig {
            commit_frequency_ms: parms.commit_frequency_ms,
            validator: parms.validator
        };

        let seed = &[ctx.accounts.payer.key.as_ref()];
        ctx.accounts.delegate_balance(&ctx.accounts.payer, seed, config)?;

        Ok(())
    }

    pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
        let balance = &mut ctx.accounts.balance;
        let receiver_balance = &mut ctx.accounts.receiver_balance;
        if balance.balance < amount {
            return Err(error!(ErrorCode::InsufficientBalance));
        }
        balance.balance -= amount;
        receiver_balance.balance += amount;
        Ok(())
    }

    pub fn undelegate(ctx: Context<UndelegateBalance>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.balance.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialze<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init, 
        payer = user, 
        space = 8 + 8, 
        seeds = [user.key.as_ref()], 
        bump
    )]
    pub balance: Account<'info, Balance>,

    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateBalance<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut, 
        del, 
        seeds = [payer.key.as_ref()], 
        bump
    )]
    pub balance: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut, 
        seeds = [payer.key.as_ref()], 
        bump
    )]
    pub balance: Account<'info, Balance>,

    pub receiver: AccountInfo<'info>,

    #[account(
        init_if_needed, 
        payer = payer, 
        space = 8 + 8, 
        seeds = [receiver.key.as_ref()], 
        bump
    )]
    pub receiver_balance: Account<'info, Balance>,

    pub system_program: Program<'info, System>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateBalance<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut, 
        seeds = [payer.key.as_ref()], 
        bump
    )]
    pub balance: Account<'info, Balance>,
}

#[account]
pub struct Balance {
    pub balance: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DelegateParams {
    pub commit_frequency_ms: u32,
    pub validator: Option<Pubkey>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient balance for transfer")]
    InsufficientBalance,
}