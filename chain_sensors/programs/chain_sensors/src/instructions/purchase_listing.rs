use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use crate::state::{ListingState, Marketplace, DeviceRegistry, PurchaseRecord};

#[derive(Accounts)]
#[instruction(listing_id: String, units_requested: u64,  buyer_x25519_pubkey: [u8; 32])]
pub struct PurchaseListing<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = listing_state.seller,
    )]
    pub seller_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"treasury", marketplace.admin.as_ref()],
        bump = marketplace.treasury_bump,
    )]
    pub treasury_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"listing", device_registry.key().as_ref(), listing_id.as_bytes()],
        bump = listing_state.bump,
        constraint = listing_state.status == 0 @ ErrorCode::ListingNotActive,
        constraint = listing_state.seller != buyer.key() @ ErrorCode::CannotBuyOwnListing,
    )]
    pub listing_state: Account<'info, ListingState>,

    #[account(
        seeds = [b"marketplace", marketplace.admin.as_ref()],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        seeds = [b"device", marketplace.key().as_ref(), device_registry.device_id.as_bytes()],
        bump = device_registry.bump,
        constraint = device_registry.is_active @ ErrorCode::DeviceInactive,
    )]
    pub device_registry: Account<'info, DeviceRegistry>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,

    #[account(
        init,
        payer = buyer,
        space = 8 + PurchaseRecord::INIT_SPACE,
        seeds = [
            b"purchase",
            listing_state.key().as_ref(),
            &listing_state.purchase_count.to_le_bytes()
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

pub fn handler(
    ctx: Context<PurchaseListing>,
    listing_id: String,
    units_requested: u64,
    // UPDATED: capture buyer's X25519 ephemeral pubkey (sealed-box recipient)
    buyer_x25519_pubkey: [u8; 32],
) -> Result<()> {
    let listing = &mut ctx.accounts.listing_state;
    let clock = Clock::get()?;

    // Basic validation
    require!(units_requested > 0, ErrorCode::InvalidUnitsRequested);
    require!(listing.status == 0, ErrorCode::ListingNotActive);
    require!(listing.seller != ctx.accounts.buyer.key(), ErrorCode::CannotBuyOwnListing);

    // Expiry check
    if let Some(expiry) = listing.expires_at {
        require!(clock.unix_timestamp <= expiry, ErrorCode::ListingExpired);
    }

    // Inventory check
    require!(units_requested <= listing.remaining_units, ErrorCode::InsufficientUnits);

    // Compute payment amounts with better overflow protection
    let price_for_units = listing.price_per_unit
        .checked_mul(units_requested)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // Ensure buyer has sufficient funds BEFORE computing fees
    require!(ctx.accounts.buyer_ata.amount >= price_for_units, ErrorCode::InsufficientFunds);

    // Use u128 for intermediate calculations to prevent overflow
    let fee_calc = (price_for_units as u128)
        .checked_mul(ctx.accounts.marketplace.seller_fee as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ErrorCode::MathOverflow)?;
    
    let fee: u64 = fee_calc.try_into().map_err(|_| ErrorCode::MathOverflow)?;
    let amount_to_seller = price_for_units.checked_sub(fee).ok_or(ErrorCode::MathOverflow)?;

    require!(fee.checked_add(amount_to_seller) == Some(price_for_units), ErrorCode::MathOverflow);

    // Update listing BEFORE transfers
    listing.remaining_units = listing
        .remaining_units
        .checked_sub(units_requested)
        .ok_or(ErrorCode::MathOverflow)?;
    listing.updated_at = clock.unix_timestamp;
    listing.buyer = Some(ctx.accounts.buyer.key());

    if listing.remaining_units == 0 {
        listing.status = 1; // Sold out
        listing.sold_at = Some(clock.unix_timestamp);
    }

    // Increment purchase counter
    listing.purchase_count = listing.purchase_count.checked_add(1).unwrap();

    // Record the purchase BEFORE transfers
    let record = &mut ctx.accounts.purchase_record;
    record.listing         = listing.key();
    record.buyer           = ctx.accounts.buyer.key();
    record.units_purchased = units_requested;
    record.price_paid      = price_for_units;
    record.fee             = fee;
    record.timestamp       = clock.unix_timestamp;
    // persist buyer's sealed-box public key
    record.buyer_x25519_pubkey = buyer_x25519_pubkey;

    // 1) Transfer fee → treasury
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

    // 2) Transfer remainder → seller
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

    // Emit event
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

    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Listing is not active")]        ListingNotActive,
    #[msg("Cannot buy your own listing")]  CannotBuyOwnListing,
    #[msg("Listing has expired")]          ListingExpired,
    #[msg("Invalid number of units requested")] InvalidUnitsRequested,
    #[msg("Insufficient funds")]            InsufficientFunds,
    #[msg("Insufficient units available")]   InsufficientUnits,
    #[msg("Math overflow")]                 MathOverflow,
    #[msg("Device is inactive")]            DeviceInactive,
}
