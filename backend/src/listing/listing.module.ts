import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Listing, ListingSchema } from './listing.schema';
import { Device, DeviceSchema } from '../dps/device.schema';
import { ListingService } from './listing.service';
import { ListingController } from './listing.controller';
import { DpsModule } from '../dps/dps.module';
import { SolanaModule } from '../solana/solana.module';
import { WalrusModule } from '../walrus/walrus.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Listing.name, schema: ListingSchema },
      { name: Device.name, schema: DeviceSchema },
    ]),
    DpsModule,
    SolanaModule,
    WalrusModule,
  ],
  providers: [ListingService],
  controllers: [ListingController],
})
export class ListingModule {}