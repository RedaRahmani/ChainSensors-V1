import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IngestService } from '../src/ingest/ingest.service';
import * as mqtt from 'mqtt';

function envPem(name: string) {
  const v = process.env[name];
  if (!v) return undefined;
  // accept both real newlines (Render supports multi-line) or \n-escaped
  return Buffer.from(v.replace(/\\n/g, '\n'), 'utf8');
}

@Injectable()
export class MqttIngestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttIngestService.name);
  private client?: mqtt.MqttClient;

  constructor(private readonly ingest: IngestService) {}

  onModuleInit() {
    const url =
      process.env.BROKER_URL || 'mqtts://localhost:8883';

    const clientId =
      process.env.MQTT_CLIENT_ID || `backend-${Math.random().toString(16).slice(2)}`;

    const opts: mqtt.IClientOptions = {
      clientId,
      clean: true,
      reconnectPeriod: 2000,
      keepalive: 30,
      // set MQTT_TLS_INSECURE=1 only if you must connect to self-signed broker without CA
      rejectUnauthorized: process.env.MQTT_TLS_INSECURE === '1' ? false : true,

      // Managed brokers (EMQX/HiveMQ Cloud)
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,

      // Optional client TLS (self-hosted brokers)
      ca: envPem('MQTT_CA_PEM'),
      cert: envPem('MQTT_CERT_PEM'),
      key: envPem('MQTT_KEY_PEM'),

      will: {
        topic: `system/clients/${clientId}/status`,
        payload: 'offline',
        qos: 1,
        retain: true,
      },
    };

    this.client = mqtt.connect(url, opts);

    this.client.on('connect', () => {
      this.logger.log(`MQTT connected: ${url} (id=${clientId})`);
      this.client!.publish(`system/clients/${clientId}/status`, 'online', {
        qos: 1,
        retain: true,
      });

      const topics = (process.env.MQTT_TOPICS || 'cs/+/bme280,devices/+/data')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      this.client!.subscribe(topics, { qos: 1 }, (err) => {
        if (err) this.logger.error('Subscribe error', err);
        else this.logger.log(`Subscribed to ${topics.join(', ')}`);
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
        try {
          obj = JSON.parse(message.toString());
        } catch {
          obj = { raw: message.toString('base64') };
        }
        obj.ts = obj.ts || Date.now();

        const { payloadCid } = await this.ingest.encryptAndStore(
          deviceId,
          JSON.stringify(obj),
        );
        this.logger.debug(`ingested ${deviceId} -> ${payloadCid}`);
      } catch (e: any) {
        this.logger.warn(`MQTT message handling failed: ${e?.message}`);
      }
    });

    this.client.on('error', (err) => this.logger.error(`MQTT error: ${err.message}`));
    this.client.on('close', () => this.logger.warn('MQTT connection closed'));
  }

  onModuleDestroy() {
    try {
      this.client?.end(true);
    } catch {}
  }
}
