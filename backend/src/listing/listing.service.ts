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

  async createListing(dto: CreateListingDto): Promise<{ txSignature: string }> {
    // 1) Fetch device record (includes latestDataCid + metadata)
    const device = await this.dpsService.getDevice(dto.deviceId);
    if (!device) throw new NotFoundException(`Device ${dto.deviceId} not found`);
    const dataCid = device.latestDataCid;
    if (!dataCid) {
      throw new NotFoundException(`No data available yet for device ${dto.deviceId}`);
    }

    // 2) Prepare on‐chain call
    const listingId = uuidv4().replace(/-/g, '');
    const txSignature = await this.solanaService.createListing(
      listingId,
      dataCid,
      dto.pricePerUnit,
      dto.totalDataUnits,
      dto.deviceId,
    );

    // 3) Mirror to Mongo
    await this.listingModel.create({
      listingId,
      deviceId: dto.deviceId,
      dataCid,
      pricePerUnit: dto.pricePerUnit,
      totalDataUnits: dto.totalDataUnits,
      status: 'Active',
      txSignature,
    });

    this.logger.log(`Listing ${listingId} created on‑chain and in Mongo`);
    return { txSignature };
  }

  async cancelListing(deviceId: string, listingId: string): Promise<{ txSignature: string }> {
    // 1) Local existence
    const listing = await this.listingModel.findOne({ listingId, deviceId });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);

    // 2) On‑chain cancel
    const txSignature = await this.solanaService.cancelListing(listingId, deviceId);

    // 3) Mirror update
    listing.status = 'Cancelled';
    await listing.save();

    this.logger.log(`Listing ${listingId} cancelled on‑chain and in Mongo`);
    return { txSignature };
  }

  findByDevice(deviceId: string) {
    return this.listingModel.find({ deviceId }).lean().exec();
  }
}
