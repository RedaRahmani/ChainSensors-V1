use anchor_lang::prelude::*;
use crate::state::{DeviceRegistry, Marketplace};
use anchor_lang::solana_program::clock::Clock;

#[derive(Accounts)]
#[instruction(device_id: String)]
pub struct CancelDevice<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"marketplace", marketplace.admin.as_ref()],
        bump = marketplace.bump,
        constraint = marketplace.is_active @ ErrorCode::MarketplaceInactive,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        mut,
        seeds = [b"device", marketplace.key().as_ref(), device_id.as_bytes()],
        bump = device_registry.bump,
        constraint = device_registry.owner == owner.key() @ ErrorCode::Unauthorized,
        constraint = device_registry.is_active @ ErrorCode::DeviceAlreadyInactive,
    )]
    pub device_registry: Account<'info, DeviceRegistry>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelDevice>, device_id: String) -> Result<()> {
    let device = &mut ctx.accounts.device_registry;
    let clock = Clock::get()?;

    // Input validation
    require!(!device_id.is_empty(), ErrorCode::DeviceIdEmpty);
    require!(device_id.len() <= 32, ErrorCode::DeviceIdTooLong);

    // Deactivate the device
    device.is_active = false;
    device.updated_at = clock.unix_timestamp;

    msg!("Device deactivated: {} by owner: {}", device_id, device.owner);

    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Marketplace is not active")]
    MarketplaceInactive,
    #[msg("Only the device owner can deactivate the device")]
    Unauthorized,
    #[msg("Device is already inactive")]
    DeviceAlreadyInactive,
    #[msg("Device ID cannot be empty")]
    DeviceIdEmpty,
    #[msg("Device ID exceeds 32 characters")]
    DeviceIdTooLong,
}
