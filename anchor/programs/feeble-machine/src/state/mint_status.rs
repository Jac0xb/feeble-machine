use anchor_lang::prelude::*;

#[account]
pub struct MintStatus {
    pub machine: Pubkey,
    pub minter: Pubkey,
    pub mint: Pubkey,
    pub index: u16,
}