use anchor_lang::prelude::*;
use crate::state::ListingState;
use crate::state::device_registry::DeviceRegistry;
use anchor_lang::solana_program::clock::Clock;

#[derive(Accounts)]
#[instruction(listing_id: [u8; 32])]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"listing", device_registry.key().as_ref(), listing_id.as_ref()],
        bump = listing_state.bump,
        constraint = listing_state.seller == seller.key() @ ErrorCode::Unauthorized,
        constraint = listing_state.status == 0 @ ErrorCode::InvalidStatus, // Only active listings
    )]
    pub listing_state: Account<'info, ListingState>,

    // Required since it's part of the PDA seeds
    pub device_registry: Account<'info, DeviceRegistry>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelListing>, listing_id: [u8; 32]) -> Result<()> {
    let listing = &mut ctx.accounts.listing_state;
    listing.status = 2; // Cancelled
    listing.updated_at = Clock::get()?.unix_timestamp;
    msg!("Cancelled listing: {}", String::from_utf8_lossy(&listing_id));
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Only the seller can cancel the listing")]
    Unauthorized,
    #[msg("Listing is not active")]
    InvalidStatus,
}