// import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as fs from 'fs';
// import aedes from 'aedes';
// import { IngestService } from '../ingest/ingest.service';
// import { createServer } from 'aedes-server-factory';

// @Injectable()
// export class BrokerService implements OnModuleInit {
//   private readonly logger = new Logger(BrokerService.name);
//   private broker = new aedes();
//   private server: any; // keep as any to avoid type friction with TLS server factory

//   constructor(
//     private readonly config: ConfigService,
//     private readonly ingest: IngestService,
//   ) {}

//   async onModuleInit() {
//     // Dynamic port selection: try 8881, 8882, 8883...
//     const basePort = this.config.get<number>('BROKER_PORT') || 8881;
//     const maxAttempts = 10;
//     let port = basePort;
//     let started = false;
//     let lastError: any = null;

//     // Load TLS materials
//     let key: Buffer, cert: Buffer, ca: Buffer;
//     try {
//       key = fs.readFileSync(
//         this.config.get<string>('BROKER_KEY_PATH') || './broker-key.pem',
//       );
//       cert = fs.readFileSync(
//         this.config.get<string>('BROKER_CERT_PATH') || './broker-cert.pem',
//       );
//       ca = fs.readFileSync(
//         this.config.get<string>('CA_CERT_PATH') || './ca-cert.pem',
//       );
//     } catch (err) {
//       this.logger.error('Failed to load TLS certificates:', err);
//       throw err;
//     }

//     this.server = createServer(this.broker, {
//       tls: {
//         key,
//         cert,
//         ca,
//         requestCert: true,
//         rejectUnauthorized: true,
//         minVersion: 'TLSv1.2',
//       },
//     });

//     // Listen on first available port
//     for (let i = 0; i < maxAttempts; i++) {
//       try {
//         await new Promise<void>((resolve, reject) => {
//           const errorHandler = (err: any) => {
//             this.server.removeListener('listening', successHandler);
//             if (err.code === 'EADDRINUSE') {
//               this.logger.warn(`Port ${port} in use, trying next port...`);
//               reject(new Error('EADDRINUSE'));
//             } else {
//               this.logger.error(`MQTT broker error on port ${port}:`, err);
//               reject(err);
//             }
//           };

//           const successHandler = () => {
//             this.server.removeListener('error', errorHandler);
//             this.logger.log(
//               `📡 Broker listening on port ${port} (mTLS://0.0.0.0:${port})`,
//             );
//             resolve();
//           };

//           this.server.once('error', errorHandler);
//           this.server.once('listening', successHandler);
//           this.server.listen(port);
//         });
//         started = true;
//         break;
//       } catch (err: any) {
//         if (err.message === 'EADDRINUSE') {
//           port++;
//         } else {
//           lastError = err;
//           break;
//         }
//       }
//     }
//     if (!started) {
//       this.logger.error(
//         `Failed to start MQTT broker on ports ${basePort}-${
//           basePort + maxAttempts - 1
//         }`,
//         lastError,
//       );
//       throw lastError || new Error('MQTT broker failed to start');
//     }

//     // === mTLS identity + topic guard (ported from your previous version) ===
//     this.broker.authenticate = (client: any, _u: any, _p: any, cb: any) => {
//       try {
//         const sock: any = client?.conn;
//         const authorized = sock?.authorized === true;
//         const cn: string | undefined = sock?.getPeerCertificate?.()?.subject?.CN;
//         const ok = !!authorized && !!cn && cn === client?.id;
//         if (!ok) {
//           const err: any = new Error('unauthorized');
//           err.returnCode = 5; // Not authorized
//           return cb(err, false);
//         }
//         return cb(null, true);
//       } catch {
//         const err: any = new Error('unauthorized');
//         err.returnCode = 5;
//         return cb(err, false);
//       }
//     };

//     // Allow only the device to publish to its own topics
//     this.broker.authorizePublish = (client: any, packet: any, cb: any) => {
//       try {
//         const sock: any = client?.conn;
//         const cn: string | undefined = sock?.getPeerCertificate?.()?.subject?.CN;
//         const topic = String(packet.topic || '');
//         const allowed =
//           typeof cn === 'string' &&
//           (topic === `devices/${cn}/data` || topic === `devices/${cn}/status`);
//         return cb(allowed ? null : new Error('topic forbidden'));
//       } catch {
//         return cb(new Error('topic forbidden'));
//       }
//     };

//     // Logging
//     this.broker.on('clientReady', (client) => {
//       const details = (client as any).connDetails as
//         | { certAuthorized?: boolean }
//         | undefined;
//       const authorized = details?.certAuthorized ?? false;
//       this.logger.log(
//         `Client connected: ${client.id} (authorized=${authorized})`,
//       );
//     });

//     // Data ingestion (binary-safe + JSON auto-detect)
//     this.broker.on('publish', async (packet, client) => {
//       if (
//         client &&
//         packet.topic.startsWith('devices/') &&
//         packet.topic.endsWith('/data')
//       ) {
//         try {
//           const [, deviceId] = packet.topic.split('/');

//           // Binary-safe: try JSON, else pass raw Buffer
//           const raw: Buffer = Buffer.isBuffer(packet.payload)
//             ? (packet.payload as Buffer)
//             : Buffer.from(packet.payload as any);

//           let outgoing: any = raw;
//           try {
//             const s = raw.toString('utf8').trim();
//             if (s.length && (s.startsWith('{') || s.startsWith('['))) {
//               outgoing = JSON.parse(s);
//               this.logger.debug(
//                 `▶ ${client.id} → ${packet.topic}: ${JSON.stringify(outgoing)}`,
//               );
//             } else {
//               this.logger.debug(
//                 `▶ ${client.id} → ${packet.topic}: <${raw.length} bytes>`,
//               );
//             }
//           } catch {
//             this.logger.debug(
//               `▶ ${client.id} → ${packet.topic}: <${raw.length} bytes (non-JSON)>`,
//             );
//           }

//           await this.ingest.uploadData(deviceId, outgoing);
//         } catch (err) {
//           this.logger.error(
//             'Failed to forward MQTT payload to IngestService',
//             err,
//           );
//         }
//       }
//     });
//   }
// }
// backend/src/broker/broker.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import aedes from 'aedes';
import { IngestService } from '../ingest/ingest.service';
import { createServer } from 'aedes-server-factory';

function envMultiline(v?: string): string | undefined {
  if (!v) return undefined;
  return v.replace(/\\n/g, '\n');
}

@Injectable()
export class BrokerService implements OnModuleInit {
  private readonly logger = new Logger(BrokerService.name);
  private broker = new aedes();
  private server: any;

  constructor(
    private readonly config: ConfigService,
    private readonly ingest: IngestService,
  ) {}

  async onModuleInit() {
    // Opt-in only
    const enabled = String(this.config.get('BROKER_EMBEDDED') ?? '').toLowerCase() === 'true';
    if (!enabled) {
      this.logger.log('Skipping embedded MQTT broker (BROKER_EMBEDDED not true).');
      return;
    }

    // TLS from ENV PEMs (no filesystem)
    const keyPem  = envMultiline(this.config.get<string>('BROKER_TLS_KEY_PEM'));
    const certPem = envMultiline(this.config.get<string>('BROKER_TLS_CERT_PEM'));
    const caPem =
      envMultiline(this.config.get<string>('BROKER_CLIENT_CA_PEM')) ||
      envMultiline(this.config.get<string>('CA_CERT_PEM')) ||
      envMultiline(this.config.get<string>('BROKER_CA_PEM'));

    if (!keyPem || !certPem || !caPem) {
      this.logger.error(
        'Embedded broker enabled but missing TLS PEMs. ' +
        'Set BROKER_TLS_KEY_PEM, BROKER_TLS_CERT_PEM and BROKER_CLIENT_CA_PEM (or CA_CERT_PEM/BROKER_CA_PEM). ' +
        'Embedded broker will NOT start.'
      );
      return;
    }

    const key = Buffer.from(keyPem);
    const cert = Buffer.from(certPem);
    const ca = Buffer.from(caPem);

    const basePort = this.config.get<number>('BROKER_PORT') || 8881;
    const maxAttempts = 10;
    let port = basePort;
    let started = false;
    let lastError: any = null;

    this.server = createServer(this.broker, {
      tls: {
        key, cert, ca,
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
            this.logger.log(`📡 Broker listening on port ${port} (mTLS://0.0.0.0:${port})`);
            resolve();
          };
          this.server.once('error', errorHandler);
          this.server.once('listening', successHandler);
          this.server.listen(port);
        });
        started = true;
        break;
      } catch (err: any) {
        if (err.message === 'EADDRINUSE') port++;
        else { lastError = err; break; }
      }
    }
    if (!started) {
      this.logger.error(
        `Failed to start embedded MQTT broker on ports ${basePort}-${basePort + maxAttempts - 1}`,
        lastError,
      );
      return; // keep web app alive
    }

    this.broker.authenticate = (client: any, _u: any, _p: any, cb: any) => {
      try {
        const sock: any = client?.conn;
        const authorized = sock?.authorized === true;
        const cn: string | undefined = sock?.getPeerCertificate?.()?.subject?.CN;
        const ok = !!authorized && !!cn && cn === client?.id;
        if (!ok) {
          const err: any = new Error('unauthorized');
          err.returnCode = 5;
          return cb(err, false);
        }
        return cb(null, true);
      } catch {
        const err: any = new Error('unauthorized');
        err.returnCode = 5;
        return cb(err, false);
      }
    };

    this.broker.authorizePublish = (client: any, packet: any, cb: any) => {
      try {
        const sock: any = client?.conn;
        const cn: string | undefined = sock?.getPeerCertificate?.()?.subject?.CN;
        const topic = String(packet.topic || '');
        const allowed =
          typeof cn === 'string' &&
          (topic === `devices/${cn}/data` || topic === `devices/${cn}/status`);
        return cb(allowed ? null : new Error('topic forbidden'));
      } catch {
        return cb(new Error('topic forbidden'));
      }
    };

    this.broker.on('clientReady', (client) => {
      const details = (client as any).connDetails as { certAuthorized?: boolean } | undefined;
      const authorized = details?.certAuthorized ?? false;
      this.logger.log(`Client connected: ${client.id} (authorized=${authorized})`);
    });

    this.broker.on('publish', async (packet, client) => {
      if (client && packet.topic.startsWith('devices/') && packet.topic.endsWith('/data')) {
        try {
          const [, deviceId] = packet.topic.split('/');
          const raw: Buffer = Buffer.isBuffer(packet.payload)
            ? (packet.payload as Buffer)
            : Buffer.from(packet.payload as any);
          let outgoing: any = raw;
          try {
            const s = raw.toString('utf8').trim();
            if (s.length && (s.startsWith('{') || s.startsWith('['))) {
              outgoing = JSON.parse(s);
              this.logger.debug(`▶ ${client.id} → ${packet.topic}: ${JSON.stringify(outgoing)}`);
            } else {
              this.logger.debug(`▶ ${client.id} → ${packet.topic}: <${raw.length} bytes>`);
            }
          } catch {
            this.logger.debug(`▶ ${client.id} → ${packet.topic}: <${raw.length} bytes (non-JSON)>`);
          }
          await this.ingest.uploadData(deviceId, outgoing);
        } catch (err) {
          this.logger.error('Failed to forward MQTT payload to IngestService', err);
        }
      }
    });
  }
}
