import { Module } from '@nestjs/common';
import { MqttIngestService } from './mqtt-ingest.service';
import { IngestModule } from '../src/ingest/ingest.module';

@Module({
  imports: [IngestModule],
  providers: [MqttIngestService],
})
export class MqttModule {}
