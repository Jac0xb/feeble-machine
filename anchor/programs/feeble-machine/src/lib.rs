use anchor_lang::prelude::*;
use crate::instructions::*;

pub mod instructions;
pub mod state;

declare_id!("VENDzam3eJ4Kn8KmVndH7qdF23jMf3NkogyLvA5XJxV");

const PREFIX: &str = "FEEBLE";

#[program]
pub mod feeble_machine {
  use super::*;

  pub fn init_machine(ctx: Context<InitMachine>, uid: String, supply: u16, arweave_manifest_ui: String, name_prefix: String, symbol: String, seller_fee: u16) -> Result<()> {
    instructions::init_machine::handler(ctx, uid, supply, arweave_manifest_ui, name_prefix, symbol, seller_fee)
  }

  pub fn update_machine(ctx: Context<UpdateMachine>, arweave_manifest_ui: Option<String>, name_prefix: Option<String>, symbol: Option<String>, seller_fee: Option<u16>) -> Result<()> {
    instructions::update_machine::handler(ctx, arweave_manifest_ui, name_prefix, symbol, seller_fee)
  }

  pub fn mint(ctx: Context<Mint>, creator_bump: u8, index: u16) -> Result<()> {
    instructions::mint::handler(ctx, creator_bump, index)
  }

  pub fn whitelist_user(ctx: Context<WhitelistUser>, mint_limit: u8) -> Result<()> {
    instructions::whitelist_user::handler(ctx, mint_limit)
  }

  pub fn update_whitelist(ctx: Context<UpdateWhitelist>, mint_limit: u8) -> Result<()> {
    instructions::update_whitelist::handler(ctx, mint_limit)
  }

  pub fn toggle_lock(ctx: Context<ToggleLock>, flag: bool) -> Result<()> {
    instructions::toggle_lock::handler(ctx, flag)
  }

  pub fn whitelist_set_mint_limit(ctx: Context<WhitelistSetMintLimit>, amount: u8) -> Result<()> {
    instructions::whitelist_set_mint_limit::handler(ctx, amount)
  }
}