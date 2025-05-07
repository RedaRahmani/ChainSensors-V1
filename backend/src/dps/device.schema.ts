import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Device {
  @Prop({ unique: true, required: true })
  deviceId: string;

  @Prop({ required: true })
  metadataCid: string;

  @Prop({ required: true })
  txSignature: string;

  @Prop({ default: null })
  lastSeen: Date | null;

  @Prop({ required: false })
  latestDataCid: string;

}

export type DeviceDocument = Device & Document;
export const DeviceSchema = SchemaFactory.createForClass(Device);
