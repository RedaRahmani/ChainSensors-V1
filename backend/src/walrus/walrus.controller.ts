import { Controller, Get, Param, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { WalrusService } from './walrus.service';

@Controller('walrus')
export class WalrusController {
  constructor(private readonly walrus: WalrusService) {}

  @Get('blobs/:id')
  async stream(@Param('id') id: string, @Res() res: Response) {
    try {
      const buf = await this.walrus.fetchFile(id);
      const isJson = buf.length && (buf[0] === 0x7b || buf[0] === 0x5b); // { or [
      res.setHeader('Content-Type', isJson ? 'application/json' : 'application/octet-stream');
      res.setHeader('Content-Length', String(buf.length));
      res.send(buf);
    } catch (e: any) {
      // surface a clean 404/502 if the aggregator can’t find/serve the blob
      throw new HttpException(e?.message || 'Failed to fetch blob', HttpStatus.BAD_GATEWAY);
    }
  }
}
