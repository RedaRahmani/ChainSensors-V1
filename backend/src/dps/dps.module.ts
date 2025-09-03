import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DpsController } from './dps.controller';
import { DpsService } from './dps.service';

import { Device, DeviceSchema } from './device.schema';

import { WalrusModule } from '../walrus/walrus.module';
import { SolanaModule } from '../solana/solana.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ArciumModule } from '../arcium/arcium.module';

// ⬇️ NEW controllers
import { DpsDeviceController } from './device.controller';
import { FirmwareController } from './firmware.controller';

@Module({
  imports: [
    WalrusModule,
    SolanaModule,
    RewardsModule,
    ArciumModule, // needed for DEK sealing
    MongooseModule.forFeature([{ name: Device.name, schema: DeviceSchema }]),
  ],
  controllers: [
    DpsController,
    DpsDeviceController, // ⬅️ add
    FirmwareController,  // ⬅️ add
  ],
  providers: [DpsService],
  exports: [DpsService],
})
export class DpsModule {}
