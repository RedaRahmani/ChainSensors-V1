import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QualityMetric, QualityMetricDocument } from './quality.schema';
import { ArciumService } from '../arcium/arcium.service';

interface ComputeAccuracyDto {
  listingKey: string;   // base58 PublicKey
  reading: number;      // Q16.16 reading value
  mean: number;         // Q16.16 mean value  
  std: number;          // Q16.16 std deviation
  arcisPubkey?: string; // base64 Shared pubkey (optional, will use default)
  nonce?: string;       // optional nonce (will generate if not provided)
}

interface AccuracyComputationResponse {
  status: 'queued';
  signature: string;
  computationOffset: string;
  device: string;
  listing: string;
  nonce: string;
  estimatedCallbackTime: string; // ISO timestamp estimate
}

@Controller('quality')
export class QualityController {
  private readonly logger = new Logger(QualityController.name);

  constructor(
    @InjectModel(QualityMetric.name)
    private readonly qualityMetricModel: Model<QualityMetricDocument>,
    private readonly arciumService: ArciumService,
  ) {}

  private toPublicKeyOrThrow(s: string, fieldName: string): PublicKey {
    try {
      return new PublicKey(s);
    } catch {
      throw new BadRequestException(`${fieldName} is not a valid base58 public key`);
    }
  }

  @Get(':deviceId/latest')
  async getLatestQuality(@Param('deviceId') deviceId: string) {
    this.logger.log('GET /quality/:deviceId/latest', { deviceId });
    
    try {
      const latest = await (this.qualityMetricModel as any).latestByDevice(deviceId);
      
      if (!latest) {
        throw new HttpException(
          `No quality metrics found for device ${deviceId}`,
          HttpStatus.NOT_FOUND
        );
      }

      return {
        device: latest.device,
        listing: latest.listing,
        accuracy_score_hex: latest.accuracy_score_hex,
        nonce_hex: latest.nonce_hex,
        computation_type: latest.computation_type,
        slot: latest.slot,
        signature: latest.signature,
        timestamp: latest.ts,
        age_seconds: Math.floor((Date.now() - latest.ts.getTime()) / 1000),
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      
      this.logger.error('Failed to get latest quality', { deviceId, error: error?.message });
      throw new HttpException(
        'Failed to retrieve quality metrics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':deviceId/history')
  async getQualityHistory(
    @Param('deviceId') deviceId: string,
    @Query('limit') limitStr?: string,
  ) {
    this.logger.log('GET /quality/:deviceId/history', { deviceId, limit: limitStr });
    
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 200, 1000) : 200;
    
    try {
      const history = await (this.qualityMetricModel as any).historyByDevice(deviceId, limit);
      
      return {
        device: deviceId,
        count: history.length,
        limit,
        metrics: history.map((metric: any) => ({
          accuracy_score_hex: metric.accuracy_score_hex,
          nonce_hex: metric.nonce_hex,
          computation_type: metric.computation_type,
          slot: metric.slot,
          signature: metric.signature,
          timestamp: metric.ts,
          listing: metric.listing,
        })),
      };
    } catch (error: any) {
      this.logger.error('Failed to get quality history', { deviceId, error: error?.message });
      throw new HttpException(
        'Failed to retrieve quality history',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':deviceId/stats')
  async getDeviceStats(
    @Param('deviceId') deviceId: string,
    @Query('since') sinceStr?: string,
  ) {
    this.logger.log('GET /quality/:deviceId/stats', { deviceId, since: sinceStr });
    
    let since: Date | undefined;
    if (sinceStr) {
      since = new Date(sinceStr);
      if (isNaN(since.getTime())) {
        throw new BadRequestException('Invalid since date format');
      }
    }
    
    try {
      const stats = await (this.qualityMetricModel as any).getDeviceStats(deviceId, since);
      
      if (!stats.length) {
        return {
          device: deviceId,
          count: 0,
          latest: null,
          earliest: null,
        };
      }
      
      const stat = stats[0];
      return {
        device: deviceId,
        count: stat.count,
        latest: stat.latest,
        earliest: stat.earliest,
        latest_score_hex: stat.latest_score_hex,
        period_days: since ? Math.ceil((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000)) : null,
      };
    } catch (error: any) {
      this.logger.error('Failed to get device stats', { deviceId, error: error?.message });
      throw new HttpException(
        'Failed to retrieve device statistics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':deviceId/compute')
  async triggerAccuracyComputation(
    @Param('deviceId') deviceId: string,
    @Body() dto: ComputeAccuracyDto,
  ): Promise<AccuracyComputationResponse> {
    this.logger.log('POST /quality/:deviceId/compute', {
      deviceId,
      listingKey: dto.listingKey,
      reading: dto.reading,
      mean: dto.mean,
      std: dto.std,
    });

    // Validate inputs
    if (!dto.listingKey || typeof dto.reading !== 'number' || typeof dto.mean !== 'number' || typeof dto.std !== 'number') {
      throw new BadRequestException('listingKey, reading, mean, and std are required');
    }

    if (dto.reading < 0 || dto.mean < 0 || dto.std < 0) {
      throw new BadRequestException('reading, mean, and std must be non-negative');
    }

    const deviceKey = this.toPublicKeyOrThrow(deviceId, 'deviceId');
    const listingKey = this.toPublicKeyOrThrow(dto.listingKey, 'listingKey');

    try {
      // Derive DQ state PDA for the device
      const programId = new PublicKey('DWbGQjpG3aAciCfuSt16PB5FuuJhf5XATmoUpTMGRfU9');
      const [dqStateKey] = PublicKey.findProgramAddressSync(
        [Buffer.from('dqstate'), deviceKey.toBuffer()],
        programId
      );

      // Generate or parse nonce
      const nonce = dto.nonce ? BigInt(dto.nonce) : BigInt(Date.now() * 1000 + Math.floor(Math.random() * 1000));

      // Get Arcium shared pubkey
      // TODO: Parse from dto.arcisPubkey or fetch from Arcium service
      const arcisPubkey = dto.arcisPubkey
        ? Buffer.from(dto.arcisPubkey, 'base64')
        : new Uint8Array(32); // TODO: Get actual shared pubkey

      if (arcisPubkey.length !== 32) {
        throw new BadRequestException('arcisPubkey must be 32 bytes when base64 decoded');
      }

      // Queue the accuracy computation
      const result = await this.arciumService.queueAccuracyScore({
        deviceKey,
        listingKey,
        dqStateKey,
        readingQ16: dto.reading,
        meanQ16: dto.mean,
        stdQ16: dto.std,
        arcisPubkey,
        nonce,
      });

      // Estimate callback time (typically 30-60 seconds for Arcium)
      const estimatedCallbackTime = new Date(Date.now() + 45 * 1000).toISOString();

      this.logger.log('accuracy computation queued successfully', {
        deviceId,
        signature: result.signature,
        computationOffset: result.computationOffset.toString(),
      });

      return {
        status: 'queued',
        signature: result.signature,
        computationOffset: result.computationOffset.toString(),
        device: deviceId,
        listing: dto.listingKey,
        nonce: nonce.toString(),
        estimatedCallbackTime,
      };

    } catch (error: any) {
      this.logger.error('Failed to queue accuracy computation', {
        deviceId,
        error: error?.message,
        stack: error?.stack,
      });

      if (error instanceof BadRequestException) throw error;

      throw new HttpException(
        `Failed to queue accuracy computation: ${error?.message || 'unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('signatures/:signature')
  async getQualityBySignature(@Param('signature') signature: string) {
    this.logger.log('GET /quality/signatures/:signature', { signature });
    
    try {
      const metrics = await (this.qualityMetricModel as any).findBySignature(signature);
      
      return {
        signature,
        count: metrics.length,
        metrics: metrics.map((metric: any) => ({
          device: metric.device,
          listing: metric.listing,
          accuracy_score_hex: metric.accuracy_score_hex,
          nonce_hex: metric.nonce_hex,
          computation_type: metric.computation_type,
          slot: metric.slot,
          timestamp: metric.ts,
        })),
      };
    } catch (error: any) {
      this.logger.error('Failed to get quality by signature', { signature, error: error?.message });
      throw new HttpException(
        'Failed to retrieve quality metrics by signature',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
