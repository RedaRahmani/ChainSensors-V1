import { Module } from '@nestjs/common';
import { SolanaService } from './solana.service';
import { TokenService } from './token.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [SolanaService, TokenService],
  exports: [SolanaService, TokenService],
})
export class SolanaModule {}
