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
    // keep new version's config access (future-proof), explorer base unchanged
    const cluster = this.configService.get<string>('SOLANA_CLUSTER') || 'devnet';
    this.explorerBase = `https://explorer.solana.com/tx`;
  }

  async getAllDevices() {
    const devices = await this.dpsService.listDevices();
    // enrich with name/lastSeen/latestDataCid like past version
    return devices.map((dev: any) => ({
      deviceId: dev.deviceId,
      deviceName: dev?.metadata?.deviceName ?? null,
      metadataCid: dev.metadataCid ?? null,
      latestDataCid: dev.latestDataCid ?? null,
      lastSeen: dev.lastSeen ?? null,
    }));
  }

  async getDevice(id: string) {
    const dev: any = await this.dpsService.getDevice(id);
    if (!dev) throw new NotFoundException(`Device ${id} not found`);

    // only fetch Walrus metadata when we actually have a CID
    let metadata: any = null;
    if (dev.metadataCid && typeof dev.metadataCid === 'string' && dev.metadataCid.length > 0) {
      metadata = await this.walrusService.getMetadata(dev.metadataCid);
    }

    const nameFromDb = dev?.metadata?.deviceName;
    const nameFromWalrus = metadata?.deviceName;

    return {
      deviceId: dev.deviceId,
      deviceName: nameFromDb ?? nameFromWalrus ?? null,
      metadata, // may be null
      lastSeen: dev.lastSeen ?? null,
      latestDataCid: dev.latestDataCid ?? null,
      transactionLink: dev.txSignature ? `${this.explorerBase}/${dev.txSignature}` : null,
    };
  }
}
