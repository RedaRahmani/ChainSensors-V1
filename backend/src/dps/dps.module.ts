import { Module } from '@nestjs/common';
import { DpsController } from './dps.controller';
import { DpsService } from './dps.service';
import { WalrusModule } from '../walrus/walrus.module';
import { SolanaModule } from '../solana/solana.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Device, DeviceSchema } from './device.schema';

@Module({
  imports: [WalrusModule, SolanaModule, MongooseModule.forFeature([{ name: Device.name, schema: DeviceSchema }]),],
  controllers: [DpsController],
  providers: [DpsService],
  exports: [DpsService], // Export for Registry/Ingestion access
})
export class DpsModule {}