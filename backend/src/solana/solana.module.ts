import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SolanaService } from './solana.service';
import { TokenService } from './token.service';
import { PurchasesController } from './purchases.controller';
import { WalrusModule } from '../walrus/walrus.module';
import { ArciumModule } from '../arcium/arcium.module';
import { PurchaseListenerService } from './purchase-listener.service';

@Module({
  imports: [ConfigModule, WalrusModule, ArciumModule],
  providers: [SolanaService, TokenService, PurchaseListenerService],
  controllers: [PurchasesController],
  exports: [SolanaService, TokenService],
})
export class SolanaModule {}
