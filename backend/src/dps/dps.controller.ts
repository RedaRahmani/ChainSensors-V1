import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Get,
  Query,
  Param,
  Logger,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { DpsService, EnrollMetadata } from './dps.service';

interface GenerateTxDto {
  csrPem: string;
  metadata: EnrollMetadata;
  sellerPubkey: string;
}
interface GenerateTxResponse {
  deviceId: string;
  certificatePem: string;
  unsignedTx: string;
  brokerUrl: string;
}
interface FinalizeDto {
  deviceId: string;
  signedTx: string;
}
interface FinalizeResponse {
  txSignature: string;
  brokerUrl: string;
  certificatePem: string;
}

@Controller('dps')
export class DpsController {
  private readonly logger = new Logger(DpsController.name);
  constructor(private readonly dpsService: DpsService) {}

  @Post('enroll')
  async generateRegistrationTransaction(
    @Body() dto: GenerateTxDto,
  ): Promise<GenerateTxResponse> {
    this.logger.log('POST /dps/enroll', {
      sellerPubkey: dto?.sellerPubkey,
      model: dto?.metadata?.model,
      deviceName: dto?.metadata?.deviceName,
    });

    const { csrPem, metadata, sellerPubkey } = dto;
    if (!csrPem || !metadata || !sellerPubkey) {
      throw new HttpException(
        'Missing csrPem, metadata, or sellerPubkey',
        HttpStatus.BAD_REQUEST,
      );
    }
    let sellerKey: PublicKey;
    try {
      sellerKey = new PublicKey(sellerPubkey);
    } catch {
      throw new HttpException('Invalid sellerPubkey format', HttpStatus.BAD_REQUEST);
    }
    try {
      const out = await this.dpsService.generateRegistrationTransaction(
        csrPem,
        metadata,
        sellerKey,
      );
      this.logger.log('enroll -> OK', { deviceId: out.deviceId, metadataCid: (out as any).metadataCid });
      return out;
    } catch (err: any) {
      this.logger.error('enroll -> FAIL', { err: err?.message });
      throw new HttpException(
        err.message || 'Enrollment failed',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('finalize')
  async finalizeRegistration(@Body() dto: FinalizeDto): Promise<FinalizeResponse> {
    this.logger.log('POST /dps/finalize', { deviceId: dto?.deviceId });
    const { deviceId, signedTx } = dto;
    if (!deviceId || !signedTx) {
      throw new HttpException('Missing deviceId or signedTx', HttpStatus.BAD_REQUEST);
    }
    try {
      const out = await this.dpsService.finalizeRegistration(deviceId, signedTx);
      this.logger.log('finalize -> OK', { deviceId, tx: out.txSignature });
      return out;
    } catch (err: any) {
      this.logger.error('finalize -> FAIL', { err: err?.message });
      throw new HttpException(
        err.message || 'Finalization failed',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('my-devices')
  async myDevices(@Query('sellerPubkey') seller: string) {
    this.logger.log('GET /dps/my-devices', { seller });
    return this.dpsService.listDevices({ sellerPubkey: seller });
  }

  @Get('device/:deviceId')
  async getDeviceMetadata(@Param('deviceId') deviceId: string) {
    this.logger.log('GET /dps/device/:deviceId', { deviceId });
    return this.dpsService.getDeviceMetadata(deviceId);
  }
}
