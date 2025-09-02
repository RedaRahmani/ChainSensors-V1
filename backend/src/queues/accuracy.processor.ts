import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PublicKey } from '@solana/web3.js';
import { ArciumService } from '../arcium/arcium.service';

interface AccuracyJobData {
  deviceId: string;
  listingKey: string;
  windowStart: number; // timestamp
  windowEnd: number;   // timestamp
  aggregates: {
    reading: number;   // aggregated Q16.16 reading
    mean: number;      // computed mean Q16.16
    std: number;       // computed std deviation Q16.16
  };
  arcisPubkey?: string; // base64 shared pubkey
  nonce?: string;       // optional nonce
  retryCount?: number;
}

@Processor('accuracy')
export class AccuracyProcessor {
  private readonly logger = new Logger(AccuracyProcessor.name);

  constructor(private readonly arciumService: ArciumService) {}

  @Process()
  async processAccuracyComputation(job: Job<AccuracyJobData>): Promise<void> {
    const { deviceId, listingKey, windowStart, windowEnd, aggregates, arcisPubkey, nonce } = job.data;
    
    this.logger.log('Processing accuracy computation job', {
      jobId: job.id,
      deviceId,
      listingKey,
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
      reading: aggregates.reading,
      mean: aggregates.mean,
      std: aggregates.std,
    });

    try {
      // Validate inputs
      const deviceKey = new PublicKey(deviceId);
      const listingPubkey = new PublicKey(listingKey);
      
      // Derive DQ state PDA
      const programId = new PublicKey('DWbGQjpG3aAciCfuSt16PB5FuuJhf5XATmoUpTMGRfU9');
      const [dqStateKey] = PublicKey.findProgramAddressSync(
        [Buffer.from('dqstate'), deviceKey.toBuffer()],
        programId
      );

      // Generate nonce if not provided
      const computationNonce = nonce ? BigInt(nonce) : BigInt(Date.now() * 1000 + Math.floor(Math.random() * 1000));

      // Get Arcium shared pubkey (TODO: implement proper key retrieval)
      const sharedPubkey = arcisPubkey 
        ? Buffer.from(arcisPubkey, 'base64')
        : new Uint8Array(32); // TODO: Get actual shared pubkey from Arcium

      // Queue the accuracy computation
      const result = await this.arciumService.queueAccuracyScore({
        deviceKey,
        listingKey: listingPubkey,
        dqStateKey,
        readingQ16: aggregates.reading,
        meanQ16: aggregates.mean,
        stdQ16: aggregates.std,
        arcisPubkey: sharedPubkey,
        nonce: computationNonce,
      });

      this.logger.log('Accuracy computation queued successfully', {
        jobId: job.id,
        deviceId,
        signature: result.signature,
        computationOffset: result.computationOffset.toString(),
        nonce: computationNonce.toString(),
        windowDuration: windowEnd - windowStart,
      });

      // Store computation details for callback correlation
      await job.progress(100);

    } catch (error: any) {
      this.logger.error('Accuracy computation job failed', {
        jobId: job.id,
        deviceId,
        error: error?.message,
        stack: error?.stack,
        attemptsMade: job.attemptsMade,
        attemptsLeft: job.opts.attempts - job.attemptsMade,
      });

      // Re-throw to trigger Bull's retry mechanism
      throw error;
    }
  }

  @Process('window-aggregation')
  async processWindowAggregation(job: Job<{
    deviceId: string;
    windowStart: number;
    windowEnd: number;
  }>): Promise<void> {
    const { deviceId, windowStart, windowEnd } = job.data;
    
    this.logger.log('Processing window aggregation job', {
      jobId: job.id,
      deviceId,
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
    });

    try {
      // TODO: Implement window aggregation logic
      // 1. Fetch readings from MongoDB for the time window
      // 2. Compute aggregates (reading, mean, std) in Q16.16 format
      // 3. Queue accuracy computation job with aggregated data
      
      this.logger.warn('Window aggregation not yet implemented', {
        jobId: job.id,
        deviceId,
      });

      // Placeholder: create dummy aggregates for testing
      const aggregates = {
        reading: 1.5,  // Example Q16.16 reading
        mean: 1.0,     // Example Q16.16 mean
        std: 0.5,      // Example Q16.16 std deviation
      };

      // TODO: Queue accuracy computation with real aggregated data
      this.logger.log('Window aggregation completed (placeholder)', {
        jobId: job.id,
        deviceId,
        aggregates,
      });

    } catch (error: any) {
      this.logger.error('Window aggregation job failed', {
        jobId: job.id,
        deviceId,
        error: error?.message,
        attemptsMade: job.attemptsMade,
      });

      throw error;
    }
  }
}
