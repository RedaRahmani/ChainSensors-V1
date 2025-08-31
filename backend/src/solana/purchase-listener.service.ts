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
    this.listenerId = await this.solana.addPurchaseFinalizedListener(async (ev: any) => {
      try {
        this.logger.log('=== PurchaseFinalized Event Received ===');
        this.logger.log('Raw event data:', JSON.stringify(ev, null, 2));

        const listing = new PublicKey(ev.listing);
        const record = new PublicKey(ev.record);
        const buyerX = Uint8Array.from(ev.buyerX25519Pubkey ?? ev.buyer_x25519_pubkey ?? ev.buyerX25519PubKey ?? []);
        const mxeCid: string = ev.dekCapsuleForMxeCid ?? ev.dek_capsule_for_mxe_cid;

        if (!mxeCid || !buyerX?.length) {
          this.logger.error('Event missing required fields', {
            listing: listing.toBase58(),
            record: record.toBase58(),
            hasMxeCid: !!mxeCid,
            hasBuyerKey: !!buyerX?.length,
          });
          return;
        }

        this.logger.log('Parsed event data:', {
          listing: listing.toBase58(),
          record: record.toBase58(),
          buyerX25519Length: buyerX?.length ?? 0,
          buyerX25519: buyerX ? Array.from(buyerX) : null,
          mxeCid,
          mxeCidLength: mxeCid?.length ?? 0,
        });

        // Strictly on-chain reseal: submit job and log. We DO NOT use any HTTP Arcium path.
        try {
          const { bytes } = await this.walrus.fetchFileSmart(mxeCid);
          if (bytes.length !== 144) {
            this.logger.warn(`MXE Walrus blob length=${bytes.length} (expected 144). Skipping reseal submission from listener.`);
            return;
          }
          const { sig, computationOffset } = await this.arcium.resealDekOnChain({
            mxeCapsule: bytes,
            buyerX25519Pubkey: buyerX,
            listingState: listing,
            purchaseRecord: record,
          });
          this.logger.log(`reseal_dek queued from listener: tx=${sig} offset=${computationOffset.toString()}`);
        } catch (e: any) {
          this.logger.error('Listener reseal submission failed', { err: e?.message });
        }

      } catch (e: any) {
        this.logger.error('=== PURCHASE LISTENER ERROR ===', {
          error: e?.message,
          stack: e?.stack,
          eventData: JSON.stringify(ev, null, 2),
        });
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
