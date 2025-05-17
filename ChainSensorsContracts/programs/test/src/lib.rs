// use anchor_lang::prelude::*;
// use light_sdk::{light_system_accounts, merkle_context::PackedMerkleContext};
// use light_sdk_macros::LightTraits;

// declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
// use light_sdk::merkle_context::PackedAddressMerkleContext;
// use light_sdk::{
//     proof::CompressedProof,
//     verify::{verify, InstructionDataInvokeCpi},
// };

// pub mod address;
// pub mod compressed_account_helpers;
// pub mod state;

// pub const CPI_AUTHORITY_PDA_SEED: &[u8] = b"cpi_authority";

// #[program]
// pub mod test {

//     use crate::{
//         address::create_address,
//         compressed_account_helpers::{create_input_account, create_output_account},
//     };

//     use super::*;

//     pub fn create<'info>(
//         ctx: Context<'_, '_, '_, 'info, GenericAccounts<'info>>,
//         proof: CompressedProof,
//         address_merkle_tree_root_index: u16,
//         address_merkle_context: PackedAddressMerkleContext,
//         merkle_tree_index: u8,
//         bump: u8,
//     ) -> Result<()> {
//         let (new_address_params, address) = create_address(
//             ctx.accounts.signer.key(),
//             ctx.remaining_accounts,
//             address_merkle_context.address_merkle_tree_pubkey_index,
//             address_merkle_context.address_queue_pubkey_index,
//             address_merkle_tree_root_index,
//         );
//         let counter_value = 0;
//         let output_compressed_account = create_output_account(
//             ctx.accounts.signer.key(),
//             merkle_tree_index,
//             counter_value,
//             address,
//         );

//         let inputs = InstructionDataInvokeCpi {
//             cpi_context: None,
//             is_compress: false,
//             compress_or_decompress_lamports: None,
//             new_address_params: vec![new_address_params],
//             relay_fee: None,
//             input_compressed_accounts_with_merkle_context: Vec::new(),
//             output_compressed_accounts: vec![output_compressed_account],
//             proof: Some(proof),
//         };
//         let signer_seeds = [CPI_AUTHORITY_PDA_SEED, &[bump]];
//         verify(&ctx, &inputs, &[signer_seeds.as_slice()]).unwrap();
//         Ok(())
//     }

//     #[allow(clippy::too_many_arguments)]
//     pub fn increment<'info>(
//         ctx: Context<'_, '_, '_, 'info, GenericAccounts<'info>>,
//         proof: CompressedProof,
//         input_merkle_context: PackedMerkleContext,
//         root_index: u16,
//         output_merkle_tree_index: u8,
//         address: [u8; 32],
//         input_counter_value: u64,
//         bump: u8,
//     ) -> Result<()> {
//         let input_compressed_account = create_input_account(
//             ctx.accounts.signer.key(),
//             input_merkle_context,
//             input_counter_value,
//             address,
//             root_index,
//         );
//         let output_counter_value = input_counter_value + 1;
//         let output_compressed_account = create_output_account(
//             ctx.accounts.signer.key(),
//             output_merkle_tree_index,
//             output_counter_value,
//             address,
//         );

//         let inputs = InstructionDataInvokeCpi {
//             cpi_context: None,
//             is_compress: false,
//             compress_or_decompress_lamports: None,
//             new_address_params: vec![],
//             relay_fee: None,
//             input_compressed_accounts_with_merkle_context: vec![input_compressed_account],
//             output_compressed_accounts: vec![output_compressed_account],
//             proof: Some(proof),
//         };
//         let signer_seeds = [CPI_AUTHORITY_PDA_SEED, &[bump]];
//         verify(&ctx, &inputs, &[signer_seeds.as_slice()]).unwrap();
//         Ok(())
//     }

//     pub fn delete<'info>(
//         ctx: Context<'_, '_, '_, 'info, GenericAccounts<'info>>,
//         proof: CompressedProof,
//         input_merkle_context: PackedMerkleContext,
//         root_index: u16,
//         address: [u8; 32],
//         input_counter_value: u64,
//         bump: u8,
//     ) -> Result<()> {
//         let input_compressed_account = create_input_account(
//             ctx.accounts.signer.key(),
//             input_merkle_context,
//             input_counter_value,
//             address,
//             root_index,
//         );
//         let inputs = InstructionDataInvokeCpi {
//             cpi_context: None,
//             is_compress: false,
//             compress_or_decompress_lamports: None,
//             new_address_params: vec![],
//             relay_fee: None,
//             input_compressed_accounts_with_merkle_context: vec![input_compressed_account],
//             output_compressed_accounts: vec![],
//             proof: Some(proof),
//         };

//         let signer_seeds = [CPI_AUTHORITY_PDA_SEED, &[bump]];
//         verify(&ctx, &inputs, &[signer_seeds.as_slice()]).unwrap();
//         Ok(())
//     }
// }

// #[light_system_accounts]
// #[derive(Accounts, LightTraits)]
// pub struct GenericAccounts<'info> {
//     #[account(mut)]
//     #[fee_payer]
//     pub signer: Signer<'info>,
//     /// CHECK: checked by cpi.
//     #[authority]
//     pub cpi_signer: AccountInfo<'info>,
//     #[self_program]
//     pub self_program: Program<'info, crate::program::Test>,
// }


use anchor_lang::prelude::*;
use light_sdk::{light_system_accounts, merkle_context::PackedMerkleContext};
use light_sdk_macros::LightTraits;
use light_sdk::merkle_context::PackedAddressMerkleContext;
use light_sdk::{
    proof::CompressedProof,
    verify::{verify, InstructionDataInvokeCpi},
};
use light_sdk::verify;

pub mod instructions;
pub mod state;
pub mod address;
pub mod compressed_account_helpers;
use instructions::*;
use state::*;
pub mod types;
use types::*;

declare_id!("C8qdXZW4Ze7Zy9u4bJbzhbJThxZbE4vBGKjQexsaWXwP");

pub const CPI_AUTHORITY_PDA_SEED: &[u8] = b"cpi_authority";

#[program]
pub mod test {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        name: String,
        seller_fee: u16,
    ) -> Result<()> {
        ctx.accounts.init(name, seller_fee, &ctx.bumps)
    }

    pub fn register_device<'a, 'b, 'c, 'info>(
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
        address_merkle_context: PackedAddressMerkleContext,
        merkle_tree_index: u8,
        bump: u8,
    ) -> Result<()> {
        instructions::register_device::handler(
            ctx,
            device_id,
            ek_pubkey_hash,
            device_type,
            location,
            data_type,
            data_unit,
            price_per_unit,
            total_data_units,
            data_cid,
            access_key_hash,
            proof,
            address_merkle_tree_root_index,
            address_merkle_context,
            merkle_tree_index,
            bump,
        )
    }

    pub fn create<'info>(
        ctx: Context<'_, '_, '_, 'info, GenericAccounts<'info>>,
        proof: AnchorCompressedProof,
        address_merkle_tree_root_index: u16,
        address_merkle_context: PackedAddressMerkleContext,
        merkle_tree_index: u8,
        bump: u8,
    ) -> Result<()> {
        let (new_address_params, address) = address::create_address(
            ctx.accounts.signer.key(),
            ctx.remaining_accounts,
            address_merkle_context.address_merkle_tree_pubkey_index,
            address_merkle_context.address_queue_pubkey_index,
            address_merkle_tree_root_index,
        );
        let counter_value = 0;
        let output_compressed_account = compressed_account_helpers::create_output_account(
            ctx.accounts.signer.key(),
            merkle_tree_index,
            counter_value,
            address,
        );
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
        let signer_seeds = [CPI_AUTHORITY_PDA_SEED, &[bump]];
        verify::verify(&ctx, &inputs, &[signer_seeds.as_slice()]).unwrap();
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn increment<'info>(
        ctx: Context<'_, '_, '_, 'info, GenericAccounts<'info>>,
        proof: AnchorCompressedProof,
        input_merkle_context: PackedMerkleContext,
        root_index: u16,
        output_merkle_tree_index: u8,
        address: [u8; 32],
        input_counter_value: u64,
        bump: u8,
    ) -> Result<()> {
        let input_compressed_account = compressed_account_helpers::create_input_account(
            ctx.accounts.signer.key(),
            input_merkle_context,
            input_counter_value,
            address,
            root_index,
        );
        let output_counter_value = input_counter_value + 1;
        let output_compressed_account = compressed_account_helpers::create_output_account(
            ctx.accounts.signer.key(),
            output_merkle_tree_index,
            output_counter_value,
            address,
        );
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
        let inputs = verify::InstructionDataInvokeCpi {
            cpi_context: None,
            is_compress: false,
            compress_or_decompress_lamports: None,
            new_address_params: vec![],
            relay_fee: None,
            input_compressed_accounts_with_merkle_context: vec![input_compressed_account],
            output_compressed_accounts: vec![output_compressed_account],
            proof: Some(light_proof),
        };
        let signer_seeds = [CPI_AUTHORITY_PDA_SEED, &[bump]];
        verify(&ctx, &inputs, &[signer_seeds.as_slice()]).unwrap();
        Ok(())
    }

    pub fn delete<'info>(
        ctx: Context<'_, '_, '_, 'info, GenericAccounts<'info>>,
        proof: AnchorCompressedProof,
        input_merkle_context: PackedMerkleContext,
        root_index: u16,
        address: [u8; 32],
        input_counter_value: u64,
        bump: u8,
    ) -> Result<()> {
        let input_compressed_account = compressed_account_helpers::create_input_account(
            ctx.accounts.signer.key(),
            input_merkle_context,
            input_counter_value,
            address,
            root_index,
        );
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
        let inputs = verify::InstructionDataInvokeCpi {
            cpi_context: None,
            is_compress: false,
            compress_or_decompress_lamports: None,
            new_address_params: vec![],
            relay_fee: None,
            input_compressed_accounts_with_merkle_context: vec![input_compressed_account],
            output_compressed_accounts: vec![],
            proof: Some(light_proof),
        };

        let signer_seeds = [CPI_AUTHORITY_PDA_SEED, &[bump]];
        verify(&ctx, &inputs, &[signer_seeds.as_slice()]).unwrap();
        Ok(())
    }
}

#[light_system_accounts]
#[derive(Accounts, LightTraits)]
pub struct GenericAccounts<'info> {
    #[account(mut)]
    #[fee_payer]
    pub signer: Signer<'info>,
    #[authority]
    pub cpi_signer: AccountInfo<'info>,
    #[self_program]
    pub self_program: Program<'info, crate::program::Test>,
}