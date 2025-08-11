// programs/chain_sensors/src/state/job.rs
use anchor_lang::prelude::*;

#[account]
pub struct QualityJob {
    pub nonce: u128,
    pub bump: u8,
    pub created_at: i64,
}

impl QualityJob {
    pub const SEED: &'static [u8] = b"quality_job";
    // 8 bytes discriminator is added by Anchor at allocation time; keep SIZE to payload only.
    pub const SIZE: usize = 16 /*nonce*/ + 1 /*bump*/ + 8 /*ts*/;
}
