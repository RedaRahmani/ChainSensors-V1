import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import aedes from 'aedes';
import { IngestService } from '../ingest/ingest.service';
import { createServer } from 'aedes-server-factory';

@Injectable()
export class BrokerService implements OnModuleInit {
  private readonly logger = new Logger(BrokerService.name);
  private broker = new aedes();
  private server;

  constructor(
    private readonly config: ConfigService,
    private readonly ingest: IngestService,
) {}

  onModuleInit() {
    const port = this.config.get<number>('BROKER_PORT');
    const key   = fs.readFileSync(this.config.get<string>('TLS_KEY_PATH'));
    const cert  = fs.readFileSync(this.config.get<string>('TLS_CERT_PATH'));
    const ca    = fs.readFileSync(this.config.get<string>('TLS_CA_PATH'));

    this.server = createServer(this.broker, {
      tls: {
        key,
        cert,
        ca,
        requestCert: true,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
    });

    this.server.listen(port, () => {
      this.logger.log(`📡 MQTT broker listening mTLS://0.0.0.0:${port}`);
    });

    this.broker.on('clientReady', (client) => {
        const details = (client as any).connDetails as { certAuthorized?: boolean } | undefined;
        const authorized = details?.certAuthorized ?? false;
        this.logger.log(`Client connected: ${client.id} (authorized=${authorized})`);
      });
    this.broker.on('publish', async (packet, client) => {
        if (client && packet.topic.startsWith('devices/') && packet.topic.endsWith('/data')) {
          try {
            const [, deviceId] = packet.topic.split('/');
            const payload = JSON.parse(packet.payload.toString());
            this.logger.debug(`▶ ${client.id} → ${packet.topic}: ${JSON.stringify(payload)}`);
            await this.ingest.uploadData(deviceId, payload);
          } catch (err) {
            this.logger.error('Failed to forward MQTT payload to IngestService', err);
          }
        }
      });

    
  }
}
