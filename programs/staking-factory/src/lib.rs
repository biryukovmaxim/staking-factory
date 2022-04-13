use crate::reward::{Params, RewardPolicy};
use crate::staking_factory::StackingFactory;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

mod history;
mod reward;

declare_id!("DBa1q9iY3ZrvXBgEpVq453adWqZUrVDmRQztiW6FRJek");

#[program]
pub mod staking_factory {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, fee_percent: u8) -> Result<()> {
        ctx.accounts.creator_pda.fee_percent = fee_percent;
        ctx.accounts.creator_pda.authority = ctx.accounts.factory_creator.key();
        Ok(())
    }

    pub fn create_staking(
        ctx: Context<CreateStacking>,
        reward_policy_type: u8,
        period: i64,
        units_per_token: u64,
        rewards_per_unit: u64,
    ) -> Result<()> {
        let staking = &mut ctx.accounts.stacking;
        staking.add_factory_creator(*ctx.accounts.factory_creator);
        staking.authority = ctx.accounts.stacking_creator.key();
        staking.mint = ctx.accounts.stacking_mint.key();
        staking.policy_type = RewardPolicy::from(reward_policy_type);
        staking.policy_params = Params {
            reward_mint: ctx.accounts.reward_mint.key(),
            period,
            units_per_token,
            rewards_per_unit,
        };
        staking.reward_token_account = ctx.accounts.general_reward_pool.key();
        staking.staked_token_account = ctx.accounts.general_stake_pool.key();
        staking.free_token_account = ctx.accounts.general_free_pool.key();
        Ok(())
    }

    #[derive(Clone)]
    pub struct StackingFactory;

    impl anchor_lang::Id for StackingFactory {
        fn id() -> Pubkey {
            crate::ID
        }
    }
}

#[derive(Accounts)]
#[instruction(fee_percent: u8)]
pub struct Initialize<'info> {
    #[account(init,
    payer = factory_creator,
    space = 8 + 32 + 1,
    owner = crate::ID,
    seeds= [b"factory_creator"], bump
    )]
    creator_pda: Account<'info, FactoryCreator>,
    #[account(mut)]
    factory_creator: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(reward_policy_type: u8,
period: i64,
units_per_token: u64,
rewards_per_unit: u64)]
pub struct CreateStacking<'info> {
    #[account(init,
    payer = stacking_creator,
    space = 8 + Staking::space(),
    seeds= [
    b"staking",
    stacking_creator.key.as_ref(),
    stacking_mint.key().as_ref(),
    [reward_policy_type].as_ref()
    ], bump
    )]
    stacking: Account<'info, Staking>,
    #[account(init,
    payer = stacking_creator,
    space = 8 ,
    seeds= [
    b"free_tokens",
    stacking_creator.key.as_ref(),
    stacking_mint.key().as_ref(),
    [reward_policy_type].as_ref()
    ], bump
    )]
    free_tokens: Account<'info, Empty>,
    #[account(init,
    payer = stacking_creator,
    space = 8 ,
    seeds= [
    b"staked_tokens",
    stacking_creator.key.as_ref(),
    stacking_mint.key().as_ref(),
    [reward_policy_type].as_ref()
    ], bump
    )]
    staked_tokens: Account<'info, Empty>,
    #[account(init,
    payer = stacking_creator,
    space = 8,
    seeds= [
    b"reward_tokens",
    stacking_creator.key.as_ref(),
    stacking_mint.key().as_ref(),
    [reward_policy_type].as_ref()
    ], bump
    )]
    reward_tokens: Account<'info, Empty>,

    #[account(mut)]
    stacking_creator: Signer<'info>,
    factory_creator: Account<'info, FactoryCreator>,
    stacking_mint: Box<Account<'info, Mint>>,
    #[account(
    init,
    payer = stacking_creator,
    associated_token::mint = stacking_mint,
    associated_token::authority = staked_tokens,
    )]
    general_stake_pool: Box<Account<'info, TokenAccount>>,
    #[account(
    init,
    payer = stacking_creator,
    associated_token::mint = stacking_mint,
    associated_token::authority = free_tokens,
    )]
    general_free_pool: Box<Account<'info, TokenAccount>>,
    reward_mint: Box<Account<'info, Mint>>,
    #[account(
    init,
    payer = stacking_creator,
    associated_token::mint = reward_mint,
    associated_token::authority = reward_tokens,
    )]
    general_reward_pool: Box<Account<'info, TokenAccount>>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

#[account]
#[derive(Copy, Default, Debug)]
pub struct FactoryCreator {
    pub authority: Pubkey,
    pub fee_percent: u8,
}

#[account]
pub struct Staking {
    pub authority: Pubkey,
    pub mint: Pubkey,

    pub reward_token_account: Pubkey,
    pub staked_token_account: Pubkey,
    pub free_token_account: Pubkey,

    pub policy_params: Params,
    pub policy_type: RewardPolicy,
    pub factory_creator_fee_percent: u8,
    pub factory_creator: Pubkey,
}

impl Staking {
    pub fn space() -> usize {
        32 + // pub authority: Pubkey,
            32 + // pub mint: Pubkey,
            32 + // pub reward_mint_pool: Pubkey,
            32 + // pub staked_token_account: Pubkey,
            32 + // pub free_token_account: Pubkey,
            1 + //  pub policy_type: RewardPolicy,
            Params::space() + // pub policy_params: Params,

            1 + // pub factory_creator_fee_percent: u8,
            32 // pub factory_creator: Pubkey,
    }
    pub fn add_factory_creator(&mut self, fc: FactoryCreator) {
        self.factory_creator = fc.authority;
        self.factory_creator_fee_percent = fc.fee_percent;
    }
}

#[error_code]
pub enum MyError {
    MyError,
}

#[account]
pub struct Empty {}
