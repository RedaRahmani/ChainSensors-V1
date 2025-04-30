import { Module } from '@nestjs/common';
import { SolanaService } from './solana.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [SolanaService],
  exports: [SolanaService],
})
export class SolanaModule {}