
use crate::PREFIX;
use anchor_lang::{
  prelude::*,
  Key,
};
use crate::state::*;

#[derive(Accounts)]
pub struct InitMachine<'info> {

    #[account(init, seeds=[PREFIX.as_bytes(), authority.key().as_ref()], bump, payer = authority, space = 8 + std::mem::size_of::<FeebleMachine>() + 256)]
    pub machine: Box<Account<'info, FeebleMachine>>,

    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitMachine>, uid: String, supply: u16, manifest_uri: String, name_prefix: String, symbol: String, seller_fee: u16) -> Result<()> {
    let machine = &mut ctx.accounts.machine;

    machine.uid = uid;
    machine.authority = ctx.accounts.authority.key();
    machine.max_supply = supply;
    machine.remaining_supply = supply;
    machine.manifest_uri = manifest_uri;
    machine.symbol = symbol;
    machine.name_prefix = name_prefix;
    machine.seller_fee = seller_fee;
    machine.locked = true;

  Ok(())
}
