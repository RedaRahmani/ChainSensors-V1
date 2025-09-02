import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

interface AccuracyJobData {
  deviceId: string;
  listingKey: string;
  windowStart: number;
  windowEnd: number;
  aggregates: {
    reading: number;
    mean: number;
    std: number;
  };
  arcisPubkey?: string;
  nonce?: string;
}

interface ResealRetryJobData {
  recordPk: string;
  listingPk: string;
  mxeCapsuleCid: string;
  buyerX25519Pubkey: number[];
  originalSignature?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  
  // Configuration
  private readonly ACCURACY_WINDOW_MS: number;
  private readonly ACCURACY_TRIGGER_THRESHOLD: number;
  private readonly activeDevices = new Set<string>(); // Track devices that should have accuracy computed

  constructor(
    @InjectQueue('accuracy') private readonly accuracyQueue: Queue<AccuracyJobData>,
    @InjectQueue('reseal-retry') private readonly resealRetryQueue: Queue<ResealRetryJobData>,
    private readonly config: ConfigService,
  ) {
    this.ACCURACY_WINDOW_MS = parseInt(this.config.get('ACCURACY_WINDOW_MS') || '300000', 10); // 5 minutes
    this.ACCURACY_TRIGGER_THRESHOLD = parseFloat(this.config.get('ACCURACY_TRIGGER_THRESHOLD') || '0.5');
    
    this.logger.log('QueueService initialized', {
      accuracyWindowMs: this.ACCURACY_WINDOW_MS,
      accuracyThreshold: this.ACCURACY_TRIGGER_THRESHOLD,
    });
  }

  // ---------------------------------------------------------------------------
  // Accuracy computation scheduling
  // ---------------------------------------------------------------------------

  async scheduleAccuracyComputation(data: AccuracyJobData, delayMs = 0): Promise<void> {
    const job = await this.accuracyQueue.add(data, {
      delay: delayMs,
      removeOnComplete: 10,
      removeOnFail: 5,
    });

    this.logger.log('Accuracy computation scheduled', {
      jobId: job.id,
      deviceId: data.deviceId,
      delayMs,
    });
  }

  async scheduleWindowAggregation(deviceId: string, windowStart: number, windowEnd: number): Promise<void> {
    // Note: This is a simplified version for aggregation scheduling
    // In practice, you would need to provide actual listingKey and aggregates
    const job = await this.accuracyQueue.add('window-aggregation', {
      deviceId,
      listingKey: 'placeholder', // TODO: Get actual listing key from device context
      windowStart,
      windowEnd,
      aggregates: {
        reading: 0, // TODO: Calculate from actual readings
        mean: 0,
        std: 0,
      },
    }, {
      removeOnComplete: 5,
      removeOnFail: 3,
    });

    this.logger.log('Window aggregation scheduled', {
      jobId: job.id,
      deviceId,
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
    });
  }

  // ---------------------------------------------------------------------------
  // Reseal retry scheduling
  // ---------------------------------------------------------------------------

  async scheduleResealRetry(data: ResealRetryJobData, delayMs = 30000): Promise<void> {
    const job = await this.resealRetryQueue.add(data, {
      delay: delayMs,
      removeOnComplete: 20,
      removeOnFail: 10,
    });

    this.logger.log('Reseal retry scheduled', {
      jobId: job.id,
      recordPk: data.recordPk,
      delayMs,
    });
  }

  async scheduleResealStatusCheck(recordPk: string, delayMs = 60000): Promise<void> {
    // Note: This is a simplified version for status checking
    // In practice, you would need to provide actual listing and capsule data
    const job = await this.resealRetryQueue.add('check-reseal-status', {
      recordPk,
      listingPk: 'placeholder', // TODO: Get actual listing public key
      mxeCapsuleCid: 'placeholder', // TODO: Get actual MXE capsule CID
      buyerX25519Pubkey: [], // TODO: Get actual buyer X25519 public key
    }, {
      delay: delayMs,
      removeOnComplete: 50,
      removeOnFail: 10,
    });

    this.logger.log('Reseal status check scheduled', {
      jobId: job.id,
      recordPk,
      delayMs,
    });
  }

  // ---------------------------------------------------------------------------
  // Device management
  // ---------------------------------------------------------------------------

  addActiveDevice(deviceId: string): void {
    this.activeDevices.add(deviceId);
    this.logger.log('Device added to accuracy monitoring', { deviceId, totalActive: this.activeDevices.size });
  }

  removeActiveDevice(deviceId: string): void {
    this.activeDevices.delete(deviceId);
    this.logger.log('Device removed from accuracy monitoring', { deviceId, totalActive: this.activeDevices.size });
  }

  getActiveDevices(): string[] {
    return Array.from(this.activeDevices);
  }

  // ---------------------------------------------------------------------------
  // Periodic accuracy computation scheduler (cron)
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_5_MINUTES)
  async schedulePeriodicAccuracyComputations(): Promise<void> {
    const activeDeviceCount = this.activeDevices.size;
    
    if (activeDeviceCount === 0) {
      this.logger.debug('No active devices for accuracy computation');
      return;
    }

    this.logger.log('Starting periodic accuracy computation scheduling', {
      activeDevices: activeDeviceCount,
      windowMs: this.ACCURACY_WINDOW_MS,
    });

    const now = Date.now();
    const windowStart = now - this.ACCURACY_WINDOW_MS;
    const windowEnd = now;

    for (const deviceId of this.activeDevices) {
      try {
        await this.scheduleWindowAggregation(deviceId, windowStart, windowEnd);
      } catch (error: any) {
        this.logger.error('Failed to schedule window aggregation for device', {
          deviceId,
          error: error?.message,
        });
      }
    }

    this.logger.log('Periodic accuracy computation scheduling completed', {
      devicesScheduled: activeDeviceCount,
    });
  }

  // ---------------------------------------------------------------------------
  // Queue monitoring and statistics
  // ---------------------------------------------------------------------------

  async getQueueStats() {
    const [accuracyStats, resealStats] = await Promise.all([
      this.getQueueStatsFor(this.accuracyQueue, 'accuracy'),
      this.getQueueStatsFor(this.resealRetryQueue, 'reseal-retry'),
    ]);

    return {
      accuracy: accuracyStats,
      resealRetry: resealStats,
      activeDevices: this.activeDevices.size,
      config: {
        accuracyWindowMs: this.ACCURACY_WINDOW_MS,
        accuracyThreshold: this.ACCURACY_TRIGGER_THRESHOLD,
      },
    };
  }

  private async getQueueStatsFor(queue: Queue, name: string) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      name,
      counts: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Manual trigger methods (for API endpoints)
  // ---------------------------------------------------------------------------

  async triggerAccuracyComputation(
    deviceId: string,
    listingKey: string,
    reading: number,
    mean: number,
    std: number,
    arcisPubkey?: string,
  ): Promise<{ jobId: string }> {
    const job = await this.accuracyQueue.add({
      deviceId,
      listingKey,
      windowStart: Date.now() - this.ACCURACY_WINDOW_MS,
      windowEnd: Date.now(),
      aggregates: { reading, mean, std },
      arcisPubkey,
    });

    return { jobId: job.id.toString() };
  }

  async triggerResealRetry(
    recordPk: string,
    listingPk: string,
    mxeCapsuleCid: string,
    buyerX25519Pubkey: number[],
  ): Promise<{ jobId: string }> {
    const job = await this.resealRetryQueue.add({
      recordPk,
      listingPk,
      mxeCapsuleCid,
      buyerX25519Pubkey,
    });

    return { jobId: job.id.toString() };
  }
}
