import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PublicKey } from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import { ListingStatus } from './listing.types';
import { Listing, ListingDocument } from './listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { SolanaService } from '../solana/solana.service';
import { WalrusService } from '../walrus/walrus.service';
import { Device, DeviceDocument } from '../dps/device.schema';
import { ArciumService } from '../arcium/arcium.service';

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  constructor(
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    private readonly solanaService: SolanaService,
    private readonly walrusService: WalrusService,
    private readonly arciumService: ArciumService,
  ) {}

  private async ensureValidCapsuleCid(inputCid: string | undefined, deviceId: string): Promise<string> {
    // If caller provided a CID, verify it decodes to a 144-byte capsule
    if (inputCid && inputCid.trim()) {
      const normalized = this.walrusService.normalizeBlobId(inputCid.trim());
      try {
        const { bytes, used } = await this.walrusService.fetchFileSmart(normalized);
        if (bytes.length === 144) {
          this.logger.log(`Capsule CID verified via Walrus (${used}) length=144`);
          return normalized;
        }
        this.logger.warn(`Provided capsule CID resolved to ${bytes.length} bytes; expected 144. Will attempt self-repair from device metadata.`);
      } catch (e: any) {
        this.logger.warn(`Capsule CID fetch failed (${e?.message}); will attempt self-repair from device metadata.`);
      }
    }

    // Self-repair path: fetch device metadata → get plaintext DEK → seal → upload
    const device = await this.deviceModel.findOne({ deviceId }).lean().exec();
    if (!device || !device.metadataCid) {
      throw new BadRequestException(`Device ${deviceId} has no metadataCid; cannot repair capsule`);
    }
    const meta: any = await this.walrusService.getMetadata(device.metadataCid);
    const dekB64 =
      meta?.dekPlaintextB64 ??
      meta?.dek_plaintext_b64 ??
      device?.metadata?.dekPlaintextB64 ??
      device?.metadata?.dek_plaintext_b64 ??
      null;
    if (!dekB64) {
      throw new BadRequestException(`Device ${deviceId} metadata lacks DEK; cannot repair capsule`);
    }
    const dek = Buffer.from(String(dekB64).replace(/-/g,'+').replace(/_/g,'/'), 'base64');
    if (dek.length !== 32) {
      throw new BadRequestException(`Device ${deviceId} DEK must be 32 bytes, got ${dek.length}`);
    }

    const mxeCipher = await this.arciumService.sealDekForMxe(dek);
    if (mxeCipher.length !== 144) throw new BadRequestException(`Resealed capsule not 144 bytes`);
    const cid = this.walrusService.normalizeBlobId(await this.walrusService.uploadData(mxeCipher));
    this.logger.log(`Repaired capsule for ${deviceId}: ${cid}`);
    return cid;
  }

  async prepareCreateListing(
    dto: CreateListingDto,
    sellerPubkey: PublicKey,
  ): Promise<{ listingId: string; unsignedTx: string }> {
    const listingId = uuidv4().replace(/-/g, '').slice(0, 32);

    const ensuredCid = await this.ensureValidCapsuleCid(dto.dekCapsuleForMxeCid, dto.deviceId);

    this.logger.log('prepareCreateListing()', {
      listingId,
      deviceId: dto.deviceId,
      dataCid: dto.dataCid,
      dekCapsuleForMxeCid_len: ensuredCid.length,
      pricePerUnit: dto.pricePerUnit,
      totalDataUnits: dto.totalDataUnits,
    });

    const { unsignedTx } =
      await this.solanaService.buildCreateListingTransaction({
        listingId,
        dataCid: dto.dataCid,
        dekCapsuleForMxeCid: ensuredCid,
        pricePerUnit: dto.pricePerUnit,
        deviceId: dto.deviceId,
        totalDataUnits: dto.totalDataUnits,
        expiresAt: dto.expiresAt ?? null,
        sellerPubkey,
      });

    await this.listingModel.create({
      listingId,
      sellerPubkey: sellerPubkey.toBase58(),
      deviceId: dto.deviceId,
      dataCid: dto.dataCid,
      dekCapsuleForMxeCid: ensuredCid,
      pricePerUnit: dto.pricePerUnit,
      totalDataUnits: dto.totalDataUnits,
      expiresAt: dto.expiresAt ?? null,
      unsignedTx,
      remainingUnits: dto.totalDataUnits,
      status: ListingStatus.Pending,
    });

    this.logger.log(`Prepared listing ${listingId}`);
    return { listingId, unsignedTx };
  }

  async finalizeCreateListing(
    listingId: string,
    signedTx: string,
  ): Promise<{ txSignature: string }> {
    this.logger.log('finalizeCreateListing()', { listingId });

    const listing = await this.listingModel.findOne({ listingId });
    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }
    if (listing.status !== ListingStatus.Pending) {
      throw new BadRequestException(`Listing ${listingId} not pending`);
    }

    const txSignature =
      await this.solanaService.submitSignedTransactionListing(signedTx);

    listing.txSignature = txSignature;
    listing.status = ListingStatus.Active;
    listing.unsignedTx = undefined;
    await listing.save();

    this.logger.log(`Listing ${listingId} activated: ${txSignature}`);
    return { txSignature };
  }

  async findBySeller(sellerPubkey: PublicKey) {
    return this.listingModel
      .find({ sellerPubkey: sellerPubkey.toBase58() })
      .lean()
      .exec();
  }

  async findActiveListings() {
    const listings = await this.listingModel
      .find({ status: ListingStatus.Active })
      .lean()
      .exec();

    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const device = await this.deviceModel
          .findOne({ deviceId: listing.deviceId })
          .lean()
          .exec();
        if (device && device.metadataCid) {
          try {
            const metadata = await this.walrusService.getMetadata(
              device.metadataCid,
            );
            return { ...listing, deviceMetadata: metadata };
          } catch (error: any) {
            this.logger.error(
              `Failed to fetch metadata for device ${listing.deviceId}: ${error.message}`,
            );
            return { ...listing, deviceMetadata: null };
          }
        }
        return { ...listing, deviceMetadata: null };
      }),
    );

    return enrichedListings;
  }

  async preparePurchase(
    listingId: string,
    buyerPubkey: PublicKey,
    unitsRequested: number,
    buyerEphemeralPubkey: number[],
  ): Promise<{ listingId: string; unsignedTx: string; purchaseIndex: number }> {
    this.logger.log(`preparePurchase: ${listingId}`, {
      buyer: buyerPubkey.toBase58(),
      unitsRequested,
    });

    const listing = await this.listingModel.findOne({ listingId });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.status !== ListingStatus.Active)
      throw new BadRequestException(`Listing not active`);
    if (listing.sellerPubkey === buyerPubkey.toBase58())
      throw new BadRequestException(`Cannot purchase your own listing`);
    if (unitsRequested <= 0 || unitsRequested > listing.remainingUnits)
      throw new BadRequestException(`Invalid units requested`);

    const { unsignedTx, purchaseIndex } =
      await this.solanaService.prepareUnsignedPurchaseTx({
        listingId,
        buyer: buyerPubkey,
        seller: new PublicKey(listing.sellerPubkey),
        unitsRequested,
        deviceId: listing.deviceId,
        buyerEphemeralPubkey,
      });

    listing.unsignedTx = unsignedTx;
    await listing.save();

    this.logger.log('preparePurchase -> built tx', { listingId, purchaseIndex });
    return { listingId, unsignedTx, purchaseIndex };
  }

  async finalizePurchase(
    listingId: string,
    signedTx: string,
    unitsRequested: number,
  ): Promise<{ txSignature: string }> {
    this.logger.log(`finalizePurchase: ${listingId}`, { unitsRequested });

    const txSignature =
      await this.solanaService.submitSignedPurchaseTransaction(signedTx);
    this.logger.log(`Transaction ${txSignature} confirmed on chain`);

    const listing = await this.listingModel.findOne({ listingId });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);

    listing.remainingUnits = listing.remainingUnits - unitsRequested;
    if (listing.remainingUnits <= 0) {
      listing.status = ListingStatus.Sold;
    }
    await listing.save();

    this.logger.log(`finalizePurchase -> updated listing: remaining=${listing.remainingUnits} status=${listing.status}`);
    return { txSignature };
  }
}
