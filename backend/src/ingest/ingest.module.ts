import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { WalrusModule } from '../walrus/walrus.module';
import { DpsModule } from '../dps/dps.module';

@Module({
  imports: [WalrusModule, DpsModule],
  controllers: [IngestController],
  providers: [IngestService],
})
export class IngestModule {}