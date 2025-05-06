use anchor_lang::prelude::*;
use crate::state::{Marketplace, ListingState, DeviceRegistry};

#[derive(Accounts)]
#[instruction(data_cid: String, price_per_unit: u64, total_data_units: u64, device_id: String, access_key_hash: [u8; 32], ek_pubkey_hash: [u8; 32], bump: u8)]
pub struct CreateListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        seeds = [b"marketplace", marketplace.admin.as_ref()],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,
    #[account(
        init,
        payer = seller,
        seeds = [b"listing", marketplace.key().as_ref(), seller.key().as_ref(), device_id.as_bytes()],
        bump,
        space = 8 + ListingState::INIT_SPACE,
    )]
    pub listing: Account<'info, ListingState>,
    #[account(
        seeds = [b"device", marketplace.key().as_ref(), device_id.as_bytes()],
        bump,
    )]
    pub device_registry: Account<'info, DeviceRegistry>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreateListing<'info> {
    pub fn handler(
        ctx: Context<Self>,
        data_cid: String,
        price_per_unit: u64,
        total_data_units: u64,
        device_id: String,
        access_key_hash: [u8; 32],
        ek_pubkey_hash: [u8; 32],
        bump: u8,
    ) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        let marketplace = &ctx.accounts.marketplace;
        let device_registry = &ctx.accounts.device_registry;

        // Validate marketplace is active
        require!(marketplace.is_active, ErrorCode::InactiveMarketplace);

        // Validate device is registered and active
        require!(
            device_registry.is_active,
            ErrorCode::InvalidDeviceId
        );
        require!(
            device_registry.device_id == device_id,
            ErrorCode::InvalidDeviceId
        );

        // Validate price
        require!(price_per_unit > 0, ErrorCode::InvalidPrice);

        // Validate total data units
        require!(total_data_units > 0, ErrorCode::InvalidDataUnits);

        // Validate data CID (non-empty and reasonable length)
        require!(!data_cid.is_empty(), ErrorCode::InvalidDataCid);
        require!(data_cid.len() <= 64, ErrorCode::InvalidDataCid); // Allow up to 64 chars

        // Validate device ID (non-empty and ASCII)
        require!(!device_id.is_empty(), ErrorCode::InvalidDeviceId);
        require!(
            device_id.chars().all(|c| c.is_ascii()),
            ErrorCode::InvalidDeviceId
        );

        // Validate access key hash (non-zero)
        require!(access_key_hash.iter().any(|&x| x != 0), ErrorCode::InvalidAccessKey);

        // Clone device_id for use in ListingState
        let device_id_for_state = device_id.clone();

        // Initialize listing state
        listing.set_inner(ListingState {
            seller: ctx.accounts.seller.key(),
            marketplace: marketplace.key(),
            data_cid,
            price_per_unit,
            status: 0, // Active
            device_id: device_id_for_state, // Use the clone here
            total_data_units,
            access_key_hash,
            ek_pubkey_hash,
            bump,
        });

        // Now device_id is still usable because it wasn't moved
        msg!("Listing created for device: {}", device_id);
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Marketplace is inactive")]
    InactiveMarketplace,
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Total data units must be greater than zero")]
    InvalidDataUnits,
    #[msg("Invalid data CID provided")]
    InvalidDataCid,
    #[msg("Invalid device ID provided")]
    InvalidDeviceId,
    #[msg("Invalid access key hash provided")]
    InvalidAccessKey,
}