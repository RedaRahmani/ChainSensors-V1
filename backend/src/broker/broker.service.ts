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

  async onModuleInit() {
    // Dynamic port selection: try 8881, 8882, 8883...
    const basePort = this.config.get<number>('BROKER_PORT') || 8881;
    const maxAttempts = 10;
    let port = basePort;
    let started = false;
    let lastError = null;
    let key, cert, ca;
    try {
      key = fs.readFileSync(
        this.config.get<string>('BROKER_KEY_PATH') || './broker-key.pem',
      );
      cert = fs.readFileSync(
        this.config.get<string>('BROKER_CERT_PATH') || './broker-cert.pem',
      );
      ca = fs.readFileSync(
        this.config.get<string>('CA_CERT_PATH') || './ca-cert.pem',
      );
    } catch (err) {
      this.logger.error('Failed to load TLS certificates:', err);
      throw err;
    }

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

    for (let i = 0; i < maxAttempts; i++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const errorHandler = (err: any) => {
            this.server.removeListener('listening', successHandler);
            if (err.code === 'EADDRINUSE') {
              this.logger.warn(`Port ${port} in use, trying next port...`);
              reject(new Error('EADDRINUSE'));
            } else {
              this.logger.error(`MQTT broker error on port ${port}:`, err);
              reject(err);
            }
          };

          const successHandler = () => {
            this.server.removeListener('error', errorHandler);
            this.logger.log(
              `📡 Broker listening on port ${port} (mTLS://0.0.0.0:${port})`,
            );
            resolve();
          };

          this.server.once('error', errorHandler);
          this.server.once('listening', successHandler);
          this.server.listen(port);
        });
        started = true;
        break;
      } catch (err: any) {
        if (err.message === 'EADDRINUSE') {
          port++;
        } else {
          lastError = err;
          break;
        }
      }
    }
    if (!started) {
      this.logger.error(
        `Failed to start MQTT broker on ports ${basePort}-${basePort + maxAttempts - 1}`,
        lastError,
      );
      throw lastError || new Error('MQTT broker failed to start');
    }

    this.broker.on('clientReady', (client) => {
      const details = (client as any).connDetails as
        | { certAuthorized?: boolean }
        | undefined;
      const authorized = details?.certAuthorized ?? false;
      this.logger.log(
        `Client connected: ${client.id} (authorized=${authorized})`,
      );
    });
    this.broker.on('publish', async (packet, client) => {
      if (
        client &&
        packet.topic.startsWith('devices/') &&
        packet.topic.endsWith('/data')
      ) {
        try {
          const [, deviceId] = packet.topic.split('/');
          const payload = JSON.parse(packet.payload.toString());
          this.logger.debug(
            `▶ ${client.id} → ${packet.topic}: ${JSON.stringify(payload)}`,
          );
          await this.ingest.uploadData(deviceId, payload);
        } catch (err) {
          this.logger.error(
            'Failed to forward MQTT payload to IngestService',
            err,
          );
        }
      }
    });
  }
}
