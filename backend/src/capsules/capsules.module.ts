import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CapsulesService } from './capsules.service';
import { CapsulesController } from './capsules.controller';
import { WalrusModule } from '../walrus/walrus.module';
import { ArciumModule } from '../arcium/arcium.module';
import { ResealedCapsule, ResealedCapsuleSchema } from './capsule.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ResealedCapsule.name, schema: ResealedCapsuleSchema },
    ]),
    WalrusModule,   // provides WalrusService
    ArciumModule,   // provides ArciumService
  ],
  providers: [CapsulesService],
  controllers: [CapsulesController],
  exports: [CapsulesService, MongooseModule],
})
export class CapsulesModule {}

