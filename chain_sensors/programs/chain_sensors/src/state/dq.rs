use anchor_lang::prelude::*;

#[account]
pub struct DqConfig {
    pub bump: u8,
    pub device: Pubkey,
    pub authority: Pubkey,
    pub expected_rate_hz: u32,
    pub stale_threshold_ms: u32,
    pub var_hi_q16_16: u32,
    pub var_lo_q16_16: u32,
    pub eps_q16_16: u32,
    pub reserved: [u8; 32],
}
impl DqConfig {
    pub const SPACE: usize = 8 + 1 + 32 + 32 + 4 + 4 + 4 + 4 + 4 + 32;
}

#[account]
pub struct DqState {
    pub bump: u8,
    pub device: Pubkey,
    pub last_window_start: i64,
    pub last_window_end: i64,
    pub last_quality_bps: u16,
    pub last_accuracy_u8: u8,
    pub window_count: u64,
    pub last_updated_ts: i64,
    pub last_acc_ciphertext_hash: [u8; 32],
    pub last_acc_nonce_le: [u8; 16],
    pub reserved: [u8; 16],
}
impl DqState {
    pub const SPACE: usize = 8 + 1 + 32 + 8 + 8 + 2 + 1 + 8 + 8 + 32 + 16 + 16;
}
