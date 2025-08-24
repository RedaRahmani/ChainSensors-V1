import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { WalrusService } from '../walrus/walrus.service';
import { ArciumService } from '../arcium/arcium.service';

@Injectable()
export class CapsulesService {
  private readonly logger = new Logger(CapsulesService.name);
  constructor(
    private readonly walrus: WalrusService,
    private readonly arcium: ArciumService,
  ) {}

  private b64ToBytes(b64: string): Buffer {
    try {
      // accept both b64 and b64url (with or without padding)
      let t = String(b64).trim();
      t = t.replace(/-/g, '+').replace(/_/g, '/');
      while (t.length % 4) t += '=';
      const buf = Buffer.from(t, 'base64');
      if (!buf.length) throw new Error('empty decode');
      return buf;
    } catch (e: any) {
      throw new BadRequestException(`Invalid base64: ${e?.message || 'decode failed'}`);
    }
  }

  /**
   * Create a proper Arcium capsule (serialized ciphertext) from a 32-byte DEK
   * and upload to Walrus. Returns the Walrus blobId (use this in listings).
   */
  async createAndUploadCapsuleFromDekB64(dekBase64: string): Promise<{ blobId: string }> {
    if (!dekBase64) throw new BadRequestException('dekBase64 required');

    const dek = this.b64ToBytes(dekBase64);
    if (dek.length !== 32) {
      throw new BadRequestException(`DEK must be 32 bytes, got ${dek.length}`);
    }

    this.logger.log('Sealing DEK with Arcium MXE…', { dek_len: dek.length });
    let serialized: Buffer;
    try {
      serialized = await this.arcium.sealDekForMxe(dek);
    } catch (e: any) {
      this.logger.error('Arcium sealDekForMxe failed', { err: e?.message });
      throw new BadRequestException(`Arcium sealing failed: ${e?.message || 'unknown error'}`);
    }

    if (!serialized?.length) {
      throw new BadRequestException('Arcium returned empty capsule bytes');
    }

    this.logger.log('Uploading capsule to Walrus…', { bytes: serialized.length });
    const blobId = await this.walrus.uploadData(serialized);
    const normalized = this.walrus.normalizeBlobId(blobId);

    this.logger.log('createAndUploadCapsuleFromDekB64 -> OK', {
      blobId: normalized,
      len: normalized.length,
    });
    return { blobId: normalized };
  }
}
