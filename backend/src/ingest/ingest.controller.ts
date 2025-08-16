import {
  Controller,
  Post,
  Param,
  Body,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { IngestService } from './ingest.service';

@Controller('data')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  /**
   * Legacy raw upload – stores the body as-is via Walrus.
   * Returns: { dataCid, timestamp }
   */
  @Post(':deviceId')
  async uploadData(@Param('deviceId') deviceId: string, @Body() data: any) {
    try {
      if (data == null) {
        throw new BadRequestException('Data is required');
      }
      // IngestService.uploadData already returns { dataCid, timestamp }
      return await this.ingestService.uploadData(deviceId, data);
    } catch (error: any) {
      throw new HttpException(
        error?.message || 'Upload failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Real encryption path – AES-256-GCM payload + DEK sealed for MXE.
   * Body: { deviceId, dataBase64?: string, text?: string }
   * Returns: { payloadCid, dekCapsuleForMxeCid }
   */
  @Post('encrypt')
  async encryptAndStore(
    @Body()
    body: { deviceId: string; dataBase64?: string; text?: string },
  ) {
    const { deviceId, dataBase64, text } = body || {};
    if (!deviceId) throw new BadRequestException('deviceId is required');

    let buf: Buffer;
    if (typeof dataBase64 === 'string') {
      try {
        buf = Buffer.from(dataBase64, 'base64');
      } catch {
        throw new BadRequestException('dataBase64 is not valid base64');
      }
    } else if (typeof text === 'string') {
      buf = Buffer.from(text, 'utf-8');
    } else {
      throw new BadRequestException('Provide dataBase64 or text');
    }

    return this.ingestService.encryptAndStore(deviceId, buf);
  }
}
