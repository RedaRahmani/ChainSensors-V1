#[allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::Marketplace;

#[derive(Accounts)]
#[instruction(name: String, seller_fee: u16)]
pub struct Initialize<'info> {
    /// The admin who pays for and signs the transaction.
    #[account(mut)]
    pub admin: Signer<'info>,
    /// The marketplace account to be initialized.
    #[account(
        init,
        payer = admin,
        seeds = [b"marketplace", admin.key().as_ref()],
        bump,
        space = 8 + Marketplace::INIT_SPACE,
    )]
    pub marketplace: Account<'info, Marketplace>,
    /// The treasury token account for collecting fees.
    #[account(
        init,
        payer = admin,
        seeds = [b"treasury", admin.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = admin, // Program-controlled treasury
    )]
    pub treasury: Account<'info, TokenAccount>,
    /// The mint of the token used in the marketplace (e.g., USDC).
    pub usdc_mint: Account<'info, Mint>,
    /// The SPL Token program.
    pub token_program: Program<'info, Token>,
    /// The Solana System program.
    pub system_program: Program<'info, System>,
    /// Rent sysvar for account initialization.
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> Initialize<'info> {
    pub fn init(&mut self, name: String, seller_fee: u16, bumps : &InitializeBumps) -> Result<()> {
        // Validate inputs
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(seller_fee <= 10000, ErrorCode::InvalidFee);
        require!(name.chars().all(|c| c.is_alphanumeric() || c == ' ' || c == '_'), ErrorCode::InvalidNameChars);
        require!(!name.is_empty(), ErrorCode::NameEmpty);


        self.marketplace.set_inner(Marketplace{
            admin: self.admin.key(),
            treasury: self.treasury.key(),
            treasury_bump: bumps.treasury,
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