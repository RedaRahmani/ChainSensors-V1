import { Module } from '@nestjs/common';
import { BrokerService } from './broker.service';
import { ConfigModule } from '@nestjs/config';
import { IngestModule } from '../ingest/ingest.module';

@Module({
  imports: [ConfigModule, IngestModule],
  providers: [BrokerService],
  exports: [BrokerService],
})
export class BrokerModule {}
