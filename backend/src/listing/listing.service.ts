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

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  constructor(
    @InjectModel(Listing.name) private readonly listingModel: Model<ListingDocument>,
    private readonly solanaService: SolanaService,
  ) {}

  /**
   * Phase 1: Prepare unsigned createListing tx
   */
  async prepareCreateListing(
    dto: CreateListingDto,
    sellerPubkey: PublicKey,
  ): Promise<{ listingId: string; unsignedTx: string }> {
    // 1) Generate a new 32-byte listing ID
    const listingId = uuidv4().replace(/-/g, '').slice(0, 32);

    // 2) Build unsigned tx using SolanaService
    const { unsignedTx } = await this.solanaService.buildCreateListingTransaction({
      listingId,
      dataCid: dto.dataCid,
      pricePerUnit: dto.pricePerUnit,
      deviceId: dto.deviceId,
      totalDataUnits: dto.totalDataUnits,
      expiresAt: dto.expiresAt ?? null,
      sellerPubkey,
    });

    // 3) Persist pending listing in MongoDB
    await this.listingModel.create({
      listingId,
      sellerPubkey: sellerPubkey.toBase58(),
      deviceId: dto.deviceId,
      dataCid: dto.dataCid,
      pricePerUnit: dto.pricePerUnit,
      totalDataUnits: dto.totalDataUnits,
      expiresAt: dto.expiresAt ?? null,
      unsignedTx,
      status: ListingStatus.Pending,
    });

    this.logger.log(`Prepared listing ${listingId}`);
    return { listingId, unsignedTx };
  }

  /**
   * Phase 2: Finalize with signed tx
   */
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

    // submit signed transaction on-chain
    const txSignature = await this.solanaService.submitSignedTransactionListing(signedTx);

    // update database record
    listing.txSignature = txSignature;
    listing.status = ListingStatus.Active;
    listing.unsignedTx = undefined;
    await listing.save();

    this.logger.log(`Listing ${listingId} activated: ${txSignature}`);
    return { txSignature };
  }

  /**
   * List all listings for a given seller
   */
  async findBySeller(sellerPubkey: PublicKey) {
    return this.listingModel
      .find({ sellerPubkey: sellerPubkey.toBase58() })
      .lean()
      .exec();
  }
}