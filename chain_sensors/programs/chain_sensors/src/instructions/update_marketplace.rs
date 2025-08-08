use anchor_lang::prelude::*;
use crate::state::Marketplace;

#[derive(Accounts)]
pub struct UpdateMarketplace<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"marketplace", admin.key().as_ref()],
        bump = marketplace.bump,
        constraint = marketplace.admin == admin.key() @ ErrorCode::Unauthorized,
    )]
    pub marketplace: Account<'info, Marketplace>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UpdateMarketplace>,
    new_fee: Option<u16>,
    is_active: Option<bool>,
) -> Result<()> {
    let marketplace = &mut ctx.accounts.marketplace;

    // Update seller fee if provided
    if let Some(fee) = new_fee {
        require!(fee <= 10000, ErrorCode::InvalidFee); // Max 100%
        marketplace.seller_fee = fee;
    }

    // Update active status if provided
    if let Some(active) = is_active {
        marketplace.is_active = active;
    }

    msg!("Marketplace updated by admin: {}", ctx.accounts.admin.key());
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Only the marketplace admin can update settings")]
    Unauthorized,
    #[msg("Seller fee exceeds 100% (10,000 basis points)")]
    InvalidFee,
}
