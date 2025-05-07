import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WalrusService } from '../walrus/walrus.service';
import { DpsService } from '../dps/dps.service';
import { Reading, ReadingDocument } from '../reading/reading.schema';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly dpsService: DpsService,
    private readonly walrusService: WalrusService,
    @InjectModel(Reading.name) private readonly readingModel: Model<ReadingDocument>,
  ) {}

  /**
   * Ingest sensor data for a device:
   * 1. Verify device exists
   * 2. Upload data to Walrus
   * 3. Update lastSeen in device record
   * 4. Persist a new Reading document
   */
  async uploadData(deviceId: string, data: any) {
    // 1. Verify device exists
    const device = await this.dpsService.getDevice(deviceId);
    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not registered`);
    }

    // 2. Upload data payload to Walrus
    this.logger.log(`Uploading data for device ${deviceId}`);
    const dataCid = await this.walrusService.uploadData(data);

    // 3. Update device's lastSeen timestamp and latestDataCid
    await this.dpsService.updateLastSeen(deviceId, dataCid);

    // 4. Record the reading in MongoDB
    const reading = await this.readingModel.create({
      deviceId,
      dataCid,
      timestamp: new Date(),
    });

    return { dataCid, timestamp: reading.timestamp };
  }
}