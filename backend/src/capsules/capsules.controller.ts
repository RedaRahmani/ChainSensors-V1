import { Body, Controller, Post } from '@nestjs/common';
import { CapsulesService } from './capsules.service';

@Controller('capsules')
export class CapsulesController {
  constructor(private readonly capsules: CapsulesService) {}

  // Production path: backend receives a DEK (base64), seals to MXE pubkey,
  // uploads capsule to Walrus, and returns a short blobId.
  @Post('upload')
  async upload(@Body() body: { dekBase64: string }) {
    return this.capsules.createAndUploadCapsuleFromDekB64(body.dekBase64);
  }
}
