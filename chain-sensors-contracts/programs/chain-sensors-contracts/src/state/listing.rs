use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ListingState {
    pub seller: Pubkey,          // The public key of the seller
    pub marketplace: Pubkey,     // The public key of the marketplace
    #[max_len(64)]
    pub data_cid: String,        // The CID for the data stream on Walrus
    pub price_per_unit: u64,     // The price per unit of data in USDC lamports
    pub status: u8,              // The status of the listing: 0 = Active, 1 = Sold, 2 = Cancelled
    #[max_len(32)]
    pub device_id: String,       // The unique identifier for the IoT device
    pub total_data_units: u64,   // The total number of data units available for purchase
    pub access_key_hash: [u8; 32], // The hash of the access key for decrypting the data stream
    pub ek_pubkey_hash: [u8; 32], // Hash of the TPM's EK public key
    pub bump: u8,                // The bump seed for the PDA
}