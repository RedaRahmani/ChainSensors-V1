import {
  Controller,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { IngestService } from './ingest.service';

@Controller('data')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post(':deviceId')
  async uploadData(@Param('deviceId') deviceId: string, @Body() data: any) {
    try {
      if (!data) {
        throw new HttpException('Data is required', HttpStatus.BAD_REQUEST);
      }
      const cid = await this.ingestService.uploadData(deviceId, data);
      return { cid };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
