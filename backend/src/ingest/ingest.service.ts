import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WalrusService } from '../walrus/walrus.service';
import { DpsService } from '../dps/dps.service';
import { Reading, ReadingDocument } from '../reading/reading.schema';
import { ArciumService } from '../arcium/arcium.service';
import { randomBytes, createCipheriv } from 'crypto';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly dpsService: DpsService,
    private readonly walrusService: WalrusService,
    private readonly arcium: ArciumService,
    @InjectModel(Reading.name)
    private readonly readingModel: Model<ReadingDocument>,
  ) {}

  /**
   * Legacy raw upload (kept)
   */
  async uploadData(deviceId: string, data: any) {
    const device = await this.dpsService.getDevice(deviceId);
    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not registered`);
    }

    this.logger.log(`Uploading data for device ${deviceId}`);
    const dataCid = await this.walrusService.uploadData(data);

    await this.dpsService.updateLastSeen(deviceId, dataCid);

    const reading = await this.readingModel.create({
      deviceId,
      dataCid,
      timestamp: new Date(),
    });

    return { dataCid, timestamp: reading.timestamp };
  }

  /**
   * Real path for Phase 3:
   *  - Generate 32-byte DEK
   *  - AES-256-GCM encrypt payload → [IV(12) | CIPHERTEXT | TAG(16)]
   *  - Seal DEK for MXE via X25519+HKDF → capsule bytes
   *  - Upload both to Walrus, return CIDs
   */
  async encryptAndStore(deviceId: string, payload: Buffer | string): Promise<{
    payloadCid: string;
    dekCapsuleForMxeCid: string;
  }> {
    const device = await this.dpsService.getDevice(deviceId);
    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not registered`);
    }

    const dataBuf = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(payload as string, 'utf-8');

    // 1) DEK + AES-GCM
    const dek = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    const ciphertext = Buffer.concat([cipher.update(dataBuf), cipher.final()]);
    const tag = cipher.getAuthTag();

    // On-wire format: IV | CIPHERTEXT | TAG
    const encBlob = Buffer.concat([iv, ciphertext, tag]);

    // 2) Seal DEK for MXE (capsule)
    const capsule = await this.arcium.sealDekForMxe(dek);

    // 3) Upload both to Walrus
    const [payloadCid, dekCapsuleForMxeCid] = await Promise.all([
      this.walrusService.uploadData(encBlob),
      this.walrusService.uploadData(capsule),
    ]);

    // 4) Bookkeeping
    await this.dpsService.updateLastSeen(deviceId, payloadCid);
    await this.readingModel.create({
      deviceId,
      dataCid: payloadCid,
      timestamp: new Date(),
    });

    this.logger.log(
      `encryptAndStore -> device=${deviceId}, payloadCid=${payloadCid}, dekCapsuleForMxeCid=${dekCapsuleForMxeCid}`,
    );

    return { payloadCid, dekCapsuleForMxeCid };
  }
}
