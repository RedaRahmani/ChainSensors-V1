import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Device {
  @Prop({ unique: true, required: true })
  token: string;

  @Prop({ required: true })
  sellerPubkey: string;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: false })
  csrPem: string;

  @Prop({ required: true, type: Object })
  metadata: Record<string, any>;

  @Prop()
  metadataCid?: string;

  @Prop()
  certificatePem?: string;

  @Prop()
  unsignedTx?: string;

  @Prop()
  txSignature?: string;

  @Prop({ default: null })
  lastSeen: Date | null;

  @Prop({ required: false })
  latestDataCid: string;

  @Prop({ required: true, enum: ['pending','tx-generated','complete'], default: 'pending' })
  status: 'pending' | 'tx-generated' | 'complete';
}

export type DeviceDocument = Device & Document;
export const DeviceSchema = SchemaFactory.createForClass(Device);
