use anchor_lang::prelude::*;
use crate::state::{Marketplace, ListingState, PurchaseRecord};

#[derive(Accounts)]
pub struct FinalizePurchase<'info> {
    /// Seller or marketplace admin
    pub authority: Signer<'info>,

    /// Marketplace (for admin auth + seed check)
    #[account(
        seeds = [b"marketplace", marketplace.admin.as_ref()],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,

    /// Listing this purchase belongs to (kept lean to avoid stack blowups)
    pub listing_state: Account<'info, ListingState>,

    /// The specific purchase record to finalize
    #[account(mut)]
    pub purchase_record: Account<'info, PurchaseRecord>,

    pub clock: Sysvar<'info, Clock>,
}

#[event]
pub struct PurchaseSealed {
    pub listing: Pubkey,
    pub record: Pubkey,
    pub buyer: Pubkey,
    pub dek_capsule_for_buyer_cid: String,
    pub authority: Pubkey, // who finalized (seller or admin)
    pub timestamp: i64,
}

pub fn handler(
    ctx: Context<FinalizePurchase>,
    dek_capsule_for_buyer_cid: String,
) -> Result<()> {
    let listing = &ctx.accounts.listing_state;
    let record  = &mut ctx.accounts.purchase_record;

    // ---------- Auth ----------
    let is_seller = ctx.accounts.authority.key() == listing.seller;
    let is_admin  = ctx.accounts.authority.key() == ctx.accounts.marketplace.admin;
    require!(is_seller || is_admin, ErrorCode::UnauthorizedFinalize);

    // ---------- Integrity checks ----------
    require_keys_eq!(record.listing, listing.key(), ErrorCode::RecordListingMismatch);
    require_keys_eq!(listing.marketplace, ctx.accounts.marketplace.key(), ErrorCode::WrongMarketplaceForListing);

    // Must have Phase-1 capsule on record (set during purchase)
    require!(
        !record.dek_capsule_for_mxe_cid.is_empty(),
        ErrorCode::MissingMxeCapsuleOnRecord
    );

    // CID validations
    require!(!dek_capsule_for_buyer_cid.is_empty(), ErrorCode::CidEmpty);
    require!(dek_capsule_for_buyer_cid.len() <= 64, ErrorCode::CidTooLong);

    // One-time set; prevent overwrite
    require!(record.dek_capsule_for_buyer_cid.is_empty(), ErrorCode::AlreadyFinalized);

    // ---------- Write ----------
    record.dek_capsule_for_buyer_cid = dek_capsule_for_buyer_cid.clone();

    // ---------- Signal ----------
    let ts = Clock::get()?.unix_timestamp;
    emit!(PurchaseSealed {
        listing: listing.key(),
        record:  record.key(),
        buyer:   record.buyer,
        dek_capsule_for_buyer_cid,
        authority: ctx.accounts.authority.key(),
        timestamp: ts,
    });

    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Only the listing's seller or marketplace admin may finalize.")]
    UnauthorizedFinalize,
    #[msg("Purchase record does not belong to the provided listing.")]
    RecordListingMismatch,
    #[msg("Wrong marketplace for listing.")]
    WrongMarketplaceForListing,
    #[msg("Buyer capsule CID cannot be empty.")]
    CidEmpty,
    #[msg("Buyer capsule CID exceeds 64 chars.")]
    CidTooLong,
    #[msg("Purchase record already finalized (buyer capsule present).")]
    AlreadyFinalized,
    #[msg("Missing MXE capsule on record; purchase not created by Phase-1 path.")]
    MissingMxeCapsuleOnRecord,
}
