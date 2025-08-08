use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

pub mod instructions;
mod state;
use instructions::*;

// Computation definition offsets (commented out for now)
const COMP_DEF_OFFSET_ADD_TOGETHER: u32 = comp_def_offset("add_together");
const COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE: u32 = comp_def_offset("compute_accuracy_score");

declare_id!("HUcGkoShKcRFNWcYWGN7AFVVydxAQvRy8KRYeHfhdcNY");

#[program]
pub mod chain_sensors {
    use super::*;

    // ============================================================================
    // ChainSensors Marketplace Instructions
    // ============================================================================

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
        price_per_unit: u64,
        device_id: String,
        total_data_units: u64,
        expires_at: Option<i64>,
    ) -> Result<()> {
        instructions::create_listing::handler(
            ctx,
            listing_id,
            data_cid,
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
    ) -> Result<()> {
        instructions::purchase_listing::handler(ctx, listing_id, units_requested)
    }

    pub fn update_marketplace(
        ctx: Context<UpdateMarketplace>,
        new_fee: Option<u16>,
        is_active: Option<bool>,
    ) -> Result<()> {
        instructions::update_marketplace::handler(ctx, new_fee, is_active)
    }

    // ============================================================================
    // FUTURE: Arcium MPC Instructions - Quality Score Accuracy (TEMPORARILY DISABLED)
    // ============================================================================
    // These will be implemented once the Arcium build environment is stable

    /*
    pub fn init_accuracy_score_comp_def(ctx: Context<InitAccuracyScoreCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE.into(), None, None)?;
        Ok(())
    }

    pub fn compute_accuracy_score(
        ctx: Context<ComputeAccuracyScore>,
        computation_offset: u64,
        encrypted_reading: [u8; 32],
        encrypted_mean: [u8; 32], 
        encrypted_std_dev: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        let args = vec![
            Argument::ArcisPubkey(pub_key),
            Argument::PlaintextU128(nonce),
            Argument::EncryptedU32(encrypted_reading),
            Argument::EncryptedU32(encrypted_mean),
            Argument::EncryptedU32(encrypted_std_dev),
        ];
        queue_computation(ctx.accounts, computation_offset, args, vec![], None)?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "compute_accuracy_score")]
    pub fn compute_accuracy_score_callback(
        ctx: Context<ComputeAccuracyScoreCallback>,
        output: ComputationOutputs<ComputeAccuracyScoreOutput>,
    ) -> Result<()> {
        let accuracy_result = match output {
            ComputationOutputs::Success(ComputeAccuracyScoreOutput { field_0: result }) => result,
            _ => return Err(ChainSensorsErrorCode::AbortedComputation.into()),
        };

        emit!(QualityScoreEvent {
            accuracy_score: if accuracy_result.len() >= 32 {
                accuracy_result[0..32].try_into().unwrap_or([0u8; 32])
            } else {
                [0u8; 32]
            },
            nonce: [0u8; 16], // Simplified for now
            computation_type: "accuracy".to_string(),
        });
        Ok(())
    }
    */

}

// ============================================================================
// FUTURE: MPC Event Structure for Quality Scores
// ============================================================================


#[event]
pub struct QualityScoreEvent {
    pub accuracy_score: [u8; 32],
    pub nonce: [u8; 16],
    pub computation_type: String,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ComputeAccuracyScoreOutput {
    pub field_0: Vec<u8>, // Use Vec<u8> instead of EncryptedOutput
}

#[error_code]
pub enum ChainSensorsErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
}

