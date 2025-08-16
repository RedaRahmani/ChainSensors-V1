use anchor_lang::prelude::*;

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
    pub data_cid: String,
    #[max_len(64)]
    pub dek_capsule_for_mxe_cid: String,
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
