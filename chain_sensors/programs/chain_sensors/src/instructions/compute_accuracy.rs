// use anchor_lang::prelude::*;
// use arcium_anchor::prelude::*;
// use crate::{COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE, ID};

// // Import required constants for Arcium macros
// use arcium_client::idl::arcium::ID_CONST;

// #[queue_computation_accounts("compute_accuracy_score", payer)]
// #[derive(Accounts)]
// #[instruction(computation_offset: u64)]
// pub struct ComputeAccuracyScore<'info> {
//     #[account(mut)]
//     pub payer: Signer<'info>,
//     #[account(address = derive_mxe_pda!())]
//     pub mxe_account: Account<'info, MXEAccount>,
//     /// CHECK: This is a raw account validated by Arcium runtime for Mempool context.
//     #[account(mut, address = derive_mempool_pda!())]
//     pub mempool_account: UncheckedAccount<'info>,
//     /// CHECK: This account is derived and validated internally by the Arcium SDK.
//     #[account(mut, address = derive_execpool_pda!())]
//     pub executing_pool: UncheckedAccount<'info>,
//     /// CHECK: This account is derived and validated internally by the Arcium SDK.
//     #[account(mut, address = derive_comp_pda!(computation_offset))]
//     pub computation_account: UncheckedAccount<'info>,
//     #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE))]
//     pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
//     #[account(mut, address = derive_cluster_pda!(mxe_account))]
//     pub cluster_account: Account<'info, Cluster>,
//     #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
//     pub pool_account: Account<'info, FeePool>,
//     #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
//     pub clock_account: Account<'info, ClockAccount>,
//     pub system_program: Program<'info, System>,
//     pub arcium_program: Program<'info, Arcium>,
// }

// #[callback_accounts("compute_accuracy_score", payer)]
// #[derive(Accounts)]
// pub struct ComputeAccuracyScoreCallback<'info> {
//     #[account(mut)]
//     pub payer: Signer<'info>,
//     pub arcium_program: Program<'info, Arcium>,
//     #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE))]
//     pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
//     /// CHECK: This is the instructions sysvar account required for callback validation.
//     /// It is read-only and verified internally by the Arcium runtime.
//     #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
//     pub instructions_sysvar: AccountInfo<'info>,
// }

// #[init_computation_definition_accounts("compute_accuracy_score", payer)]
// #[derive(Accounts)]
// pub struct InitAccuracyScoreCompDef<'info> {
//     #[account(mut)]
//     pub payer: Signer<'info>,
//     #[account(mut, address = derive_mxe_pda!())]
//     pub mxe_account: Box<Account<'info, MXEAccount>>,
//     /// CHECK: This is a raw account validated by Arcium runtime for Mempool context.
//     #[account(mut)]
//     pub comp_def_account: UncheckedAccount<'info>,
//     pub arcium_program: Program<'info, Arcium>,
//     pub system_program: Program<'info, System>,
// }
// #[error_code]
// pub enum ErrorCode {
//     #[msg("Cluster account is not set")]
//     ClusterNotSet,
    
//     // Add others as needed
// }
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
// UPDATED: needed by derive_comp_def_pda! (comes from #[arcium_program])
use crate::ID_CONST;

use crate::{COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE, ID};
// UPDATED: bring in the Job PDA type
use crate::state::job::QualityJob;

// NOTE: Make sure there is NO arcium_client import here (it causes huge BPF stacks).
// (removed) use arcium_client::idl::arcium::ID_CONST;

#[queue_computation_accounts("compute_accuracy_score", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ComputeAccuracyScore<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: This is a raw account validated by Arcium runtime for Mempool context.
    #[account(mut, address = derive_mempool_pda!())]
    pub mempool_account: UncheckedAccount<'info>,
    /// CHECK: This account is derived and validated internally by the Arcium SDK.
    #[account(mut, address = derive_execpool_pda!())]
    pub executing_pool: UncheckedAccount<'info>,
    /// CHECK: This account is derived and validated internally by the Arcium SDK.
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

    // UPDATED: Job PDA stores the nonce so the callback can emit it.
    // We key it by the *computation account pubkey* so the callback
    // can derive the same PDA without needing the offset again.
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + QualityJob::SIZE,
        seeds = [QualityJob::SEED, computation_account.key().as_ref()], // UPDATED
        bump
    )]
    pub job_pda: Account<'info, QualityJob>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("compute_accuracy_score", payer)]
#[derive(Accounts)]
pub struct ComputeAccuracyScoreCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_COMPUTE_ACCURACY_SCORE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    // UPDATED: we need the computation account pubkey so we can derive the same Job PDA seeds.
    /// CHECK: Provided by Arcium runtime; used only to derive Job PDA seeds.
    #[account(mut)]
    pub computation_account: UncheckedAccount<'info>, // UPDATED: added

    // UPDATED: read-only open; we can also set `close = payer` here if you want to auto-close after emit.
    #[account(
        mut,
        seeds = [QualityJob::SEED, computation_account.key().as_ref()], // UPDATED
        bump
        // , close = payer  // <— uncomment to auto-close and refund rent to payer
    )]
    pub job_pda: Account<'info, QualityJob>, // UPDATED

    /// CHECK: This is the instructions sysvar account required for callback validation.
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
}

#[init_computation_definition_accounts("compute_accuracy_score", payer)]
#[derive(Accounts)]
pub struct InitAccuracyScoreCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    /// CHECK: This is a raw account validated by Arcium runtime for Mempool context.
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Cluster account is not set")]
    ClusterNotSet,
}
