import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ListingDocument = Listing & Document;

@Schema({ timestamps: true })
export class Listing {
  @Prop({ unique: true, required: true })
  listingId: string;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  dataCid: string;

  @Prop({ required: true })
  pricePerUnit: number;

  @Prop({ required: true })
  totalDataUnits: number;

  @Prop({ required: true, default: 'Active' })
  status: 'Active' | 'Cancelled' | 'Sold';

  @Prop({ required: true })
  txSignature: string;
}

export const ListingSchema = SchemaFactory.createForClass(Listing);
