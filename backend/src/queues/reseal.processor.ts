import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PublicKey } from '@solana/web3.js';
import { ResealedCapsule, ResealedCapsuleDocument } from '../capsules/capsule.schema';
import { ArciumService } from '../arcium/arcium.service';
import { WalrusService } from '../walrus/walrus.service';

interface ResealRetryJobData {
  recordPk: string;
  listingPk: string;
  mxeCapsuleCid: string;
  buyerX25519Pubkey: number[]; // 32 bytes
  maxRetries?: number;
  retryCount?: number;
  originalSignature?: string; // Original purchase transaction (optional, for tracing)
}

@Processor('reseal-retry')
export class ResealProcessor {
  private readonly logger = new Logger(ResealProcessor.name);

  constructor(
    private readonly arciumService: ArciumService,
    @InjectModel(ResealedCapsule.name)
    private readonly resealedCapsuleModel: Model<ResealedCapsuleDocument>,
    private readonly walrusService: WalrusService,
  ) {}

  @Process()
  async processResealRetry(job: Job<ResealRetryJobData>): Promise<void> {
    const { recordPk, listingPk, mxeCapsuleCid, buyerX25519Pubkey, maxRetries = 5 } = job.data;
    const trace = { jobId: job.id, recordPk, listingPk };

    this.logger.log({
      msg: 'reseal.retry.start',
      ...trace,
      attempt: job.attemptsMade + 1,
      maxRetries,
    });

    try {
      // 1) Short-circuit if reseal already persisted
      const existingCapsule = await (this.resealedCapsuleModel as any).findByRecord(recordPk);
      if (existingCapsule) {
        this.logger.log({
          msg: 'reseal.retry.skip.already_completed',
          ...trace,
          signature: existingCapsule.signature,
          ts: existingCapsule.ts,
        });
        return;
      }

      // 2) Validate inputs
      const recordKey = new PublicKey(recordPk);
      const listingKey = new PublicKey(listingPk);

      if (!Array.isArray(buyerX25519Pubkey) || buyerX25519Pubkey.length !== 32) {
        throw new Error('buyerX25519Pubkey must be an array of exactly 32 numbers');
      }
      for (let i = 0; i < 32; i++) {
        const v = buyerX25519Pubkey[i];
        if (!Number.isInteger(v) || v < 0 || v > 255) {
          throw new Error(`buyerX25519Pubkey[${i}] is not an 8-bit unsigned value`);
        }
      }

      // 3) Fetch MXE capsule from Walrus (robust path with normalization + retries)
      const normalizedCid = this.walrusService.normalizeBlobId(mxeCapsuleCid);
      const { bytes: mxeCapsule, used } = await this.walrusService.fetchFileSmart(
        normalizedCid,
        String(job.id),
      );

      if (mxeCapsule.length !== 144) {
        throw new Error(`MXE capsule must be 144 bytes (16 + 4*32), got ${mxeCapsule.length}`);
      }

      this.logger.debug({
        msg: 'reseal.retry.walrus.fetch.ok',
        ...trace,
        cidUsedMode: used,
        capsuleLen: mxeCapsule.length,
      });

      // 4) Submit reseal on-chain
      const result = await this.arciumService.resealDekOnChain({
        mxeCapsule,
        buyerX25519Pubkey: new Uint8Array(buyerX25519Pubkey),
        listingState: listingKey,
        purchaseRecord: recordKey,
      });

      this.logger.log({
        msg: 'reseal.retry.submitted',
        ...trace,
        submitSig: result.sig,
        computationOffset: result.computationOffset.toString(),
        buyerCid: result.buyerCid,
        attempt: job.attemptsMade + 1,
      });

      await job.progress(100);
    } catch (error: any) {
      this.logger.error({
        msg: 'reseal.retry.failed',
        ...trace,
        error: error?.message || String(error),
        attempt: job.attemptsMade + 1,
        attemptsLeft: Math.max(0, (job.opts.attempts ?? 0) - job.attemptsMade - 1),
      });

      // Throw to trigger Bull's retry/backoff policy
      throw error;
    }
  }

  @Process('check-reseal-status')
  async processResealStatusCheck(job: Job<{ recordPk: string }>): Promise<void> {
    const { recordPk } = job.data;

    this.logger.log({ msg: 'reseal.status.check', jobId: job.id, recordPk });

    try {
      const status = await (this.resealedCapsuleModel as any).status(recordPk);

      if (status.status === 'not_found') {
        this.logger.warn({ msg: 'reseal.status.not_found', jobId: job.id, recordPk });
        // Optionally enqueue another retry here if your policy allows.
      } else {
        this.logger.log({
          msg: 'reseal.status.completed',
          jobId: job.id,
          recordPk,
          signature: status.signature,
          slot: status.slot,
          ts: status.ts,
        });
      }
    } catch (error: any) {
      this.logger.error({
        msg: 'reseal.status.failed',
        jobId: job.id,
        recordPk,
        error: error?.message || String(error),
      });
      throw error;
    }
  }
}
