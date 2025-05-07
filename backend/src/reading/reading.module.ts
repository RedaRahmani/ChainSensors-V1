import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reading, ReadingSchema } from './reading.schema';
import { ReadingService } from './reading.service';
import { ReadingController } from './reading.controller';
import { WalrusModule } from '../walrus/walrus.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Reading.name, schema: ReadingSchema }]),
    WalrusModule,                   // ← so we can fetch raw blobs
  ],
  providers: [ReadingService],
  controllers: [ReadingController],
})
export class ReadingModule {}
