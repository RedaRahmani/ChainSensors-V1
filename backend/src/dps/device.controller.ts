import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Patch,
  BadRequestException,
  Post,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from './device.schema';
import { UpdateDeviceMetadataDto } from './dto/update-device-metadata.dto';
import { WalrusService } from '../walrus/walrus.service';

@Controller('dps/device')
export class DpsDeviceController {
  private readonly logger = new Logger(DpsDeviceController.name);

  constructor(
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    private readonly walrusService: WalrusService,
  ) {}

  // PATCH /dps/device/:deviceId/metadata  { deviceName?: string }
  @Patch(':deviceId/metadata')
  async updateMetadata(
    @Param('deviceId') deviceId: string,
    @Body() body: UpdateDeviceMetadataDto,
  ) {
    const update: any = {};
    if (typeof body.deviceName === 'string') {
      const name = body.deviceName.trim();
      update['metadata.deviceName'] = name;
    }
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const doc = await this.deviceModel
      .findOneAndUpdate({ deviceId }, { $set: update }, { new: true })
      .lean()
      .exec();

    if (!doc) throw new NotFoundException(`Device ${deviceId} not found`);
    this.logger.log(`Renamed device ${deviceId} → "${doc?.metadata?.deviceName ?? ''}"`);
    return { ok: true, device: doc };
  }

  /**
   * POST /dps/device/:deviceId/metadata/prime
   * Fallback: create minimal metadata JSON in Walrus if missing.
   */
  @Post(':deviceId/metadata/prime')
  async primeMetadata(@Param('deviceId') deviceId: string) {
    const dev = await this.deviceModel.findOne({ deviceId }).lean().exec();
    if (!dev) throw new NotFoundException(`Device ${deviceId} not found`);

    if (dev.metadataCid && typeof dev.metadataCid === 'string' && dev.metadataCid.length > 0) {
      this.logger.log(`[prime] device ${deviceId} already has metadataCid=${dev.metadataCid}`);
      return { ok: true, metadataCid: dev.metadataCid, already: true };
    }

    const metaDoc = {
      v: 1,
      deviceId,
      model: dev?.metadata?.model ?? 'esp32-bme280',
      fwVersion: dev?.metadata?.fwVersion ?? '1.0.0',
      arcium: { hint: deviceId },
      createdAt: new Date().toISOString(),
      source: 'prime',
    };

    const metadataCid = await this.walrusService.uploadMetadata(metaDoc);
    await this.deviceModel.updateOne({ deviceId }, { $set: { metadataCid } }).exec();

    this.logger.log(`[prime] device ${deviceId} → metadataCid=${metadataCid}`);
    return { ok: true, metadataCid, created: true };
  }
}
