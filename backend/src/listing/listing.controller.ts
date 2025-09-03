import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
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
    this.logger.log('POST /listings (prepare create)', {
      sellerPubkey: dto?.sellerPubkey,
      deviceId: dto?.deviceId,
      pricePerUnit: dto?.pricePerUnit,
      totalDataUnits: dto?.totalDataUnits,
      dekCapsuleForMxeCid_len: dto?.dekCapsuleForMxeCid?.length ?? 0,
    });
    try {
      const sellerPubkey = new PublicKey(dto.sellerPubkey);
      const out = await this.listingService.prepareCreateListing(dto, sellerPubkey);
      this.logger.log('prepare create -> OK', out);
      return out;
    } catch (e: any) {
      this.logger.error('prepare create -> FAIL', { err: e?.message, stack: e?.stack });
      throw e;
    }
  }

  @Post('finalize')
  @HttpCode(HttpStatus.OK)
  async finalize(@Body() body: { listingId: string; signedTx: string }) {
    this.logger.log('POST /listings/finalize', { listingId: body?.listingId });
    try {
      const out = await this.listingService.finalizeCreateListing(body.listingId, body.signedTx);
      this.logger.log('finalize create -> OK', out);
      return out;
    } catch (e: any) {
      this.logger.error('finalize create -> FAIL', { err: e?.message, stack: e?.stack });
      throw e;
    }
  }

  @Post('by-seller')
  @HttpCode(HttpStatus.OK)
  async findBySeller(@Body() body: { sellerPubkey: string }) {
    this.logger.log('POST /listings/by-seller', { sellerPubkey: body?.sellerPubkey });
    return this.listingService.findBySeller(new PublicKey(body.sellerPubkey));
  }

  @Get('active')
  @HttpCode(HttpStatus.OK)
  async findActiveListings() {
    this.logger.log('GET /listings/active');
    return this.listingService.findActiveListings();
  }

  @Post('expire-all')
  @HttpCode(HttpStatus.OK)
  async expireAllListings() {
    this.logger.log('POST /listings/expire-all');
    try {
      const result = await this.listingService.expireAllActiveListings();
      this.logger.log('expireAllListings -> OK', { result });
      return {
        success: true,
        message: 'All active listings have been expired',
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      };
    } catch (error: any) {
      this.logger.error('expireAllListings -> FAIL', { error: error.message, stack: error.stack });
      throw new InternalServerErrorException(`Failed to expire listings: ${error.message}`);
    }
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
      this.logger.log('preparePurchase -> OK', { keys: Object.keys(result), result });
      return result;
    } catch (error: any) {
      this.logger.error('preparePurchase -> FAIL', {
        error: error.message,
        body,
        stack: error?.stack,
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
    this.logger.log('POST /listings/finalize-purchase', { listingId: body?.listingId, units: body?.unitsRequested });
    try {
      const result = await this.listingService.finalizePurchase(
        body.listingId,
        body.signedTx,
        body.unitsRequested,
      );
      this.logger.log('finalizePurchase -> OK', { result });
      return result;
    } catch (error: any) {
      this.logger.error('finalizePurchase -> FAIL', {
        error: error.message,
        stack: error.stack,
        body,
      });
      if (error.message.includes('Blockhash not found')) {
        throw new BadRequestException('Transaction blockhash is stale. Please try again.');
      }
      if (error.message.includes('AccountNotInitialized')) {
        throw new BadRequestException('Buyer USDC token account not initialized.');
      }
      throw new InternalServerErrorException(`Failed to finalize purchase: ${error.message}`);
    }
  }
}
