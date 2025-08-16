use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

use crate::state::Marketplace;

#[derive(Accounts)]
#[instruction(name: String, seller_fee: u16)]
pub struct Initialize<'info> {
    /// Admin / marketplace owner
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Marketplace PDA (seeded by admin) — matches seeds used elsewhere
    #[account(
        init,
        payer = admin,
        seeds = [b"marketplace", admin.key().as_ref()],
        bump,
        space = 8 + Marketplace::INIT_SPACE,
    )]
    pub marketplace: Account<'info, Marketplace>,

    /// PDA authority for the treasury (no private key; authority-only)
    #[account(
        seeds = [b"treasury", admin.key().as_ref()],
        bump
    )]
    /// CHECK: PDA authority only; stored & checked via pubkey + bump
    pub treasury: UncheckedAccount<'info>,

    /// Treasury ATA for the marketplace mint, owned by the treasury PDA
    #[account(
        init,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_ata: Account<'info, TokenAccount>,

    /// Settlement mint (e.g., USDC)
    pub usdc_mint: Account<'info, Mint>,

    /// Programs / sysvars
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> Initialize<'info> {
    pub fn init(&mut self, name: String, seller_fee: u16, bumps: &InitializeBumps) -> Result<()> {
        // Validate inputs
        require!(!name.is_empty(), ErrorCode::NameEmpty);
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(
            name.chars().all(|c| c.is_alphanumeric() || c == ' ' || c == '_'),
            ErrorCode::InvalidNameChars
        );
        require!(seller_fee <= 10_000, ErrorCode::InvalidFee);

        self.marketplace.set_inner(Marketplace {
            admin: self.admin.key(),
            treasury: self.treasury.key(),           // PDA authority
            treasury_bump: bumps.treasury,           // store bump for later derivations
            seller_fee,
            token_mint: self.usdc_mint.key(),
            is_active: true,
            bump: bumps.marketplace,
            name,
            created_at: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Marketplace name exceeds 32 characters")]
    NameTooLong,
    #[msg("Seller fee exceeds 100% (10,000 basis points)")]
    InvalidFee,
    #[msg("Marketplace name cannot be empty")]
    NameEmpty,
    #[msg("Marketplace name contains invalid characters")]
    InvalidNameChars,
}
