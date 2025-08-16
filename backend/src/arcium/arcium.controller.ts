// import { Body, Controller, Get, HttpException, HttpStatus, Post } from '@nestjs/common';
// import { ArciumService } from './arcium.service';
// import { WalrusService } from '../walrus/walrus.service';

// @Controller()
// export class ArciumController {
//   constructor(
//     private readonly arcium: ArciumService,
//     private readonly walrus: WalrusService,
//   ) {}

//   // For frontend (or ops) to inspect which MXE pubkey is in use
//   @Get('arcium/mxe-pubkey')
//   async getMxePubkey() {
//     const x25519PubkeyB64 = await this.arcium.getMxePublicKeyB64();
//     return { x25519PubkeyB64 };
//   }

//   /**
//    * Production bridge used by your CreateListing page:
//    * POST /capsules/upload { dekBase64 }
//    * -> seals DEK to MXE, uploads capsule to Walrus, returns { blobId }
//    */
//   @Post('capsules/upload')
//   async uploadCapsule(@Body() body: { dekBase64?: string }) {
//     try {
//       const dekB64 = body?.dekBase64?.trim();
//       if (!dekB64) throw new Error('dekBase64 required');
//       const dek = Buffer.from(dekB64, 'base64');
//       if (dek.length !== 32) throw new Error('dekBase64 must decode to exactly 32 bytes');

//       const capsule = await this.arcium.sealDekForMxe(dek);
//       const blobId = await this.walrus.putCapsule(capsule);
//       return { blobId };
//     } catch (e: any) {
//       throw new HttpException(e?.message || 'Failed to create/upload capsule', HttpStatus.BAD_REQUEST);
//     }
//   }
// }
import { Body, Controller, Get, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ArciumService } from './arcium.service';
import { WalrusService } from '../walrus/walrus.service';

@Controller('arcium')
export class ArciumController {
  constructor(
    private readonly arcium: ArciumService,
    private readonly walrus: WalrusService,
  ) {}

  @Get('mxe-pubkey')
  async getMxePubkey() {
    const x25519PubkeyB64 = await this.arcium.getMxePublicKeyB64();
    return { x25519PubkeyB64 };
  }

  /**
   * POST /arcium/capsules/upload
   * { dekBase64 } -> seals DEK to MXE, uploads capsule to Walrus, returns { dekCapsuleForMxeCid }
   */
  @Post('capsules/upload')
  async uploadCapsule(@Body() body: { dekBase64?: string }) {
    try {
      const dekB64 = body?.dekBase64?.trim();
      if (!dekB64) throw new Error('dekBase64 required');
      const dek = Buffer.from(dekB64, 'base64');
      if (dek.length !== 32) throw new Error('dekBase64 must decode to exactly 32 bytes');

      const capsule = await this.arcium.sealDekForMxe(dek);
      const dekCapsuleForMxeCid = await this.walrus.uploadData(capsule);
      return { dekCapsuleForMxeCid };
    } catch (e: any) {
      throw new HttpException(e?.message || 'Failed to create/upload capsule', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /arcium/capsules/reseal
   * { mxeCapsuleCid, buyerX25519PubkeyB64 } -> (will throw until reseal circuit is live)
   */
  @Post('capsules/reseal')
  async reseal(@Body() body: { mxeCapsuleCid?: string; buyerX25519PubkeyB64?: string }) {
    const mxeCapsuleCid = body?.mxeCapsuleCid?.trim();
    const buyerX25519PubkeyB64 = body?.buyerX25519PubkeyB64?.trim();
    if (!mxeCapsuleCid || !buyerX25519PubkeyB64) {
      throw new HttpException('mxeCapsuleCid and buyerX25519PubkeyB64 required', HttpStatus.BAD_REQUEST);
    }

    try {
      const buyerKey = Buffer.from(buyerX25519PubkeyB64, 'base64');
      if (buyerKey.length !== 32) throw new Error('buyerX25519PubkeyB64 must decode to 32 bytes');
      const mxeCapsule = await this.walrus.fetchFile(mxeCapsuleCid);
      const buyerCapsule = await this.arcium.reencryptDekForBuyer(mxeCapsule, buyerKey);
      const buyerCapsuleCid = await this.walrus.uploadData(buyerCapsule);
      return { buyerCapsuleCid };
    } catch (e: any) {
      throw new HttpException(e?.message || 'reseal failed', HttpStatus.BAD_REQUEST);
    }
  }
}
