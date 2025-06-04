use anchor_lang::prelude::*;
use light_account_checks::discriminator::Discriminator;
use light_hasher::{DataHasher, Poseidon};
use light_sdk::compressed_account::{
    CompressedAccount, CompressedAccountData, OutputCompressedAccountWithPackedContext,
};
use crate::state::CompressedDeviceRegistry;

use anchor_lang::prelude::error_code;

#[error_code]
pub enum ErrorCode {
    HashingError,
}

#[error_code]
pub enum ListingError {
    #[msg("Failed to hash compressed listing data")]
    HashingError,
}

pub fn create_output_account(
    signer: Pubkey,
    merkle_tree_index: u8,
    device_registry: CompressedDeviceRegistry,
    address: [u8; 32],
) -> Result<OutputCompressedAccountWithPackedContext> {
    let account_data = CompressedAccountData {
        discriminator: CompressedDeviceRegistry::discriminator(),
        data: device_registry.try_to_vec()?,
        data_hash: device_registry
            .hash::<Poseidon>()
            .map_err(|_| ErrorCode::HashingError)?,
    };
    Ok(OutputCompressedAccountWithPackedContext {
        compressed_account: CompressedAccount {
            owner: crate::ID,
            lamports: 0,
            address: Some(address),
            data: Some(account_data),
        },
        merkle_tree_index,
    })
}
