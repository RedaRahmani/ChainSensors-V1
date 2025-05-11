#[allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

mod instructions;
mod state;

use instructions::Initialize;
use crate::instructions::*;
use instructions::RegisterDevice;
use instructions::PurchaseListing;



declare_id!("E3yceGcwF38aFzoJHzmNGGZKEk9bmMqZRNTvQ8ehVms3");

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
        listing_id: String,
        data_cid:   String,
        price_per_unit: u64,
        device_id:  String,
        total_data_units: u64,
        expires_at: Option<i64>,
    ) -> Result<()> {
        instructions::create_listing::handler(
            ctx,
            listing_id,
            data_cid,
            price_per_unit,
            device_id,
            total_data_units,
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
