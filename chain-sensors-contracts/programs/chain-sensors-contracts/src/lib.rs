#[allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

mod instructions;
mod state;

use instructions::Initialize;
use crate::instructions::*;
use instructions::RegisterDevice;
use instructions::PurchaseListing;



declare_id!("2br92QQ6NsTZV5Scny6nfh6JvQmUMobd7JDHSTasAgYK");

#[program]
pub mod chainsensors {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, name: String, fee: u16, ) -> Result<()> {
        ctx.accounts.init(name, fee, &ctx.bumps)?;
        Ok(())
    }

    pub fn register_device(
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
        instructions::device_registry::handler(
            ctx,
            device_id,
            ek_pubkey_hash,
            device_type,
            location,
            data_type,
            data_unit,
            price_per_unit,
            total_data_units,
            data_cid,
            access_key_hash,
            expires_at,
        )
    }

    pub fn create_listing(
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
        instructions::create_listing::handler(
            ctx,
            listing_id,
            data_cid,
            price_per_unit,
            device_id,
            total_data_units,
            unit_type,
            access_key_hash,
            data_type,
            location,
            expires_at,
        )
    }

    pub fn cancel_listing(ctx: Context<CancelListing>, listing_id: [u8; 32]) -> Result<()> {
        instructions::cancel_listing::handler(ctx, listing_id)
    }

    pub fn purchase_listing(
        ctx: Context<PurchaseListing>,
        listing_id: [u8; 32],
        units_requested: u64,
    ) -> Result<()> {
        instructions::purchase_listing::handler(ctx, listing_id, units_requested)
    }
}
