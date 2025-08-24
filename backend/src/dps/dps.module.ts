import { Module } from '@nestjs/common';
import { DpsController } from './dps.controller';
import { DpsService } from './dps.service';
import { WalrusModule } from '../walrus/walrus.module';
import { SolanaModule } from '../solana/solana.module';
import { RewardsModule } from '../rewards/rewards.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Device, DeviceSchema } from './device.schema';
import { ArciumModule } from '../arcium/arcium.module';

@Module({
  imports: [
    WalrusModule,
    SolanaModule,
    RewardsModule,
    ArciumModule, // needed for DEK sealing
    MongooseModule.forFeature([{ name: Device.name, schema: DeviceSchema }]),
  ],
  controllers: [DpsController],
  providers: [DpsService],
  exports: [DpsService],
})
export class DpsModule {}
