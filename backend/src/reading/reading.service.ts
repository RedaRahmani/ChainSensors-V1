import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WalrusService } from '../walrus/walrus.service';
import { Reading, ReadingDocument } from './reading.schema';

@Injectable()
export class ReadingService {
  constructor(
    @InjectModel(Reading.name) private readingModel: Model<ReadingDocument>,
    private readonly walrusService: WalrusService,
  ) {}

  /**
   * Fetch paginated readings for a given device.
   */
  async findByDevice(
    deviceId: string,
    skip = 0,
    limit = 100,
  ): Promise<Reading[]> {
    return this.readingModel
      .find({ deviceId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  /**
   * Fetch the raw JSON payload for a particular reading.
   * Throws 404 if that blobId isn't associated with this device.
   */
  async getRaw(deviceId: string, blobId: string): Promise<any> {
    const reading = await this.readingModel
      .findOne({ deviceId, dataCid: blobId })
      .lean()
      .exec();
    if (!reading) {
      throw new NotFoundException(
        `Reading ${blobId} for device ${deviceId} not found`,
      );
    }
    // pull the actual JSON from Walrus
    return this.walrusService.getMetadata(blobId);
  }
}
