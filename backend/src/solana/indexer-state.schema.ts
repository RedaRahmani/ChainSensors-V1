import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PublicKey } from '@solana/web3.js';

export type IndexerStateDocument = IndexerState & Document;

@Schema({ collection: 'indexer_states', timestamps: true })
export class IndexerState {
  @Prop({ required: true })
  _id: string; // Format: 'program:<PID>'

  @Prop({ default: 0 })
  lastProcessedSlot: number;

  @Prop({ default: '' })
  lastProcessedSig: string;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const IndexerStateSchema = SchemaFactory.createForClass(IndexerState);

// Static methods
IndexerStateSchema.statics.getOrCreate = async function(programId: PublicKey) {
  const id = `program:${programId.toBase58()}`;
  let state = await this.findById(id);
  
  if (!state) {
    state = await this.create({
      _id: id,
      lastProcessedSlot: 0,
      lastProcessedSig: '',
    });
  }
  
  return state;
};

IndexerStateSchema.statics.updateProgress = async function(
  programId: PublicKey, 
  slot: number, 
  sig: string
) {
  const id = `program:${programId.toBase58()}`;
  return this.findByIdAndUpdate(
    id,
    { 
      lastProcessedSlot: slot, 
      lastProcessedSig: sig,
      updatedAt: new Date(),
    },
    { upsert: true, new: true }
  );
};
