import { Injectable } from '@nestjs/common';
import { WalrusService } from '../walrus/walrus.service';
import { DpsService } from '../dps/dps.service';

@Injectable()
export class IngestService {
  constructor(
    private readonly walrusService: WalrusService,
    private readonly dpsService: DpsService,
  ) {}

  async uploadData(deviceId: string, data: Buffer): Promise<string> {
    const deviceMap = this.dpsService.getDeviceMap();
    if (!deviceMap.has(deviceId)) throw new Error('Device not found');

    return await this.walrusService.uploadData(data);
  }
}