import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CapsulesController } from './capsules.controller';
import { CapsulesService } from './capsules.service';
import { WalrusService } from '../walrus/walrus.service';

@Module({
  imports: [ConfigModule],
  controllers: [CapsulesController],
  providers: [CapsulesService, WalrusService],
})
export class CapsulesModule {}
