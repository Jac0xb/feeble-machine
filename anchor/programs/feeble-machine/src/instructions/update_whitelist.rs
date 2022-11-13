use anchor_lang::{
  prelude::*,
  Key,
};

use crate::state::*;

#[derive(Accounts)]
pub struct UpdateWhitelist<'info> {
    /// CHECK: Doesn't really matter who we whitelist.
    pub user: UncheckedAccount<'info>,

    #[account(mut, seeds=[machine.key().as_ref(), user.key().as_ref()], bump)]
    pub whitelist: Box<Account<'info, Whitelist>>,

    // state
    #[account(has_one=authority)]
    pub machine: Box<Account<'info, FeebleMachine>>,

    // machine authority
    #[account(mut)]
    pub authority: Signer<'info>,
    
    // programs
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<UpdateWhitelist>, mint_limit: u8) -> Result<()> {
    let whitelist = &mut ctx.accounts.whitelist;

    whitelist.mint_limit = mint_limit;

    Ok(())
}
