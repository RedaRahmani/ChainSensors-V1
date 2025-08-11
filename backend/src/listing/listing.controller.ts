import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { ListingService } from './listing.service';
import { CreateListingDto } from './dto/create-listing.dto';

@Controller('listings')
export class ListingController {
  private readonly logger = new Logger(ListingController.name);

  constructor(private readonly listingService: ListingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async prepare(@Body() dto: CreateListingDto) {
    const sellerPubkey = new PublicKey(dto.sellerPubkey);
    return this.listingService.prepareCreateListing(dto, sellerPubkey);
  }

  @Post('finalize')
  @HttpCode(HttpStatus.OK)
  async finalize(@Body() body: { listingId: string; signedTx: string }) {
    return this.listingService.finalizeCreateListing(
      body.listingId,
      body.signedTx,
    );
  }

  @Post('by-seller')
  @HttpCode(HttpStatus.OK)
  async findBySeller(@Body() body: { sellerPubkey: string }) {
    return this.listingService.findBySeller(new PublicKey(body.sellerPubkey));
  }

  @Get('active')
  @HttpCode(HttpStatus.OK)
  async findActiveListings() {
    return this.listingService.findActiveListings();
  }

  @Post('prepare-purchase')
  @HttpCode(HttpStatus.OK)
  async preparePurchase(
    @Body()
    body: {
      listingId: string;
      buyerPubkey: string;
      unitsRequested: number;
      buyerEphemeralPubkey: number[];
    },
  ) {
    this.logger.log('POST /listings/prepare-purchase', { body });
    try {
      if (!Array.isArray(body.buyerEphemeralPubkey) || body.buyerEphemeralPubkey.length !== 32) {
      throw new BadRequestException('buyerEphemeralPubkey must be 32 bytes');
    }
      const result = await this.listingService.preparePurchase(
        body.listingId,
        new PublicKey(body.buyerPubkey),
        body.unitsRequested,
        body.buyerEphemeralPubkey,
      );
      this.logger.log('preparePurchase response', { result });
      return result;
    } catch (error: any) {
      this.logger.error('preparePurchase failed', {
        error: error.message,
        body,
      });
      throw error;
    }
  }

  @Post('finalize-purchase')
  async finalizePurchase(
    @Body()
    body: {
      listingId: string;
      signedTx: string;
      unitsRequested: number;
    },
  ) {
    this.logger.log('POST /listings/finalize-purchase', { body });
    try {
      const result = await this.listingService.finalizePurchase(
        body.listingId,
        body.signedTx,
        body.unitsRequested,
      );
      this.logger.log('finalizePurchase response', { result });
      return result;
    } catch (error: any) {
      this.logger.error('finalizePurchase failed', {
        error: error.message,
        stack: error.stack,
        body,
      });
      if (error.message.includes('Blockhash not found')) {
        throw new BadRequestException(
          'Transaction blockhash is stale. Please try again.',
        );
      }
      if (error.message.includes('AccountNotInitialized')) {
        throw new BadRequestException(
          'Buyer USDC token account not initialized.',
        );
      }
      throw new InternalServerErrorException(
        `Failed to finalize purchase: ${error.message}`,
      );
    }
  }
}
