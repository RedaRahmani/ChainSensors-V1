import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, ConfirmedSignatureInfo } from '@solana/web3.js';
import { BorshCoder, EventParser } from '@coral-xyz/anchor';
import { createHash } from 'crypto';
import idl from './idl.json';
import { QualityMetric, QualityMetricDocument } from '../quality/quality.schema';
import { ResealedCapsule, ResealedCapsuleDocument } from '../capsules/capsule.schema';
import { IndexerState, IndexerStateDocument } from './indexer-state.schema';
import { indexerMetrics } from '../metrics/metrics.module';

interface ResealOutputEvent {
  listing: PublicKey;
  record: PublicKey;
  encryption_key: number[];
  nonce: number[];
  c0: number[];
  c1: number[];
  c2: number[];
  c3: number[];
}

interface QualityScoreEvent {
  accuracy_score: number[];
  nonce: number[];
  computation_type: string;
}

interface ParsedEvent {
  name: string;
  data: any;
  signature: string;
  slot: number;
  logIndex: number;
  timestamp: Date;
}

type Finality = 'processed' | 'confirmed' | 'finalized';

@Injectable()
export class EventIndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventIndexerService.name);
  private connection: Connection;
  private program: anchor.Program;
  private eventParser: EventParser;
  private coder: BorshCoder;

  // Subscription state
  private logsSubscriptionId: number | null = null;
  private backfillIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Tracking state
  private lastProcessedSlot = 0;
  private lastProcessedSig = '';
  private processedEvents = new Set<string>(); // (signature, logIndex) for deduplication

  // Config
  private PROGRAM_ID: PublicKey; // <- now configurable
  private readonly BACKFILL_INTERVAL_MS = 30000; // 30 seconds
  private readonly MAX_SIGNATURES_PER_BACKFILL = 1000; // Increased for proper pagination
  private readonly DEDUP_CACHE_SIZE = 10000;

  // NEW: discriminator caches to recognize callback ixs
  private callbackDiscHexSet?: Set<string>;
  private discNameByHex?: Map<string, string>;
  private qualityCbAccountIdx?: { device?: number; listing?: number; listingState?: number };

  constructor(
    private readonly config: ConfigService,
    @InjectModel(QualityMetric.name)
    private readonly qualityMetricModel: Model<QualityMetricDocument>,
    @InjectModel(ResealedCapsule.name)
    private readonly resealedCapsuleModel: Model<ResealedCapsuleDocument>,
    @InjectModel(IndexerState.name)
    private readonly indexerStateModel: Model<IndexerStateDocument>,
  ) {
    const httpEndpoint = this.config.get<string>('SOLANA_HTTP')
      || this.config.get<string>('SOLANA_RPC')
      || 'https://api.devnet.solana.com';
    const wsEndpoint = this.config.get<string>('SOLANA_WS')
      || 'wss://api.devnet.solana.com';

    // Program ID: env -> idl.address -> fallback constant
    const pidStr =
      this.config.get<string>('SOLANA_PROGRAM_ID')
      || (idl as any)?.address
      || 'DWbGQjpG3aAciCfuSt16PB5FuuJhf5XATmoUpTMGRfU9';
    this.PROGRAM_ID = new PublicKey(pidStr);

    this.connection = new Connection(httpEndpoint, {
      commitment: 'confirmed',
      wsEndpoint,
      httpHeaders: { 'User-Agent': 'ChainSensors-EventIndexer/1.0' },
    });

    // Setup Anchor program and event parser
    const mockWallet = {
      publicKey: new PublicKey('11111111111111111111111111111112'),
      signTransaction: () => Promise.reject('Read-only'),
      signAllTransactions: () => Promise.reject('Read-only'),
    };

    const provider = new anchor.AnchorProvider(
      this.connection,
      mockWallet as any,
      { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    this.program = new anchor.Program(idl as any, provider);
    this.coder = new BorshCoder(idl as any);
    this.eventParser = new EventParser(this.PROGRAM_ID, this.coder);

    // Build discriminator maps once
    this.buildDiscriminatorMaps();
    // Work out the interesting account indices on the quality-score callback
    this.qualityCbAccountIdx = this.resolveQualityCallbackAccountIndices();
  }

  async onModuleInit() {
    await this.start();
  }

  async onModuleDestroy() {
    await this.stop();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Event indexer already running');
      return;
    }

    this.logger.log('Starting Anchor/Arcium event indexer...');

    try {
      await this.initializeLastProcessedSlot();
      await this.startLogsSubscription();
      this.startBackfillTimer();

      this.isRunning = true;
      this.logger.log(`Event indexer started. Monitoring program: ${this.PROGRAM_ID.toBase58()}`);
    } catch (error) {
      this.logger.error('Failed to start event indexer:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.log('Stopping event indexer...');
    if (this.logsSubscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.logsSubscriptionId);
        this.logsSubscriptionId = null;
      } catch (error) {
        this.logger.warn('Error removing logs listener:', error);
      }
    }
    if (this.backfillIntervalId) {
      clearInterval(this.backfillIntervalId);
      this.backfillIntervalId = null;
    }
    this.isRunning = false;
    this.logger.log('Event indexer stopped');
  }

  private async initializeLastProcessedSlot(): Promise<void> {
    try {
      // Load from IndexerState instead of scanning event collections
      const state = await (this.indexerStateModel as any).getOrCreate(this.PROGRAM_ID);
      this.lastProcessedSlot = state.lastProcessedSlot;
      this.lastProcessedSig = state.lastProcessedSig;

      this.logger.log(`Initialized from IndexerState - slot: ${this.lastProcessedSlot}, sig: ${this.lastProcessedSig || 'none'}`);
      
      // Update metrics
      indexerMetrics.lastSlot.set({ program: this.PROGRAM_ID.toBase58() }, this.lastProcessedSlot);
    } catch (error) {
      this.logger.warn('Failed to initialize from IndexerState, starting from 0:', error);
      indexerMetrics.errorsTotal.inc({ phase: 'initialization', program: this.PROGRAM_ID.toBase58() });
      this.lastProcessedSlot = 0;
      this.lastProcessedSig = '';
    }
  }

  private async startLogsSubscription(): Promise<void> {
    try {
      this.logsSubscriptionId = this.connection.onLogs(
        this.PROGRAM_ID,
        async (logs, context) => {
          try {
            await this.processLogEntry(logs, context);
          } catch (error) {
            this.logger.error('Error processing log entry from subscription:', error);
          }
        },
        'confirmed'
      );

      this.logger.log(`WebSocket logs subscription established (ID: ${this.logsSubscriptionId})`);
    } catch (error) {
      this.logger.error('Failed to establish logs subscription:', error);
      throw error;
    }
  }

  private startBackfillTimer(): void {
    this.backfillIntervalId = setInterval(async () => {
      try {
        await this.performBackfill();
      } catch (error) {
        this.logger.error('Backfill error:', error);
      }
    }, this.BACKFILL_INTERVAL_MS);

    this.logger.log(`Backfill timer started (interval: ${this.BACKFILL_INTERVAL_MS}ms)`);
  }

  private async processLogEntry(logs: any, context: any): Promise<void> {
    const { signature, slot } = context;
    if (!logs.logs || logs.err) return;

    const events = this.parseEventsFromLogs(logs.logs, signature, slot);
    for (const event of events) {
      await this.persistEvent(event);
    }
    if (slot > this.lastProcessedSlot) this.lastProcessedSlot = slot;
  }

  private parseEventsFromLogs(logs: string[], signature: string, slot: number): ParsedEvent[] {
    const parsed = Array.from(this.eventParser.parseLogs(logs));
    return parsed
      .map((ev, idx) => ({
        name: ev.name,
        data: ev.data,
        signature,
        slot,
        logIndex: idx,
        timestamp: new Date(),
      }))
      .filter((ev) => {
        const k = `${ev.signature}:${ev.logIndex}`;
        if (this.processedEvents.has(k)) return false;
        this.processedEvents.add(k);
        if (this.processedEvents.size > this.DEDUP_CACHE_SIZE) {
          const slice = Array.from(this.processedEvents).slice(0, 1000);
          slice.forEach((s) => this.processedEvents.delete(s));
        }
        return true;
      });
  }

  private async persistEvent(event: ParsedEvent): Promise<void> {
    try {
      switch (event.name) {
        case 'QualityScoreEvent':
          await this.persistQualityScoreEvent(event);
          indexerMetrics.eventsTotal.inc({ type: 'QualityScoreEvent', program: this.PROGRAM_ID.toBase58() });
          break;
        case 'ResealOutput':
          await this.persistResealOutputEvent(event);
          indexerMetrics.eventsTotal.inc({ type: 'ResealOutput', program: this.PROGRAM_ID.toBase58() });
          break;
        default:
          // Reduce noise: only debug
          this.logger.debug(`Ignoring event type: ${event.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to persist ${event.name} event:`, error);
      indexerMetrics.errorsTotal.inc({ phase: 'persist_event', program: this.PROGRAM_ID.toBase58() });
    }
  }

  // ---------- QualityScoreEvent handling with enrichment ----------
  private async persistQualityScoreEvent(event: ParsedEvent): Promise<void> {
    const data = event.data as QualityScoreEvent;

    // Try to enrich device/listing from the callback instruction in the tx
    const enrichment = await this.tryEnrichQualityFromTx(event.signature);

    const deviceKey = enrichment?.device ?? 'UNKNOWN_DEVICE';
    const listingKey = enrichment?.listing ?? 'UNKNOWN_LISTING';

    const qualityMetric = new this.qualityMetricModel({
      device: deviceKey,
      listing: listingKey,
      accuracy_score: Buffer.from(data.accuracy_score),
      nonce: Buffer.from(data.nonce),
      computation_type: data.computation_type,
      slot: event.slot,
      signature: event.signature,
      ts: event.timestamp,
    });

    await qualityMetric.save();
    this.logger.log(`Persisted QualityScoreEvent: ${event.signature} (slot: ${event.slot})`);
  }

  private async tryEnrichQualityFromTx(signature: string): Promise<{ device?: string; listing?: string } | null> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (!tx?.transaction?.message) return null;

      const keys = this.allKeysFromTx(tx);
      const { ix, accountIndexList } = this.findFirstCallbackIx(tx);
      if (!ix || !accountIndexList?.length) return null;

      const idxMap = this.qualityCbAccountIdx || {};
      const pick = (name: 'device' | 'listing' | 'listingState'): string | undefined => {
        const i = (idxMap as any)[name];
        if (typeof i === 'number' && i >= 0 && i < accountIndexList.length) {
          const keyIdx = accountIndexList[i];
          const k = keys[keyIdx];
          return k?.toBase58?.();
        }
        return undefined;
      };

      // Prefer explicit 'listing' then fallback to 'listingState'
      const device = pick('device');
      const listing = pick('listing') || pick('listingState');

      if (device || listing) {
        this.logger.debug({
          msg: 'quality.enrich',
          signature,
          device: device || null,
          listing: listing || null,
        });
        return { device, listing };
      }
      return null;
    } catch (e) {
      this.logger.debug({ msg: 'quality.enrich.error', signature, err: String(e) });
      return null;
    }
  }

  // ---------- ResealOutput handling ----------
  private async persistResealOutputEvent(event: ParsedEvent): Promise<void> {
    const data = event.data as ResealOutputEvent;

    const resealedCapsule = new this.resealedCapsuleModel({
      listing: data.listing.toBase58(),
      record: data.record.toBase58(),
      encryption_key: Buffer.from(data.encryption_key),
      nonce: Buffer.from(data.nonce),
      c0: Buffer.from(data.c0),
      c1: Buffer.from(data.c1),
      c2: Buffer.from(data.c2),
      c3: Buffer.from(data.c3),
      slot: event.slot,
      signature: event.signature,
      ts: event.timestamp,
    });

    try {
      await resealedCapsule.save();
      this.logger.log(`Persisted ResealOutput: ${event.signature} (record: ${data.record.toBase58()})`);
    } catch (e: any) {
      // avoid crashing on a duplicate (unique signature per record enforced)
      if (e?.code === 11000) {
        this.logger.warn(`Duplicate ResealOutput ignored for signature ${event.signature}`);
      } else {
        throw e;
      }
    }
  }

  // ---------- Backfill ----------
  private async performBackfill(): Promise<void> {
    const startTime = Date.now();
    let pages = 0;
    let processed = 0;
    let minSlot = Infinity;
    let maxSlot = 0;
    let newestSig = '';

    try {
      const currentSlot = await this.connection.getSlot('confirmed');
      
      if (currentSlot <= this.lastProcessedSlot) {
        // Update metrics
        const lag = currentSlot - this.lastProcessedSlot;
        indexerMetrics.slotLag.set({ program: this.PROGRAM_ID.toBase58() }, lag);
        return;
      }

      this.logger.debug(`Performing robust backfill from slot ${this.lastProcessedSlot} to ${currentSlot}`);

      // Paginated backfill with proper before/until semantics
      let before: string | undefined = undefined;
      const until = this.lastProcessedSig || undefined;
      let allProcessedSigs: string[] = [];

      do {
        pages++;
        indexerMetrics.backfillPagesTotal.inc({ program: this.PROGRAM_ID.toBase58() });

        const signatures = await this.connection.getSignaturesForAddress(
          this.PROGRAM_ID,
          { 
            limit: this.MAX_SIGNATURES_PER_BACKFILL,
            before,
            until,
          },
          'confirmed'
        );

        if (!signatures.length) break;

        // Filter signatures where slot > lastProcessedSlot
        const relevantSigs = signatures.filter(sig => 
          sig.slot && sig.slot > this.lastProcessedSlot
        );

        if (!relevantSigs.length) {
          // Check if we should stop - if oldest signature is <= lastProcessedSlot
          const oldestSlot = Math.min(...signatures.map(s => s.slot || Infinity));
          if (oldestSlot <= this.lastProcessedSlot) break;
        }

        // Process each relevant signature
        for (const sigInfo of relevantSigs) {
          try {
            await this.processTransactionSignature(sigInfo);
            processed++;
            allProcessedSigs.push(sigInfo.signature);
            
            if (sigInfo.slot) {
              minSlot = Math.min(minSlot, sigInfo.slot);
              maxSlot = Math.max(maxSlot, sigInfo.slot);
              
              // Track newest signature (first in results is newest)
              if (!newestSig) newestSig = sigInfo.signature;
            }
          } catch (error) {
            this.logger.warn(`Failed to process signature ${sigInfo.signature}:`, error);
            indexerMetrics.errorsTotal.inc({ phase: 'process_tx', program: this.PROGRAM_ID.toBase58() });
          }
        }

        // Set before for next page (oldest signature from current page)
        before = signatures[signatures.length - 1]?.signature;

        // Stop if we've reached signatures older than lastProcessedSlot
        const oldestSlot = signatures[signatures.length - 1]?.slot || 0;
        if (oldestSlot <= this.lastProcessedSlot) break;

      } while (true);

      // Update persistent state if we processed anything
      if (processed > 0) {
        await (this.indexerStateModel as any).updateProgress(
          this.PROGRAM_ID,
          maxSlot,
          newestSig
        );
        
        this.lastProcessedSlot = maxSlot;
        this.lastProcessedSig = newestSig;
      }

      // Update metrics
      const lag = currentSlot - this.lastProcessedSlot;
      indexerMetrics.slotLag.set({ program: this.PROGRAM_ID.toBase58() }, lag);
      indexerMetrics.lastSlot.set({ program: this.PROGRAM_ID.toBase58() }, this.lastProcessedSlot);

      // Log summary
      const duration = Date.now() - startTime;
      this.logger.log(`Backfill completed: { pages: ${pages}, processed: ${processed}, minSlot: ${minSlot === Infinity ? 'N/A' : minSlot}, maxSlot: ${maxSlot || 'N/A'}, lag: ${lag}, duration: ${duration}ms }`);

    } catch (error) {
      this.logger.error('Backfill failed:', error);
      indexerMetrics.errorsTotal.inc({ phase: 'backfill', program: this.PROGRAM_ID.toBase58() });
    }
  }

  private async processTransactionSignature(sigInfo: ConfirmedSignatureInfo): Promise<void> {
    if (!sigInfo.slot || sigInfo.err) return;

    try {
      const tx = await this.connection.getTransaction(sigInfo.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta?.logMessages) return;

      const events = this.parseEventsFromLogs(tx.meta.logMessages, sigInfo.signature, sigInfo.slot);
      for (const event of events) {
        await this.persistEvent(event);
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch transaction ${sigInfo.signature}:`, error);
    }
  }

  // ---------- Public status ----------
  async getIndexerStatus() {
    const currentSlot = await this.connection.getSlot('confirmed');
    const [qualityCount, resealCount] = await Promise.all([
      this.qualityMetricModel.countDocuments(),
      this.resealedCapsuleModel.countDocuments(),
    ]);

    return {
      isRunning: this.isRunning,
      lastProcessedSlot: this.lastProcessedSlot,
      currentSlot,
      slotLag: currentSlot - this.lastProcessedSlot,
      eventsProcessed: {
        quality: qualityCount,
        reseal: resealCount,
      },
      subscriptionActive: this.logsSubscriptionId !== null,
      backfillActive: this.backfillIntervalId !== null,
    };
  }

  // ---------- Discriminator helpers ----------
  /** sha256("global:"+name) first 8 bytes → hex string */
  private instrDiscHex(name: string): string {
    return createHash('sha256')
      .update(`global:${name}`)
      .digest()
      .subarray(0, 8)
      .toString('hex');
  }

  /** Build maps: head8 hex → idl name, and set of callback head8s */
  private buildDiscriminatorMaps(): void {
    if (this.discNameByHex && this.callbackDiscHexSet) return;

    const discNameByHex = new Map<string, string>();
    const callbackSet = new Set<string>();
    const idlAny: any = this.program.idl ?? idl;
    const instrs: Array<{ name: string }> = idlAny?.instructions ?? [];

    for (const i of instrs) {
      const h = this.instrDiscHex(i.name);
      discNameByHex.set(h, i.name);
      if (/callback/i.test(i.name)) callbackSet.add(h);
    }

    // Back-compat: common names
    ['reseal_dek_callback', 'resealDekCallback', 'computeAccuracyScoreCallback'].forEach((n) =>
      callbackSet.add(this.instrDiscHex(n)),
    );

    // Allow env overrides (comma-separated hex)
    const extraHex =
      this.config.get<string>('ARCIUM_CALLBACK_DISC_HEX') || process.env.ARCIUM_CALLBACK_DISC_HEX;
    if (extraHex) {
      for (const raw of extraHex.split(',').map((s) => s.trim()).filter(Boolean)) {
        const clean = raw.toLowerCase().replace(/^0x/, '');
        if (clean.length === 16) callbackSet.add(clean);
      }
    }

    this.discNameByHex = discNameByHex;
    this.callbackDiscHexSet = callbackSet;

    this.logger.log({
      msg: 'idl.discriminators.built',
      nInstructions: instrs.length,
      callbacks: [...callbackSet].map((h) => `${h}:${discNameByHex.get(h) || '?'}`),
    });
  }

  private getCallbackDiscSet(): Set<string> {
    if (!this.callbackDiscHexSet) this.buildDiscriminatorMaps();
    return this.callbackDiscHexSet!;
  }

  private discHexToName(hex: string): string | undefined {
    if (!this.discNameByHex) this.buildDiscriminatorMaps();
    return this.discNameByHex!.get(hex);
  }

  // ---------- Tx inspection helpers ----------
  /** Build full key list (supports legacy + v0 with loaded address tables) */
  private allKeysFromTx(tx: any): PublicKey[] {
    const msg: any = tx.transaction.message;

    // Legacy
    if (!('staticAccountKeys' in msg)) {
      const legacyKeys: any[] = msg.accountKeys ?? [];
      return legacyKeys.map((k: any) => (k instanceof PublicKey ? k : new PublicKey(k)));
    }

    // v0
    const statics: any[] = msg.staticAccountKeys ?? [];
    const loadedW: any[] = tx.meta?.loadedAddresses?.writable ?? [];
    const loadedR: any[] = tx.meta?.loadedAddresses?.readonly ?? [];
    return [...statics, ...loadedW, ...loadedR].map((k: any) =>
      k instanceof PublicKey ? k : new PublicKey(k),
    );
  }

  /** Return the first callback ix and its account index list (top or inner). */
  private findFirstCallbackIx(tx: any): {
    ix: any | null;
    accountIndexList: number[] | null;
    src?: 'top' | 'inner';
  } {
    const msg: any = tx.transaction.message;
    const isV0 = 'compiledInstructions' in msg;
    const top = isV0 ? (msg.compiledInstructions ?? []) : (msg.instructions ?? []);
    const innerGroups = tx.meta?.innerInstructions ?? [];
    const keys: PublicKey[] = this.allKeysFromTx(tx);
    const discSet = this.getCallbackDiscSet();

    const decode = (s: string): Buffer => {
      try { return Buffer.from(require('bs58').decode(s)); } catch {}
      try { return Buffer.from(s, 'base64'); } catch {}
      return Buffer.alloc(0);
    };

    const getAccounts = (ix: any): number[] => {
      // legacy: ix.accounts, v0: ix.accountKeyIndexes
      if (Array.isArray(ix.accounts)) return ix.accounts as number[];
      if (Array.isArray(ix.accountKeyIndexes)) return ix.accountKeyIndexes as number[];
      return [];
    };

    const test = (ix: any, src: 'top' | 'inner'): { ix: any; list: number[] } | null => {
      try {
        const pid = keys[ix.programIdIndex];
        if (!pid || !pid.equals(this.PROGRAM_ID)) return null;
        const raw = decode(ix.data);
        if (raw.length >= 8) {
          const head8 = raw.subarray(0, 8).toString('hex');
          if (discSet.has(head8)) return { ix, list: getAccounts(ix) };
        }
      } catch {
        /* ignore */
      }
      return null;
    };

    for (const ix of top) {
      const hit = test(ix, 'top');
      if (hit) return { ix: hit.ix, accountIndexList: hit.list, src: 'top' };
    }
    for (const g of innerGroups) {
      for (const ix of g.instructions ?? []) {
        const hit = test(ix, 'inner');
        if (hit) return { ix: hit.ix, accountIndexList: hit.list, src: 'inner' };
      }
    }
    return { ix: null, accountIndexList: null };
  }

  /** From IDL, find the account positions for device/listing on the quality callback. */
  private resolveQualityCallbackAccountIndices():
    | { device?: number; listing?: number; listingState?: number }
    | undefined {
    const idlAny: any = this.program.idl ?? idl;
    const instrs: Array<any> = idlAny?.instructions ?? [];
    const target = instrs.find((i) =>
      String(i?.name || '').toLowerCase() === 'computeaccuracyscorecallback',
    );
    if (!target?.accounts) return undefined;

    const map: Record<string, number> = {};
    target.accounts.forEach((acc: any, idx: number) => {
      const n = String(acc?.name || '').toLowerCase();
      if (n === 'device') map.device = idx;
      if (n === 'listing' || n === 'listingstate') map[n] = idx;
    });

    if (map.device === undefined && map.listing === undefined && map.listingState === undefined) {
      this.logger.warn('[EventIndexer] Could not resolve account indices on computeAccuracyScoreCallback');
      return undefined;
    }
    this.logger.log({
      msg: 'quality.callback.account_indices',
      device: map.device ?? null,
      listing: map.listing ?? null,
      listingState: map.listingState ?? null,
    });
    return map as any;
  }
}
