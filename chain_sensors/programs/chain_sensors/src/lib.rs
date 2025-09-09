use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_macros::{
    arcium_callback, arcium_program, init_computation_definition_accounts,
    queue_computation_accounts, callback_accounts,
};
use arcium_client::idl::arcium::types::{
    CircuitSource, OffChainCircuitSource, CallbackAccount,
};
use anchor_lang::solana_program::sysvar::instructions as sys_ix;

pub mod instructions;
mod state;

pub use instructions::*;

const COMP_DEF_OFFSET_ADD_TOGETHER: u32 = comp_def_offset("add_together");
const COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE: u32 = comp_def_offset("compute_accuracy_score");
const COMP_DEF_OFFSET_RESEAL_DEK: u32 = comp_def_offset("reseal_dek");

declare_id!("DWbGQjpG3aAciCfuSt16PB5FuuJhf5XATmoUpTMGRfU9");

// --------------------------- Events & Errors ---------------------------
#[event]
pub struct QualityScoreEvent {
    pub accuracy_score: [u8; 32],
    pub nonce: [u8; 16],
    pub computation_type: String,
}

#[event]
pub struct ResealOutput {
    pub listing: Pubkey,
    pub record: Pubkey,
    pub encryption_key: [u8; 32],
    pub nonce: [u8; 16],
    pub c0: [u8; 32],
    pub c1: [u8; 32],
    pub c2: [u8; 32],
    pub c3: [u8; 32],
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

// --------------------------- Helpers ---------------------------
fn assert_called_by_arcium(ix_sysvar: &AccountInfo, arcium_pid: &Pubkey) -> Result<()> {
    let idx = sys_ix::load_current_index_checked(ix_sysvar)? as usize;
    let cur = sys_ix::load_instruction_at_checked(idx, ix_sysvar)?;
    if cur.program_id == *arcium_pid {
        return Ok(());
    }
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
        instructions::purchase_listing::handler(
            ctx,
            listing_id,
            units_requested,
            buyer_x25519_pubkey,
            purchase_index,
        )
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

    // ---------- DQ ----------
    pub fn init_dq_for_device(
        ctx: Context<InitDqForDevice>,
        authority: Pubkey,
        expected_rate_hz: u32,
        stale_threshold_ms: u32,
        var_hi_q16_16: u32,
        var_lo_q16_16: u32,
        eps_q16_16: u32,
    ) -> Result<()> {
        instructions::quality::init_dq_for_device_handler(
            ctx,
            authority,
            expected_rate_hz,
            stale_threshold_ms,
            var_hi_q16_16,
            var_lo_q16_16,
            eps_q16_16,
        )
    }

    pub fn publish_quality_metrics(
        ctx: Context<PublishQualityMetrics>,
        window_start: i64,
        window_end: i64,
        field_completeness_bps: u16,
        packet_completeness_bps: u16,
        stale_ratio_bps: u16,
        delay_p50_ms: u32,
        delay_p90_ms: u32,
        delay_p99_ms: u32,
        rolling_var_q16_16: u32,
        flags: u8,
        accuracy_score_opt: Option<u8>,
        quality_score_bps_opt: Option<u16>,
    ) -> Result<()> {
        instructions::quality::publish_quality_metrics_handler(
            ctx,
            window_start,
            window_end,
            field_completeness_bps,
            packet_completeness_bps,
            stale_ratio_bps,
            delay_p50_ms,
            delay_p90_ms,
            delay_p99_ms,
            rolling_var_q16_16,
            flags,
            accuracy_score_opt,
            quality_score_bps_opt,
        )
    }

    // ---------- Accuracy comp-def ----------
    pub fn init_accuracy_score_comp_def(ctx: Context<InitAccuracyScoreCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    // ---------- Queue accuracy ----------
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
        ctx.accounts.job_pda.created_at = clock.unix_timestamp;

        let args = vec![
            Argument::ArcisPubkey(pub_key),
            Argument::PlaintextU128(nonce),
            Argument::EncryptedU32(encrypted_reading_q16_16),
            Argument::EncryptedU32(encrypted_mean_q16_16),
            Argument::EncryptedU32(encrypted_std_q16_16),
        ];

        let device_key = ctx.accounts.device.key();
        let listing_key = ctx.accounts.listing_state.key();
        let dq_state_pda = Pubkey::find_program_address(
            &[b"dqstate", device_key.as_ref()],
            ctx.program_id,
        )
        .0;

        let cb_accs = vec![
            CallbackAccount { pubkey: device_key,    is_writable: false },
            CallbackAccount { pubkey: listing_key,   is_writable: false },
            CallbackAccount { pubkey: dq_state_pda,  is_writable: true  },
        ];

        queue_computation(ctx.accounts, computation_offset, args, cb_accs, None)?;
        Ok(())
    }

    // ---------- Accuracy callback ----------
    #[arcium_callback(encrypted_ix = "compute_accuracy_score")]
    pub fn compute_accuracy_score_callback(
        ctx: Context<ComputeAccuracyScoreCallback>,
        output: ComputationOutputs<ComputeAccuracyScoreOutput>,
    ) -> Result<()> {
        let enc = match output {
            ComputationOutputs::Success(ComputeAccuracyScoreOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        // Serialize + hash ciphertext bytes
        let enc_bytes = enc.try_to_vec().map_err(|_| ErrorCode::AbortedComputation)?;
        let digest = anchor_lang::solana_program::keccak::hash(&enc_bytes).0;

        let nonce_le: [u8; 16] = ctx.accounts.job_pda.nonce.to_le_bytes();
        let st = &mut ctx.accounts.dq_state;
        st.last_acc_ciphertext_hash = digest;
        st.last_acc_nonce_le = nonce_le;
        st.last_updated_ts = Clock::get()?.unix_timestamp;

        emit!(QualityScoreEvent {
            accuracy_score: digest,
            nonce: nonce_le,
            computation_type: "accuracy".to_string(),
        });
        Ok(())
    }

    // ---------- Reseal comp-def ----------
    pub fn init_reseal_dek_comp_def(ctx: Context<InitResealDekCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            false,
            0,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: "https://github.com/RedaRahmani/ChainSensors-V1/releases/download/v0.1.0/reseal_dek.arcis".to_string(),
                hash: [
                    168, 104, 243, 119, 239, 175, 108, 148, 212, 136, 204, 96, 132, 179, 193, 113,
                    149, 206, 164, 33, 43, 238, 48, 253, 85, 155, 187, 16, 44, 116, 252, 217
                ],
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

    #[arcium_callback(encrypted_ix = "reseal_dek")]
    pub fn reseal_dek_callback(
        ctx: Context<ResealDekCallback>,
        output: ComputationOutputs<ResealDekOutput>,
    ) -> Result<()> {
        // Optional: assert caller using instructions sysvar
        assert_called_by_arcium(
            &ctx.accounts.instructions_sysvar,
            &ctx.accounts.arcium_program.key(),
        )?;

        let o = match output {
            ComputationOutputs::Success(ResealDekOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(ResealOutput {
            listing:  ctx.accounts.listing_state,
            record:   ctx.accounts.purchase_record,
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



// ---- init reseal comp-def ----
#[init_computation_definition_accounts("reseal_dek", payer)]
#[derive(Accounts)]
pub struct InitResealDekCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

// ---- queue reseal ----
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

    /// CHECK: pointer-only
    pub listing_state: UncheckedAccount<'info>,
    /// CHECK: pointer-only
    pub purchase_record: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}


#[callback_accounts("reseal_dek")]
#[derive(Accounts)]
pub struct ResealDekCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_RESEAL_DEK))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    /// CHECK: verified by constraint
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    /// CHECK: pointer-only; provided by Arcium runtime
    #[account()]
    pub listing_state: UncheckedAccount<'info>,
    /// CHECK: pointer-only; provided by Arcium runtime (writable in cb_accs)
    #[account(mut)]
    pub purchase_record: UncheckedAccount<'info>,
}


// ---- queue accuracy ----
#[queue_computation_accounts("compute_accuracy_score", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ComputeAccuracyScore<'info> {
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
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,

    // Job PDA (stores nonce/metadata)
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + crate::state::job::QualityJob::SIZE,
        seeds = [crate::state::job::QualityJob::SEED, computation_account.key().as_ref()],
        bump
    )]
    pub job_pda: Account<'info, crate::state::job::QualityJob>,

    /// CHECK: pointer-only
    pub device: UncheckedAccount<'info>,
    /// CHECK: pointer-only
    pub listing_state: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}


#[callback_accounts("compute_accuracy_score")]
#[derive(Accounts)]
pub struct ComputeAccuracyScoreCallback<'info> {

    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    /// CHECK: verified by constraint
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    /// CHECK: passed by runtime; we don't write to it
    #[account()]
    pub computation_account: UncheckedAccount<'info>,

    // PDA we DO write to
    #[account(
        mut,
        seeds = [crate::state::job::QualityJob::SEED, computation_account.key().as_ref()],
        bump
    )]
    pub job_pda: Account<'info, crate::state::job::QualityJob>,

    /// CHECK: pointer-only
    #[account()]
    pub device: UncheckedAccount<'info>,
    /// CHECK: pointer-only
    #[account()]
    pub listing_state: UncheckedAccount<'info>,


    #[account(
        mut,
        seeds = [b"dqstate", device.key().as_ref()],
        bump
    )]
    pub dq_state: Account<'info, crate::state::dq::DqState>,
}


// ---- init accuracy comp-def ----
#[init_computation_definition_accounts("compute_accuracy_score", payer)]
#[derive(Accounts)]
pub struct InitAccuracyScoreCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}
