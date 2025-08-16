import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as dns from 'dns';
import * as https from 'https';

@Injectable()
export class WalrusService {
  private readonly logger = new Logger(WalrusService.name);

  private readonly publisherUrl: string;
  private readonly aggregatorUrl: string;
  private readonly defaultEpochs: number;
  private readonly deletable: boolean;

  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    // Prefer IPv4 (WSL/Windows often stalls on AAAA)
    try { dns.setDefaultResultOrder('ipv4first'); } catch {}

    this.publisherUrl =
      this.config.get<string>('WALRUS_PUBLISHER_URL') ||
      this.config.get<string>('WALRUS_URL');
    this.aggregatorUrl =
      this.config.get<string>('WALRUS_AGGREGATOR_URL') ||
      this.config.get<string>('WALRUS_URL');

    if (!this.publisherUrl) throw new Error('WALRUS_PUBLISHER_URL (or WALRUS_URL) not set');
    if (!this.aggregatorUrl) throw new Error('WALRUS_AGGREGATOR_URL (or WALRUS_URL) not set');

    this.defaultEpochs = Number(this.config.get<string>('WALRUS_EPOCHS') ?? '3');
    this.deletable = (this.config.get<string>('WALRUS_DELETABLE') ?? 'false') === 'true';

    const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 32 });

    this.http = axios.create({
      timeout: 60000, // first request can be slow
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      decompress: true,
      httpsAgent,
      validateStatus: (s) => s >= 200 && s < 300,
    });
    this.logger.log(
      `WalrusService ready. publisher=${this.publisherUrl} aggregator=${this.aggregatorUrl} epochs=${this.defaultEpochs} deletable=${this.deletable}`,
    );
  }

  private async putBlob(data: Buffer, epochs?: number): Promise<string> {
    const query = new URLSearchParams();
    query.set('epochs', String(epochs ?? this.defaultEpochs));
    if (this.deletable) query.set('deletable', 'true');
    const url = `${this.publisherUrl.replace(/\/$/, '')}/v1/blobs?${query.toString()}`;

    try {
      this.logger.debug(`PUT ${url}`);
      const res = await this.http.put(url, data, {
        headers: { 'Content-Type': 'application/octet-stream' },
        // Force IPv4 on this call as an additional guard
        lookup: (hostname, _opts, cb) => dns.lookup(hostname, { family: 4, all: false }, cb),
      } as AxiosRequestConfig & { lookup: any });

      const body = res.data || {};
      const blobId: string | undefined =
        body?.alreadyCertified?.blobId ??
        body?.newlyCreated?.blobObject?.blobId ??
        body?.newlyCreated?.blobId;

      if (!blobId) {
        this.logger.error(`Unexpected Walrus response: ${JSON.stringify(body).slice(0, 400)}`);
        throw new Error('Walrus did not return a blobId');
      }
      return blobId;
    } catch (err: any) {
      const status = err?.response?.status;
      const statusText = err?.response?.statusText;
      const code = err?.code;
      const body = err?.response?.data;
      const bodySnippet =
        typeof body === 'string' ? body.slice(0, 400) : JSON.stringify(body)?.slice(0, 400);

      this.logger.error(
        `Walrus PUT failed [status=${status ?? '-'} code=${code ?? '-'}]: ${err?.message}`,
      );
      if (bodySnippet) this.logger.error(`Walrus error body: ${bodySnippet}`);

      // Bubble an actionable message up to the controller/frontend
      throw new Error(
        JSON.stringify({
          where: 'publisher',
          status: status ?? null,
          statusText: statusText ?? null,
          code: code ?? null,
          message: err?.message ?? 'upload failed',
          body: bodySnippet ?? null,
        }),
      );
    }
  }

  async uploadMetadata(metadata: Record<string, any>): Promise<string> {
    this.logger.debug('uploadMetadata called');
    const payload = Buffer.from(JSON.stringify(metadata), 'utf-8');
    return this.putBlob(payload);
  }

  async uploadData(data: any): Promise<string> {
    this.logger.debug('uploadData called');
    let payload: Buffer;
    if (Buffer.isBuffer(data)) payload = data;
    else if (typeof data === 'string') payload = Buffer.from(data, 'utf-8');
    else payload = Buffer.from(JSON.stringify(data), 'utf-8');
    return this.putBlob(payload);
  }

  async fetchFile(blobId: string): Promise<Buffer> {
    const url = `${this.aggregatorUrl.replace(/\/$/, '')}/v1/blobs/${blobId}`;
    try {
      this.logger.debug(`GET ${url}`);
      const res = await this.http.get(url, {
        responseType: 'arraybuffer',
        lookup: (hostname, _opts, cb) => dns.lookup(hostname, { family: 4, all: false }, cb),
      } as AxiosRequestConfig & { lookup: any });
      return Buffer.from(res.data);
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.code;
      this.logger.error(
        `Walrus GET failed for ${blobId} [status=${status ?? '-'} code=${code ?? '-'}]: ${err?.message}`,
      );
      throw new Error('Failed to fetch blob from Walrus');
    }
  }

  async getMetadata(blobId: string): Promise<any> {
    const buffer = await this.fetchFile(blobId);
    try {
      return JSON.parse(buffer.toString('utf-8'));
    } catch (error: any) {
      this.logger.error(`Error parsing JSON for blob ${blobId}: ${error.message}`);
      throw new Error('Failed to parse metadata');
    }
  }

  async putCapsule(bytes: Buffer): Promise<string> {
    const base = this.config.get<string>('WALRUS_BASE_URL')!;
    if (!base) throw new Error('WALRUS_BASE_URL not set');

    const apiKey = this.config.get<string>('WALRUS_API_KEY');

    const res = await fetch(`${base.replace(/\/$/, '')}/blobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: new Uint8Array(bytes),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Walrus upload failed: ${res.status} ${text}`);
    }

    const json: any = await res.json().catch(() => ({}));
    const id = json.blobId ?? json.id ?? json.cid ?? json.hash;
    if (!id) throw new Error('Walrus upload did not return a blob id');

    const str = String(id);
    if (str.length > 64) {
      // If your Walrus returns long CIDs, switch to a short-id mode or map off-chain.
      throw new Error('Walrus blob id exceeds 64 chars; enable short ids or map off-chain');
    }
    return str;
  }
}
