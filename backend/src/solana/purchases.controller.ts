import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { SolanaService } from './solana.service';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly solana: SolanaService) {}

  @Get(':recordPk/capsule')
  async getBuyerCapsuleCid(@Param('recordPk') recordPk: string) {
    let pk: PublicKey;
    try {
      pk = new PublicKey(recordPk);
    } catch {
      throw new BadRequestException('Invalid record public key');
    }
    const cid = await this.solana.getPurchaseRecordBuyerCid(pk);
    return { record: recordPk, dek_capsule_for_buyer_cid: cid };
  }
}
