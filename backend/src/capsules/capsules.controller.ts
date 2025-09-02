import { 
  Body, 
  Controller, 
  Post, 
  Get, 
  Param,
  Logger, 
  BadRequestException,
  HttpException,
  HttpStatus 
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PublicKey } from '@solana/web3.js';
import { CapsulesService } from './capsules.service';
import { ResealedCapsule, ResealedCapsuleDocument } from './capsule.schema';

@Controller('capsules')
export class CapsulesController {
  private readonly logger = new Logger(CapsulesController.name);
  
  constructor(
    private readonly capsules: CapsulesService,
    @InjectModel(ResealedCapsule.name)
    private readonly resealedCapsuleModel: Model<ResealedCapsuleDocument>,
  ) {}

  private toPublicKeyOrThrow(s: string, fieldName: string): PublicKey {
    try {
      return new PublicKey(s);
    } catch {
      throw new BadRequestException(`${fieldName} is not a valid base58 public key`);
    }
  }

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

  @Get('reseal/:recordPk')
  async getResealedCapsule(@Param('recordPk') recordPk: string) {
    this.logger.log('GET /capsules/reseal/:recordPk', { recordPk });
    
    // Validate recordPk is a valid PublicKey
    this.toPublicKeyOrThrow(recordPk, 'recordPk');
    
    try {
      const capsule = await (this.resealedCapsuleModel as any).findByRecord(recordPk);
      
      if (!capsule) {
        throw new HttpException(
          `No resealed capsule found for purchase record ${recordPk}`,
          HttpStatus.NOT_FOUND
        );
      }

      return {
        record: capsule.record,
        listing: capsule.listing,
        encryption_key_hex: capsule.encryption_key_hex,
        nonce_hex: capsule.nonce_hex,
        ciphertext_hex: capsule.ciphertext_hex,
        arc1_capsule_base64: capsule.arc1_capsule_base64,
        signature: capsule.signature,
        slot: capsule.slot,
        timestamp: capsule.ts,
        size_bytes: 144, // 16 nonce + 4*32 ciphertext
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      
      this.logger.error('Failed to get resealed capsule', { recordPk, error: error?.message });
      throw new HttpException(
        'Failed to retrieve resealed capsule',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('reseal/:recordPk/status')
  async getResealStatus(@Param('recordPk') recordPk: string) {
    this.logger.log('GET /capsules/reseal/:recordPk/status', { recordPk });
    
    // Validate recordPk is a valid PublicKey
    this.toPublicKeyOrThrow(recordPk, 'recordPk');
    
    try {
      const status = await (this.resealedCapsuleModel as any).status(recordPk);
      
      return {
        record: recordPk,
        ...status,
        has_capsule: status.status === 'completed',
        age_seconds: status.ts ? Math.floor((Date.now() - new Date(status.ts).getTime()) / 1000) : null,
      };
    } catch (error: any) {
      this.logger.error('Failed to get reseal status', { recordPk, error: error?.message });
      throw new HttpException(
        'Failed to retrieve reseal status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('listing/:listingPk')
  async getResealedCapsulesByListing(@Param('listingPk') listingPk: string) {
    this.logger.log('GET /capsules/listing/:listingPk', { listingPk });
    
    // Validate listingPk is a valid PublicKey
    this.toPublicKeyOrThrow(listingPk, 'listingPk');
    
    try {
      const capsules = await (this.resealedCapsuleModel as any).findByListing(listingPk);
      
      return {
        listing: listingPk,
        count: capsules.length,
        capsules: capsules.map((capsule: any) => ({
          record: capsule.record,
          signature: capsule.signature,
          slot: capsule.slot,
          timestamp: capsule.ts,
          has_full_capsule: true,
        })),
      };
    } catch (error: any) {
      this.logger.error('Failed to get capsules by listing', { listingPk, error: error?.message });
      throw new HttpException(
        'Failed to retrieve capsules by listing',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('signatures/:signature')
  async getResealedCapsulesBySignature(@Param('signature') signature: string) {
    this.logger.log('GET /capsules/signatures/:signature', { signature });
    
    try {
      const capsules = await (this.resealedCapsuleModel as any).findBySignature(signature);
      
      return {
        signature,
        count: capsules.length,
        capsules: capsules.map((capsule: any) => ({
          record: capsule.record,
          listing: capsule.listing,
          slot: capsule.slot,
          timestamp: capsule.ts,
        })),
      };
    } catch (error: any) {
      this.logger.error('Failed to get capsules by signature', { signature, error: error?.message });
      throw new HttpException(
        'Failed to retrieve capsules by signature',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
