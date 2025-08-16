use anchor_lang::prelude::*;

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

    // Buyer's ephemeral X25519 pubkey (for e2e re-seal grant)
    pub buyer_x25519_pubkey: [u8; 32],
    #[max_len(64)]
    pub dek_capsule_for_mxe_cid: String,
    #[max_len(64)]
    pub dek_capsule_for_buyer_cid: String,
}
