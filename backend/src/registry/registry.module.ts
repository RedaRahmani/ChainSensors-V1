import { Module } from '@nestjs/common';
import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';
import { WalrusModule } from '../walrus/walrus.module';
import { DpsModule } from '../dps/dps.module';

@Module({
  imports: [WalrusModule, DpsModule],
  controllers: [RegistryController],
  providers: [RegistryService],
})
export class RegistryModule {}
