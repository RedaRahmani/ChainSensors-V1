import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { WalrusService } from '../walrus/walrus.service';
import { ArciumService } from '../arcium/arcium.service';
import { SolanaService } from './solana.service';

@Injectable()
export class PurchaseListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PurchaseListenerService.name);
  private listenerId: number | null = null;

  constructor(
    private readonly solana: SolanaService,
    private readonly walrus: WalrusService,
    private readonly arcium: ArciumService,
  ) {}

  async onModuleInit() {
    // Listen to on-chain PurchaseFinalized (emitted in purchase_listing)
    this.listenerId = await this.solana.addPurchaseFinalizedListener(async (ev: any) => {
      try {
        const listing = new PublicKey(ev.listing);
        const record = new PublicKey(ev.record);
        const buyerX = Uint8Array.from(ev.buyerX25519Pubkey ?? ev.buyer_x25519_pubkey ?? ev.buyerX25519PubKey ?? []);
        const mxeCid: string = ev.dekCapsuleForMxeCid ?? ev.dek_capsule_for_mxe_cid;

        if (!mxeCid || !buyerX?.length) {
          this.logger.warn(`event missing fields, listing=${listing.toBase58()}, record=${record.toBase58()}`);
          return;
        }

        // 1) Fetch MXE capsule from Walrus
        const mxeCapsule = await this.walrus.fetchFile(mxeCid);

        // 2) Re-seal via Arcium MPC (requires your re-seal circuit/IX)
        let buyerCapsule: Buffer;
        try {
          buyerCapsule = await this.arcium.reencryptDekForBuyer(mxeCapsule, buyerX);
        } catch (e: any) {
          // This will throw until your compute is deployed — log clearly and bail (no fake).
          this.logger.error(`re-seal unavailable: ${e?.message}`);
          return;
        }

        // 3) Upload buyer capsule → Walrus
        const buyerCid = await this.walrus.uploadData(buyerCapsule);

        // 4) Call on-chain finalize_purchase to persist buyer CID
        await this.solana.finalizePurchaseOnChain({
          listing,
          record,
          dekCapsuleForBuyerCid: buyerCid,
        });

        this.logger.log(
          `purchase sealed: listing=${listing.toBase58()} record=${record.toBase58()} buyerCid=${buyerCid}`,
        );
      } catch (e: any) {
        this.logger.error(`listener error: ${e?.message}`);
      }
    });

    this.logger.log(`PurchaseFinalized listener attached (id=${this.listenerId})`);
  }

  async onModuleDestroy() {
    if (this.listenerId != null) {
      try { await this.solana.removeEventListener(this.listenerId); } catch {}
    }
  }
}
