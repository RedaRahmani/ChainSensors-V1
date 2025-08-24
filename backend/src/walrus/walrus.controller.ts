import { Controller, Get, Param, Res, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { WalrusService } from './walrus.service';

@Controller('walrus')
export class WalrusController {
  private readonly logger = new Logger(WalrusController.name);
  constructor(private readonly walrus: WalrusService) {}

  @Get('blobs/:id')
  async stream(@Param('id') id: string, @Res() res: Response) {
    this.logger.log('GET /walrus/blobs/:id', {
      id_len: id?.length ?? 0,
      hasSlash: id?.includes('/') ?? false,
      hasPlus: id?.includes('+') ?? false,
      hasEq: id?.includes('=') ?? false,
    });

    try {
      const buf = await this.walrus.fetchFile(id);
      const isJson = buf.length && (buf[0] === 0x7b || buf[0] === 0x5b); // { or [
      res.setHeader('Content-Type', isJson ? 'application/json' : 'application/octet-stream');
      res.setHeader('Content-Length', String(buf.length));
      res.send(buf);
    } catch (e: any) {
      throw new HttpException(e?.message || 'Failed to fetch blob', HttpStatus.BAD_GATEWAY);
    }
  }
}
