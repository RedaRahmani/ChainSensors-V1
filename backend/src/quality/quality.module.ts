import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QualityController } from './quality.controller';
import { QualityMetric, QualityMetricSchema } from './quality.schema';
import { ArciumModule } from '../arcium/arcium.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QualityMetric.name, schema: QualityMetricSchema },
    ]),
    ArciumModule,
  ],
  controllers: [QualityController],
  exports: [MongooseModule],
})
export class QualityModule {}
