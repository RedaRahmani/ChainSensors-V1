import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RewardDocument = Reward & Document;

@Schema({ timestamps: true })
export class Reward {
  @Prop({ required: true }) userPubkey: string;
  @Prop({ required: true }) action: string; // e.g. 'deviceRegistration'
  @Prop({ required: true }) amount: number; // from REWARD_RULES
  @Prop({ required: true }) txSignature: string; // on‑chain mint tx
}

export const RewardSchema = SchemaFactory.createForClass(Reward);
