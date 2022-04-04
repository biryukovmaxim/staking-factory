use anchor_lang::prelude::*;

mod stacking_params;

declare_id!("DBa1q9iY3ZrvXBgEpVq453adWqZUrVDmRQztiW6FRJek");

#[program]
pub mod staking_factory {
    use super::*;
    // use anchor_spl::token;

    pub fn initialize(ctx: Context<Initialize>, fee_percent: u8) -> Result<()> {
        ctx.accounts.creator_pda.fee_percent = fee_percent;
        ctx.accounts.creator_pda.authority = ctx.accounts.factory_creator.key();
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(fee_percent: u8)]
pub struct Initialize<'info> {
    #[account(init,
    payer = factory_creator,
    space = 8 + 32 + 1,
    seeds= [b"factory_creator"], bump
    )]
    creator_pda: Account<'info, FactoryCreator>,
    #[account(mut)]
    factory_creator: Signer<'info>,
    system_program: Program<'info, System>,
}

#[account]
pub struct FactoryCreator {
    pub authority: Pubkey,
    pub fee_percent: u8,
}
