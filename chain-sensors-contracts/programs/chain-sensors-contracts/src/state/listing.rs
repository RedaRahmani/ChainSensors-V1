use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ListingState {
    pub seller: Pubkey,
    pub marketplace: Pubkey,
    pub device: Pubkey,
    pub data_cid: [u8; 64],
    pub price_per_unit: u64,
    pub status: u8,
    pub device_id: [u8; 32],
    pub total_data_units: u64,
    pub remaining_units: u64,
    pub unit_type: [u8; 32],
    pub token_mint: Pubkey,
    pub access_key_hash: [u8; 32],
    pub data_type: [u8; 32],
    pub location: [u8; 64],
    pub created_at: i64,
    pub updated_at: i64,
    pub expires_at: Option<i64>,
    pub bump: u8,
    pub buyer: Option<Pubkey>,
    pub purchase_count: u64,
    pub sold_at: Option<i64>,
}