// import { Module } from '@nestjs/common';
// import { ConfigModule } from '@nestjs/config';
// import { ArciumService } from './arcium.service';
// import { ArciumController } from './arcium.controller';
// import { WalrusService } from '../walrus/walrus.service';

// @Module({
//   imports: [ConfigModule],
//   controllers: [ArciumController],
//   providers: [ArciumService, WalrusService],
//   exports: [ArciumService],
// })
// export class ArciumModule {}
// // 












import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArciumService } from './arcium.service';
import { ArciumController } from './arcium.controller';
import { WalrusService } from '../walrus/walrus.service';

@Module({
  imports: [ConfigModule],
  controllers: [ArciumController],
  providers: [ArciumService, WalrusService],
  exports: [ArciumService],
})
export class ArciumModule {}

