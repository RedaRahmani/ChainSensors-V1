import { Injectable } from '@nestjs/common';
import { WalrusService } from '../walrus/walrus.service';
import { DpsService } from '../dps/dps.service';

@Injectable()
export class RegistryService {
  constructor(
    private readonly walrusService: WalrusService,
    private readonly dpsService: DpsService, // Injected to access deviceMap
  ) {}

  getAllDevices(): any[] {
    const deviceMap = this.dpsService.getDeviceMap();
    return Array.from(deviceMap.entries()).map(([id, data]) => ({
      deviceId: id,
      devicePubKey: data.devicePubKey,
      metadataCid: data.metadataCid,
    }));
  }

  async getDevice(id: string): Promise<any> {
    const deviceMap = this.dpsService.getDeviceMap();
    const device = deviceMap.get(id);
    if (!device) throw new Error('Device not found');

    const metadata = await this.walrusService.getMetadata(device.metadataCid);
    return {
      deviceId: id,
      devicePubKey: device.devicePubKey,
      metadata,
      transactionLink: `https://explorer.solana.com/tx/${device.transactionId}?cluster=devnet`,
    };
  }
}