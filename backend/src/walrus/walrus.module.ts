import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WalrusService } from './walrus.service';
import { WalrusController } from './walrus.controller';
import { WalrusDiagnosticsController } from './walrus.diagnostics.controller';

@Module({
  imports: [ConfigModule],  
  providers: [WalrusService],
  controllers: [WalrusController, WalrusDiagnosticsController],  
  exports: [WalrusService],
})
export class WalrusModule {}
