import { Body, Controller, Post, Logger, BadRequestException } from '@nestjs/common';
import { CapsulesService } from './capsules.service';

@Controller('capsules')
export class CapsulesController {
  private readonly logger = new Logger(CapsulesController.name);
  constructor(private readonly capsules: CapsulesService) {}

  @Post('upload')
  async upload(@Body() body: { dekBase64: string }) {
    this.logger.log('POST /capsules/upload', {
      hasDek: !!body?.dekBase64,
      dekLen: body?.dekBase64 ? body.dekBase64.length : 0,
    });
    try {
      const out = await this.capsules.createAndUploadCapsuleFromDekB64(body.dekBase64);
      this.logger.log('capsule uploaded', out);
      return out;
    } catch (e: any) {
      this.logger.error('capsule upload failed', { err: e?.message });
      // surface a clear client error instead of a vague 500
      if (e?.getStatus?.() >= 400 && e?.getStatus?.() < 500) throw e;
      throw new BadRequestException(e?.message || 'capsule upload failed');
    }
  }
}
