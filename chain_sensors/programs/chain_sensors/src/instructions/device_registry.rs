use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use crate::state::Marketplace;
use crate::state::device_registry::DeviceRegistry;

#[derive(Accounts)]
#[instruction(device_id: String)]
pub struct RegisterDevice<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        seeds = [b"marketplace", marketplace.admin.as_ref()],
        bump = marketplace.bump,
        constraint = marketplace.is_active @ ErrorCode::MarketplaceInactive,
    )]
    pub marketplace: Account<'info, Marketplace>,
    #[account(
        init,
        payer = owner,
        seeds = [b"device", marketplace.key().as_ref(), device_id.as_bytes()],
        bump,
        space = 8 + DeviceRegistry::INIT_SPACE,
    )]
    pub device_registry: Account<'info, DeviceRegistry>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<RegisterDevice>,
    device_id: String,
    ek_pubkey_hash: [u8; 32],
    device_type: String,
    location: String,
    data_type: String,
    data_unit: String,
    price_per_unit: u64,
    total_data_units: u64,
    data_cid: String,
    access_key_hash: [u8; 32],
    expires_at: Option<i64>,
) -> Result<()> {
    let device_registry = &mut ctx.accounts.device_registry;
    let clock = Clock::get()?;

    // Input validation
    require!(!device_id.is_empty(), ErrorCode::DeviceIdEmpty);
    require!(device_id.len() <= 32, ErrorCode::DeviceIdTooLong);
    require!(device_type.len() <= 32, ErrorCode::DeviceTypeTooLong);
    require!(location.len() <= 32, ErrorCode::LocationTooLong);
    require!(data_type.len() <= 32, ErrorCode::DataTypeTooLong);
    require!(data_unit.len() <= 32, ErrorCode::DataUnitTooLong);
    require!(data_cid.len() <= 64, ErrorCode::DataCidTooLong);
    // Optional: Add business logic checks
    require!(price_per_unit > 0, ErrorCode::InvalidPrice);
    require!(total_data_units > 0, ErrorCode::InvalidDataUnits);

    // Initialize device registry fields
    device_registry.owner = ctx.accounts.owner.key();
    device_registry.marketplace = ctx.accounts.marketplace.key();
    device_registry.device_id = device_id;
    device_registry.ek_pubkey_hash = ek_pubkey_hash;
    device_registry.bump = ctx.bumps.device_registry;
    device_registry.device_type = device_type;
    device_registry.location = location;
    device_registry.created_at = clock.unix_timestamp;
    device_registry.updated_at = clock.unix_timestamp;
    device_registry.is_active = true;
    device_registry.expires_at = expires_at;
    device_registry.price_per_unit = price_per_unit;
    device_registry.data_type = data_type;
    device_registry.data_unit = data_unit;
    device_registry.total_data_units = total_data_units;
    device_registry.data_cid = data_cid;
    device_registry.access_key_hash = access_key_hash;
    device_registry.is_verified = true; // Default to true, update via separate instruction if needed

    msg!("Device registered: {} under marketplace: {}", 
        device_registry.device_id, 
        device_registry.marketplace
    );

    Ok(())
}

// Error codes for the instruction
#[error_code]
pub enum ErrorCode {
    #[msg("Marketplace is not active")]
    MarketplaceInactive,
    #[msg("Device ID cannot be empty")]
    DeviceIdEmpty,
    #[msg("Device ID exceeds 32 characters")]
    DeviceIdTooLong,
    #[msg("Device type exceeds 32 characters")]
    DeviceTypeTooLong,
    #[msg("Location exceeds 32 characters")]
    LocationTooLong,
    #[msg("Data type exceeds 32 characters")]
    DataTypeTooLong,
    #[msg("Data unit exceeds 32 characters")]
    DataUnitTooLong,
    #[msg("Data CID exceeds 64 characters")]
    DataCidTooLong,
    #[msg("Price per unit must be greater than zero")]
    InvalidPrice,
    #[msg("Total data units must be greater than zero")]
    InvalidDataUnits,
}
