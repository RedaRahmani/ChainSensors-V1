use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use crate::state::{Marketplace, DeviceRegistry, DeviceMetadata};
use light_sdk::address::{derive_address, derive_address_seed, NewAddressParamsPacked};
use light_sdk::merkle_context::AddressMerkleContext;
use light_hasher::{DataHasher, Poseidon, HasherError};
use light_sdk::compressed_account::{CompressedAccount, CompressedAccountData, OutputCompressedAccountWithPackedContext};
use light_sdk::verify;
use light_sdk::merkle_context::PackedAddressMerkleContext;
use light_sdk::proof::CompressedProof;
use crate::types::AnchorCompressedProof;
use light_sdk_macros::LightTraits;
use light_account_checks::discriminator::Discriminator;
use light_sdk::light_system_accounts;



#[light_system_accounts]
#[derive(Accounts, LightTraits)]
pub struct RegisterDevice<'info> {
    #[account(mut)]
    #[fee_payer]
    pub owner: Signer<'info>,
    #[account(
        seeds = [b"marketplace", marketplace.admin.as_ref()],
        bump = marketplace.bump,
        constraint = marketplace.is_active @ ErrorCode::MarketplaceInactive,
    )]
    pub marketplace: Account<'info, Marketplace>,
    #[authority]
    pub cpi_signer: AccountInfo<'info>,
    #[self_program]
    pub self_program: Program<'info, crate::program::Test>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Marketplace is not active")]
    MarketplaceInactive,
    #[msg("Device ID cannot be empty")]
    DeviceIdEmpty,
    #[msg("Device ID exceeds 32 characters")]
    DeviceIdTooLong,
    #[msg("Device type exceeds 32 characters")]
    DeviceTypeTooLong,
    #[msg("Location exceeds 32 characters")]
    LocationTooLong,
    #[msg("Data type exceeds 32 characters")]
    DataTypeTooLong,
    #[msg("Data unit exceeds 32 characters")]
    DataUnitTooLong,
    #[msg("Data CID exceeds 64 characters")]
    DataCidTooLong,
    #[msg("Price per unit must be greater than zero")]
    InvalidPrice,
    #[msg("Total data units must be greater than zero")]
    InvalidDataUnits,
    #[msg("Hashing error")]
    HashingError,
    #[msg("Missing Merkle tree account in remaining_accounts")]
    MissingMerkleTreeAccount,
    #[msg("Missing queue account in remaining_accounts")]
    MissingQueueAccount,
    #[msg("Invalid proof format")]
    InvalidProofFormat,
}

pub fn handler<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, RegisterDevice<'info>>,
    device_id: String,
    ek_pubkey_hash: [u8; 32],
    device_type: String,
    location: String,
    data_type: String,
    data_unit: String,
    price_per_unit: u64,
    total_data_units: u64,
    data_cid: String,
    access_key_hash: [u8; 32],
    proof: AnchorCompressedProof,
    address_merkle_tree_root_index: u16,
    packed_address_merkle_context: PackedAddressMerkleContext,
    merkle_tree_index: u8,
    bump: u8,
) -> Result<()> {
    // Input validation
    require!(!device_id.is_empty(), ErrorCode::DeviceIdEmpty);
    require!(device_id.len() <= 32, ErrorCode::DeviceIdTooLong);
    require!(device_type.len() <= 32, ErrorCode::DeviceTypeTooLong);
    require!(location.len() <= 32, ErrorCode::LocationTooLong);
    require!(data_type.len() <= 32, ErrorCode::DataTypeTooLong);
    require!(data_unit.len() <= 32, ErrorCode::DataUnitTooLong);
    require!(data_cid.len() <= 64, ErrorCode::DataCidTooLong);
    require!(price_per_unit > 0, ErrorCode::InvalidPrice);
    require!(total_data_units > 0, ErrorCode::InvalidDataUnits);
    //require!(proof.is_valid_format(), ErrorCode::InvalidProofFormat);



    let merkle_tree_account = ctx.remaining_accounts
        .get(packed_address_merkle_context.address_merkle_tree_pubkey_index as usize)
        .ok_or(error!(ErrorCode::MissingMerkleTreeAccount))?;
    let queue_account = ctx.remaining_accounts
        .get(packed_address_merkle_context.address_queue_pubkey_index as usize)
        .ok_or(error!(ErrorCode::MissingQueueAccount))?;

    // Derive the compressed account address
    let address_merkle_context = AddressMerkleContext {
        address_merkle_tree_pubkey: ctx.remaining_accounts[packed_address_merkle_context.address_merkle_tree_pubkey_index as usize].key(),
        address_queue_pubkey: ctx.remaining_accounts[packed_address_merkle_context.address_queue_pubkey_index as usize].key(),
    };

    let mkt_key = ctx.accounts.marketplace.key();
    let seeds = [b"device", mkt_key.as_ref(), device_id.as_bytes()];
    let address_seed = derive_address_seed(seeds.as_slice(), &crate::ID, &address_merkle_context);
    let address = derive_address(&address_seed, &address_merkle_context);

    // Create the output compressed account
    let device_registry = DeviceRegistry {
        owner: ctx.accounts.owner.key(),
        marketplace: ctx.accounts.marketplace.key(),
        device_id: device_id.clone(),
        ek_pubkey_hash,
        is_active: true,
        price_per_unit,
        total_data_units,
        data_cid,
        access_key_hash,
        metadata: DeviceMetadata {
            device_type,
            location,
            data_type,
            data_unit,
        },
    };
    let account_data = CompressedAccountData {
        discriminator: DeviceRegistry::discriminator(),
        data: device_registry.try_to_vec()?,
        data_hash: device_registry
            .hash::<Poseidon>()
            .map_err(|_| error!(ErrorCode::HashingError))?,
    };
    let output_compressed_account = OutputCompressedAccountWithPackedContext {
        compressed_account: CompressedAccount {
            owner: crate::ID,
            lamports: 0,
            address: Some(address),
            data: Some(account_data),
        },
        merkle_tree_index,
    };

    let light_proof = CompressedProof {
        a: proof.a,
        b: {
            let mut bb = [0u8; 64];
            bb[..32].copy_from_slice(&proof.b0);
            bb[32..].copy_from_slice(&proof.b1);
            bb
        },
        c: proof.c,
    };
    // Prepare the CPI instruction data
    let new_address_params = NewAddressParamsPacked {
        address_merkle_tree_account_index: packed_address_merkle_context.address_merkle_tree_pubkey_index,
        address_queue_account_index: packed_address_merkle_context.address_queue_pubkey_index,
        address_merkle_tree_root_index,
        seed: address_seed,
    };
    let inputs = verify::InstructionDataInvokeCpi {
        cpi_context: None,
        is_compress: false,
        compress_or_decompress_lamports: None,
        new_address_params: vec![new_address_params],
        relay_fee: None,
        input_compressed_accounts_with_merkle_context: Vec::new(),
        output_compressed_accounts: vec![output_compressed_account],
        proof: Some(light_proof),
    };

    // Invoke the Light System Program
    let signer_seeds = [b"cpi_authority".as_ref(), &[bump]];
    verify::verify(&ctx, &inputs, &[&signer_seeds])?;

    msg!(
        "Device registered: {} under marketplace: {}",
        device_id,
        ctx.accounts.marketplace.key()
    );

    Ok(())
}










































































// #[derive(Accounts)]
// pub struct RegisterDevice<'info> {
//     #[account(mut)]
//     pub owner: Signer<'info>,
//     #[account(
//         seeds = [b"marketplace", marketplace.admin.as_ref()],
//         bump = marketplace.bump,
//         constraint = marketplace.is_active @ ErrorCode::MarketplaceInactive,
//     )]
//     pub marketplace: Account<'info, Marketplace>,
//     // Remaining accounts for Light System Program passed via ctx.remaining_accounts
// }

// pub fn handler(
//     ctx: Context<RegisterDevice>,
//     device_id: String,
//     ek_pubkey_hash: [u8; 32],
//     device_type: String,
//     location: String,
//     data_type: String,
//     data_unit: String,
//     price_per_unit: u64,
//     total_data_units: u64,
//     data_cid: String,
//     access_key_hash: [u8; 32],
//     proof: CompressedProof,
//     address_merkle_tree_root_index: u16,
//     address_merkle_context: PackedAddressMerkleContext,
//     merkle_tree_index: u8,
//     bump: u8,
// ) -> Result<()> {
//     // Input validation
//     require!(!device_id.is_empty(), ErrorCode::DeviceIdEmpty);
//     require!(device_id.len() <= 32, ErrorCode::DeviceIdTooLong);
//     require!(device_type.len() <= 32, ErrorCode::DeviceTypeTooLong);
//     require!(location.len() <= 32, ErrorCode::LocationTooLong);
//     require!(data_type.len() <= 32, ErrorCode::DataTypeTooLong);
//     require!(data_unit.len() <= 32, ErrorCode::DataUnitTooLong);
//     require!(data_cid.len() <= 64, ErrorCode::DataCidTooLong);
//     require!(price_per_unit > 0, ErrorCode::InvalidPrice);
//     require!(total_data_units > 0, ErrorCode::InvalidDataUnits);

//     // Derive the compressed account address
//     let address_merkle_context = AddressMerkleContext {
//         address_merkle_tree_pubkey: ctx.remaining_accounts[address_merkle_context.address_merkle_tree_pubkey_index as usize].key(),
//         address_queue_pubkey: ctx.remaining_accounts[address_merkle_context.address_queue_pubkey_index as usize].key(),
//     };
//     let seeds = [b"device", ctx.accounts.marketplace.key().as_ref(), device_id.as_bytes()];
//     let address_seed = derive_address_seed(seeds.as_slice(), &crate::ID, &address_merkle_context);
//     let address = derive_address(&address_seed, &address_merkle_context);

//     // Create the output compressed account
//     let device_registry = DeviceRegistry {
//         owner: ctx.accounts.owner.key(),
//         marketplace: ctx.accounts.marketplace.key(),
//         device_id: device_id.clone(),
//         ek_pubkey_hash,
//         is_active: true,
//         price_per_unit,
//         total_data_units,
//         data_cid,
//         access_key_hash,
//         metadata: DeviceMetadata {
//             device_type,
//             location,
//             data_type,
//             data_unit,
//         },
//     };
//     let account_data = CompressedAccountData {
//         discriminator: DeviceRegistry::discriminator(),
//         data: device_registry.try_to_vec()?,
//         data_hash: device_registry.hash::<Poseidon>()?,
//     };
//     let output_compressed_account = OutputCompressedAccountWithPackedContext {
//         compressed_account: CompressedAccount {
//             owner: crate::ID,
//             lamports: 0,
//             address: Some(address),
//             data: Some(account_data),
//         },
//         merkle_tree_index,
//     };

//     // Prepare the CPI instruction data
//     let new_address_params = NewAddressParamsPacked {
//         address_merkle_tree_account_index: address_merkle_context.address_merkle_tree_pubkey_index,
//         address_queue_account_index: address_merkle_context.address_queue_pubkey_index,
//         address_merkle_tree_root_index,
//         seed: address_seed,
//     };
//     let inputs = InstructionDataInvokeCpi {
//         cpi_context: None,
//         is_compress: false,
//         compress_or_decompress_lamports: None,
//         new_address_params: vec![new_address_params],
//         relay_fee: None,
//         input_compressed_accounts_with_merkle_context: Vec::new(),
//         output_compressed_accounts: vec![output_compressed_account],
//         proof: Some(proof),
//     };

//     // Invoke the Light System Program
//     let signer_seeds = [b"cpi_authority", &[bump]];
//     verify(&ctx, &inputs, &[signer_seeds.as_slice()])?;

//     msg!(
//         "Device registered: {} under marketplace: {}",
//         device_id,
//         ctx.accounts.marketplace.key()
//     );

//     Ok(())
// }

// #[error_code]
// pub enum ErrorCode {
//     #[msg("Marketplace is not active")]
//     MarketplaceInactive,
//     #[msg("Device ID cannot be empty")]
//     DeviceIdEmpty,
//     #[msg("Device ID exceeds 32 characters")]
//     DeviceIdTooLong,
//     #[msg("Device type exceeds 32 characters")]
//     DeviceTypeTooLong,
//     #[msg("Location exceeds 32 characters")]
//     LocationTooLong,
//     #[msg("Data type exceeds 32 characters")]
//     DataTypeTooLong,
//     #[msg("Data unit exceeds 32 characters")]
//     DataUnitTooLong,
//     #[msg("Data CID exceeds 64 characters")]
//     DataCidTooLong,
//     #[msg("Price per unit must be greater than zero")]
//     InvalidPrice,
//     #[msg("Total data units must be greater than zero")]
//     InvalidDataUnits,
// }