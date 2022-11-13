use anchor_lang::prelude::*;

#[account]
pub struct Whitelist {
    pub user: Pubkey,
    pub machine: Pubkey,
    pub mint_limit: u8,
    pub mint_count: u8,
    pub unlimited: bool,
}