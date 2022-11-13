
use crate::PREFIX;
use anchor_lang::{
  prelude::*,
  Key,
};
use crate::state::*;

#[derive(Accounts)]
pub struct ToggleLock<'info> {
    #[account(mut, seeds=[PREFIX.as_bytes(), authority.key().as_ref()], bump)]
    pub machine: Box<Account<'info, FeebleMachine>>,

    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ToggleLock>, toggle: bool) -> Result<()> {
    let machine = &mut ctx.accounts.machine;

    machine.locked = toggle;
    Ok(())
}