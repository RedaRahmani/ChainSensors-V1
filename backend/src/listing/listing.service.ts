// src/listing/listing.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Listing, ListingDocument } from './listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { DpsService } from '../dps/dps.service';
import { SolanaService } from '../solana/solana.service';

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  constructor(
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    private readonly dpsService: DpsService,
    private readonly solanaService: SolanaService,
  ) {}

  /**
   * Create a new listing:
   * 1) fetch device metadata
   * 2) build unsigned transaction
   * 3) mirror to Mongo (store listing data without signature)
   * 4) return listingId and unsignedTx
   */
  async createListing(
    dto: CreateListingDto
  ): Promise<{ listingId: string; unsignedTx: string }> {
    // 1) Fetch device record
    const device = await this.dpsService.getDevice(dto.deviceId);
    if (!device) throw new NotFoundException(`Device ${dto.deviceId} not found`);
    const dataCid = device.latestDataCid;
    if (!dataCid) {
      throw new NotFoundException(`No data available yet for device ${dto.deviceId}`);
    }

    // prepare listingId
    const listingId = uuidv4().replace(/-/g, '');

    // 2) Build unsigned Tx
    const { unsignedTx } = await this.solanaService.createListing(
      listingId,
      dataCid,
      dto.pricePerUnit,
      dto.totalDataUnits,
      dto.deviceId
    );

    // 3) Mirror to Mongo: store listing info, status Active
    await this.listingModel.create({
      listingId,
      deviceId: dto.deviceId,
      dataCid,
      pricePerUnit: dto.pricePerUnit,
      totalDataUnits: dto.totalDataUnits,
      status: 'Active',
      // Note: we no longer store server-side signature
    });

    this.logger.log(`Prepared listing ${listingId} (unsignedTx built)`);
    return { listingId, unsignedTx };
  }

  /**
   * Cancel an existing listing:
   * 1) verify listing exists
   * 2) build unsigned cancellation tx
   * 3) update status in Mongo
   * 4) return unsignedTx
   */
  async cancelListing(
    deviceId: string,
    listingId: string
  ): Promise<{ unsignedTx: string }> {
    // 1) Local existence
    const listing = await this.listingModel.findOne({ listingId, deviceId });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);

    // 2) Build unsigned cancellation tx
    const { unsignedTx } = await this.solanaService.cancelListing(
      listingId,
      deviceId
    );

    // 3) Mirror update
    listing.status = 'Cancelled';
    await listing.save();

    this.logger.log(`Prepared cancel for listing ${listingId}`);
    return { unsignedTx };
  }

  /**
   * Retrieve listings for a device
   */
  findByDevice(deviceId: string) {
    return this.listingModel.find({ deviceId }).lean().exec();
  }
}