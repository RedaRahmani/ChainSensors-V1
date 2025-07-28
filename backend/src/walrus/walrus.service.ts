import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';

@Injectable()
export class WalrusService {
  private readonly logger = new Logger(WalrusService.name);
  private tuskyUrl: string;
  private apiKey: string;
  private vaultCache = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {
    this.tuskyUrl = this.configService.get<string>('TUSKY_URL');
    this.apiKey = this.configService.get<string>('TUSKY_API_KEY');
    if (!this.tuskyUrl) throw new Error('TUSKY_URL not set');
    if (!this.apiKey) throw new Error('TUSKY_API_KEY not set');
  }

  /** Create or retrieve a vault by name */
  private async getOrCreateVault(name: string): Promise<string> {
    if (this.vaultCache.has(name)) {
      const cached = this.vaultCache.get(name)!;
      this.logger.debug(`Using cached vaultId for '${name}': ${cached}`);
      return cached;
    }
    try {
      this.logger.log(`Creating vault: ${name}`);
      const config: AxiosRequestConfig = {
        headers: { 'Api-Key': this.apiKey },
      };
      this.logger.debug(`POST ${this.tuskyUrl}/vaults`, {
        name,
        headers: config.headers,
      });
      const response = await axios.post(
        `${this.tuskyUrl}/vaults`,
        { name },
        config,
      );
      this.logger.debug(`Vault create response`, {
        status: response.status,
        data: response.data,
      });
      const vaultId = response.data.id;
      this.vaultCache.set(name, vaultId);
      return vaultId;
    } catch (error: any) {
      this.logger.error(`Error creating vault ${name}: ${error.message}`);
      if (error.response) {
        this.logger.error('Response data:', error.response.data);
      }
      throw new Error('Failed to create vault');
    }
  }

  /** Construct TUS Upload-Metadata header */
  private constructUploadMetadata(metadata: Record<string, string>): string {
    return Object.entries(metadata)
      .map(([key, value]) => {
        const encodedValue = Buffer.from(value.toString()).toString('base64');
        return `${key} ${encodedValue}`;
      })
      .join(',');
  }

  /** Low-level file upload via TUS */
  private async uploadFileToVault(
    data: Buffer,
    vaultId: string,
  ): Promise<string> {
    const length = data.length;
    this.logger.debug(
      `Initiating TUS upload for vault ${vaultId}, size=${length}`,
    );
    let uploadUrl: string;

    // Create TUS upload session
    try {
      const metadata = {
        vaultId: vaultId,
        filename: 'data.json',
      };
      const uploadMetadata = this.constructUploadMetadata(metadata);

      const createConfig: AxiosRequestConfig = {
        headers: {
          'Api-Key': this.apiKey,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': length.toString(),
          'Upload-Metadata': uploadMetadata,
        },
        validateStatus: (status) => status === 201 || status === 204,
      };
      this.logger.debug('TUS create config', createConfig.headers);
      const createRes = await axios.post(
        `${this.tuskyUrl}/uploads`,
        null,
        createConfig,
      );
      this.logger.debug(`TUS create response`, {
        status: createRes.status,
        headers: createRes.headers,
      });
      uploadUrl = createRes.headers['location'];
      if (!uploadUrl) throw new Error('Missing Location header');
    } catch (error: any) {
      this.logger.error(`TUS create upload error: ${error.message}`);
      if (error.response)
        this.logger.error('Response data:', error.response.data);
      throw new Error('Failed to initiate upload');
    }

    // Upload data chunk
    try {
      const patchConfig: AxiosRequestConfig = {
        headers: {
          'Api-Key': this.apiKey,
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': '0',
          'Content-Type': 'application/offset+octet-stream',
        },
        maxBodyLength: Infinity,
        validateStatus: (status) =>
          status === 204 || status === 201 || status === 200,
      };
      this.logger.debug(`PATCH ${uploadUrl}`, { headers: patchConfig.headers });
      const patchRes = await axios.patch(uploadUrl, data, patchConfig);
      this.logger.debug(`TUS upload PATCH response`, {
        status: patchRes.status,
        data: patchRes.data,
      });
      this.logger.debug('TUS upload PATCH succeeded');
    } catch (error: any) {
      this.logger.error(`TUS upload PATCH error: ${error.message}`);
      if (error.response)
        this.logger.error('Response data:', error.response.data);
      throw new Error('Failed to upload chunk');
    }

    const blobId = uploadUrl.split('/').pop();
    this.logger.log(`Upload completed for vault ${vaultId}, blobId=${blobId}`);
    return blobId!;
  }

  private async fetchFile(blobId: string): Promise<Buffer> {
    try {
      this.logger.log(`Fetching blob ${blobId}`);
      const response = await axios.get(
        `${this.tuskyUrl}/files/${blobId}/data`,
        {
          headers: { 'Api-Key': this.apiKey },
          responseType: 'arraybuffer',
        },
      );
      this.logger.debug(`Fetch response status: ${response.status}`);
      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error(`Error fetching blob ${blobId}: ${error.message}`);
      if (error.response)
        this.logger.error('Response data:', error.response.data);
      throw new Error('Failed to retrieve file');
    }
  }

  async uploadMetadata(metadata: any): Promise<string> {
    this.logger.debug(`uploadMetadata called`, metadata);
    const vaultId = await this.getOrCreateVault(
      metadata.deviceId || 'metadata',
    );
    const buffer = Buffer.from(JSON.stringify(metadata));
    this.logger.debug(`Uploading metadata buffer length: ${buffer.length}`);
    return this.uploadFileToVault(buffer, vaultId);
  }

  async uploadData(data: any): Promise<string> {
    this.logger.debug(`uploadData called`, data);
    const vaultId = await this.getOrCreateVault('sensor-data');
    const buffer = Buffer.from(JSON.stringify(data));
    this.logger.debug(`Uploading data buffer length: ${buffer.length}`);
    return this.uploadFileToVault(buffer, vaultId);
  }

  async getMetadata(blobId: string): Promise<any> {
    this.logger.debug(`getMetadata called for blobId: ${blobId}`);
    const buffer = await this.fetchFile(blobId);
    this.logger.debug(`Fetched buffer length: ${buffer.length}`);
    try {
      return JSON.parse(buffer.toString('utf-8'));
    } catch (error: any) {
      this.logger.error(
        `Error parsing JSON for blob ${blobId}: ${error.message}`,
      );
      throw new Error('Failed to parse metadata');
    }
  }
}
