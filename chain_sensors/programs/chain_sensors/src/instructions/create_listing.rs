use anchor_lang::prelude::*;
use crate::state::{Marketplace, DeviceRegistry};
use crate::state::listing::ListingState;
use anchor_lang::solana_program::clock::Clock;

#[derive(Accounts)]
#[instruction(listing_id: String)]
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
        seeds = [
          b"listing",
          device_registry.key().as_ref(),
          listing_id.as_bytes()
        ],
        bump,
        space = 8 + ListingState::INIT_SPACE,
    )]
    pub listing_state: Account<'info, ListingState>,

    pub system_program: Program<'info, System>,
    pub rent:            Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateListing>,
    listing_id: String,
    data_cid:   String,
    dek_capsule_for_mxe_cid: String, // NEW
    price_per_unit: u64,
    device_id:  String,
    total_data_units: u64,
    expires_at: Option<i64>,
) -> Result<()> {
    let l = &mut ctx.accounts.listing_state;
    let clock = Clock::get()?;

    // Input validation
    require!(!listing_id.is_empty(), ErrorCode::ListingIdEmpty);
    require!(!device_id.is_empty(),  ErrorCode::DeviceIdEmpty);
    require!(!data_cid.is_empty(),   ErrorCode::DataCidEmpty);
    require!(!dek_capsule_for_mxe_cid.is_empty(), ErrorCode::DekCapsuleCidEmpty);
    require!(dek_capsule_for_mxe_cid.len() <= 64, ErrorCode::DekCapsuleCidTooLong);
    require!(price_per_unit > 0,     ErrorCode::InvalidPrice);
    require!(total_data_units > 0,   ErrorCode::InvalidDataUnits);

    // Initialize
    l.seller           = ctx.accounts.seller.key();
    l.marketplace      = ctx.accounts.marketplace.key();
    l.device           = ctx.accounts.device_registry.key();
    l.device_id        = device_id.clone();
    l.listing_id       = listing_id.clone();
    l.data_cid         = data_cid;
    l.dek_capsule_for_mxe_cid = dek_capsule_for_mxe_cid; // NEW
    l.price_per_unit   = price_per_unit;
    l.status           = 0;
    l.total_data_units = total_data_units;
    l.remaining_units  = total_data_units;
    l.token_mint       = ctx.accounts.marketplace.token_mint;
    l.created_at       = clock.unix_timestamp;
    l.updated_at       = clock.unix_timestamp;
    l.expires_at       = expires_at;
    l.bump             = ctx.bumps.listing_state;
    l.buyer            = None;
    l.purchase_count   = 0;
    l.sold_at          = None;

    msg!("Listing created: {} for device: {}", listing_id, device_id);
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
    #[msg("Device ID cannot be empty")]
    DeviceIdEmpty,
    #[msg("Data CID cannot be empty")]
    DataCidEmpty,
    #[msg("Price per unit must be greater than zero")]
    InvalidPrice,
    #[msg("Total data units must be greater than zero")]
    InvalidDataUnits,
    #[msg("DEK capsule CID exceeds 64 characters")]
    DekCapsuleCidTooLong,
    #[msg("DEK capsule CID cannot be empty")]
    DekCapsuleCidEmpty,
}
