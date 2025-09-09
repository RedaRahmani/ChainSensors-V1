// programs/chain_sensors/src/instructions/reseal_dek.rs
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

// NOTE: Do NOT import crate::ResealDek here; if the macro expansion

use crate::ErrorCode;

pub fn handler(
    ctx: Context<crate::ResealDek>, // fully qualify to avoid fragile import
    computation_offset: u64,
    nonce: u128,
    buyer_x25519_pubkey: [u8; 32],
    // EncryptedU64 in Arcium uses 32-byte arrays
    c0: [u8; 32],
    c1: [u8; 32],
    c2: [u8; 32],
    c3: [u8; 32],
) -> Result<()> {
    //require!(computation_offset != 0, ErrorCode::ClusterNotSet);


    let args = vec![
        Argument::PlaintextU128(nonce),
        Argument::EncryptedU64(c0),
        Argument::EncryptedU64(c1),
        Argument::EncryptedU64(c2),
        Argument::EncryptedU64(c3),
        Argument::ArcisPubkey(buyer_x25519_pubkey),
    ];

    // Must match ResealDekCallback custom account order; record writable.
    let cb_accounts = vec![
        CallbackAccount { pubkey: ctx.accounts.listing_state.key(),  is_writable: false },
        CallbackAccount { pubkey: ctx.accounts.purchase_record.key(), is_writable: true  },
    ];

    queue_computation(ctx.accounts, computation_offset, args, cb_accounts, None)?;
    Ok(())
}
