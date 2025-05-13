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
// backend/src/registry/registry.module.ts
// backend/src/registry/registry.module.ts
// import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
// import { MongooseModule } from '@nestjs/mongoose';
// import { RegistryController } from './registry.controller';
// import { RegistryService } from './registry.service';
// import { Device, DeviceSchema } from '../dps/device.schema';
// import { AuthMiddleware } from '../auth/auth.middleware';
// import { DpsModule } from '../dps/dps.module'; // Import DpsModule to provide DpsService
// import { WalrusModule } from '../walrus/walrus.module'; // Import WalrusModule to provide WalrusService

// @Module({
//   imports: [
//     MongooseModule.forFeature([
//       { name: Device.name, schema: DeviceSchema },
//     ]),
//     DpsModule, // Added to provide DpsService
//     WalrusModule, // Added to provide WalrusService
//   ],
//   controllers: [RegistryController],
//   providers: [RegistryService],
// })
// export class RegistryModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer
//       .apply(AuthMiddleware)
//       .forRoutes(RegistryController);
//   }
// }