import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ListingStatus } from './listing.types';

export type ListingDocument = Listing & Document;

@Schema({ timestamps: true })
export class Listing {
  @Prop({ unique: true, required: true })
  listingId: string;

  @Prop({ required: true })
  sellerPubkey: string;

  @Prop({ required: true })
  deviceId: string;
  
  @Prop({ required: true })
  dekCapsuleForMxeCid: string;

  @Prop({ required: true })
  dataCid: string;

  @Prop({ required: true })
  pricePerUnit: number;

  @Prop({ required: true, default: 100 })
  remainingUnits: number;

  @Prop({ required: true })
  totalDataUnits: number;

  @Prop({ required: false })
  unsignedTx?: string;

  @Prop({ required: false })
  txSignature?: string;

  @Prop({
    type: Number,
    enum: ListingStatus,
    required: true,
    default: ListingStatus.Pending,
  })
  status: ListingStatus;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const ListingSchema = SchemaFactory.createForClass(Listing);
