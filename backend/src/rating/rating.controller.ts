// backend/src/rating/rating.controller.ts
import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { RatingService } from './rating.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Controller('ratings')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRatingDto) {
    return this.ratingService.create(dto);
  }

  @Get('listing/:id')
  getByListing(@Param('id') listingId: string) {
    return this.ratingService.getStats(listingId);
  }
}
