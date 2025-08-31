import { Controller, Get, Param, Res, HttpException, HttpStatus, Logger, Headers } from '@nestjs/common';
import { Response } from 'express';
import { WalrusService } from './walrus.service';
import { logKV } from '../common/trace';
import { validateBuyerCapsuleForDownload } from '../common/arc1-validation';

@Controller('walrus')
export class WalrusController {
  private readonly logger = new Logger(WalrusController.name);
  constructor(private readonly walrus: WalrusService) {}

  @Get('blobs/:id')
  async stream(@Param('id') id: string, @Res() res: Response, @Headers('x-trace-id') traceId?: string) {
    logKV(this.logger, 'walrus.controller.fetch', {
      traceId,
      id_len: id?.length ?? 0,
      hasSlash: id?.includes('/') ?? false,
      hasPlus: id?.includes('+') ?? false,
      hasEq: id?.includes('=') ?? false,
    }, 'debug');

    this.logger.log('GET /walrus/blobs/:id', {
      id_len: id?.length ?? 0,
      hasSlash: id?.includes('/') ?? false,
      hasPlus: id?.includes('+') ?? false,
      hasEq: id?.includes('=') ?? false,
    });

    try {
      const buf = await this.walrus.fetchFile(id);
      const isJson = buf.length && (buf[0] === 0x7b || buf[0] === 0x5b); // { or [
      const contentType = isJson ? 'application/json' : 'application/octet-stream';
      
      // Validate buyer capsules (binary content that looks like ARC1 capsules)
      if (!isJson && buf.length > 40 && buf.length <= 200) {
        const isValidBuyerCapsule = validateBuyerCapsuleForDownload(buf, this.logger, {
          traceId,
          cid: id,
        });
        
        if (!isValidBuyerCapsule) {
          logKV(this.logger, 'walrus.controller.capsule_validation_failed', {
            traceId,
            cid: id,
            size: buf.length,
          }, 'warn');
          // Note: We log the warning but don't block download to maintain compatibility
          // Frontend should handle capsule validation errors gracefully
        }
      }
      
      // Log final result
      logKV(this.logger, 'walrus.controller.result', {
        traceId,
        status: 200,
        contentType,
        contentLength: buf.length,
      }, 'debug');
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(buf.length));
      res.send(buf);
    } catch (e: any) {
      logKV(this.logger, 'walrus.controller.result', {
        traceId,
        status: 502,
        contentType: null,
        contentLength: 0,
        error: e?.message || 'Failed to fetch blob',
      }, 'error');
      
      throw new HttpException(e?.message || 'Failed to fetch blob', HttpStatus.BAD_GATEWAY);
    }
  }
}
