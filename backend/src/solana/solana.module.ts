import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { SolanaService } from './solana.service';
import { TokenService } from './token.service';
import { PurchasesController } from './purchases.controller';
import { WalrusModule } from '../walrus/walrus.module';
import { ArciumModule } from '../arcium/arcium.module';
import { PurchaseListenerService } from './purchase-listener.service';

import { Device, DeviceSchema } from '../dps/device.schema';

@Module({
  imports: [
    ConfigModule,
    WalrusModule,
    ArciumModule,
    MongooseModule.forFeature([{ name: Device.name, schema: DeviceSchema }]),
  ],
  providers: [SolanaService, TokenService, PurchaseListenerService],
  controllers: [PurchasesController],
  exports: [SolanaService, TokenService],
})
export class SolanaModule {}
