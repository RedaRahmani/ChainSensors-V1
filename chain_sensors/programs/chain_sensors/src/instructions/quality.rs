use anchor_lang::prelude::*;
use crate::state::dq::{DqConfig, DqState};

/// Bit flags for consistency anomalies
pub const FLAG_NOISY: u8 = 1 << 0;
pub const FLAG_STUCK: u8 = 1 << 1;

#[event]
pub struct DataQualityEvent {
    pub device: Pubkey,
    pub listing: Pubkey,
    pub window_start: i64,
    pub window_end: i64,
    pub field_completeness_bps: u16,
    pub packet_completeness_bps: u16,
    pub stale_ratio_bps: u16,
    pub delay_p50_ms: u32,
    pub delay_p90_ms: u32,
    pub delay_p99_ms: u32,
    pub rolling_var_q16_16: u32,
    pub flags: u8,
    pub accuracy_score_opt: Option<u8>,
    pub quality_score_bps_opt: Option<u16>,
}

#[derive(Accounts)]
pub struct InitDqForDevice<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: device account/PDA (pointer only)
    pub device: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [b"dqcfg", device.key().as_ref()],
        bump,
        space = DqConfig::SPACE,
    )]
    pub dq_config: Account<'info, DqConfig>,

    #[account(
        init,
        payer = payer,
        seeds = [b"dqstate", device.key().as_ref()],
        bump,
        space = DqState::SPACE,
    )]
    pub dq_state: Account<'info, DqState>,

    pub system_program: Program<'info, System>,
}

pub fn init_dq_for_device_handler(
    ctx: Context<InitDqForDevice>,
    authority: Pubkey,
    expected_rate_hz: u32,
    stale_threshold_ms: u32,
    var_hi_q16_16: u32,
    var_lo_q16_16: u32,
    eps_q16_16: u32,
) -> Result<()> {
    let cfg = &mut ctx.accounts.dq_config;
    let st = &mut ctx.accounts.dq_state;
    let bumps = ctx.bumps;

    cfg.bump = bumps.dq_config;
    cfg.device = ctx.accounts.device.key();
    cfg.authority = authority;
    cfg.expected_rate_hz = expected_rate_hz;
    cfg.stale_threshold_ms = stale_threshold_ms;
    cfg.var_hi_q16_16 = var_hi_q16_16;
    cfg.var_lo_q16_16 = var_lo_q16_16;
    cfg.eps_q16_16 = eps_q16_16;

    st.bump = bumps.dq_state;
    st.device = ctx.accounts.device.key();
    st.last_window_start = 0;
    st.last_window_end = 0;
    st.last_quality_bps = 0;
    st.last_accuracy_u8 = 0;
    st.window_count = 0;
    st.last_updated_ts = 0;
    st.last_acc_ciphertext_hash = [0u8; 32];
    st.last_acc_nonce_le = [0u8; 16];
    st.reserved = [0u8; 16];
    Ok(())
}

#[derive(Accounts)]
pub struct PublishQualityMetrics<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: pointer-only
    pub device: UncheckedAccount<'info>,
    /// CHECK: pointer-only
    pub listing: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"dqcfg", device.key().as_ref()],
        bump = dq_config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub dq_config: Account<'info, DqConfig>,

    #[account(
        mut,
        seeds = [b"dqstate", device.key().as_ref()],
        bump = dq_state.bump,
    )]
    pub dq_state: Account<'info, DqState>,

    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn publish_quality_metrics_handler(
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
    let st = &mut ctx.accounts.dq_state;
    st.last_window_start = window_start;
    st.last_window_end = window_end;
    st.window_count = st.window_count.saturating_add(1);
    st.last_updated_ts = Clock::get()?.unix_timestamp;
    if let Some(q) = quality_score_bps_opt { st.last_quality_bps = q; }
    if let Some(a) = accuracy_score_opt { st.last_accuracy_u8 = a; }

    emit!(DataQualityEvent {
        device:  ctx.accounts.device.key(),
        listing: ctx.accounts.listing.key(),
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
    });
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized caller")]
    Unauthorized,
}
