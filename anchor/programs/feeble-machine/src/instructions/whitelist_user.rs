
use crate::PREFIX;
use anchor_lang::{
  prelude::*,
  Key,
};

use crate::state::*;

#[derive(Accounts)]
pub struct WhitelistUser<'info> {
    /// CHECK: Doesn't really matter who we whitelist.
    pub user: UncheckedAccount<'info>,

    #[account(init, seeds=[machine.key().as_ref(), user.key().as_ref()], bump, payer = authority, space = 8 + std::mem::size_of::<WhitelistUser>())]
    pub whitelist: Box<Account<'info, Whitelist>>,
    
    #[account(seeds=[PREFIX.as_bytes(), authority.key().as_ref()], bump, has_one=authority)]
    pub machine: Box<Account<'info, FeebleMachine>>,
    
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WhitelistUser>, mint_limit: u8) -> Result<()> {
    let whitelist = &mut ctx.accounts.whitelist;

    whitelist.user = ctx.accounts.user.key();
    whitelist.machine = ctx.accounts.machine.key();
    whitelist.mint_limit = mint_limit;
    whitelist.mint_count = 0; 

    Ok(())
}
