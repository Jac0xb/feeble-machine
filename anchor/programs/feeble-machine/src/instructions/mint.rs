use mpl_token_metadata::instruction::create_master_edition_v3;
use anchor_spl::associated_token::AssociatedToken;
use mpl_token_metadata::instruction::{create_metadata_accounts_v2, update_metadata_accounts_v2, sign_metadata};
use crate::PREFIX;
use anchor_lang::{
  prelude::*,
  solana_program::{
      program::{invoke_signed, invoke},
      system_instruction,
  },

  AnchorDeserialize, Key,
};
use anchor_spl::token::Token;
use spl_token::instruction::initialize_mint;
use spl_associated_token_account::create_associated_token_account;
use crate::state::*;

#[derive(Accounts)]
#[instruction(creator_bump: u8, index: u16)]
pub struct Mint<'info> {
    #[account(mut, seeds=[PREFIX.as_bytes(), authority.key().as_ref()], bump, has_one=authority)]
    pub machine: Box<Account<'info, FeebleMachine>>,

    #[account(init, seeds=["status".as_bytes(), machine.key().as_ref(), &index.to_le_bytes()], bump, payer = payer, space = 8 + 128 + std::mem::size_of::<MintStatus>())]
    pub mint_status: Box<Account<'info, MintStatus>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: CPI Checked
    #[account(mut)]
    pub reciept: UncheckedAccount<'info>,

    /// CHECK: CPI Checked
    pub authority: UncheckedAccount<'info>,

    /// CHECK: CPI Checked
    #[account(mut)]
    metadata: UncheckedAccount<'info>,

    /// CHECK: CPI Checked
    #[account(mut)]
    master_edition: UncheckedAccount<'info>,

    /// CHECK: CPI Checked
    #[account(seeds = [PREFIX.as_bytes(), machine.key().as_ref()], bump=creator_bump)]
    program_derived_creator: UncheckedAccount<'info>,

    /// CHECK: CPI Checked
    #[account(mut)]
    mint: Signer<'info>,

    /// CHECK: CPI Checked
    #[account(mut)]
    token_account: UncheckedAccount<'info>,

    #[account(mut, seeds=[machine.key().as_ref(), payer.key().as_ref()], bump)]
    whitelist: Box<Account<'info, Whitelist>>,

    /// CHECK: CPI Checked
    #[account(address = mpl_token_metadata::id())]
    token_metadata_program: UncheckedAccount<'info>,

    token_program: Program<'info, Token>,
    ata_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Mint>, creator_bump: u8, index: u16) -> Result<()> {
  let machine = &mut ctx.accounts.machine;
  let mint_status = &mut ctx.accounts.mint_status;
  let whitelist = &mut ctx.accounts.whitelist;

  if index >= machine.max_supply {
    return Err(error!(MintErrors::OutOfBounds))
  }

  if machine.locked {
    return Err(error!(MintErrors::Locked))
  }

  if !whitelist.unlimited && whitelist.mint_count >= whitelist.mint_limit {
    return Err(error!(MintErrors::ExcessiveMinting))
  }

  whitelist.mint_count += 1;


  mint_status.machine = ctx.accounts.machine.key();
  mint_status.minter = ctx.accounts.payer.key();
  mint_status.mint = ctx.accounts.mint.key();
  mint_status.index = index;

  create_nft(ctx, creator_bump, index)
}

pub fn create_nft(ctx: Context<Mint>, creator_bump: u8, index: u16) -> Result<()> {
  let machine = &mut ctx.accounts.machine;
  let machine_key = machine.key();

  let mint_layout_size = 82u64;
  let ix = system_instruction::create_account(
    ctx.accounts.payer.key, 
    ctx.accounts.mint.key,
    ctx.accounts.rent.minimum_balance(mint_layout_size as usize), 
    mint_layout_size,
    ctx.accounts.token_program.key
  );
  let accounts = vec![
    ctx.accounts.payer.to_account_info(),
    ctx.accounts.mint.to_account_info(),
  ];
  invoke(&ix, &accounts).unwrap();

  let authority_seeds = [PREFIX.as_bytes(), machine_key.as_ref(), &[creator_bump]];
  msg!("Initialize token mint.");
  let ix = initialize_mint(
    &ctx.accounts.token_program.key(), 
    &ctx.accounts.mint.key(), 
    &ctx.accounts.program_derived_creator.key(),
    Some(&ctx.accounts.program_derived_creator.key()),
    0
  ).unwrap();
  let accounts = vec![
    ctx.accounts.token_program.to_account_info(),
    ctx.accounts.mint.to_account_info(),
    ctx.accounts.rent.to_account_info()
  ];
  invoke_signed(&ix, &accounts, &[&authority_seeds]).unwrap();

  msg!("Create token account for payer.");
  let ix = create_associated_token_account(
    &ctx.accounts.payer.key(),
    &ctx.accounts.reciept.key(), 
    &ctx.accounts.mint.key() 
  );
  let accounts = vec![
    ctx.accounts.payer.to_account_info(),
    ctx.accounts.token_account.to_account_info(),
    ctx.accounts.reciept.to_account_info(),
    ctx.accounts.mint.to_account_info(),
    ctx.accounts.system_program.to_account_info(),
    ctx.accounts.token_program.to_account_info(),
    ctx.accounts.ata_program.to_account_info(),
    ctx.accounts.rent.to_account_info(),
  ];
  invoke(&ix, &accounts).unwrap();


  msg!("Mint one token to payer.");
  let ix = spl_token::instruction::mint_to(
    &ctx.accounts.token_program.key(), 
    &ctx.accounts.mint.key(), 
    &ctx.accounts.token_account.key(), 
    &ctx.accounts.program_derived_creator.key(),
    &[&ctx.accounts.program_derived_creator.key()],
    1
  ).unwrap();

  let accounts = vec![
    ctx.accounts.mint.to_account_info(),
    ctx.accounts.token_account.to_account_info(),
    ctx.accounts.program_derived_creator.to_account_info(),
    ctx.accounts.mint.to_account_info(),
  ];
  invoke_signed(&ix, &accounts, &[&authority_seeds]).unwrap();

  // Metadata
  let name = String::from(machine.name_prefix.clone() + " #" + &index.to_string());
  let symbol = machine.symbol.clone();
  let uri = String::from(machine.manifest_uri.clone() + "/" + &index.to_string() + ".json");

  // address gotta be a PDA
  let creators: Vec<mpl_token_metadata::state::Creator> =
  vec![
    mpl_token_metadata::state::Creator {
      address: ctx.accounts.program_derived_creator.key(),
      verified: false,
      share: 0,
    },  
    mpl_token_metadata::state::Creator {
      address: ctx.accounts.authority.key(),
      verified: false,
      share: 100,
  }];

  msg!("Creating metadata");
  let metadata_infos = vec![
    ctx.accounts.metadata.to_account_info(),
    ctx.accounts.mint.to_account_info(),
    ctx.accounts.authority.to_account_info(),
    ctx.accounts.program_derived_creator.to_account_info(),
    ctx.accounts.payer.to_account_info(),
    ctx.accounts.token_metadata_program.to_account_info(),
    ctx.accounts.token_program.to_account_info(),
    ctx.accounts.system_program.to_account_info(),
    ctx.accounts.rent.to_account_info(),
    ctx.accounts.program_derived_creator.to_account_info(),
  ];
  let ix = create_metadata_accounts_v2(
    ctx.accounts.token_metadata_program.key(),
    ctx.accounts.metadata.key(),
    ctx.accounts.mint.key(),
    ctx.accounts.program_derived_creator.key(),
    ctx.accounts.payer.key(),
    ctx.accounts.program_derived_creator.key(),
    name,
    symbol,
    uri,
    Some(creators),
    machine.seller_fee,
    false,
    true,
    None,
    None,
  );
  invoke_signed(
    &ix,
    metadata_infos.as_slice(),
    &[&authority_seeds],
  ).unwrap();

  msg!("Verify program creator");
  invoke_signed(
      &sign_metadata(
        ctx.accounts.token_metadata_program.key(), 
        ctx.accounts.metadata.key(), 
        ctx.accounts.program_derived_creator.key()
      ),
      vec![
          ctx.accounts.program_derived_creator.to_account_info(),
          ctx.accounts.metadata.to_account_info(),
          ctx.accounts.token_metadata_program.to_account_info(),
          ctx.accounts.system_program.to_account_info(),
          ctx.accounts.rent.to_account_info(),
      ].as_slice(),
      &[&authority_seeds],
  ).unwrap();

  msg!("Creating master edition");
  invoke_signed(
      &create_master_edition_v3(
          ctx.accounts.token_metadata_program.key(),
          ctx.accounts.master_edition.key(),
          ctx.accounts.mint.key(),
          ctx.accounts.program_derived_creator.key(),
          ctx.accounts.program_derived_creator.key(),
          ctx.accounts.metadata.key(),
          ctx.accounts.payer.key(),
          Some(0),
      ),
      vec![
          ctx.accounts.master_edition.to_account_info(),
          ctx.accounts.mint.to_account_info(),
          ctx.accounts.program_derived_creator.to_account_info(),
          ctx.accounts.payer.to_account_info(),
          ctx.accounts.metadata.to_account_info(),
          ctx.accounts.token_metadata_program.to_account_info(),
          ctx.accounts.token_program.to_account_info(),
          ctx.accounts.system_program.to_account_info(),
          ctx.accounts.rent.to_account_info(),
      ].as_slice(),
      &[&authority_seeds],
  ).unwrap();


msg!("Updating metadata");
  invoke_signed(
      &update_metadata_accounts_v2(
          ctx.accounts.token_metadata_program.key(),
          ctx.accounts.metadata.key(),
          ctx.accounts.program_derived_creator.key(),
          Some(ctx.accounts.authority.key()),
          None,
          Some(true),
          Some(true)
      ),
      &[
          ctx.accounts.token_metadata_program.to_account_info(),
          ctx.accounts.metadata.to_account_info(),
          ctx.accounts.program_derived_creator.to_account_info(),
          ctx.accounts.authority.to_account_info()
      ],
      &[&authority_seeds],
  ).unwrap();

  Ok(())
}

#[error_code]
pub enum MintErrors {
    // 6000
    #[msg("Mint was out of bounds.")]
    OutOfBounds,
    // 6001
    #[msg("Feeble machine is locked.")]
    Locked,
    // 6002
    #[msg("Whitelisted user has reached mint limit.")]
    ExcessiveMinting
}