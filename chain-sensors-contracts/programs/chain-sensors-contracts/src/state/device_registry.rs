use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct DeviceRegistry {
    pub owner: Pubkey,          // The owner of the device (seller)
    pub marketplace: Pubkey,    // The marketplace this device is registered under
    #[max_len(32)]
    pub device_id: String,      // Unique device ID within the marketplace
    pub ek_pubkey_hash: [u8; 32], // Simulated TPM EK public key hash (SHA-256, 32 bytes)
    pub bump: u8,               // Bump seed for the PDA
    #[max_len(32)]
    pub device_type: String,      // Type of device (e.g., "sensor", "camera")
    #[max_len(32)]
    pub location: String,      // Location of the device (e.g., "Morocco, Casablanca", "USA, New York")
    pub created_at: i64,        // Timestamp of device registration
    pub updated_at: i64,        // Timestamp of last update
    pub is_active: bool,        // Whether the device is active
    pub expires_at: Option<i64>, // Optional expiration timestamp for the device registration
    pub price_per_unit: u64,    // Price per data unit in the marketplace
    #[max_len(32)]
    pub data_type: String,      // Type of data the device collects (e.g., "temperature", "humidity")
    #[max_len(32)]
    pub data_unit: String,      // Unit of measurement for the data (e.g., "Celsius", "Fahrenheit")
    pub total_data_units: u64,  // Total number of data units the device can collect
    #[max_len(32)]
    pub data_cid: String,       // CID of the data stored on IPFS
    pub access_key_hash: [u8; 32], // Hash of the access key for the device (SHA-256, 32 bytes)
    pub is_verified: bool,      // Whether the device is verified
}