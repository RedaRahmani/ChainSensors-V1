// backend/src/rating/rating.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Rating, RatingSchema } from './rating.schema';
import { RatingService } from './rating.service';
import { RatingController } from './rating.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Rating.name, schema: RatingSchema }]),
  ],
  providers: [RatingService],
  controllers: [RatingController],
})
export class RatingModule {}
