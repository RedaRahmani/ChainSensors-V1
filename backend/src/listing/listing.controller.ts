import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { ListingService } from './listing.service';
import { CreateListingDto } from './dto/create-listing.dto';

@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  /**
   * Phase 1: prepare unsigned createListing tx
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async prepare(@Body() dto: CreateListingDto) {
    const sellerPubkey = new PublicKey(dto.sellerPubkey);
    return this.listingService.prepareCreateListing(dto, sellerPubkey);
  }

  /**
   * Phase 2: submit signed tx
   */
  @Post('finalize')
  @HttpCode(HttpStatus.OK)
  async finalize(
    @Body() body: { listingId: string; signedTx: string }
  ) {
    return this.listingService.finalizeCreateListing(
      body.listingId,
      body.signedTx,
    );
  }

  /**
   * List all listings by seller
   */
  @Post('by-seller')
  @HttpCode(HttpStatus.OK)
  async findBySeller(@Body() body: { sellerPubkey: string }) {
    return this.listingService.findBySeller(
      new PublicKey(body.sellerPubkey),
    );
  }
}