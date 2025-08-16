import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArciumService } from './arcium.service';

@Module({
  imports: [ConfigModule],
  providers: [ArciumService],
  exports: [ArciumService],
})
export class ArciumModule {}
