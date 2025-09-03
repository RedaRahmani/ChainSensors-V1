import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from './device.schema';
import { ReportDeviceMetadataDto } from './dto/report-device-metadata.dto';
import { WalrusService } from '../walrus/walrus.service';

@Controller('dps')
export class FirmwareController {
  private readonly logger = new Logger(FirmwareController.name);

  constructor(
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    private readonly walrusService: WalrusService,
  ) {}

  /**
   * POST /dps/metadata
   * Body: { deviceId, model, fwVersion, mxeDeviceId? }
   * Stores JSON in Walrus, saves metadataCid on device doc, returns { metadataCid }.
   */
  @Post('metadata')
  @HttpCode(HttpStatus.CREATED)
  async reportMetadata(@Body() dto: ReportDeviceMetadataDto) {
    let dev = await this.deviceModel.findOne({ deviceId: dto.deviceId }).lean().exec();
    if (!dev) {
      await this.deviceModel.create({ deviceId: dto.deviceId });
      dev = await this.deviceModel.findOne({ deviceId: dto.deviceId }).lean().exec();
    }

    const metaDoc = {
      v: 1,
      deviceId: dto.deviceId,
      model: dto.model,
      fwVersion: dto.fwVersion,
      arcium: dto.mxeDeviceId ? { deviceId: dto.mxeDeviceId } : { hint: dto.deviceId },
      createdAt: new Date().toISOString(),
      source: 'firmware',
    };

    const metadataCid = await this.walrusService.uploadMetadata(metaDoc);
    await this.deviceModel.updateOne({ deviceId: dto.deviceId }, { $set: { metadataCid } }).exec();

    this.logger.log(`[fw] metadata for ${dto.deviceId} → ${metadataCid}`);
    return { ok: true, metadataCid };
  }
}
