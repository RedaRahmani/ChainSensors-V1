import { Module } from '@nestjs/common';
import { DpsController } from './dps.controller';
import { DpsService } from './dps.service';
import { WalrusModule } from '../walrus/walrus.module';
import { SolanaModule } from '../solana/solana.module';

@Module({
  imports: [WalrusModule, SolanaModule],
  controllers: [DpsController],
  providers: [DpsService],
  exports: [DpsService], // Export for Registry/Ingestion access
})
export class DpsModule {}