import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { DpsService } from './dps.service';

@Controller('dps')
export class DpsController {
  constructor(private readonly dpsService: DpsService) {}

  @Post('enroll')
  async enrollDevice(@Body() body: { devicePubKey: string; metadata: any }) {
    try {
      const { devicePubKey, metadata } = body;
      if (!devicePubKey || !metadata) {
        throw new HttpException('Missing required fields', HttpStatus.BAD_REQUEST);
      }
      return await this.dpsService.enrollDevice(devicePubKey, metadata);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}