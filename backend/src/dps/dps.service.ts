import { Injectable } from '@nestjs/common';
import { WalrusService } from '../walrus/walrus.service';
import { SolanaService } from '../solana/solana.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DpsService {
  private deviceMap = new Map<string, any>(); // In-memory storage

  constructor(
    private readonly walrusService: WalrusService,
    private readonly solanaService: SolanaService,
  ) {}

  async enrollDevice(devicePubKey: string, metadata: any): Promise<any> {
    const whitelist = ['allowedPubKey1', 'allowedPubKey2']; // Simple whitelist
    if (!whitelist.includes(devicePubKey)) {
      throw new Error('Device not whitelisted');
    }

    const metadataCid = await this.walrusService.uploadMetadata(metadata);
    const transactionId = await this.solanaService.registerDevice(devicePubKey, metadataCid);

    const deviceId = uuidv4();
    this.deviceMap.set(deviceId, { devicePubKey, metadataCid, transactionId });

    return {
      deviceId,
      brokerUrl: process.env.BROKER_URL || 'mqtt://broker.example.com',
      csrSigned: false, // Placeholder for certificate signing
    };
  }

  // Expose deviceMap for other services (in production, use a DB)
  getDeviceMap() {
    return this.deviceMap;
  }
}