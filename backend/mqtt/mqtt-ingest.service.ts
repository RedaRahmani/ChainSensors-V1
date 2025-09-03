import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IngestService } from '../src/ingest/ingest.service';
import * as mqtt from 'mqtt';
import * as fs from 'fs';

@Injectable()
export class MqttIngestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttIngestService.name);
  private client?: mqtt.MqttClient;

  constructor(private readonly ingest: IngestService) {}

  onModuleInit() {
    const url = process.env.BROKER_URL || 'mqtts://localhost:8883';
    const clientId = process.env.MQTT_CLIENT_ID || `backend-${Math.random().toString(16).slice(2)}`;

    const caPath   = process.env.MQTT_CA_PATH   || process.env.CA_CERT_PATH;
    const certPath = process.env.MQTT_CERT_PATH || '';
    const keyPath  = process.env.MQTT_KEY_PATH  || '';

    const opts: mqtt.IClientOptions = {
      clientId,
      clean: true,
      reconnectPeriod: 2000,
      keepalive: 30,
      rejectUnauthorized: true,
      will: {               // optional LWT for backend presence
        topic: `system/clients/${clientId}/status`,
        payload: 'offline',
        qos: 1,
        retain: true,
      },
    };

    if (caPath && fs.existsSync(caPath))   opts.ca   = fs.readFileSync(caPath);
    if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      opts.cert = fs.readFileSync(certPath);
      opts.key  = fs.readFileSync(keyPath);
    }

    this.client = mqtt.connect(url, opts);
    this.client.on('connect', () => {
      this.logger.log(`MQTT connected: ${url} (id=${clientId})`);
      this.client!.publish(`system/clients/${clientId}/status`, 'online', { qos: 1, retain: true });
      this.client!.subscribe(['cs/+/bme280', 'devices/+/data'], { qos: 1 }, (err) => {
        if (err) this.logger.error('Subscribe error', err);
        else this.logger.log('Subscribed to cs/+/bme280 and devices/+/data');
      });
    });

    this.client.on('message', async (topic, message) => {
      try {
        const parts = topic.split('/');
        let deviceId: string | null = null;
        if (parts.length >= 3 && parts[0] === 'cs' && parts[2] === 'bme280') deviceId = parts[1];
        if (parts.length >= 3 && parts[0] === 'devices' && parts[2] === 'data') deviceId = parts[1];
        if (!deviceId) return;

        let obj: any;
        try { obj = JSON.parse(message.toString()); } catch { obj = { raw: message.toString('base64') }; }
        obj.ts = obj.ts || Date.now();

        // encrypt + store, updates lastSeen for us
        const { payloadCid } = await this.ingest.encryptAndStore(deviceId, JSON.stringify(obj));
        this.logger.debug(`ingested ${deviceId} -> ${payloadCid}`);
      } catch (e:any) {
        this.logger.warn(`MQTT message handling failed: ${e?.message}`);
      }
    });

    this.client.on('error', (err) => this.logger.error(`MQTT error: ${err.message}`));
    this.client.on('close', () => this.logger.warn('MQTT connection closed'));
  }

  onModuleDestroy() { try { this.client?.end(true); } catch {} }
}
