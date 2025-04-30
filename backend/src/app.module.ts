import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DpsModule } from './dps/dps.module';
import { RegistryModule } from './registry/registry.module';
import { IngestModule } from './ingest/ingest.module';
import { SolanaModule } from './solana/solana.module';
import { WalrusModule } from './walrus/walrus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => require('./configuration').default()],
    }),
    SolanaModule,
    WalrusModule,
    DpsModule,
    RegistryModule,
    IngestModule,
  ],
})
export class AppModule {}
