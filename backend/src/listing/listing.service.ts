import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  constructor(
    @InjectModel(Listing.name) private readonly listingModel: Model<ListingDocument>,
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    private readonly solanaService: SolanaService,
    private readonly walrusService: WalrusService,
  ) {}


  async prepareCreateListing(
    dto: CreateListingDto,
    sellerPubkey: PublicKey,
  ): Promise<{ listingId: string; unsignedTx: string }> {
    const listingId = uuidv4().replace(/-/g, '').slice(0, 32);
    const { unsignedTx } = await this.solanaService.buildCreateListingTransaction({
      listingId,
      dataCid: dto.dataCid,
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
      pricePerUnit: dto.pricePerUnit,
      totalDataUnits: dto.totalDataUnits,
      expiresAt: dto.expiresAt ?? null,
      unsignedTx,
      remainingUnits: dto.totalDataUnits,  // ← initialize here
      status: ListingStatus.Pending,
    });

    this.logger.log(`Prepared listing ${listingId}`);
    return { listingId, unsignedTx };
  }


  async finalizeCreateListing(
    listingId: string,
    signedTx: string,
  ): Promise<{ txSignature: string }> {
    const listing = await this.listingModel.findOne({ listingId });
    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }
    if (listing.status !== ListingStatus.Pending) {
      throw new BadRequestException(`Listing ${listingId} not pending`);
    }

    const txSignature = await this.solanaService.submitSignedTransactionListing(signedTx);
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
    const listings = await this.listingModel.find({ status: ListingStatus.Active }).lean().exec();
    const enrichedListings = await Promise.all(listings.map(async (listing) => {
      const device = await this.deviceModel.findOne({ deviceId: listing.deviceId }).lean().exec();
      if (device && device.metadataCid) {
        try {
          const metadata = await this.walrusService.getMetadata(device.metadataCid);
          return { ...listing, deviceMetadata: metadata };
        } catch (error: any) {
          this.logger.error(`Failed to fetch metadata for device ${listing.deviceId}: ${error.message}`);
          return { ...listing, deviceMetadata: null };
        }
      }
      return { ...listing, deviceMetadata: null };
    }));
    return enrichedListings;
  }


   /** Called by your controller to prepare a purchase for the frontend */
   async preparePurchase(
    listingId: string,
    buyerPubkey: PublicKey,
    unitsRequested: number,
  ): Promise<{ listingId: string; unsignedTx: string }> {
    this.logger.log(`preparePurchase: ${listingId}`, { buyer: buyerPubkey.toBase58(), unitsRequested });

    const listing = await this.listingModel.findOne({ listingId });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.status !== ListingStatus.Active) throw new BadRequestException(`Listing not active`);
    if (listing.sellerPubkey === buyerPubkey.toBase58())
      throw new BadRequestException(`Cannot purchase your own listing`);
    if (unitsRequested <= 0 || unitsRequested > listing.remainingUnits)
      throw new BadRequestException(`Invalid units requested`);

    const unsignedTx = await this.solanaService.prepareUnsignedPurchaseTx({
      listingId,
      buyer: buyerPubkey,
      seller: new PublicKey(listing.sellerPubkey),
      unitsRequested,
      deviceId: listing.deviceId,
    });

    listing.unsignedTx = unsignedTx;
    await listing.save();

    return { listingId, unsignedTx };
  }

  /** Called by your controller to submit the signed tx */
  async finalizePurchase(
    listingId: string,
    signedTx: string,
    unitsRequested: number,
  ): Promise<{ txSignature: string }> {
    this.logger.log(`finalizePurchase: ${listingId}`);

    const txSignature = await this.solanaService.submitSignedPurchaseTransaction(signedTx);
    this.logger.log(`Transaction ${txSignature} confirmed on chain`);

    // Sync remainingUnits from on‑chain
    // (Alternatively: decrement locally by unitsRequested)
    const listing = await this.listingModel.findOne({ listingId });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);

    listing.remainingUnits = listing.remainingUnits - unitsRequested;
    if (listing.remainingUnits <= 0) {
      listing.status = ListingStatus.Sold;
    }
    await listing.save();

    return { txSignature };
  }
}