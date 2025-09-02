import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type QualityMetricDocument = QualityMetric & Document;

@Schema({ timestamps: true })
export class QualityMetric {
  @Prop({ required: true, index: true })
  device: string;

  @Prop({ required: true, index: true })
  listing: string;

  @Prop({ required: true, type: Buffer })
  accuracy_score: Buffer; // 32 bytes digest from keccak hash

  @Prop({ required: true, type: Buffer })
  nonce: Buffer; // 16 bytes LE

  @Prop({ required: true })
  computation_type: string; // "accuracy"

  @Prop({ required: true, index: true })
  slot: number;

  @Prop({ required: true, index: true })
  signature: string;

  @Prop({ required: true, index: true })
  ts: Date; // Timestamp when event was processed

  // Virtual for hex representation of accuracy score
  get accuracy_score_hex(): string {
    return this.accuracy_score?.toString('hex') || '';
  }

  // Virtual for hex representation of nonce
  get nonce_hex(): string {
    return this.nonce?.toString('hex') || '';
  }
}

export const QualityMetricSchema = SchemaFactory.createForClass(QualityMetric);

// Add compound indexes for efficient queries
QualityMetricSchema.index({ device: 1, ts: -1 });
QualityMetricSchema.index({ device: 1, slot: -1 });
QualityMetricSchema.index({ signature: 1, device: 1 }, { unique: true });

// Static methods
QualityMetricSchema.statics.latestByDevice = function(device: string) {
  return this.findOne({ device })
    .sort({ ts: -1 })
    .exec();
};

QualityMetricSchema.statics.historyByDevice = function(device: string, limit: number = 200) {
  return this.find({ device })
    .sort({ ts: -1 })
    .limit(limit)
    .exec();
};

QualityMetricSchema.statics.findBySignature = function(signature: string) {
  return this.find({ signature }).exec();
};

QualityMetricSchema.statics.getDeviceStats = function(device: string, since?: Date) {
  const match: any = { device };
  if (since) {
    match.ts = { $gte: since };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$device',
        count: { $sum: 1 },
        latest: { $max: '$ts' },
        earliest: { $min: '$ts' },
        latest_score_hex: { $last: { $toString: '$accuracy_score' } },
      }
    }
  ]).exec();
};

// Add virtuals to schema
QualityMetricSchema.virtual('accuracy_score_hex').get(function() {
  return this.accuracy_score?.toString('hex') || '';
});

QualityMetricSchema.virtual('nonce_hex').get(function() {
  return this.nonce?.toString('hex') || '';
});

// Ensure virtuals are included in JSON output
QualityMetricSchema.set('toJSON', { virtuals: true });
QualityMetricSchema.set('toObject', { virtuals: true });
