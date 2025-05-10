use anchor_lang::prelude::*;
use crate::state::{Marketplace, DeviceRegistry};
use crate::state::listing::ListingState;
use anchor_lang::solana_program::clock::Clock;

#[derive(Accounts)]
#[instruction(listing_id: [u8; 32])]  // Inform Anchor about listing_id for PDA bump
pub struct CreateListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [b"marketplace", marketplace.admin.as_ref()],
        bump = marketplace.bump,
        constraint = marketplace.is_active @ ErrorCode::MarketplaceInactive,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        seeds = [b"device", marketplace.key().as_ref(), device_registry.device_id.as_bytes()],
        bump = device_registry.bump,
        constraint = device_registry.owner == seller.key() @ ErrorCode::Unauthorized,
        constraint = device_registry.is_active @ ErrorCode::DeviceInactive,
    )]
    pub device_registry: Account<'info, DeviceRegistry>,

    #[account(
        init,
        payer = seller,
        seeds = [b"listing", device_registry.key().as_ref(), listing_id.as_ref()],
        bump,
        space = 8 + ListingState::INIT_SPACE,  // 8 (discriminator) + 429 (fields)
    )]
    pub listing_state: Account<'info, ListingState>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateListing>,
    listing_id: [u8; 32],
    data_cid: [u8; 64],
    price_per_unit: u64,
    device_id: [u8; 32],
    total_data_units: u64,
    unit_type: [u8; 32],
    access_key_hash: [u8; 32],
    data_type: [u8; 32],
    location: [u8; 64],
    expires_at: Option<i64>,
) -> Result<()> {
    let listing_state = &mut ctx.accounts.listing_state;
    let clock = Clock::get()?;

    // Input validation
    require!(!listing_id.iter().all(|&b| b == 0), ErrorCode::ListingIdEmpty);
    require!(price_per_unit > 0, ErrorCode::InvalidPrice);
    require!(total_data_units > 0, ErrorCode::InvalidDataUnits);
    require!(!data_cid.iter().all(|&b| b == 0), ErrorCode::DataCidEmpty);

    // Initialize listing state
    listing_state.seller = ctx.accounts.seller.key();
    listing_state.marketplace = ctx.accounts.marketplace.key();
    listing_state.device = ctx.accounts.device_registry.key();
    listing_state.data_cid = data_cid;
    listing_state.price_per_unit = price_per_unit;
    listing_state.status = 0; // Active
    listing_state.device_id = device_id;
    listing_state.total_data_units = total_data_units;
    listing_state.remaining_units   = total_data_units; 
    listing_state.unit_type = unit_type;
    listing_state.token_mint = ctx.accounts.marketplace.token_mint; // Derived from Marketplace
    listing_state.access_key_hash = access_key_hash;
    listing_state.data_type = data_type;
    listing_state.location = location;
    listing_state.created_at = clock.unix_timestamp;
    listing_state.updated_at = clock.unix_timestamp;
    listing_state.expires_at = expires_at;
    listing_state.bump = ctx.bumps.listing_state;
    listing_state.buyer = None;
    listing_state.sold_at = None;

    listing_state.purchase_count   = 0;

    msg!(
        "Listing created: {} for device: {}",
        String::from_utf8_lossy(&listing_id),
        String::from_utf8_lossy(&device_id)
    );

    Ok(())
}


#[error_code]
pub enum ErrorCode {
    #[msg("Marketplace is not active")]
    MarketplaceInactive,
    #[msg("Unauthorized: Seller does not own the device")]
    Unauthorized,
    #[msg("Device is not active")]
    DeviceInactive,
    #[msg("Listing ID cannot be empty")]
    ListingIdEmpty,
    #[msg("Price per unit must be greater than zero")]
    InvalidPrice,
    #[msg("Total data units must be greater than zero")]
    InvalidDataUnits,
    #[msg("Data CID cannot be empty")]
    DataCidEmpty,
}