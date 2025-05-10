// // src/listing/listing.module.ts
// import { Module } from '@nestjs/common';
// import { MongooseModule } from '@nestjs/mongoose';
// import { Listing, ListingSchema } from './listing.schema';
// import { ListingService } from './listing.service';
// import { ListingController } from './listing.controller';
// import { DpsModule } from '../dps/dps.module';
// import { SolanaModule } from '../solana/solana.module';

// @Module({
//   imports: [
//     MongooseModule.forFeature([{ name: Listing.name, schema: ListingSchema }]),
//     DpsModule,
//     SolanaModule,
//   ],
//   providers: [ListingService],
//   controllers: [ListingController],
// })
// export class ListingModule {}
// // 