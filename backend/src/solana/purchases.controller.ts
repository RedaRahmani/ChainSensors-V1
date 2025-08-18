// import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
// import { PublicKey } from '@solana/web3.js';
// import { SolanaService } from './solana.service';

// @Controller('purchases')
// export class PurchasesController {
//   constructor(private readonly solana: SolanaService) {}

//   @Get(':recordPk/capsule')
//   async getBuyerCapsuleCid(@Param('recordPk') recordPk: string) {
//     let pk: PublicKey;
//     try {
//       pk = new PublicKey(recordPk);
//     } catch {
//       throw new BadRequestException('Invalid record public key');
//     }
//     const cid = await this.solana.getPurchaseRecordBuyerCid(pk);
//     return { record: recordPk, dek_capsule_for_buyer_cid: cid };
//   }
// }
import { Controller, Get, Post, Param, Body, BadRequestException } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { SolanaService } from './solana.service';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly solana: SolanaService) {}

  @Get(':recordPk/capsule')
  async getBuyerCapsuleCid(@Param('recordPk') recordPk: string) {
    let pk: PublicKey;
    try { pk = new PublicKey(recordPk); } 
    catch { throw new BadRequestException('Invalid record public key'); }
    const cid = await this.solana.getPurchaseRecordBuyerCid(pk);
    return { record: recordPk, dek_capsule_for_buyer_cid: cid };
  }

  // ⬇ dev-only helper to “finalize” a purchase by writing a CID
  @Post(':recordPk/finalize')
  async finalizeManually(
    @Param('recordPk') recordPk: string,
    @Body() body: { listingPk: string; cid: string }
  ) {
    if (!body?.listingPk || !body?.cid) throw new BadRequestException('listingPk and cid are required');
    const record = new PublicKey(recordPk);
    const listing = new PublicKey(body.listingPk);
    const sig = await this.solana.finalizePurchaseOnChain({
      listing,
      record,
      dekCapsuleForBuyerCid: body.cid,
    });
    return { ok: true, signature: sig };
  }
}

