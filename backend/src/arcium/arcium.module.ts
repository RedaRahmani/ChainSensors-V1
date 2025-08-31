import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArciumService } from './arcium.service';
import { ArciumController } from './arcium.controller';
import { WalrusService } from '../walrus/walrus.service';
import { SolanaModule } from '../solana/solana.module';

@Module({
  imports: [ConfigModule, forwardRef(() => SolanaModule)],
  controllers: [ArciumController],
  providers: [ArciumService, WalrusService],
  exports: [ArciumService],
})
export class ArciumModule {}

