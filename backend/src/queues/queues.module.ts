import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AccuracyProcessor } from './accuracy.processor';
import { ResealProcessor } from './reseal.processor';
import { QueueService } from './queue.service';
import { ArciumModule } from '../arcium/arcium.module';
import { QualityModule } from '../quality/quality.module';
import { CapsulesModule } from '../capsules/capsules.module';
import { WalrusModule } from '../walrus/walrus.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB') || 0,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: 'accuracy',
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
          attempts: 2, // Lower attempts for computation jobs
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      },
      {
        name: 'reseal-retry',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 10000, // 10s, 20s, 40s, 80s, 160s
          },
        },
      }
    ),
    ArciumModule,
    QualityModule,
    CapsulesModule,
    WalrusModule,
  ],
  providers: [AccuracyProcessor, ResealProcessor, QueueService],
  exports: [QueueService, BullModule],
})
export class QueuesModule {}
