import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Device {
  @Prop({ unique: true, required: true })
  token: string;

  /** wallet address of the seller doing this enrollment */
  @Prop({ required: true })
  sellerPubkey: string;

  /** logical device ID (e.g. “AIR001”) */
  @Prop({ required: true })
  deviceId: string;

  /** PEM CSR as submitted by the agent */
  @Prop({ required: true })
  csrPem: string;

  /** the metadata object the agent sent */
  @Prop({ required: true, type: Object })
  metadata: Record<string, any>;

  /** once we call Walrus uploadMetadata, we store its CID here */
  @Prop()
  metadataCid?: string;

  /** the certificate PEM we sign and return to the agent */
  @Prop()
  certificatePem?: string;

  /** base64 of the unsigned Solana transaction we built */
  @Prop()
  unsignedTx?: string;

  /** once the front-end sends back the signed tx, we persist its signature */
  @Prop()
  txSignature?: string;

  @Prop({ default: null })
  lastSeen: Date | null;

  @Prop({ required: false })
  latestDataCid: string;

  /** where in the flow this record is */
  @Prop({ required: true, enum: ['pending','tx-generated','complete'], default: 'pending' })
  status: 'pending' | 'tx-generated' | 'complete';
}

export type DeviceDocument = Device & Document;
export const DeviceSchema = SchemaFactory.createForClass(Device);
