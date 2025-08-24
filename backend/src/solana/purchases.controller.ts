import {
  Controller, Get, Param, Query, HttpException, HttpStatus, Logger, BadRequestException,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SolanaService } from './solana.service';
import { WalrusService } from '../walrus/walrus.service';
import { ArciumService } from '../arcium/arcium.service';
import { Device, DeviceDocument } from '../dps/device.schema';

@Controller('purchases')
export class PurchasesController {
  private readonly logger = new Logger(PurchasesController.name);

  constructor(
    private readonly solana: SolanaService,
    private readonly walrus: WalrusService,
    private readonly arcium: ArciumService,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
  ) {}

  private toPublicKeyOrThrow(s: string, fieldName: string): PublicKey {
    try { return new PublicKey(s); }
    catch { throw new BadRequestException(`${fieldName} is not a valid base58 public key`); }
  }

  @Get('buyer/:buyer')
  async byBuyerParam(@Param('buyer') buyer: string) {
    this.logger.log('GET /purchases/buyer/:buyer', { buyer });
    const pk = this.toPublicKeyOrThrow(buyer, 'buyer');
    return await this.solana.getPurchasesByBuyer(pk);
  }

  @Get('by-buyer')
  async byBuyerQuery(@Query('buyer') buyer?: string) {
    this.logger.log('GET /purchases/by-buyer', { buyer });
    if (!buyer) throw new BadRequestException('buyer required');
    const pk = this.toPublicKeyOrThrow(buyer, 'buyer');
    return await this.solana.getPurchasesByBuyer(pk);
  }

  @Get(':recordPk/meta')
  async meta(@Param('recordPk') recordPk: string) {
    this.logger.log('GET /purchases/:recordPk/meta', { recordPk });
    const rPk = this.toPublicKeyOrThrow(recordPk, 'recordPk');

    let existingBuyerCid: string | null = null;
    try { existingBuyerCid = await this.solana.getPurchaseRecordBuyerCid(rPk); } catch {}

    try {
      const { listingState, purchaseIndex } = await this.solana.getPurchaseRecordLight(rPk);
      const listingInfo = await this.solana.getListingStateInfo(listingState);

      this.logger.log('meta -> OK', {
        recordPk, listingState: listingState.toBase58(),
        purchaseIndex, dataCid: listingInfo.dataCid, buyerCid: existingBuyerCid
      });

      return {
        recordPk,
        listingState: listingState.toBase58(),
        purchaseIndex,
        dekCapsuleForBuyerCid: existingBuyerCid,
        dek_capsule_for_buyer_cid: existingBuyerCid,
        listingId: listingInfo.listingId,
        dataCid: listingInfo.dataCid,
        deviceId: listingInfo.deviceId,
        pricePerUnit: listingInfo.pricePerUnit,
        expiresAt: listingInfo.expiresAt,
        seller: listingInfo.seller,
      };
    } catch (e: any) {
      this.logger.error('meta -> FAIL', { recordPk, err: e?.message });
      throw new HttpException(
        {
          message:
            e?.message ||
            'Failed to read purchase meta (check legacy field names or program/IDL mismatch)',
          recordPk,
          dekCapsuleForBuyerCid: existingBuyerCid,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async resolveMxeCapsuleBytes(params: {
    mxeField: string | null | undefined;
    deviceId?: string | null;
  }): Promise<{ bytes: Buffer; resolvedFrom: string }> {
    const { mxeField, deviceId } = params;

    const b64urlToB64 = (s: string) => {
      let t = s.replace(/-/g, '+').replace(/_/g, '/');
      while (t.length % 4) t += '=';
      return t;
    };
    const decodeMaybe = (s: string): Buffer | null => {
      try { const b = Buffer.from(s, 'base64'); if (b.length) return b; } catch {}
      try { const b = Buffer.from(b64urlToB64(s), 'base64'); if (b.length) return b; } catch {}
      return null;
    };
    const isValidCapsule = (buf: Buffer) => buf.length === 144;

    if (mxeField && typeof mxeField === 'string' && mxeField.trim()) {
      const id = mxeField.trim();
      try {
        const { bytes, used } = await this.walrus.fetchFileSmart(id);
        if (isValidCapsule(bytes)) {
          this.logger.log(`Walrus fetch succeeded via ${used}, valid capsule (144 bytes)`);
          return { bytes, resolvedFrom: `walrus:${used}` };
        }

        this.logger.warn(`Walrus blob fetched but invalid length=${bytes.length}; attempting repair from device metadata (if available).`);
      } catch (e) {
        this.logger.warn(`Walrus fetch failed for listing field; will try local interpretation/repair`, {
          id, error: (e as Error)?.message,
        });
      }


      const dec = decodeMaybe(id);
      if (dec && isValidCapsule(dec)) {
        this.logger.log('Listing field decoded directly to valid serialized capsule (144 bytes)');
        return { bytes: dec, resolvedFrom: 'listing.serializedCipher' };
      }
      if (dec && dec.length === 32) {
        this.logger.log('Detected 32-byte DEK in listing field; sealing to MXE ciphertext (fallback)');
        const sealed = await this.arcium.sealDekForMxe(dec);
        return { bytes: sealed, resolvedFrom: 'listing.dekBase64->sealed' };
      }
      if (dec && (dec.length === 96 || dec.length === 104)) {
        throw new BadRequestException(
          'Listing contains a legacy/invalid capsule (96/104 bytes). Please reseal the DEK using /capsules/upload or re-enroll the device.',
        );
      }
    }

    if (deviceId) {
      this.logger.log('Attempting device fallback for MXE capsule resolution', { deviceId });
      const device = await this.deviceModel.findOne({ deviceId }).lean().exec();
      if (device?.metadataCid) {
        try {
          const meta: any = await this.walrus.getMetadata(device.metadataCid);
          const dekB64 =
            meta?.dekPlaintextB64 ??
            meta?.dek_plaintext_b64 ??
            device?.metadata?.dekPlaintextB64 ??
            device?.metadata?.dek_plaintext_b64 ??
            null;

          if (dekB64 && typeof dekB64 === 'string') {
            const dec = Buffer.from(b64urlToB64(dekB64), 'base64');
            if (dec.length === 32) {
              const sealed = await this.arcium.sealDekForMxe(dec);
              return { bytes: sealed, resolvedFrom: 'device.meta.dekBase64->sealed' };
            }
          }
        } catch (e: any) {
          this.logger.warn('Device metadata fallback failed', { deviceId, error: e?.message });
        }
      }
    }

    throw new BadRequestException(
      'Could not resolve a valid MXE capsule: not a Walrus 144-byte blob, not a decodable ciphertext, and no usable device metadata found.',
    );
  }

  @Get(':recordPk/capsule')
  async ensureBuyerCapsule(@Param('recordPk') recordPk: string) {
    this.logger.log('=== GET /purchases/:recordPk/capsule ===', { recordPk });
    const rPk = this.toPublicKeyOrThrow(recordPk, 'recordPk');

    const existing = await this.solana.getPurchaseRecordBuyerCid(rPk);
    if (existing) {
      this.logger.log('✓ Buyer capsule already exists - returning existing CID', {
        recordPk, existingCid: existing,
      });
      return {
        record: recordPk,
        dek_capsule_for_buyer_cid: existing,
        dekCapsuleForBuyerCid: existing,
        finalized: true,
      };
    }

    const { listingState, buyerEphemeralPubkey } =
      await this.solana.getPurchaseRecordLight(rPk);

    if (!buyerEphemeralPubkey || buyerEphemeralPubkey.length !== 32) {
      throw new BadRequestException('buyerEphemeralPubkey missing or invalid in purchase record');
    }

    this.logger.log('Purchase record data:', {
      listingState: listingState.toBase58(),
      buyerEphemeralPubkeyLength: buyerEphemeralPubkey?.length ?? 0,
      buyerEphemeralPubkey: Array.from(buyerEphemeralPubkey),
    });

    const listingInfo = await this.solana.getListingStateInfo(listingState);
    const mxeField = (listingInfo as any).dekCapsuleForMxeCid ?? (listingInfo as any).mxeCid ?? null;

    this.logger.log('Listing info:', {
      listingId: listingInfo.listingId,
      dataCid: listingInfo.dataCid,
      deviceId: listingInfo.deviceId,
      hasMxeField: !!mxeField,
      seller: listingInfo.seller,
    });

    const { bytes: mxeCapsule, resolvedFrom } = await this.resolveMxeCapsuleBytes({
      mxeField,
      deviceId: listingInfo.deviceId,
    });
    this.logger.log(`✓ MXE capsule resolved from: ${resolvedFrom} (bytes=${mxeCapsule.length})`);

    this.logger.log('=== STEP 5: Submitting ON-CHAIN reseal job ===');
    const { sig, computationOffset } = await this.arcium.resealDekOnChain({
      mxeCapsule,
      buyerX25519Pubkey: buyerEphemeralPubkey,
    });

   
    return {
      record: recordPk,
      listingState: listingState.toBase58(),
      status: 'queued',
      resealTxSig: sig,
      computationOffset: computationOffset.toString(),
    };
  }
}
