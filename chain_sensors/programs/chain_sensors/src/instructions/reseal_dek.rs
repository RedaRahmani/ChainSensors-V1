use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use crate::ChainSensorsErrorCode;

// Reuse the SAME accounts struct as compute_accuracy
// so we inherit the QueueCompAccs<'info> implementation.
use super::compute_accuracy::ComputeAccuracyScore;

pub fn handler(
    // NOTE: reuse ComputeAccuracyScore accounts!
    mut ctx: Context<ComputeAccuracyScore>,
    computation_offset: u64,          // COMP_DEF_OFFSET_RESEAL_DEK as u64
    nonce: u128,                      // Arcis nonce
    buyer_x25519_pubkey: [u8; 32],    // public param
    c0: [u8; 32],                     // EncryptedU64 chunk 0 (MXE)
    c1: [u8; 32],
    c2: [u8; 32],
    c3: [u8; 32],
) -> Result<()> {
    require!(computation_offset != 0, ChainSensorsErrorCode::ClusterNotSet);

    // Persist nonce & audit info into the existing Job PDA (same as accuracy ix)
    let clock = Clock::get()?;
    ctx.accounts.job_pda.nonce = nonce;
    ctx.accounts.job_pda.bump = ctx.bumps.job_pda;
    ctx.accounts.job_pda.created_at = clock.unix_timestamp;

    // Arguments for the encrypted-ix (reseal_dek)
    let args = vec![
        Argument::ArcisPubkey(buyer_x25519_pubkey), // public input
        Argument::PlaintextU128(nonce),
        Argument::EncryptedU64(c0),
        Argument::EncryptedU64(c1),
        Argument::EncryptedU64(c2),
        Argument::EncryptedU64(c3),
    ];

    // No on-chain callback for reseal (off-chain backend will fetch result),
    // so callback_url = None. If you later add a webhook, pass Some(url).
    queue_computation(ctx.accounts, computation_offset, args, vec![], None)?;
    Ok(())
}
