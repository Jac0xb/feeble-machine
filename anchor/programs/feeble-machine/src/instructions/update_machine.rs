
use crate::PREFIX;
use anchor_lang::{
  prelude::*,
  Key,
};
use crate::state::*;

#[derive(Accounts)]
pub struct UpdateMachine<'info> {
    // machine
    #[account(mut, seeds=[PREFIX.as_bytes(), authority.key().as_ref()], bump, has_one=authority)]
    pub machine: Box<Account<'info, FeebleMachine>>,

    // machine authority
    #[account(mut)]
    pub authority: Signer<'info>,

    // programs
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<UpdateMachine>, manifest_uri: Option<String>, name_prefix: Option<String>, symbol: Option<String>, seller_fee: Option<u16>) -> Result<()> {
    let machine = &mut ctx.accounts.machine;

    if manifest_uri.is_some() {
      machine.manifest_uri = manifest_uri.unwrap();
    }
    if symbol.is_some() {
      machine.symbol = symbol.unwrap();
    }
    if name_prefix.is_some() {
      machine.name_prefix = name_prefix.unwrap();
    }
    if seller_fee.is_some() {
      machine.seller_fee = seller_fee.unwrap();
    }

  Ok(())
}
