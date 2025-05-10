// src/dps/dps.controller.ts

import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { DpsService, EnrollMetadata } from './dps.service';

interface GenerateTxDto {
  csrPem: string;
  metadata: EnrollMetadata;
  sellerPubkey: string;      // ← NEW: seller’s wallet pubkey (base58)
}

interface GenerateTxResponse {
  deviceId: string;
  certificatePem: string;
  unsignedTx: string;
  brokerUrl: string;
}

interface FinalizeDto {
  deviceId: string;
  signedTx: string;   // base64‐encoded signed transaction
}

interface FinalizeResponse {
  txSignature: string;
  brokerUrl: string;
  certificatePem: string;
}

@Controller('dps')
export class DpsController {
  constructor(private readonly dpsService: DpsService) {}

  /**
   * Phase 1: receive CSR + metadata + sellerPubkey,
   *         return unsigned tx + cert.
   */
  @Post('enroll')
  async generateRegistrationTransaction(
    @Body() dto: GenerateTxDto,
  ): Promise<GenerateTxResponse> {
    console.log('Received body:', dto);
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
      throw new HttpException(
        'Invalid sellerPubkey format',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.dpsService.generateRegistrationTransaction(
        csrPem,
        metadata,
        sellerKey,            // ← PASS IT THROUGH
      );
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Enrollment failed',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Phase 2: receive the signed transaction, submit it on‐chain.
   */
  @Post('finalize')
  async finalizeRegistration(
    @Body() dto: FinalizeDto,
  ): Promise<FinalizeResponse> {
    const { deviceId, signedTx } = dto;
    if (!deviceId || !signedTx) {
      throw new HttpException(
        'Missing deviceId or signedTx',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.dpsService.finalizeRegistration(deviceId, signedTx);
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Finalization failed',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
