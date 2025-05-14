import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RatingDocument = Rating & Document;

@Schema({ timestamps: true })
export class Rating {
  @Prop({ required: true })          
  userPubkey: string;

  @Prop({ required: true })        
  listingId: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ default: '' , maxlength: 128 })
  comment: string;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);
