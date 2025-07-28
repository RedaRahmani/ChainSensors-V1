import { Module } from '@nestjs/common';
import { WalrusService } from './walrus.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [WalrusService],
  exports: [WalrusService],
})
export class WalrusModule {}
