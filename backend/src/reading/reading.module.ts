import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reading, ReadingSchema } from './reading.schema';
import { ReadingService } from './reading.service';
import { ReadingController } from './reading.controller';
import { WalrusModule } from '../walrus/walrus.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Reading.name, schema: ReadingSchema }]),
    WalrusModule,                   // ← so we can fetch raw blobs
  ],
  providers: [ReadingService],
  controllers: [ReadingController],
})
export class ReadingModule {}
// backend/src/reading/reading.module.ts
// import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
// import { MongooseModule } from '@nestjs/mongoose';
// import { ReadingController } from './reading.controller';
// import { ReadingService } from './reading.service';
// import { Reading, ReadingSchema } from './reading.schema';
// import { AuthMiddleware } from '../auth/auth.middleware';
// import { WalrusModule } from '../walrus/walrus.module'; // Import WalrusModule to provide WalrusService

// @Module({
//   imports: [
//     MongooseModule.forFeature([
//       { name: Reading.name, schema: ReadingSchema },
//     ]),
//     WalrusModule, // Added to provide WalrusService
//   ],
//   controllers: [ReadingController],
//   providers: [ReadingService],
// })
// export class ReadingModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer
//       .apply(AuthMiddleware)
//       .forRoutes(ReadingController);
//   }
// }