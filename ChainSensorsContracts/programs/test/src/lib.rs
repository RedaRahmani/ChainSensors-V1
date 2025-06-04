use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::token::{Mint, Token};
use light_sdk::{light_system_accounts, merkle_context::PackedAddressMerkleContext};
use light_sdk_macros::LightTraits;
use light_sdk::{
    proof::CompressedProof,
    verify::{verify, InstructionDataInvokeCpi},
};
use crate::state::CompressedDeviceRegistry;
use crate::state::Marketplace;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

pub mod address;
pub mod compressed_account_helpers;
pub mod state;

pub const CPI_AUTHORITY_PDA_SEED: &[u8] = b"cpi_authority";

#[program]
pub mod chainsensor {
    use super::*;
    use crate::{
        address::create_address,
        compressed_account_helpers::create_output_account,
        state::{CompressedDeviceRegistry, Marketplace},
    };

    pub fn initialize<'info>(
        ctx: Context<'_, '_, '_, 'info, Initialize<'info>>,
        name: String,
        seller_fee: u16,
    ) -> Result<()> {
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(seller_fee <= 10000, ErrorCode::InvalidFee);
        require!(
            name.chars().all(|c| c.is_alphanumeric() || c == ' ' || c == '_'),
            ErrorCode::InvalidNameChars
        );
        require!(!name.is_empty(), ErrorCode::NameEmpty);

        let (treasury_pda, treasury_bump) = Pubkey::find_program_address(
            &[b"treasury", ctx.accounts.admin.key().as_ref()],
            &crate::ID,
        );
        require!(treasury_pda == *ctx.accounts.treasury.key, ErrorCode::InvalidTreasury);

        ctx.accounts.marketplace.set_inner(Marketplace {
            admin: ctx.accounts.admin.key(),
            treasury: ctx.accounts.treasury.key(),
            treasury_bump,
            seller_fee,
            token_mint: ctx.accounts.usdc_mint.key(),
            is_active: true,
            bump: ctx.bumps.marketplace,
            name,
            created_at: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn register_device<'info>(
        ctx: Context<'_, '_, '_, 'info, GenericAccounts<'info>>,
        proof: CompressedProof,
        address_merkle_tree_root_index: u16,
        address_merkle_context: PackedAddressMerkleContext,
        merkle_tree_index: u8,
        bump: u8,
        device_id: [u8; 32],
        ek_pubkey_hash: [u8; 32],
        device_type: [u8; 32],
        data_type: [u8; 32],
    ) -> Result<()> {
        require!(!device_id.iter().all(|&x| x == 0), ErrorCode::DeviceIdEmpty);
        require!(!device_type.iter().all(|&x| x == 0), ErrorCode::DeviceTypeTooLong);
        require!(!data_type.iter().all(|&x| x == 0), ErrorCode::DataTypeTooLong);

        let (new_address_params, address) = create_address(
            ctx.accounts.signer.key(),
            ctx.remaining_accounts,
            address_merkle_context.address_merkle_tree_pubkey_index,
            address_merkle_context.address_queue_pubkey_index,
            address_merkle_tree_root_index,
        );
        let device_registry = CompressedDeviceRegistry {
            owner: ctx.accounts.signer.key(),
            marketplace: ctx.accounts.marketplace.key(),
            device_id,
            ek_pubkey_hash,
            bump,
            device_type,
            created_at: Clock::get()?.unix_timestamp,
            data_type,
        };

        let output_compressed_account = create_output_account(
            ctx.accounts.signer.key(),
            merkle_tree_index,
            device_registry,
            address,
        )?;

        let inputs = InstructionDataInvokeCpi {
            cpi_context: None,
            is_compress: false,
            compress_or_decompress_lamports: None,
            new_address_params: vec![new_address_params],
            relay_fee: None,
            input_compressed_accounts_with_merkle_context: Vec::new(),
            output_compressed_accounts: vec![output_compressed_account],
            proof: Some(proof),
        };
        let signer_seeds = [CPI_AUTHORITY_PDA_SEED, &[bump]];
        verify(&ctx, &inputs, &[signer_seeds.as_slice()])?;
        Ok(())
    }
    
}

#[light_system_accounts]
#[derive(Accounts, LightTraits)]
pub struct GenericAccounts<'info> {
    #[account(mut)]
    #[fee_payer]
    pub signer: Signer<'info>,
    /// CHECK: checked by cpi.
    #[authority]
    pub cpi_signer: AccountInfo<'info>,
    #[self_program]
    pub self_program: Program<'info, crate::program::Chainsensor>,
    #[account(
        seeds = [b"marketplace", signer.key().as_ref()],
        bump,
        constraint = marketplace.is_active @ ErrorCode::MarketplaceInactive,
    )]
    pub marketplace: Account<'info, Marketplace>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        seeds = [b"marketplace", admin.key().as_ref()],
        bump,
        space = 8 + Marketplace::INIT_SPACE,
    )]
    pub marketplace: Account<'info, Marketplace>,
    #[account(mut)]
    /// CHECK: Manually validated as a token account.
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: Manually validated as a mint.
    pub usdc_mint: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}


#[error_code]
pub enum ErrorCode {
    #[msg("Marketplace name exceeds 32 characters")]
    NameTooLong,
    #[msg("Seller fee exceeds 100% (10,000 basis points)")]
    InvalidFee,
    #[msg("Marketplace name cannot be empty")]
    NameEmpty,
    #[msg("Marketplace name contains invalid characters")]
    InvalidNameChars,
    #[msg("Marketplace is not active")]
    MarketplaceInactive,
    #[msg("Device ID cannot be empty")]
    DeviceIdEmpty,
    #[msg("Device ID exceeds 32 characters")]
    DeviceIdTooLong,
    #[msg("Device type exceeds 32 characters")]
    DeviceTypeTooLong,
    #[msg("Data type exceeds 32 characters")]
    DataTypeTooLong,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
    #[msg("Invalid account index")]
    InvalidAccountIndex,
     // Listing creation errors
    #[msg("Listing ID cannot be empty")]
    ListingIdEmpty,
    #[msg("Device ID cannot be empty")]
    DeviceIdEmptyListing,
    #[msg("Data CID cannot be empty")]
    DataCidEmpty,
    #[msg("Price per unit must be greater than zero")]
    InvalidPrice,
    #[msg("Total data units must be greater than zero")]
    InvalidDataUnits,
    #[msg("Invalid Listing PDA")]
    InvalidListingPda,

    // Listing cancellation errors
    #[msg("Only the seller can cancel the listing")]
    CancelUnauthorized,
}