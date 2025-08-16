import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DpsModule } from './dps/dps.module';
import { RegistryModule } from './registry/registry.module';
import { IngestModule } from './ingest/ingest.module';
import { SolanaModule } from './solana/solana.module';
import { WalrusModule } from './walrus/walrus.module';
import { MongooseModule } from '@nestjs/mongoose';
import { BrokerModule } from './broker/broker.module';
import { ReadingModule } from './reading/reading.module';
import { ListingModule } from './listing/listing.module';
import configuration from './configuration';
import { ArciumModule } from './arcium/arcium.module';
import { CapsulesModule } from './capsules/capsules.module';
import { RewardsModule } from './rewards/rewards.module';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => require('./configuration').default()],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
          throw new Error('MONGODB_URI environment variable is required');
        }
        console.log(
          `📦 Connecting to MongoDB: ${uri.replace(/\/\/.*@/, '//***@')}`,
        );
        return {
          uri,
          connectTimeoutMS: 5000,
          serverSelectionTimeoutMS: 5000,
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,

    SolanaModule,
    WalrusModule,
    RewardsModule,
    DpsModule,
    RegistryModule,
    IngestModule,
    BrokerModule,
    ReadingModule,
    ListingModule,
    ArciumModule,
    CapsulesModule,
    // RatingModule,
  ],
})
export class AppModule {}
