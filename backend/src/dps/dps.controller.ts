import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { DpsService } from './dps.service';

@Controller('dps')
export class DpsController {
  constructor(private readonly dpsService: DpsService) {}


  @Post('enroll')
  async enrollDevice(
    @Body()
    body: { csrPem: string; metadata: any },
  ) {
    const { csrPem, metadata } = body;
    if (!csrPem || !metadata) {
      throw new HttpException('Missing csrPem or metadata', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.dpsService.enrollDevice(csrPem, metadata);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
