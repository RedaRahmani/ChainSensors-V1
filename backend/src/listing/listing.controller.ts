// import {
//   Controller,
//   Post,
//   Body,
//   HttpCode,
//   HttpStatus,
// } from '@nestjs/common';
// import { PublicKey } from '@solana/web3.js';
// import { ListingService } from './listing.service';
// import { CreateListingDto } from './dto/create-listing.dto';

// @Controller('listings')
// export class ListingController {
//   constructor(private readonly listingService: ListingService) {}

//   /**
//    * Phase 1: prepare unsigned createListing tx
//    */
//   @Post()
//   @HttpCode(HttpStatus.CREATED)
//   async prepare(@Body() dto: CreateListingDto) {
//     const sellerPubkey = new PublicKey(dto.sellerPubkey);
//     return this.listingService.prepareCreateListing(dto, sellerPubkey);
//   }

//   /**
//    * Phase 2: submit signed tx
//    */
//   @Post('finalize')
//   @HttpCode(HttpStatus.OK)
//   async finalize(
//     @Body() body: { listingId: string; signedTx: string }
//   ) {
//     return this.listingService.finalizeCreateListing(
//       body.listingId,
//       body.signedTx,
//     );
//   }

//   /**
//    * List all listings by seller
//    */
//   @Post('by-seller')
//   @HttpCode(HttpStatus.OK)
//   async findBySeller(@Body() body: { sellerPubkey: string }) {
//     return this.listingService.findBySeller(
//       new PublicKey(body.sellerPubkey),
//     );
//   }
// }

// import {
//   Controller,
//   Post,
//   Get,
//   Body,
//   HttpCode,
//   HttpStatus,
// } from '@nestjs/common';
// import { PublicKey } from '@solana/web3.js';
// import { ListingService } from './listing.service';
// import { CreateListingDto } from './dto/create-listing.dto';

// @Controller('listings')
// export class ListingController {
//   constructor(private readonly listingService: ListingService) {}

//   /**
//    * Phase 1: prepare unsigned createListing tx
//    */
//   @Post()
//   @HttpCode(HttpStatus.CREATED)
//   async prepare(@Body() dto: CreateListingDto) {
//     const sellerPubkey = new PublicKey(dto.sellerPubkey);
//     return this.listingService.prepareCreateListing(dto, sellerPubkey);
//   }

//   /**
//    * Phase 2: submit signed tx
//    */
//   @Post('finalize')
//   @HttpCode(HttpStatus.OK)
//   async finalize(
//     @Body() body: { listingId: string; signedTx: string }
//   ) {
//     return this.listingService.finalizeCreateListing(
//       body.listingId,
//       body.signedTx,
//     );
//   }

//   /**
//    * List all listings by seller
//    */
//   @Post('by-seller')
//   @HttpCode(HttpStatus.OK)
//   async findBySeller(@Body() body: { sellerPubkey: string }) {
//     return this.listingService.findBySeller(
//       new PublicKey(body.sellerPubkey),
//     );
//   }

//   /**
//    * Fetch all active listings
//    */
//   @Get('active')
//   @HttpCode(HttpStatus.OK)
//   async findActiveListings() {
//     return this.listingService.findActiveListings();
//   }

//   @Post('purchase')
// @HttpCode(HttpStatus.OK)
// async purchaseListing(@Body() body: { listingId: string; buyerPubkey: string }) {
//   return this.listingService.purchaseListing(body.listingId, body.buyerPubkey);
// }
// }

// backend/src/listing/listing.controller.ts
// backend/src/listing/listing.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { ListingService } from './listing.service';
import { CreateListingDto } from './dto/create-listing.dto';

@Controller('listings')
export class ListingController {
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
    return this.listingService.finalizeCreateListing(body.listingId, body.signedTx);
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

  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  async purchaseListing(@Body() body: { listingId: string; buyerPubkey: string }) {
    return this.listingService.purchaseListing(body.listingId, body.buyerPubkey);
  }
}