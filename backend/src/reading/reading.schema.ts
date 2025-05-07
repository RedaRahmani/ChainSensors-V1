import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReadingDocument = Reading & Document;

@Schema({ timestamps: true })
export class Reading {
  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  dataCid: string;

  @Prop({ required: true, default: () => new Date() })
  timestamp: Date;
}

export const ReadingSchema = SchemaFactory.createForClass(Reading);
