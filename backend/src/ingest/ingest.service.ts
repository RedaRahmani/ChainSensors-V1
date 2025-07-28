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
    @InjectModel(Reading.name)
    private readonly readingModel: Model<ReadingDocument>,
  ) {}

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
}
