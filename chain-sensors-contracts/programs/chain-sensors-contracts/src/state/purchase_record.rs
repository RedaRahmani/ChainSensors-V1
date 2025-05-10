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
}