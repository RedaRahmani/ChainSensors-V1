// programs/chain_sensors/src/instructions/purchase_listing.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use crate::state::{ListingState, Marketplace, DeviceRegistry, PurchaseRecord};

#[derive(Accounts)]
#[instruction(
    listing_id: String,
    units_requested: u64,
    buyer_x25519_pubkey: [u8; 32],
    purchase_index: u64,
)]
pub struct PurchaseListing<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    // Keep lean: no associated_token attr, we validate in handler
    #[account(mut)]
    pub buyer_ata: Account<'info, TokenAccount>,

    // Load marketplace first (referenced by others)
    #[account(
        seeds = [b"marketplace", marketplace.admin.as_ref()],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    // Device registry (lean)
    #[account(
        seeds = [b"device", marketplace.key().as_ref(), device_registry.device_id.as_bytes()],
        bump = device_registry.bump,
    )]
    pub device_registry: Account<'info, DeviceRegistry>,

    // Listing (lean)
    #[account(
        mut,
        seeds = [b"listing", device_registry.key().as_ref(), listing_id.as_bytes()],
        bump = listing_state.bump,
    )]
    pub listing_state: Account<'info, ListingState>,

    // Seller ATA (lean)
    #[account(mut)]
    pub seller_ata: Account<'info, TokenAccount>,

    // Treasury PDA authority must match marketplace.treasury
    #[account(
        seeds = [b"treasury", marketplace.admin.as_ref()],
        bump = marketplace.treasury_bump,
    )]
    /// CHECK: PDA authority only
    pub treasury: UncheckedAccount<'info>,

    // Treasury ATA (lean)
    #[account(mut)]
    pub treasury_ata: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,

    // Create the purchase record PDA using the **passed-in** purchase_index
    #[account(
        init,
        payer = buyer,
        space = 8 + PurchaseRecord::INIT_SPACE,
        seeds = [
            b"purchase",
            listing_state.key().as_ref(),
            &purchase_index.to_le_bytes(),
        ],
        bump,
    )]
    pub purchase_record: Account<'info, PurchaseRecord>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[event]
pub struct ListingPurchased {
    pub listing_id: [u8; 32],
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub units_purchased: u64,
    pub price_paid: u64,
    pub fee: u64,
    pub remaining_units: u64,
    pub timestamp: i64,
}

// Backend trigger event with encryption metadata (Phase-1)
#[event]
pub struct PurchaseFinalized {
    pub listing: Pubkey,
    pub record: Pubkey,
    pub buyer: Pubkey,
    pub buyer_x25519_pubkey: [u8; 32],
    pub dek_capsule_for_mxe_cid: String,
    pub timestamp: i64,
}

pub fn handler(
    ctx: Context<PurchaseListing>,
    listing_id: String,
    units_requested: u64,
    buyer_x25519_pubkey: [u8; 32],
    purchase_index: u64,
) -> Result<()> {
    let listing = &mut ctx.accounts.listing_state;
    let clock = Clock::get()?;

    msg!(
        "purchase start: listing_id='{}' units={} idx={}",
        listing_id,
        units_requested,
        purchase_index
    );

    // ---- Runtime validations moved from #[account(constraint=...)] ----
    require!(ctx.accounts.device_registry.is_active, ErrorCode::DeviceInactive);
    require_keys_eq!(ctx.accounts.treasury.key(), ctx.accounts.marketplace.treasury, ErrorCode::WrongTreasuryAuthority);

    require_keys_eq!(listing.marketplace, ctx.accounts.marketplace.key(), ErrorCode::WrongMarketplaceForListing);
    require_keys_eq!(listing.device, ctx.accounts.device_registry.key(), ErrorCode::WrongDeviceForListing);
    require_keys_eq!(listing.token_mint, ctx.accounts.usdc_mint.key(), ErrorCode::WrongMintForListing);

    require_keys_eq!(ctx.accounts.buyer_ata.owner, ctx.accounts.buyer.key(), ErrorCode::AtaWrongOwner);
    require_keys_eq!(ctx.accounts.buyer_ata.mint,  ctx.accounts.usdc_mint.key(), ErrorCode::AtaWrongMint);

    require_keys_eq!(ctx.accounts.seller_ata.owner, listing.seller, ErrorCode::AtaWrongOwner);
    require_keys_eq!(ctx.accounts.seller_ata.mint,  ctx.accounts.usdc_mint.key(), ErrorCode::AtaWrongMint);

    require_keys_eq!(ctx.accounts.treasury_ata.owner, ctx.accounts.treasury.key(), ErrorCode::AtaWrongOwner);
    require_keys_eq!(ctx.accounts.treasury_ata.mint,  ctx.accounts.usdc_mint.key(), ErrorCode::AtaWrongMint);

    // Stable index must match on-chain state (prevents dupes/races)
    require_eq!(purchase_index, listing.purchase_count, ErrorCode::PurchaseIndexMismatch);

    // Basic business rules
    require!(units_requested > 0, ErrorCode::InvalidUnitsRequested);
    require!(listing.status == 0, ErrorCode::ListingNotActive);
    require!(listing.seller != ctx.accounts.buyer.key(), ErrorCode::CannotBuyOwnListing);

    if let Some(expiry) = listing.expires_at {
        require!(clock.unix_timestamp <= expiry, ErrorCode::ListingExpired);
    }
    require!(units_requested <= listing.remaining_units, ErrorCode::InsufficientUnits);

    // Compute payment amounts
    let price_for_units = listing.price_per_unit
        .checked_mul(units_requested)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(ctx.accounts.buyer_ata.amount >= price_for_units, ErrorCode::InsufficientFunds);

    let fee_calc = (price_for_units as u128)
        .checked_mul(ctx.accounts.marketplace.seller_fee as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ErrorCode::MathOverflow)?;
    let fee: u64 = fee_calc.try_into().map_err(|_| ErrorCode::MathOverflow)?;
    let amount_to_seller = price_for_units.checked_sub(fee).ok_or(ErrorCode::MathOverflow)?;
    require!(fee.checked_add(amount_to_seller) == Some(price_for_units), ErrorCode::MathOverflow);

    // Update listing BEFORE transfers
    listing.remaining_units = listing.remaining_units.checked_sub(units_requested).ok_or(ErrorCode::MathOverflow)?;
    listing.updated_at = clock.unix_timestamp;
    listing.buyer = Some(ctx.accounts.buyer.key());

    if listing.remaining_units == 0 {
        listing.status = 1; // sold out
        listing.sold_at = Some(clock.unix_timestamp);
    }

    listing.purchase_count = listing.purchase_count.checked_add(1).ok_or(ErrorCode::MathOverflow)?;

    // Record purchase BEFORE transfers
    let record = &mut ctx.accounts.purchase_record;
    record.listing         = listing.key();
    record.buyer           = ctx.accounts.buyer.key();
    record.units_purchased = units_requested;
    record.price_paid      = price_for_units;
    record.fee             = fee;
    record.timestamp       = clock.unix_timestamp;
    record.buyer_x25519_pubkey = buyer_x25519_pubkey;
    // Phase-1 encryption metadata
    record.dek_capsule_for_mxe_cid   = listing.dek_capsule_for_mxe_cid.clone();
    record.dek_capsule_for_buyer_cid = String::new();

    // 1) Transfer fee → treasury ATA
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from:      ctx.accounts.buyer_ata.to_account_info(),
                to:        ctx.accounts.treasury_ata.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        fee,
    )?;

    // 2) Transfer remainder → seller ATA
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from:      ctx.accounts.buyer_ata.to_account_info(),
                to:        ctx.accounts.seller_ata.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        amount_to_seller,
    )?;

    // Emit events
    emit!(ListingPurchased {
        listing_id: listing_id.as_bytes().try_into().unwrap_or_default(),
        buyer:            ctx.accounts.buyer.key(),
        seller:           listing.seller,
        units_purchased:  units_requested,
        price_paid:       price_for_units,
        fee,
        remaining_units:  listing.remaining_units,
        timestamp:        clock.unix_timestamp,
    });

    emit!(PurchaseFinalized {
        listing: listing.key(),
        record:  record.key(),
        buyer:   ctx.accounts.buyer.key(),
        buyer_x25519_pubkey,
        dek_capsule_for_mxe_cid: listing.dek_capsule_for_mxe_cid.clone(),
        timestamp: clock.unix_timestamp,
    });

    msg!("purchase ok: idx {} -> {}", purchase_index, listing.purchase_count);
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Listing is not active")]                      ListingNotActive,
    #[msg("Cannot buy your own listing")]                CannotBuyOwnListing,
    #[msg("Listing has expired")]                        ListingExpired,
    #[msg("Invalid number of units requested")]          InvalidUnitsRequested,
    #[msg("Insufficient funds")]                         InsufficientFunds,
    #[msg("Insufficient units available")]               InsufficientUnits,
    #[msg("Math overflow")]                              MathOverflow,
    #[msg("Device is inactive")]                         DeviceInactive,
    #[msg("Wrong token mint for listing")]               WrongMintForListing,
    #[msg("Listing does not belong to marketplace")]     WrongMarketplaceForListing,
    #[msg("Listing does not belong to device")]          WrongDeviceForListing,
    #[msg("ATA has wrong owner/authority")]              AtaWrongOwner,
    #[msg("ATA has wrong mint")]                         AtaWrongMint,
    #[msg("Treasury PDA does not match marketplace")]    WrongTreasuryAuthority,
    #[msg("Client purchase_index does not match on-chain state")]
    PurchaseIndexMismatch,
}
