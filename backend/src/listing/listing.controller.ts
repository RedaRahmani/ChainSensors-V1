// src/listing/listing.controller.ts
import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ListingService } from './listing.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { CancelListingDto } from './dto/cancel-listing.dto';

@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateListingDto) {
    return this.listingService.createListing(dto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  cancel(@Body() dto: CancelListingDto) {
    return this.listingService.cancelListing(dto.deviceId, dto.listingId);
  }

  @Get(':deviceId')
  list(@Param('deviceId') deviceId: string) {
    return this.listingService.findByDevice(deviceId);
  }
}
