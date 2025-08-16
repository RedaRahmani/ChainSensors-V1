import { Controller, Get, Post } from '@nestjs/common';
import { WalrusService } from './walrus.service';

@Controller('walrus/diag')
export class WalrusDiagnosticsController {
  constructor(private readonly walrus: WalrusService) {}

  @Post('upload')
  async uploadProbe() {
    const sample = { ping: 'chainsensors', ts: Date.now() };
    try {
      const blobId = await this.walrus.uploadMetadata(sample);
      return { ok: true, blobId };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }

  @Get('help')
  help() {
    return {
      howToUse: 'POST /walrus/diag/upload to test publisher reachability',
    };
  }
}
