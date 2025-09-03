import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
import { SolanaService } from './solana.service';

@Controller('solana')
export class SolanaController {
  private readonly logger = new Logger(SolanaController.name);

  constructor(private readonly solanaService: SolanaService) {}

  @Get('device/:deviceId/onchain')
  async checkDevice(@Param('deviceId') deviceId: string) {
    this.logger.log(`GET /solana/device/${deviceId}/onchain`);
    
    const { marketplacePda, deviceRegistryPda, admin } = this.solanaService.getDeviceRegistryPda(deviceId);
    const exists = await this.solanaService.deviceRegistryExists(deviceId);
    
    return {
      deviceId,
      exists,
      marketplaceAdmin: admin.toBase58(),
      marketplacePda: marketplacePda.toBase58(),
      deviceRegistryPda: deviceRegistryPda.toBase58(),
    };
  }

  @Post('device/auto-register')
  async autoRegisterDevice(@Body() body: {
    deviceId: string;
    deviceType?: string;
    location?: string;
    dataType?: string;
    dataUnit?: string;
    pricePerUnit?: number;
    totalDataUnits?: number;
    dataCid?: string;
  }) {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Auto-register is disabled in production');
    }

    this.logger.warn('⚠️  AUTO-REGISTERING DEVICE FOR DEVELOPMENT ONLY ⚠️', { deviceId: body.deviceId });
    
    // Use placeholder values for development
    const result = await this.solanaService.registerDeviceAuto({
      deviceId: body.deviceId,
      ekPubkeyHash: new Array(32).fill(0), // placeholder
      deviceType: body.deviceType || 'sensor',
      location: body.location || 'dev-location',
      dataType: body.dataType || 'temperature',
      dataUnit: body.dataUnit || 'celsius',
      pricePerUnit: body.pricePerUnit || 1,
      totalDataUnits: body.totalDataUnits || 100,
      dataCid: body.dataCid || 'placeholder-cid',
      accessKeyHash: new Array(32).fill(0), // placeholder
      expiresAt: null,
    });

    return { 
      success: true, 
      signature: result,
      warning: 'This is for development only. Use proper device registration in production.'
    };
  }
}
