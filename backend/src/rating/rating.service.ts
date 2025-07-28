import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rating, RatingDocument } from './rating.schema';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingService {
  constructor(
    @InjectModel(Rating.name) private ratingModel: Model<RatingDocument>,
  ) {}

  async create(dto: CreateRatingDto): Promise<Rating> {
    const exists = await this.ratingModel.findOne({
      userPubkey: dto.userPubkey,
      listingId: dto.listingId,
    });
    if (exists)
      throw new BadRequestException('You have already rated this listing');
    return this.ratingModel.create(dto);
  }

  async findByListing(listingId: string) {
    return this.ratingModel.find({ listingId }).lean().exec();
  }

  async getStats(listingId: string) {
    const all = await this.ratingModel.find({ listingId }).lean().exec();
    if (!all.length) return { average: 0, count: 0 };
    const sum = all.reduce((acc, r) => acc + r.rating, 0);
    return {
      average: sum / all.length,
      count: all.length,
      comments: all.map((r) => ({ user: r.userPubkey, comment: r.comment })),
    };
  }
}
