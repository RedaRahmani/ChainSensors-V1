import { Body, Controller, Get, HttpException, HttpStatus, Logger, Post } from '@nestjs/common';
import { ArciumService } from './arcium.service';
import { WalrusService } from '../walrus/walrus.service';

@Controller('arcium')
export class ArciumController {
  private readonly logger = new Logger(ArciumController.name);

  constructor(
    private readonly arcium: ArciumService,
    private readonly walrus: WalrusService,
  ) {}

  // --- Public: expose MXE X25519 pubkey (base64) for client-side sealing ---
  @Get('mxe-pubkey')
  async getMxePubkey() {
    const x25519PubkeyB64 = await this.arcium.getMxePublicKeyB64();
    return { x25519PubkeyB64 };
  }

  /**
   * OPTIONAL helper: server-side "seal to MXE" then upload to Walrus.
   * This does NOT use any HTTP path to Arcium — it’s purely client-side ECIES + Walrus.
   */
  @Post('capsules/upload')
  async uploadCapsule(@Body() body: { dekBase64?: string }) {
    this.logger.log('POST /arcium/capsules/upload');
    try {
      const dekB64 = body?.dekBase64?.trim();
      if (!dekB64) throw new Error('dekBase64 required');
      const dek = Buffer.from(dekB64, 'base64');
      if (dek.length !== 32) throw new Error('dekBase64 must decode to exactly 32 bytes');

      const mxeCipherBytes = await this.arcium.sealDekForMxe(dek);
      const dekCapsuleForMxeCid = await this.walrus.uploadData(mxeCipherBytes);

      this.logger.log('uploadCapsule -> OK', { dekCapsuleForMxeCid });
      return { dekCapsuleForMxeCid };
    } catch (e: any) {
      this.logger.error('uploadCapsule -> FAIL', { err: e?.message });
      throw new HttpException(
        e?.message || 'Failed to create/upload capsule',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * STRICTLY ON-CHAIN: start a reseal job and return the job info.
   * We do NOT try to fetch bytes over HTTP. The result becomes available
   * after finalization via your on-chain flow (callback/data-object).
   */
  @Post('capsules/reseal')
  async reseal(@Body() body: { mxeCapsuleCid?: string; buyerX25519PubkeyB64?: string }) {
    this.logger.log('POST /arcium/capsules/reseal');

    const mxeCapsuleCid = body?.mxeCapsuleCid?.trim();
    const buyerX25519PubkeyB64 = body?.buyerX25519PubkeyB64?.trim();
    if (!mxeCapsuleCid || !buyerX25519PubkeyB64) {
      throw new HttpException('mxeCapsuleCid and buyerX25519PubkeyB64 required', HttpStatus.BAD_REQUEST);
    }

    try {
      const buyerKey = Buffer.from(buyerX25519PubkeyB64, 'base64');
      if (buyerKey.length !== 32) throw new Error('buyerX25519PubkeyB64 must decode to 32 bytes');

      // Load the MXE capsule bytes from Walrus
      const mxeCapsuleBytes = await this.walrus.fetchFile(mxeCapsuleCid);

      // Queue encrypted IX on-chain (no HTTP fallback)
      const { sig, computationOffset } = await this.arcium.resealDekOnChain({
        mxeCapsule: mxeCapsuleBytes,
        buyerX25519Pubkey: buyerKey,
      });

      // Return job metadata to the client; downstream can observe finalization/callback
      return {
        status: 'queued',
        txSig: sig,
        computationOffset: computationOffset.toString(),
      };
    } catch (e: any) {
      this.logger.error('reseal -> FAIL', { err: e?.message });
      throw new HttpException(e?.message || 'reseal failed', HttpStatus.BAD_REQUEST);
    }
  }
}
