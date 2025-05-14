import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DpsService } from '../dps/dps.service';
import { WalrusService } from '../walrus/walrus.service';

@Injectable()
export class RegistryService {
  private readonly explorerBase: string;

  constructor(
    private readonly dpsService: DpsService,
    private readonly walrusService: WalrusService,
    private readonly configService: ConfigService,
  ) {
    const cluster = this.configService.get<string>('SOLANA_CLUSTER') || 'devnet';
    this.explorerBase = `https://explorer.solana.com/tx`;
  }

  async getAllDevices() {
    const devices = await this.dpsService.listDevices();
    return devices.map(dev => ({
      deviceId: dev.deviceId,
      metadataCid: dev.metadataCid,
    }));
  }

  async getDevice(id: string) {
    const dev = await this.dpsService.getDevice(id);
    if (!dev) throw new NotFoundException(`Device ${id} not found`);

    const metadata = await this.walrusService.getMetadata(dev.metadataCid);
    return {
      deviceId: dev.deviceId,
      metadata,
      lastSeen: dev.lastSeen,
      latestDataCid: dev.latestDataCid,
      transactionLink: `${this.explorerBase}/${dev.txSignature}`,
    };
  }
}
