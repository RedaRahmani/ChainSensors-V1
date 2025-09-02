import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { SolanaService } from './solana.service';
import { TokenService } from './token.service';
import { PurchasesController } from './purchases.controller';
import { EventIndexerService } from './event-indexer.service';
import { WalrusModule } from '../walrus/walrus.module';
import { ArciumModule } from '../arcium/arcium.module';
import { PurchaseListenerService } from './purchase-listener.service';

import { Device, DeviceSchema } from '../dps/device.schema';
import { QualityMetric, QualityMetricSchema } from '../quality/quality.schema';
import { ResealedCapsule, ResealedCapsuleSchema } from '../capsules/capsule.schema';
import { IndexerState, IndexerStateSchema } from './indexer-state.schema';

@Module({
  imports: [
    ConfigModule,
    WalrusModule,
    ArciumModule,
    MongooseModule.forFeature([
      { name: Device.name, schema: DeviceSchema },
      { name: QualityMetric.name, schema: QualityMetricSchema },
      { name: ResealedCapsule.name, schema: ResealedCapsuleSchema },
      { name: IndexerState.name, schema: IndexerStateSchema },
    ]),
  ],
  providers: [SolanaService, TokenService, PurchaseListenerService, EventIndexerService],
  controllers: [PurchasesController],
  exports: [SolanaService, TokenService, EventIndexerService],
})
export class SolanaModule {}
