import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ResealedCapsuleDocument = ResealedCapsule & Document;

@Schema({ timestamps: true })
export class ResealedCapsule {
  @Prop({ required: true, index: true })
  listing: string; // PublicKey as base58 string

  @Prop({ required: true, index: true })
  record: string; // PublicKey as base58 string

  @Prop({ required: true, type: Buffer })
  encryption_key: Buffer; // 32 bytes

  @Prop({ required: true, type: Buffer })
  nonce: Buffer; // 16 bytes

  @Prop({ required: true, type: Buffer })
  c0: Buffer; // 32 bytes - ciphertext limb 0

  @Prop({ required: true, type: Buffer })
  c1: Buffer; // 32 bytes - ciphertext limb 1

  @Prop({ required: true, type: Buffer })
  c2: Buffer; // 32 bytes - ciphertext limb 2

  @Prop({ required: true, type: Buffer })
  c3: Buffer; // 32 bytes - ciphertext limb 3

  @Prop({ required: true, index: true })
  slot: number;

  @Prop({ required: true, index: true })
  signature: string;

  @Prop({ required: true, index: true })
  ts: Date; // Timestamp when event was processed

  // Convenience hex getters
  get encryption_key_hex(): string {
    return this.encryption_key?.toString('hex') || '';
  }

  get nonce_hex(): string {
    return this.nonce?.toString('hex') || '';
  }

  get ciphertext_hex(): { c0: string; c1: string; c2: string; c3: string } {
    return {
      c0: this.c0?.toString('hex') || '',
      c1: this.c1?.toString('hex') || '',
      c2: this.c2?.toString('hex') || '',
      c3: this.c3?.toString('hex') || '',
    };
  }
}

export const ResealedCapsuleSchema = SchemaFactory.createForClass(ResealedCapsule);

// Add compound indexes for efficient queries
ResealedCapsuleSchema.index({ record: 1, ts: -1 });
ResealedCapsuleSchema.index({ listing: 1, ts: -1 });
ResealedCapsuleSchema.index({ signature: 1, record: 1 }, { unique: true }); // Prevent duplicates across retries

// Static methods
ResealedCapsuleSchema.statics.findByRecord = function(recordPk: string) {
  return this.findOne({ record: recordPk })
    .sort({ ts: -1 })
    .exec();
};

ResealedCapsuleSchema.statics.findByListing = function(listingPk: string) {
  return this.find({ listing: listingPk })
    .sort({ ts: -1 })
    .exec();
};

ResealedCapsuleSchema.statics.status = function(recordPk: string) {
  return this.findOne({ record: recordPk })
    .select('record signature ts slot')
    .sort({ ts: -1 })
    .exec()
    .then(doc => {
      if (!doc) {
        return { status: 'not_found', record: recordPk };
      }
      return {
        status: 'completed',
        record: recordPk,
        signature: doc.signature,
        ts: doc.ts,
        slot: doc.slot,
      };
    });
};

ResealedCapsuleSchema.statics.findBySignature = function(signature: string) {
  return this.find({ signature }).exec();
};

ResealedCapsuleSchema.statics.getListingStats = function(listing: string) {
  return this.aggregate([
    { $match: { listing } },
    {
      $group: {
        _id: '$listing',
        count: { $sum: 1 },
        latest: { $max: '$ts' },
        earliest: { $min: '$ts' },
      }
    }
  ]).exec();
};

// Virtuals to expose serialized capsule forms.
// NOTE: "MXE" is the raw 144-byte capsule: 16-byte nonce + 4×32-byte limbs.
ResealedCapsuleSchema.virtual('mxe_capsule').get(function(this: any) {
  if (!this.nonce || !this.c0 || !this.c1 || !this.c2 || !this.c3) {
    throw new Error('Incomplete capsule data');
  }
  return Buffer.concat([this.nonce, this.c0, this.c1, this.c2, this.c3]);
});

ResealedCapsuleSchema.virtual('mxe_capsule_base64').get(function(this: any) {
  return this.mxe_capsule.toString('base64');
});

// Back-compat alias (DEPRECATED): historically exposed as "arc1_*" even though it's MXE
ResealedCapsuleSchema.virtual('arc1_capsule').get(function(this: any) {
  return this.mxe_capsule;
});
ResealedCapsuleSchema.virtual('arc1_capsule_base64').get(function(this: any) {
  return this.mxe_capsule_base64;
});

// Mirror hex helpers as virtuals for JSON output completeness
ResealedCapsuleSchema.virtual('encryption_key_hex').get(function(this: any) {
  return this.encryption_key?.toString('hex') || '';
});
ResealedCapsuleSchema.virtual('nonce_hex').get(function(this: any) {
  return this.nonce?.toString('hex') || '';
});
ResealedCapsuleSchema.virtual('ciphertext_hex').get(function(this: any) {
  return {
    c0: this.c0?.toString('hex') || '',
    c1: this.c1?.toString('hex') || '',
    c2: this.c2?.toString('hex') || '',
    c3: this.c3?.toString('hex') || '',
  };
});

// Ensure virtuals are included in JSON output
ResealedCapsuleSchema.set('toJSON', { virtuals: true });
ResealedCapsuleSchema.set('toObject', { virtuals: true });
