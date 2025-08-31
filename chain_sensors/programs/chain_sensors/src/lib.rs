use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_macros::{
    arcium_callback, arcium_program,
    // we also need these macros for account contexts:
    init_computation_definition_accounts,
    queue_computation_accounts,
    callback_accounts,
};
use arcium_client::idl::arcium::types::{CircuitSource, OffChainCircuitSource};
use anchor_lang::solana_program::sysvar::instructions as sys_ix;

pub mod instructions;
mod state;
use instructions::*;

const COMP_DEF_OFFSET_ADD_TOGETHER: u32 = comp_def_offset("add_together");
const COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE: u32 = comp_def_offset("compute_accuracy_score");
const COMP_DEF_OFFSET_RESEAL_DEK: u32 = comp_def_offset("reseal_dek");

declare_id!("DWbGQjpG3aAciCfuSt16PB5FuuJhf5XATmoUpTMGRfU9");

fn assert_called_by_arcium(ix_sysvar: &AccountInfo, arcium_pid: &Pubkey) -> Result<()> {
    let idx = sys_ix::load_current_index_checked(ix_sysvar)? as usize;

    // 1) Accept when the current top-level instruction is Arcium (CPI case)
    let cur = sys_ix::load_instruction_at_checked(idx, ix_sysvar)?;
    if cur.program_id == *arcium_pid {
        return Ok(());
    }

    // 2) Also accept when the previous top-level instruction is Arcium (adjacent-in-message case)
    if idx > 0 {
        let prev = sys_ix::load_instruction_at_checked(idx - 1, ix_sysvar)?;
        require_keys_eq!(prev.program_id, *arcium_pid, ErrorCode::Unauthorized);
        return Ok(());
    }

    err!(ErrorCode::Unauthorized)
}

#[arcium_program]
pub mod chain_sensors {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, name: String, fee: u16) -> Result<()> {
        ctx.accounts.init(name, fee, &ctx.bumps)?;
        Ok(())
    }

    pub fn register_device(
        ctx: Context<RegisterDevice>,
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
        expires_at: Option<i64>,
    ) -> Result<()> {
        instructions::device_registry::handler(
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
            expires_at,
        )
    }

    pub fn create_listing(
        ctx: Context<CreateListing>,
        listing_id: String,
        data_cid: String,
        dek_capsule_for_mxe_cid: String,
        price_per_unit: u64,
        device_id: String,
        total_data_units: u64,
        expires_at: Option<i64>,
    ) -> Result<()> {
        instructions::create_listing::handler(
            ctx,
            listing_id,
            data_cid,
            dek_capsule_for_mxe_cid,
            price_per_unit,
            device_id,
            total_data_units,
            expires_at,
        )
    }

    pub fn cancel_listing(ctx: Context<CancelListing>, listing_id: String) -> Result<()> {
        instructions::cancel_listing::handler(ctx, listing_id)
    }

    pub fn cancel_device(ctx: Context<CancelDevice>, device_id: String) -> Result<()> {
        instructions::cancel_device::handler(ctx, device_id)
    }

    pub fn purchase_listing(
        ctx: Context<PurchaseListing>,
        listing_id: String,
        units_requested: u64,
        buyer_x25519_pubkey: [u8; 32],
        purchase_index: u64,
    ) -> Result<()> {
        instructions::purchase_listing::handler(ctx, listing_id, units_requested, buyer_x25519_pubkey, purchase_index)
    }

    pub fn finalize_purchase(
        ctx: Context<FinalizePurchase>,
        dek_capsule_for_buyer_cid: String,
    ) -> Result<()> {
        instructions::finalize_purchase::handler(ctx, dek_capsule_for_buyer_cid)
    }

    pub fn update_marketplace(
        ctx: Context<UpdateMarketplace>,
        new_fee: Option<u16>,
        is_active: Option<bool>,
    ) -> Result<()> {
        instructions::update_marketplace::handler(ctx, new_fee, is_active)
    }

    pub fn init_accuracy_score_comp_def(ctx: Context<InitAccuracyScoreCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            true,
            0,
            None,
            None
        )?;
        Ok(())
    }

    pub fn compute_accuracy_score(
        ctx: Context<ComputeAccuracyScore>,
        computation_offset: u64,
        encrypted_reading_q16_16: [u8; 32],
        encrypted_mean_q16_16: [u8; 32],
        encrypted_std_q16_16: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        let clock = Clock::get()?;
        ctx.accounts.job_pda.nonce = nonce;
        ctx.accounts.job_pda.bump = ctx.bumps.job_pda;
        ctx.accounts.job_pda.created_at = clock.unix_timestamp;

        let args = vec![
            Argument::ArcisPubkey(pub_key),
            Argument::PlaintextU128(nonce),
            Argument::EncryptedU32(encrypted_reading_q16_16),
            Argument::EncryptedU32(encrypted_mean_q16_16),
            Argument::EncryptedU32(encrypted_std_q16_16),
        ];
        queue_computation(ctx.accounts, computation_offset, args, vec![], None)?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "compute_accuracy_score")]
    pub fn compute_accuracy_score_callback(
        ctx: Context<ComputeAccuracyScoreCallback>,
        output: ComputationOutputs<ComputeAccuracyScoreOutput>,
    ) -> Result<()> {
        let accuracy_ciphertext = match output {
            ComputationOutputs::Success(ComputeAccuracyScoreOutput { field_0: result }) => result,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        let digest = anchor_lang::solana_program::keccak::hash(&accuracy_ciphertext).0;
        let nonce_le: [u8; 16] = ctx.accounts.job_pda.nonce.to_le_bytes();

        emit!(QualityScoreEvent {
            accuracy_score: digest,
            nonce: nonce_le,
            computation_type: "accuracy".to_string(),
        });

        Ok(())
    }


    pub fn init_reseal_dek_comp_def(ctx: Context<InitResealDekCompDef>) -> Result<()> {

        init_comp_def(
            ctx.accounts,
            false,
            0,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: "https://github.com/RedaRahmani/ChainSensors-V1/releases/download/v0.1.0/reseal_dek.arcis".to_string(),
                hash: [0; 32], // integrity not enforced yet
            })),
            None,
        )?;
        Ok(())
    }

    pub fn reseal_dek(
        ctx: Context<ResealDek>,
        computation_offset: u64,
        nonce: u128,
        buyer_x25519_pubkey: [u8; 32],
        c0: [u8; 32],
        c1: [u8; 32],
        c2: [u8; 32],
        c3: [u8; 32],
    ) -> Result<()> {

        instructions::reseal_dek::handler(
            ctx,
            computation_offset,
            nonce,
            buyer_x25519_pubkey,
            c0, c1, c2, c3,
        )
    }

    // IMPORTANT: callback name must be <encrypted_ix>_callback ("reseal_dek_callback")
    // The output type is generated by the Arcium macros; it contains SharedEncryptedStruct<4>.
    #[arcium_callback(encrypted_ix = "reseal_dek")]
    pub fn reseal_dek_callback(
        ctx: Context<ResealDekCallback>,
        output: ComputationOutputs<ResealDekOutput>,
    ) -> Result<()> {
        anchor_lang::prelude::msg!("reseal_dek_callback: entry");
        // Ensure this callback is being executed from the Arcium program's instruction.
        // (Arcium invokes us via CPI from its top-level tx instruction; the "current" instruction
        // in the Instructions sysvar is the Arcium program id.)
        assert_called_by_arcium(
            &ctx.accounts.instructions_sysvar,
            &ctx.accounts.arcium_program.key(),
        )?;
        anchor_lang::prelude::msg!("reseal_dek_callback: verified arcium caller");
        let o = match output {
            ComputationOutputs::Success(ResealDekOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        // Emit the structured ARC1 capsule components (not a Vec<u8>).
        anchor_lang::prelude::msg!("reseal_dek_callback: emitting ResealOutput event");
        emit!(ResealOutput {
            listing: ctx.accounts.listing_state.key(),
            record:  ctx.accounts.purchase_record.key(),
            encryption_key: o.encryption_key,
            nonce: o.nonce.to_le_bytes(),
            c0: o.ciphertexts[0],
            c1: o.ciphertexts[1],
            c2: o.ciphertexts[2],
            c3: o.ciphertexts[3],
        });

        Ok(())
    }
}


#[event]
pub struct QualityScoreEvent {
    pub accuracy_score: [u8; 32],
    pub nonce: [u8; 16],
    pub computation_type: String,
}

// Emitted by reseal_dek_callback; carries the ARC1 capsule pieces.
#[event]
pub struct ResealOutput {
    pub listing: Pubkey,
    pub record:  Pubkey,
    pub encryption_key: [u8; 32], // sender ephemeral/public (shared scheme dep)
    pub nonce: [u8; 16],          // 128-bit nonce/iv (little-endian)
    pub c0: [u8; 32],
    pub c1: [u8; 32],
    pub c2: [u8; 32],
    pub c3: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ComputeAccuracyScoreOutput {
    pub field_0: Vec<u8>,
}

// Do NOT define `ResealDekOutput` here — the Arcium macros generate it.

// Accounts required by the reseal_dek callback.
// Include payer + standard arcium accounts; then append our extra callback accounts
// in the same order we supplied them in queue_computation.
#[callback_accounts("reseal_dek", payer)]
#[derive(Accounts)]
pub struct ResealDekCallback<'info> {
    // MUST be a Signer here (matches macro's expectation)
    #[account(mut)]
    pub payer: Signer<'info>,

    pub arcium_program: Program<'info, Arcium>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_RESEAL_DEK))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    /// CHECK: verified by macro; provided for validation context
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    /// Extra callback accounts (order must match what you queued)
    /// CHECK: pointer-only
    pub listing_state: UncheckedAccount<'info>,
    /// CHECK: pointer-only
    pub purchase_record: UncheckedAccount<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
    #[msg("Unauthorized caller")]
    Unauthorized,
}

#[init_computation_definition_accounts("reseal_dek", payer)]
#[derive(Accounts)]
pub struct InitResealDekCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut , address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("reseal_dek", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ResealDek<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut, address = derive_mempool_pda!())]

    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!())]

    pub executing_pool: UncheckedAccount<'info>,

    #[account(mut, address = derive_comp_pda!(computation_offset))]

    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_RESEAL_DEK))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,


    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,

    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,


    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,

    // Extra callback accounts (we only need their keys for the event)
    /// CHECK: pointer only for event emission
    pub listing_state: UncheckedAccount<'info>,
    /// CHECK: pointer only for event emission
    pub purchase_record: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}
