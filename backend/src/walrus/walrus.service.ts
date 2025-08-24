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
      timeout: 60000,
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

  /** Base64 -> base64url (Walrus prefers url-safe, no padding). */
  private toBase64Url(id: string): string {
    let t = String(id).trim().replace(/\s+/g, '');
    // if it came percent-encoded, decode first (best-effort)
    try { t = decodeURIComponent(t); } catch {}
    t = t.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    return t;
  }

  /** Public helper used by ListingService before persisting/sending on-chain. */
  public normalizeBlobId(id: string): string {
    if (!id) return id;
    return this.toBase64Url(id);
  }

  private buildAggUrl(pathId: string): string {
    return `${this.aggregatorUrl.replace(/\/$/, '')}/v1/blobs/${pathId}`;
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

      this.logger.log('Walrus PUT -> blobId', {
        blobId_len: String(blobId).length,
        hasSlash: String(blobId).includes('/'),
        hasPlus: String(blobId).includes('+'),
        hasEq: String(blobId).includes('='),
      });

      return String(blobId);
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

  /**
   * Legacy simple fetch: percent-encodes whatever you pass.
   */
  async fetchFile(blobId: string): Promise<Buffer> {
    const encoded = encodeURIComponent(blobId);
    const url = this.buildAggUrl(encoded);
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

  /**
   * Smart fetch: tries raw-encoded, base64url, and encoded base64url path forms.
   */
  async fetchFileSmart(blobId: string): Promise<{ bytes: Buffer; used: string }> {
    const attempts: { note: string; url: string }[] = [];
    const raw = String(blobId).trim();
    const b64u = this.toBase64Url(raw);

    attempts.push({ note: 'encoded(raw)', url: this.buildAggUrl(encodeURIComponent(raw)) });
    attempts.push({ note: 'b64url',       url: this.buildAggUrl(b64u) });
    attempts.push({ note: 'encoded(b64u)',url: this.buildAggUrl(encodeURIComponent(b64u)) });

    let lastErr: any = null;

    for (const a of attempts) {
      try {
        this.logger.debug(`GET ${a.url} (${a.note})`);
        const res = await this.http.get(a.url, {
          responseType: 'arraybuffer',
          lookup: (hostname, _opts, cb) => dns.lookup(hostname, { family: 4, all: false }, cb),
        } as AxiosRequestConfig & { lookup: any });
        return { bytes: Buffer.from(res.data), used: a.note };
      } catch (err: any) {
        const status = err?.response?.status;
        const body = err?.response?.data;
        const bodySnippet =
          typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body)?.slice(0, 200);
        this.logger.warn(`Walrus GET attempt failed (${a.note}) [status=${status ?? '-'}]: ${err?.message}`);
        if (bodySnippet) this.logger.warn(`Walrus body: ${bodySnippet}`);
        lastErr = err;
      }
    }

    const status = lastErr?.response?.status;
    const code = lastErr?.code;
    this.logger.error(
      `Walrus GET failed for ${raw} after ${attempts.length} attempts [status=${status ?? '-'} code=${code ?? '-'}]: ${lastErr?.message}`,
    );
    throw new Error('Failed to fetch blob from Walrus');
  }

  async getMetadata(blobId: string): Promise<any> {
    const { bytes } = await this.fetchFileSmart(blobId);
    try {
      return JSON.parse(bytes.toString('utf-8'));
    } catch (error: any) {
      this.logger.error(`Error parsing JSON for blob ${blobId}: ${error.message}`);
      throw new Error('Failed to parse metadata');
    }
  }

  async putCapsule(bytes: Buffer): Promise<string> {
    return this.putBlob(bytes);
  }
}
