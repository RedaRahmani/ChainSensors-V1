#[allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use crate::state::{Marketplace, ListingState};

#[derive(Accounts)]
#[instruction(device_id: String)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        mut,
        seeds = [b"listing", marketplace.key().as_ref(), seller.key().as_ref(), device_id.as_bytes()],
        bump,
    )]
    pub listing: Account<'info, ListingState>,
    #[account(
        seeds = [b"marketplace", marketplace.admin.as_ref()],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,
}

impl<'info> CancelListing<'info> {
    pub fn handler(ctx: Context<Self>, device_id: String) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        let seller = &ctx.accounts.seller;

        // Check that the caller is the seller
        require!(listing.seller == seller.key(), ErrorCode::Unauthorized);

        // Check that the listing is active
        require!(listing.status == 0, ErrorCode::ListingNotActive);

        // Set status to cancelled
        listing.status = 2;

        msg!("Listing cancelled for device: {}", device_id);
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized: Only the seller can cancel the listing")]
    Unauthorized,
    #[msg("Listing is not active")]
    ListingNotActive,
}