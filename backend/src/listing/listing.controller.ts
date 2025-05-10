// // src/listing/listing.controller.ts
// import {
//   Controller,
//   Post,
//   Delete,
//   Get,
//   Param,
//   Body,
//   HttpCode,
//   HttpStatus,
// } from '@nestjs/common';
// import { ListingService } from './listing.service';
// import { CreateListingDto } from './dto/create-listing.dto';
// import { CancelListingDto } from './dto/cancel-listing.dto';

// @Controller('listings')
// export class ListingController {
//   constructor(private readonly listingService: ListingService) {}

//   /**
//    * Build an unsigned createListing tx and return it with listingId
//    */
//   @Post()
//   @HttpCode(HttpStatus.CREATED)
//   async create(@Body() dto: CreateListingDto) {
//     const { listingId, unsignedTx } = await this.listingService.createListing(dto);
//     return { listingId, unsignedTx };
//   }

//   /**
//    * Build an unsigned cancelListing tx and return it
//    */
//   @Delete()
//   @HttpCode(HttpStatus.OK)
//   async cancel(@Body() dto: CancelListingDto) {
//     const { unsignedTx } = await this.listingService.cancelListing(
//       dto.deviceId,
//       dto.listingId
//     );
//     return { unsignedTx };
//   }

//   /**
//    * List all listings for a device
//    */
//   @Get(':deviceId')
//   list(@Param('deviceId') deviceId: string) {
//     return this.listingService.findByDevice(deviceId);
//   }
// }
