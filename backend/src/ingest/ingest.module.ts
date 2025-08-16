import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IngestService } from './ingest.service';
import { IngestController } from './ingest.controller';
import { WalrusModule } from '../walrus/walrus.module';
import { DpsModule } from '../dps/dps.module';
import { Reading, ReadingSchema } from '../reading/reading.schema';
import { ArciumModule } from '../arcium/arcium.module';


@Module({
  imports: [
    WalrusModule,
    DpsModule,
    ArciumModule,
    MongooseModule.forFeature([{ name: Reading.name, schema: ReadingSchema }]),
  ],
  providers: [IngestService],
  controllers: [IngestController],
  exports: [IngestService],
})
export class IngestModule {}
