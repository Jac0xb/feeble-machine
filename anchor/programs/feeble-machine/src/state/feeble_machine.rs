use anchor_lang::prelude::*;

#[account]
pub struct FeebleMachine {
    pub authority: Pubkey,
    pub uid: String,
    pub max_supply: u16,
    pub remaining_supply: u16,
    pub manifest_uri: String,
    pub symbol: String,
    pub name_prefix: String,
    pub seller_fee: u16,
    pub locked: bool
}