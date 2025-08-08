use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Marketplace {
    pub admin: Pubkey,          // Administrator's public key
    pub treasury: Pubkey,       // Treasury account PDA where fees are collected
    pub treasury_bump: u8,      // Bump seed for deriving the treasury PDA
    pub seller_fee: u16,        // Fee charged to sellers in basis points (e.g., 500 = 5%)
    pub token_mint: Pubkey,     // Mint address of the token used for transactions (e.g., SOL or USDC)
    pub is_active: bool,        // Whether the marketplace is operational
    pub bump: u8,              // Bump seed for the marketplace PDA
    #[max_len(32)]
    pub name: String,        // Fixed-size name
    pub created_at: i64,
}
