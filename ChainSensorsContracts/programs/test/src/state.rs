use anchor_lang::prelude::*;
use light_account_checks::discriminator::Discriminator;
use light_sdk_macros::{LightDiscriminator, LightHasher};

#[account]
#[derive(InitSpace)]
pub struct Marketplace {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub treasury_bump: u8,
    pub seller_fee: u16,
    pub token_mint: Pubkey,
    pub is_active: bool,
    pub bump: u8,
    #[max_len(32)]
    pub name: String,
    pub created_at: i64,
}

#[derive(
    Clone,
    Debug,
    Default,
    anchor_lang::AnchorDeserialize,
    anchor_lang::AnchorSerialize,
    LightDiscriminator,
    LightHasher,
)]
pub struct CompressedDeviceRegistry {
    #[hash]
    pub owner: Pubkey,
    #[hash]
    pub marketplace: Pubkey,
    #[hash]
    pub device_id: [u8; 32], // Fixed-size array
    #[hash]
    pub ek_pubkey_hash: [u8; 32],
    pub bump: u8,
    #[hash]
    pub device_type: [u8; 32], // Fixed-size array
    pub created_at: i64,
    #[hash]
    pub data_type: [u8; 32], // Fixed-size array
}

#[account]
#[derive(InitSpace)]
pub struct ListingState {
    pub seller:          Pubkey,
    pub marketplace:     Pubkey,
    pub device:          Pubkey,
    #[max_len(32)]
    pub device_id: String,
    #[max_len(32)]
    pub listing_id: String,
    #[max_len(64)]
    pub data_cid:        String,
    pub price_per_unit:  u64,
    pub status:          u8,
    pub total_data_units: u64,
    pub remaining_units: u64,
    pub token_mint:      Pubkey,
    pub created_at:      i64,
    pub updated_at:      i64,
    pub expires_at:      Option<i64>,
    pub bump:            u8,
    pub buyer:           Option<Pubkey>,
    pub purchase_count:  u64,
    pub sold_at:         Option<i64>,
}

#[account]
#[derive(InitSpace)]
pub struct PurchaseRecord {
    // Which listing this purchase belongs to
    pub listing: Pubkey,
    // Who bought
    pub buyer: Pubkey,
    // How many units purchased in this tx
    pub units_purchased: u64,
    // Total price paid (before fee)
    pub price_paid: u64,
    // Marketplace fee amount
    pub fee: u64,
    // Unix timestamp of the purchase
    pub timestamp: i64,
}