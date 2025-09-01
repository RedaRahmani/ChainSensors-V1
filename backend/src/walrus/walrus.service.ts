import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as dns from 'dns';
import * as https from 'https';
import { logKV } from '../common/trace';
import PQueue from 'p-queue';

@Injectable()
export class WalrusService {
  private readonly logger = new Logger(WalrusService.name);

  private readonly publisherUrl: string;
  private readonly aggregatorUrl: string;
  private readonly defaultEpochs: number;
  private readonly deletable: boolean;

  private readonly http: AxiosInstance;

  // Upload queue with concurrency limit to prevent rate limiting
  private readonly uploadQueue = new PQueue({ concurrency: 2 });

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
      `WalrusService ready. publisher=${this.publisherUrl} aggregator=${this.aggregatorUrl} epochs=${this.defaultEpochs} deletable=${this.deletable} queueConcurrency=${this.uploadQueue.concurrency}`,
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

  /** CID utility: check if looks like base64url (only [A-Za-z0-9-_], no '=') */
  public looksBase64Url(s: string): boolean {
    return /^[A-Za-z0-9\-_]+$/.test(s);
  }

  private buildAggUrl(pathId: string): string {
    const normalizedId = this.toBase64Url(pathId);
    return `${this.aggregatorUrl.replace(/\/$/, '')}/v1/blobs/${normalizedId}`;
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

  /**
   * Rate-limited wrapper for putBlob that respects 429s and implements exponential backoff
   */
  private async putBlobWithRetry(data: Buffer, epochs?: number): Promise<string> {
    return this.uploadQueue.add(async (): Promise<string> => {
      let delay = 250; // Start with 250ms delay
      for (let attempt = 0; ; attempt++) {
        try {
          return await this.putBlob(data, epochs);
        } catch (e: any) {
          const status = e?.response?.status ?? e?.status;
          const retryAfter = Number(e?.response?.headers?.['retry-after']);
          
          // Only retry on 429 (rate limit) errors
          if (status !== 429) {
            throw e; // Re-throw non-rate-limit errors immediately
          }
          
          // Calculate sleep time: use Retry-After header if present, otherwise exponential backoff
          const sleepMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : delay;
          
          this.logger.warn(`Walrus rate limited (429), retrying in ${sleepMs}ms (attempt ${attempt + 1})`);
          
          await new Promise(resolve => setTimeout(resolve, sleepMs));
          
          // Increase delay for next attempt (exponential backoff with jitter)
          delay = Math.min(delay * 2 + Math.random() * 100, 4000); // Cap at 4s with jitter
        }
      }
    }) as Promise<string>;
  }

  async uploadMetadata(metadata: Record<string, any>): Promise<string> {
    this.logger.debug('uploadMetadata called');
    const payload = Buffer.from(JSON.stringify(metadata), 'utf-8');
    return this.putBlobWithRetry(payload);
  }

  async uploadData(data: any): Promise<string> {
    this.logger.debug('uploadData called');
    let payload: Buffer;
    if (Buffer.isBuffer(data)) payload = data;
    else if (typeof data === 'string') payload = Buffer.from(data, 'utf-8');
    else payload = Buffer.from(JSON.stringify(data), 'utf-8');
    return this.putBlobWithRetry(payload);
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
  async fetchFileSmart(blobId: string, traceId?: string): Promise<{ bytes: Buffer; used: string }> {
    const attempts: { note: string; url: string }[] = [];
    const raw = String(blobId).trim();
    const b64u = this.toBase64Url(raw);

    // Auto-normalize if not URL-safe
    if (!this.looksBase64Url(raw)) {
      logKV(this.logger, 'walrus.cid_normalized', {
        traceId,
        originalCid: raw.substring(0, 20) + '...',
        normalizedCid: b64u.substring(0, 20) + '...',
      }, 'debug');
    }

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
        
        const bytes = Buffer.from(res.data);
        const contentType = res.headers['content-type'] || 'application/octet-stream';
        
        // Add fetch summary log
        this.logger.debug({
          msg: 'walrus.fetch',
          cid: raw.slice(0, 16) + '…',
          status: res.status,
          contentType,
          contentLength: bytes.length,
        });
        
        return { bytes, used: a.note };
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
    
    // Log fetch failure
    logKV(this.logger, 'walrus.fetch', {
      traceId,
      cid: raw.substring(0, 10) + '...',
      status: status || null,
      contentType: null,
      contentLength: 0,
    }, 'error');
    
    logKV(this.logger, 'walrus.fetch_failed', {
      traceId,
      reason: 'walrus_fetch_failed',
      cid: raw.substring(0, 10) + '...',
      attempts: attempts.length,
    }, 'error');

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
    return this.putBlobWithRetry(bytes);
  }
}
