import { Module } from '@nestjs/common';
import { CapsulesService } from './capsules.service';
import { CapsulesController } from './capsules.controller';
import { WalrusModule } from '../walrus/walrus.module';
import { ArciumModule } from '../arcium/arcium.module';

@Module({
  imports: [
    WalrusModule,   // provides WalrusService
    ArciumModule,   // provides ArciumService
  ],
  providers: [CapsulesService],
  controllers: [CapsulesController],
  exports: [CapsulesService],
})
export class CapsulesModule {}

