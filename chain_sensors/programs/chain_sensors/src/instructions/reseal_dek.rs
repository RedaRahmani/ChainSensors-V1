use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use crate::ResealDek;
use crate::ErrorCode;


pub fn handler(
    ctx: Context<ResealDek>,
    computation_offset: u64,
    nonce: u128,
    buyer_x25519_pubkey: [u8; 32],
    c0: [u8; 32],
    c1: [u8; 32],
    c2: [u8; 32],
    c3: [u8; 32],
) -> Result<()> {
    require!(computation_offset != 0, ErrorCode::ClusterNotSet);

    // reseal_dek(mxe_dek: Enc<Mxe, [u64;4]>, buyer: Shared)
    // Enc<Mxe,_> => PlaintextU128(nonce) then ciphertext limbs
    // Shared     => ArcisPubkey at the Shared param position
    let args = vec![
        Argument::PlaintextU128(nonce),
        Argument::EncryptedU64(c0),
        Argument::EncryptedU64(c1),
        Argument::EncryptedU64(c2),
        Argument::EncryptedU64(c3),
        Argument::ArcisPubkey(buyer_x25519_pubkey),
    ];

    queue_computation(ctx.accounts, computation_offset, args, vec![], None)?;
    Ok(())
}