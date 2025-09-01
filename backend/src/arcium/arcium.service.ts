import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Finality, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js';
import idl from '../solana/idl.json';
import bs58 from 'bs58';

import {
  // PDA helpers & constants (TS client)
  getMXEPublicKey as getMXEKey,
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getArciumProgAddress,
  awaitComputationFinalization,
  getClockAccAddress,
  getClusterAccAddress,      // offset-based Cluster PDA
  getStakingPoolAccAddress,  // legacy v0.1 (do NOT use unless explicitly allowed)
  x25519,
  RescueCipher,
} from '@arcium-hq/client';

import { randomBytes, createHash } from 'crypto';
import { logKV } from '../common/trace';
import { WalrusService } from '../walrus/walrus.service';
import { SolanaService } from '../solana/solana.service';
import { u128NonceToIv12BE, packArc1Capsule } from '../crypto/capsule';
import * as fs from 'fs-extra';
import * as path from 'path';
const clientAny: any = require('@arcium-hq/client');

@Injectable()
export class ArciumService {
  private readonly logger = new Logger(ArciumService.name);
  private provider!: anchor.AnchorProvider;
  private program!: anchor.Program;
  private cachedMxePub?: Uint8Array;

  // NEW: dynamic callback discriminator cache
  private callbackDiscHexSet?: Set<string>;
  private discNameByHex?: Map<string, string>;

  // Constants
  private readonly CALLBACK_TIMEOUT_MS = Number(process.env.RESEAL_CALLBACK_TIMEOUT_MS ?? 300_000); // 5m default
  private readonly POLL_SLEEP_MS = Number(process.env.RESEAL_POLL_SLEEP_MS ?? 1200);
  private readonly USE_CLIENT_FINALIZE =
    (process.env.USE_CLIENT_FINALIZE ?? '0') !== '0';
  private readonly IV_MODE = process.env.RESEAL_IV_MODE ?? 'be_first12';

  constructor(
    private readonly config: ConfigService,
    private readonly walrus: WalrusService,
    @Inject(forwardRef(() => SolanaService))
    private readonly solana: SolanaService,
  ) {
    const rpcUrl = this.config.get<string>('SOLANA_RPC') || 'https://api.devnet.solana.com';

    const keypairJson = process.env.SOLANA_KEYPAIR_JSON;
    if (!keypairJson) throw new Error('SOLANA_KEYPAIR_JSON not set');

    const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairJson)));
    const wallet = new anchor.Wallet(keypair);
    const connection = new anchor.web3.Connection(
      rpcUrl,
      { commitment: 'confirmed', wsEndpoint: process.env.SOLANA_WS }
    );
    this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    anchor.setProvider(this.provider);

    this.logger.log({ msg: 'rpc.init', http: rpcUrl, ws: process.env.SOLANA_WS || '(derived default)' });
    this.logger.log({ msg: 'reseal.config', iv_mode: this.IV_MODE });

    this.program = new anchor.Program(idl as any, this.provider);

    // Build discriminator maps up-front so early logs are useful
    this.buildDiscriminatorMaps();
  }

  private getAppProgramId(): PublicKey {
    const appPid = this.config.get<string>('SOLANA_PROGRAM_ID') || (idl as any)?.address;
    if (!appPid) throw new Error('SOLANA_PROGRAM_ID or idl.address is required');
    return new PublicKey(appPid);
  }

  // ---------------------------------------------------------------------------
  // Dynamic discriminator helpers (fix: don't hard-code callback head8)
  // ---------------------------------------------------------------------------

  /** sha256("global:"+name) first 8 bytes → hex string */
  private instrDiscHex(name: string): string {
    return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8).toString('hex');
  }

  /** Build maps: head8 hex → idl name, and set of callback head8s */
  private buildDiscriminatorMaps(): void {
    if (this.discNameByHex && this.callbackDiscHexSet) return;
    const discNameByHex = new Map<string, string>();
    const callbackSet = new Set<string>();

    try {
      const idlAny: any = this.program.idl ?? idl;
      const instrs: Array<{ name: string }> = idlAny?.instructions ?? [];

      for (const i of instrs) {
        const h = this.instrDiscHex(i.name);
        discNameByHex.set(h, i.name);
        if (/callback/i.test(i.name)) callbackSet.add(h);
      }

      // Allow explicit callback method name override
      const explicitCbName =
        this.config.get<string>('ARCIUM_CALLBACK_NAME') ||
        process.env.ARCIUM_CALLBACK_NAME;
      if (explicitCbName) {
        callbackSet.add(this.instrDiscHex(explicitCbName));
      }

      // Back-compat default: include common names if not in IDL for some reason
      ['reseal_dek_callback', 'resealDekCallback'].forEach((n) => {
        callbackSet.add(this.instrDiscHex(n));
      });

      // Allow hex override(s) via env (comma-separated)
      const extraHex =
        this.config.get<string>('ARCIUM_CALLBACK_DISC_HEX') ||
        process.env.ARCIUM_CALLBACK_DISC_HEX;
      if (extraHex) {
        for (const raw of extraHex.split(',').map(s => s.trim()).filter(Boolean)) {
          const clean = raw.toLowerCase().replace(/^0x/, '');
          if (clean.length === 16) callbackSet.add(clean);
        }
      }

      this.discNameByHex = discNameByHex;
      this.callbackDiscHexSet = callbackSet;

      // Helpful one-time log
      this.logger.log({
        msg: 'idl.discriminators.built',
        nInstructions: instrs.length,
        callbacks: [...callbackSet].map(h => `${h}:${discNameByHex.get(h) || '?'}`),
      });
    } catch (e) {
      // If this fails, we still proceed; extractor will use a small default set
      this.logger.warn({ msg: 'idl.discriminators.build.failed', error: String(e) });
      this.discNameByHex = this.discNameByHex || new Map();
      this.callbackDiscHexSet = this.callbackDiscHexSet || new Set([
        this.instrDiscHex('reseal_dek_callback'),
        this.instrDiscHex('resealDekCallback'),
      ]);
    }
  }

  /** Return the cached set of callback discriminators (hex) */
  private getCallbackDiscSet(): Set<string> {
    if (!this.callbackDiscHexSet) this.buildDiscriminatorMaps();
    return this.callbackDiscHexSet!;
  }

  /** If we know the name for a head8, return it for nicer logs */
  private discHexToName(hex: string): string | undefined {
    if (!this.discNameByHex) this.buildDiscriminatorMaps();
    return this.discNameByHex!.get(hex);
  }

  // ---------------------------------------------------------------------------
  // Cluster & Fee Pool resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve an Arcium Cluster account:
   *  - Prefer explicit pubkey via ARCIUM_CLUSTER_PUBKEY
   *  - Else require ARCIUM_CLUSTER_OFFSET (devnet/testnet published offset)
   *
   * NOTE: Arcium docs show `cluster_account` is a required account owned by the Arcium program.
   */
  private getClusterAccount(): PublicKey {
    const explicit = this.config.get<string>('ARCIUM_CLUSTER_PUBKEY');
    if (explicit) return new PublicKey(explicit);

    const offStr = this.config.get<string>('ARCIUM_CLUSTER_OFFSET');
    if (!offStr) {
      throw new Error(
        'ARCIUM_CLUSTER_OFFSET missing. Set ARCIUM_CLUSTER_OFFSET=<number> (or ARCIUM_CLUSTER_PUBKEY).',
      );
    }
    const offset = Number(offStr);
    if (!Number.isFinite(offset)) throw new Error('ARCIUM_CLUSTER_OFFSET must be a number');
    return getClusterAccAddress(offset);
  }

  /**
   * Resolve Fee Pool (v0.2).
   * Prefer env or client helper; avoid legacy staking pool unless explicitly allowed.
   */
  private getFeePoolAccount(): PublicKey {
    const fromEnv =
      this.config.get<string>('ARCIUM_FEE_POOL_ACCOUNT') ||
      this.config.get<string>('ARCIUM_FEE_POOL_ACCOUNT_ADDRESS');
    if (fromEnv) {
      return new PublicKey(fromEnv);
    }

    if (typeof clientAny.getFeePoolAccAddress === 'function') {
      const pk = clientAny.getFeePoolAccAddress();
      return pk instanceof PublicKey ? pk : new PublicKey(pk);
    }

    if (clientAny?.ARCIUM_FEE_POOL_ACCOUNT_ADDRESS) {
      return new PublicKey(clientAny.ARCIUM_FEE_POOL_ACCOUNT_ADDRESS as string);
    }

    if (this.config.get<string>('ALLOW_LEGACY_POOL_FALLBACK') === 'true') {
      this.logger.warn(
        '[ArciumService] Using legacy getStakingPoolAccAddress() due to ALLOW_LEGACY_POOL_FALLBACK=true. ' +
          'This may fail on v0.2 networks — prefer ARCIUM_FEE_POOL_ACCOUNT in .env.',
      );
      return getStakingPoolAccAddress();
    }

    throw new Error(
      [
        'Unable to resolve Fee Pool account.',
        'Set ARCIUM_FEE_POOL_ACCOUNT in your .env to the FeePool address for your network,',
        'or upgrade @arcium-hq/client to a version that exposes getFeePoolAccAddress().',
      ].join(' '),
    );
  }

  // ---------------------------------------------------------------------------
  // MXE x25519 public key (cached)
  // ---------------------------------------------------------------------------

  async getMxePublicKeyWithRetry(retries = 5, backoffMs = 500): Promise<Uint8Array> {
    if (this.cachedMxePub) return this.cachedMxePub;

    const envB64 =
      this.config.get<string>('MXE_X25519_PUBKEY_B64') ||
      this.config.get<string>('MXE_X25519_PUBKEY_BASE64');

    if (envB64) {
      const bytes = Buffer.from(envB64, 'base64');
      if (bytes.length !== 32) throw new Error('MXE_X25519_PUBKEY_* must decode to 32 bytes');
      this.cachedMxePub = new Uint8Array(bytes);
      this.logger.log('MXE pubkey loaded from env');
      return this.cachedMxePub;
    }

    const pid = this.getAppProgramId();
    let lastErr: any;
    for (let i = 0; i < retries; i++) {
      try {
        const pub = await getMXEKey(this.provider as any, pid);
        if (!pub || pub.length !== 32) throw new Error('Invalid MXE public key');
        this.cachedMxePub = pub instanceof Uint8Array ? pub : new Uint8Array(pub);
        this.logger.log('MXE pubkey fetched from chain');
        return this.cachedMxePub;
      } catch (e) {
        lastErr = e;
        await new Promise((res) => setTimeout(res, backoffMs * Math.max(1, i)));
      }
    }
    throw new Error(`Failed to fetch MXE pubkey: ${lastErr?.message || 'unknown'}`);
  }

  async getMxePublicKeyB64(): Promise<string> {
    const key = await this.getMxePublicKeyWithRetry();
    return Buffer.from(key).toString('base64');
  }

  // ---------------------------------------------------------------------------
  // Comp-def init for reseal_dek (one-time)
  // ---------------------------------------------------------------------------

  async initResealCompDef(): Promise<PublicKey> {
    const payer = this.provider.wallet.publicKey;
    const programId = this.getAppProgramId();

    const compName = this.config.get<string>('ARCIUM_RESEAL_COMP_NAME') || 'reseal_dek';
    const offsetBytes = getCompDefAccOffset(compName); // 4 bytes LE
    const compDefIdx = Buffer.from(offsetBytes).readUInt32LE();

    const mxeAccount = getMXEAccAddress(programId);
    const compDefAccount = getCompDefAccAddress(programId, compDefIdx);
    const arciumProgram = getArciumProgAddress();

    const txSig = await (this.program as any).methods
      .initResealDekCompDef()
      .accounts({
        payer,
        mxeAccount,
        compDefAccount,
        arciumProgram,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: 'confirmed' });

    this.logger.log(`init_reseal_dek_comp_def ok: ${txSig} comp_def=${compDefAccount.toBase58()}`);
    return compDefAccount;
  }

  private async ensureResealCompDef(): Promise<anchor.web3.PublicKey> {
    const programId = this.getAppProgramId();
    const compDefAccount = this.resolveCompDefAccount(programId);
    const info = await this.provider.connection.getAccountInfo(compDefAccount, 'confirmed');

    if (info) {
      this.logger.log({
        msg: 'reseal.compdef.exists',
        compDef: compDefAccount.toBase58(),
        owner: info.owner.toBase58(),
      });
      return compDefAccount;
    }

    this.logger.warn({
      msg: 'reseal.compdef.missing.initializing',
      compDef: compDefAccount.toBase58(),
    });

    // Initialize and return PDA (idempotent for our purposes)
    const created = await this.initResealCompDef();
    return created;
  }

  /**
   * Derive the comp-def PDA for reseal_dek deterministically.
   * If an env override is present but doesn't match the expected derivation,
   * we log a warning and return the expected PDA (prevents Anchor 2012).
   */
  private resolveCompDefAccount(programId: PublicKey): PublicKey {
    const compName = this.config.get<string>('ARCIUM_RESEAL_COMP_NAME') || 'reseal_dek';
    const offBytes = getCompDefAccOffset(compName);
    const idx = Buffer.from(offBytes).readUInt32LE();
    const expected = getCompDefAccAddress(programId, idx);

    const override =
      this.config.get<string>('ARCIUM_COMP_DEF_PDA') ||
      this.config.get<string>('ARCIUM_CIRCUIT_ID');

    if (!override) return expected;

    const overridePk = new PublicKey(override);
    if (!overridePk.equals(expected)) {
      this.logger.warn(
        `[ArciumService] Env comp-def override (${overridePk.toBase58()}) ` +
        `does not match expected PDA for "${compName}" (${expected.toBase58()}). Ignoring override.`,
      );
      return expected;
    }
    return overridePk;
  }

  // ---------------------------------------------------------------------------
  // MXE capsule parse helpers
  // ---------------------------------------------------------------------------

  private parseMxeCapsule(mxeCapsule: Buffer): {
    nonceLE128: anchor.BN;
    c0: number[];
    c1: number[];
    c2: number[];
    c3: number[];
  } {
    if (typeof clientAny.deserializeCiphertext === 'function') {
      const obj = clientAny.deserializeCiphertext(mxeCapsule);
      const nonceLE128 = new anchor.BN(Buffer.from(obj.nonce).reverse().toString('hex'), 'hex'); // LE u128
      return {
        nonceLE128,
        c0: Array.from(obj.c0),
        c1: Array.from(obj.c1),
        c2: Array.from(obj.c2),
        c3: Array.from(obj.c3),
      };
    }

    // Fallback: 16-byte nonce + 4×32-byte limbs = 144 bytes
    if (mxeCapsule.length !== 144) {
      throw new Error(`MXE capsule must be 144 bytes, got ${mxeCapsule.length}`);
    }
    const nonce = mxeCapsule.subarray(0, 16);
    const c0 = mxeCapsule.subarray(16, 48);
    const c1 = mxeCapsule.subarray(48, 80);
    const c2 = mxeCapsule.subarray(80, 112);
    const c3 = mxeCapsule.subarray(112, 144);

    const nonceLE128 = new anchor.BN(Buffer.from(nonce).reverse().toString('hex'), 'hex');
    return { nonceLE128, c0: Array.from(c0), c1: Array.from(c1), c2: Array.from(c2), c3: Array.from(c3) };
  }

  // ---------------------------------------------------------------------------
  // Strict on-chain reseal (no HTTP path to Arcium)
  // ---------------------------------------------------------------------------

  async resealDekOnChain(params: {
    mxeCapsule: Buffer;
    buyerX25519Pubkey: Uint8Array; // 32 bytes
    listingState: PublicKey;
    purchaseRecord: PublicKey;
    commitment?: anchor.web3.Commitment;
    traceId?: string;
    recordPk?: string;
  }): Promise<{ sig: string; computationOffset: anchor.BN; buyerCid: string }> {
    const { mxeCapsule, buyerX25519Pubkey, listingState, purchaseRecord, traceId, recordPk } = params;
    if (!mxeCapsule?.length) throw new Error('mxeCapsule is required');
    if (!buyerX25519Pubkey || buyerX25519Pubkey.length !== 32) {
      throw new Error('buyerX25519Pubkey must be 32 bytes');
    }

    const programId = this.getAppProgramId();
    const payer = this.provider.wallet.publicKey;

    // Parse capsule → limbs expected by the IDL
    const { nonceLE128, c0, c1, c2, c3 } = this.parseMxeCapsule(mxeCapsule);

    // Resolve required PDAs / fixed accounts
    const mxeAccount = getMXEAccAddress(programId);
    const mempoolAccount = getMempoolAccAddress(programId);

    const executingPool = this.config.get<string>('ARCIUM_EXECUTING_POOL_PUBKEY')
      ? new PublicKey(this.config.get<string>('ARCIUM_EXECUTING_POOL_PUBKEY')!)
      : getExecutingPoolAccAddress(programId);

    const clusterAccount = this.getClusterAccount();
    const clockAccount = getClockAccAddress();
    const feePoolAccount = this.getFeePoolAccount();

    // Validate presence/ownership for better errors up-front
    await this.assertOwnedByArcium('cluster', clusterAccount);
    await this.assertOwnedByArcium('fee_pool', feePoolAccount);

    // Random 8 bytes for computation offset (u64)
    const computationOffset = new anchor.BN(randomBytes(8), 'hex');
    const computationAccount = getComputationAccAddress(programId, computationOffset);
    const compDefAccount = await this.ensureResealCompDef();
    const arciumProgram = getArciumProgAddress();

    // Helpful logs for diagnosing mismatched accounts
    this.logger.log('mxeAccount    : ' + mxeAccount.toBase58());
    this.logger.log('clusterAccount: ' + clusterAccount.toBase58());
    this.logger.log('executingPool : ' + executingPool.toBase58());
    this.logger.log('feePoolAccount: ' + feePoolAccount.toBase58());
    this.logger.log('clockAccount  : ' + clockAccount.toBase58());
    this.logger.log('compDefAccount(expected reseal_dek): ' + compDefAccount.toBase58());

    // Your program-specific PDA (unchanged)
    const [jobPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('quality_job'), computationAccount.toBuffer()],
      programId,
    );
    this.logger.log('jobPda: ' + jobPda.toBase58());
    const expectedExec = getExecutingPoolAccAddress(programId);
    this.logger.log('expectedExec: ' + expectedExec.toBase58());
    if (!expectedExec.equals(executingPool)) {
      throw new Error(
        `executing_pool mismatch. Expected ${expectedExec.toBase58()}, got ${executingPool.toBase58()}`
      );
    }

    // Encrypted IX
    const sig = await (this.program as any).methods
      .resealDek(
        computationOffset,
        nonceLE128,
        Array.from(buyerX25519Pubkey),
        c0, c1, c2, c3,
      )
      .accounts({
        payer,
        mxeAccount,
        mempoolAccount,
        executingPool,
        computationAccount,
        compDefAccount,
        clusterAccount,
        poolAccount: feePoolAccount, // MUST be Fee Pool (v0.2)
        clockAccount,
        listingState,        // <-- add
        purchaseRecord,      // <-- add
        systemProgram: SystemProgram.programId,
        arciumProgram,
      })
      .rpc({ skipPreflight: false, commitment: params.commitment ?? 'confirmed' });

    // Add structured log after .rpc() returns
    this.logger.log({
      msg: 'reseal.submitted',
      tx: sig,
      listingState: listingState.toBase58(),
      purchaseRecord: purchaseRecord.toBase58(),
    });

    this.logger.debug({
      msg: 'reseal.submit.context',
      programId: programId.toBase58(),
      submitSig: sig,
      commitment: this.toFinality(params.commitment),
      compDef: compDefAccount.toBase58(),
    });

    // Force-dump the submit tx to prove whether callback already happened
    await this.debugPrintTx(sig, programId);

    // Optional: dump the submit tx once for ground truth (guarded by env)
    if (process.env.DEBUG_RESEAL_DUMP_SUBMIT === '1') {
      await this.debugPrintTx(sig, programId);
    }

    const finalizePath = this.USE_CLIENT_FINALIZE
      ? (async () => {
          try {
            const finalizeSig = await awaitComputationFinalization(
              this.provider as any,
              computationOffset,      // BN first
              programId,              // PublicKey second
              this.toFinality(params.commitment)
            );
            this.logger.log({ msg: 'reseal.finalize.receipt', finalizeSig });
            if (!finalizeSig) throw new Error('no_finalize_sig');
            const tx = await this.provider.connection.getTransaction(finalizeSig, {
              maxSupportedTransactionVersion: 0,
              commitment: this.toFinality(params.commitment),
            });

            const { ixData, hit } = this.extractIxDataByDiscs(tx, programId, this.getCallbackDiscSet(), finalizeSig);
            if (!hit || !ixData) throw new Error('finalize_tx_missing_callback_ix');
            const decoded = this.decodeResealCallback(ixData);

            await this.writeBuyerCapsuleDebug(decoded.buyerCapsule, '_finalize');
            const buyerCid = await this.walrus.uploadData(decoded.buyerCapsule);
            this.logger.log({
              msg: 'reseal.buyer_capsule.uploaded',
              buyerCid,
              arc1_length: decoded.buyerCapsule.length,
              via: 'finalize_path',
            });

            await this.solana.finalizePurchaseOnChain({ listing: listingState, record: purchaseRecord, dekCapsuleForBuyerCid: buyerCid });
            return { signature: finalizeSig, buyerCid };
          } catch (e) {
            this.logger.warn({ msg: 'reseal.await_finalize.error', error: String(e) });
            throw e; // let Promise.any ignore it
          }
        })()
      : Promise.resolve(null as any);

    // Fast-path via onLogs (primary method with full CALLBACK_TIMEOUT_MS)
    const fastPath = this.watchCallbackOnce({
      programId,
      listing: listingState,
      record: purchaseRecord,
      commitment: this.toFinality(params.commitment),
    });

    // Enhanced event scanning strategy (secondary method)
    const eventScanPath = this.scanForResealEvent({
      programId,
      listingState,
      purchaseRecord,
      afterSignature: sig,
      commitment: this.toFinality(params.commitment),
      timeoutMs: 60000, // 60 seconds for OffChain worker burstiness
    });

    // Poll-based fallback (lazy factory - only runs when called)
    const runRestFallback = async () => {
      const winner = await Promise.any([
        this.waitForResealCallbackTx({
          programId, purchaseRecord, listingState,
          afterSignature: sig, commitment: this.toFinality(params.commitment),
          timeoutMs: this.CALLBACK_TIMEOUT_MS,
        }),
        this.pollByProgramIdForCallback({
          programId, afterSignature: sig,
          commitment: this.toFinality(params.commitment),
          timeoutMs: this.CALLBACK_TIMEOUT_MS,
        }),
      ]);
      const decoded = this.decodeResealCallback(winner.ixData);
      this.logger.log({
        msg: 'reseal.callback.decoded',
        c0Head: Buffer.from(decoded.c0).subarray(0,4).toString('hex'),
        c1Head: Buffer.from(decoded.c1).subarray(0,4).toString('hex'),
        c2Head: Buffer.from(decoded.c2).subarray(0,4).toString('hex'),
        c3Head: Buffer.from(decoded.c3).subarray(0,4).toString('hex'),
        callbackSig: winner.sig,
      });

      await this.writeBuyerCapsuleDebug(decoded.buyerCapsule, '_fallback');
      const buyerCid = await this.walrus.uploadData(decoded.buyerCapsule);
      this.logger.log({
        msg: 'reseal.buyer_capsule.uploaded',
        buyerCid,
        arc1_length: decoded.buyerCapsule.length,
        via: 'fallback_path',
      });

      await this.solana.finalizePurchaseOnChain({ listing: listingState, record: purchaseRecord, dekCapsuleForBuyerCid: buyerCid });
      return { signature: winner.sig, buyerCid };
    };

    // Enhanced event path (processes events directly)  
    const eventPath = (async () => {
      const eventResult = await eventScanPath;
      if (!eventResult) return null;

      const ev = eventResult.eventData;
      this.logger.log({
        msg: 'reseal.event.processing',
        listing: ev.listing?.toBase58?.() || ev.listing?.toString?.(),
        record: ev.record?.toBase58?.() || ev.record?.toString?.(),
        signature: eventResult.signature,
      });

      // Extract components from event data
      const c0 = Buffer.from(ev.c0);
      const c1 = Buffer.from(ev.c1);
      const c2 = Buffer.from(ev.c2);
      const c3 = Buffer.from(ev.c3);
      const nonce = Buffer.from(ev.nonce); // LE from callback

      // Extract ciphertext and tag from limbs for ARC1 format
      const limbs = Buffer.concat([c0, c1, c2, c3]); // 128 bytes
      if (limbs.length < 48) {
        throw new Error(`limbs too short for ciphertext+tag extraction: ${limbs.length}`);
      }
      const ciphertext32 = limbs.slice(0, 32);
      const tag16 = limbs.slice(32, 48);

      // Convert nonce (LE) to BE → 12-byte IV
      const iv12 = this.iv12FromNonceLE(nonce);

      // Create 96-byte ARC1 capsule for buyer
      const arc1Capsule = packArc1Capsule({
        senderEphemeral32: new Uint8Array(ev.encryption_key || Buffer.alloc(32)), // Use encryption_key from event
        iv12,
        ciphertext32: new Uint8Array(ciphertext32),
        tag16: new Uint8Array(tag16),
      });

      this.logger.log({
        msg: 'reseal.event.arc1_generated',
        iv_mode: this.IV_MODE,
        arc1_length: arc1Capsule.length,
        signature: eventResult.signature,
      });

      await this.writeBuyerCapsuleDebug(Buffer.from(arc1Capsule), '_event');
      const buyerCid = await this.walrus.uploadData(Buffer.from(arc1Capsule));
      this.logger.log({
        msg: 'reseal.buyer_capsule.uploaded',
        buyerCid,
        arc1_length: arc1Capsule.length,
        via: 'event_path',
      });

      await this.solana.finalizePurchaseOnChain({ listing: listingState, record: purchaseRecord, dekCapsuleForBuyerCid: buyerCid });
      return { signature: eventResult.signature, buyerCid };
    })();

    // WebSocket primary; then finalize path; then event scan; else fall back to REST polling
    let buyerCid: string;

    try {
      const orRejectNull = <T>(p: Promise<T | null>) =>
        p.then(v => (v === null ? Promise.reject('null') : v));

      const primary = await Promise.any([
        orRejectNull(fastPath),
        orRejectNull(finalizePath),
        orRejectNull(eventPath),
      ]);

      buyerCid = primary.buyerCid;
      this.logger.log({
        msg: 'reseal.primary.path.resolved',
        via: primary.signature ? 'callback-tx' : 'unknown',
      });
    } catch (callbackError) {
      this.logger.warn(
        'All callback transaction approaches failed, falling back to legacy event polling:',
        callbackError
      );

      try {
        const restResult = await runRestFallback();
        buyerCid = restResult.buyerCid;
      } catch (restError) {
        buyerCid = await this.pollResealCompletion({
          mempoolAccount,
          computationAccount,
          jobPda,
          arciumProgram,
          sig,
          listingState,
          purchaseRecord,
          commitment: params.commitment,
        });
      }
    }

    // Log successful reseal with details
    const buyerX25519PubkeyHash = Array.from(buyerX25519Pubkey.slice(0, 6))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    logKV(this.logger, 'arcium.reseal.complete', {
      traceId,
      recordPk,
      listingState: listingState.toBase58(),
      buyerX25519PubkeyHash,
      mxeCid: null,
      buyerCapsuleSize: 144,
      sig,
    }, 'debug');

    this.logger.log(`reseal_dek ok: ${sig} offset=${computationOffset.toString()}`);
    return { sig, computationOffset, buyerCid };
  }

  // ---------------------------------------------------------------------------
  // Helper functions
  // ---------------------------------------------------------------------------

  private sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }

  // Convert LE u128 nonce → BE u128, then derive 12-byte IV (BE first 12)
  private iv12FromNonceLE(nonceLE: Uint8Array | Buffer): Uint8Array {
    const be = Buffer.from(nonceLE).reverse(); // LE → BE
    return u128NonceToIv12BE(new Uint8Array(be));
  }

  // --- Key normalization helpers ---
  private toPubkey(v: any): PublicKey {
    if (v instanceof PublicKey) return v;
    if (typeof v === 'string') return new PublicKey(v);
    if (v?.toBase58) return new PublicKey(v.toBase58());
    throw new Error(`cannot convert to PublicKey: ${String(v)}`);
  }

  private toBase58(v: any): string {
    if (typeof v === 'string') return v;
    if (v instanceof PublicKey) return v.toBase58();
    if (v?.toBase58) return v.toBase58();
    return String(v);
  }

  /** Robustly decode instruction data from RPC (base-58 by spec; base64 fallback) */
  private decodeIxDataString(s: string): Buffer {
    try { return Buffer.from(bs58.decode(s)); } catch {}
    try { return Buffer.from(s, 'base64'); } catch {}
    return Buffer.alloc(0);
  }

  /** Return full keyspace as PublicKey[] for legacy and v0 (static + loaded ALT addresses) */
  private allKeysFromTx(tx: any): PublicKey[] {
    const msg: any = tx.transaction.message;

    // Legacy: message.accountKeys: string[]
    if (!('staticAccountKeys' in msg)) {
      const legacyKeys: any[] = msg.accountKeys ?? [];
      return legacyKeys.map((k: any) => this.toPubkey(k));
    }

    // v0: staticAccountKeys + loadedAddresses
    const statics: any[] = msg.staticAccountKeys ?? [];
    const loadedW: any[] = tx.meta?.loadedAddresses?.writable ?? [];
    const loadedR: any[] = tx.meta?.loadedAddresses?.readonly ?? [];
    return [...statics, ...loadedW, ...loadedR].map((k: any) => this.toPubkey(k));
  }

  /** Scan a transaction for our callback (top-level + inner CPIs). Returns first hit. */
  private extractIxDataByDiscs(
    tx: any,
    programId: PublicKey,
    discSet: Set<string>,
    signature?: string
  ): { ixData: Buffer | null; hit: boolean } {
    const msg: any = tx.transaction.message;
    const isV0 = 'compiledInstructions' in msg;
    const top = isV0 ? (msg.compiledInstructions ?? []) : (msg.instructions ?? []);
    const innerGroups = tx.meta?.innerInstructions ?? [];
    const keys: PublicKey[] = this.allKeysFromTx(tx);

    const test = (ix: any, src: 'top'|'inner', idx: number) => {
      try {
        const pid = keys[ix.programIdIndex];
        if (!pid || !pid.equals(programId)) return null;

        const raw = this.decodeIxDataString(ix.data);
        if (raw.length >= 8) {
          const head8 = raw.subarray(0,8).toString('hex');
          const name = this.discHexToName(head8);
          this.logger.debug({
            msg: 'reseal.callback.pid_match',
            sig: signature || 'unknown',
            head8,
            name: name || '(unknown)',
          });
          if (discSet.has(head8)) {
            this.logger.debug({
              msg: 'reseal.callback.disc.hit',
              src, idx,
              disc: head8,
              name: name || '(unknown)',
              len: raw.length,
            });
            return raw;
          }
        }
      } catch (e) {
        this.logger.debug({ msg: 'reseal.callback.decode_err', src, idx, err: String(e) });
      }
      return null;
    };

    // scan top-level
    for (let i = 0; i < top.length; i++) {
      const hit = test(top[i], 'top', i);
      if (hit) return { ixData: hit, hit: true };
    }
    // scan inner CPIs
    for (const g of innerGroups) {
      const ins = g.instructions ?? [];
      for (let i = 0; i < ins.length; i++) {
        const hit = test(ins[i], 'inner', i);
        if (hit) return { ixData: hit, hit: true };
      }
    }
    return { ixData: null, hit: false };
  }

  // ---------------------------------------------------------------------------
  // Debug utilities
  // ---------------------------------------------------------------------------

  /**
   * Write buyer capsule to debug file and log detailed hex preview
   */
  private async writeBuyerCapsuleDebug(capsule: Buffer, suffix: string = ''): Promise<void> {
    try {
      const artifactsDir = path.join(process.cwd(), 'artifacts', 'reseal');
      await fs.ensureDir(artifactsDir);

      const filename = `buyer_capsule.arc1${suffix}.bin`;
      const filepath = path.join(artifactsDir, filename);

      await fs.writeFile(filepath, capsule);

      this.logger.log({
        msg: 'reseal.debug.capsule_written',
        file: filepath,
        size: capsule.length,
        magic: capsule.subarray(0, 4).toString('hex'), // "41524331" (ARC1)
        sender_ephemeral_preview: capsule.subarray(4, 12).toString('hex'),
        iv_preview: capsule.subarray(36, 44).toString('hex'),
        ciphertext_preview: capsule.subarray(48, 56).toString('hex'),
        tag_preview: capsule.subarray(80, 88).toString('hex'),
      });
    } catch (e) {
      this.logger.warn({ msg: 'reseal.debug.write_failed', error: String(e) });
    }
  }

  // ---------------------------------------------------------------------------
  // Strict IDL-based decoder for reseal callback
  // ---------------------------------------------------------------------------

  private decodeResealCallback(ixData: Buffer) {
    // NOTE: we no longer check for a single fixed discriminator here; the caller
    // has confirmed this ix belongs to one of the callback discriminators.
    if (ixData.length < 8 + 1 + 32 + 16 + 4 * 32) {
      throw new Error(`callback ixData too short: ${ixData.length}`);
    }

    const body = ixData.subarray(8);
    let o = 0;

    const variant = body[o]; o += 1;
    if (variant !== 0) {
      throw new Error('Reseal callback returned Failure');
    }

    const encryptionKey = body.subarray(o, o + 32); o += 32;
    const nonceLE      = body.subarray(o, o + 16); o += 16;
    const c0           = body.subarray(o, o + 32); o += 32;
    const c1           = body.subarray(o, o + 32); o += 32;
    const c2           = body.subarray(o, o + 32); o += 32;
    const c3           = body.subarray(o, o + 32); o += 32;

    // Create raw 144-byte MXE capsule format (nonce-first for MXE storage)
    const mxeCapsule = Buffer.concat([nonceLE, c0, c1, c2, c3]);
    if (mxeCapsule.length !== 144) {
      throw new Error(`MXE capsule must be 144 bytes, got ${mxeCapsule.length}`);
    }

    // Extract ciphertext and tag from limbs for ARC1 format
    const limbs = Buffer.concat([c0, c1, c2, c3]); // 128 bytes
    if (limbs.length < 48) {
      throw new Error(`limbs too short for ciphertext+tag extraction: ${limbs.length}`);
    }
    const ciphertext32 = limbs.slice(0, 32);
    const tag16 = limbs.slice(32, 48);

    // Convert LE nonce → BE, then to 12-byte IV (first 12 bytes)
    const iv12 = this.iv12FromNonceLE(nonceLE);

    // Create 96-byte ARC1 capsule for buyer
    const arc1Capsule = packArc1Capsule({
      senderEphemeral32: new Uint8Array(encryptionKey),
      iv12,
      ciphertext32: new Uint8Array(ciphertext32),
      tag16: new Uint8Array(tag16),
    });

    this.logger.log({
      msg: 'reseal.callback.arc1_generated',
      iv_mode: this.IV_MODE,
      iv_preview: Buffer.from(iv12).subarray(0, 8).toString('hex'),
      arc1_length: arc1Capsule.length,
      mxe_length: mxeCapsule.length,
    });

    return {
      encryptionKey,
      nonceLE,
      c0, c1, c2, c3,
      mxeCapsule,
      buyerCapsule: Buffer.from(arc1Capsule),
    };
  }

  // ---------------------------------------------------------------------------
  // Backoff utils
  // ---------------------------------------------------------------------------

  private async backoffWithJitter(baseMs: number): Promise<void> {
    const jitter = Math.random() * 0.5 + 0.75; // 0.75-1.25x multiplier
    const delayMs = Math.floor(baseMs * jitter);
    await this.sleep(delayMs);
  }

  // ---------------------------------------------------------------------------
  // Robust callback transaction discovery (legacy + v0 support)
  // ---------------------------------------------------------------------------

  private async waitForResealCallbackTx(params: {
    programId: PublicKey;
    purchaseRecord: PublicKey;
    listingState?: PublicKey;
    afterSignature?: string;
    commitment?: Finality;
    timeoutMs: number;
  }): Promise<{ sig: string; ixData: Buffer }> {
    const { programId, purchaseRecord, listingState, afterSignature, commitment = 'confirmed', timeoutMs } = params;
    const start = Date.now();
    const discSet = this.getCallbackDiscSet();
    const ENABLE_ADDRESS_PAIR_SCANS = process.env.ENABLE_ADDRESS_PAIR_SCANS === 'true';

    const pollOne = async (addr: PublicKey) => {
      this.logger.debug({
        msg: 'reseal.callback.poll.start.addr',
        address: addr.toBase58(),
        afterSignature,
        timeoutMs
      });

      const seen = new Set<string>();
      let txsInspected = 0;
      let before: string | undefined = undefined;

      while (Date.now() - start < timeoutMs) {
        try {
          const opts: any = { limit: 50 };
          if (before) opts.before = before;
          if (afterSignature) opts.until = afterSignature; // page only *newer* than submit
          // (RPC semantics documented by Solana: `before`/`until` bound the range.)  // 

          const sigs = await this.provider.connection.getSignaturesForAddress(
            addr,
            opts,
            commitment as any
          );

          if (!sigs.length) {
            await this.backoffWithJitter(this.POLL_SLEEP_MS);
            continue;
          }

          for (const s of sigs) {
            if (seen.has(s.signature)) continue;
            seen.add(s.signature);
            txsInspected++;

            const tx = await this.provider.connection.getTransaction(s.signature, {
              maxSupportedTransactionVersion: 0,
              commitment
            });
            if (!tx?.transaction?.message) continue;

            const { ixData, hit } = this.extractIxDataByDiscs(tx, programId, discSet, s.signature);
            if (hit && ixData) {
              this.logger.log({
                msg: 'reseal.callback.detected',
                sig: s.signature,
                address: addr.toBase58(),
                txsInspected
              });
              return { sig: s.signature, ixData };
            }
          }

          before = sigs[sigs.length - 1].signature;
          await this.backoffWithJitter(this.POLL_SLEEP_MS);
        } catch (error: any) {
          if (error.message?.includes('429')) {
            const backoffMs = Math.min(5000, this.POLL_SLEEP_MS * 2);
            this.logger.warn({ msg: 'reseal.callback.429.backoff', backoffMs });
            await this.backoffWithJitter(backoffMs);
          } else {
            this.logger.warn({ msg: 'reseal.callback.poll.error', error: error.message });
            await this.backoffWithJitter(this.POLL_SLEEP_MS);
          }
        }
      }

      this.logger.warn({
        msg: 'reseal.callback.timeout.debug',
        address: addr.toBase58(),
        txsInspected,
        seenCount: seen.size
      });
      throw new Error('reseal.callback.timeout');
    };

    if (ENABLE_ADDRESS_PAIR_SCANS && listingState && !listingState.equals(purchaseRecord)) {
      this.logger.debug({ msg: 'reseal.callback.poll.dual', purchaseRecord: purchaseRecord.toBase58(), listingState: listingState.toBase58() });
      return await Promise.any([pollOne(purchaseRecord), pollOne(listingState)]);
    }
    return await pollOne(purchaseRecord);
  }

  private async pollByProgramIdForCallback(params: {
    programId: PublicKey;
    afterSignature?: string;
    commitment?: Finality;
    timeoutMs: number;
  }): Promise<{ sig: string; ixData: Buffer }> {
    const { programId, afterSignature, commitment = 'confirmed', timeoutMs } = params;
    const start = Date.now();
    const addr = programId;
    const discSet = this.getCallbackDiscSet();

    this.logger.debug({
      msg: 'reseal.callback.poll.start.program',
      programId: programId.toBase58(),
      afterSignature,
      timeoutMs
    });

    const seen = new Set<string>();
    let txsInspected = 0;
    let before: string | undefined = undefined;

    while (Date.now() - start < timeoutMs) {
      try {
        const opts: any = { limit: 50 };
        if (afterSignature) opts.until = afterSignature;
        if (before) opts.before = before;

        const sigs = await this.provider.connection.getSignaturesForAddress(
          addr, opts, commitment as any
        );

        if (!sigs.length) {
          await this.backoffWithJitter(this.POLL_SLEEP_MS);
          continue;
        }

        for (const s of sigs) {
          if (seen.has(s.signature)) continue;
          seen.add(s.signature);
          txsInspected++;

          const tx = await this.provider.connection.getTransaction(s.signature, {
            maxSupportedTransactionVersion: 0,
            commitment
          });
          if (!tx?.transaction?.message) continue;

          const { ixData, hit } = this.extractIxDataByDiscs(tx, programId, discSet, s.signature);
          if (hit && ixData) {
            this.logger.log({
              msg: 'reseal.callback.detected',
              sig: s.signature,
              address: addr.toBase58(),
              txsInspected
            });
            return { sig: s.signature, ixData };
          }
        }

        before = sigs[sigs.length - 1].signature;
        await this.backoffWithJitter(this.POLL_SLEEP_MS);
      } catch (error: any) {
        if (error.message?.includes('429')) {
          const backoffMs = Math.min(5000, this.POLL_SLEEP_MS * 2);
          this.logger.warn({ msg: 'reseal.callback.429.backoff', backoffMs });
          await this.backoffWithJitter(backoffMs);
        } else {
          this.logger.warn({ msg: 'reseal.callback.poll.error', error: error.message });
          await this.backoffWithJitter(this.POLL_SLEEP_MS);
        }
      }
    }

    this.logger.warn({
      msg: 'reseal.callback.timeout.debug',
      address: addr.toBase58(),
      txsInspected,
      seenCount: seen.size
    });
    throw new Error('reseal.callback.timeout');
  }

  /** Enhanced event scanning for ResealOutput events within an 8-12s window */
  private async scanForResealEvent(params: {
    programId: PublicKey;
    listingState: PublicKey;
    purchaseRecord: PublicKey;
    afterSignature?: string;
    commitment?: Finality;
    timeoutMs: number;
  }): Promise<{ signature: string; eventData: any } | null> {
    const { programId, listingState, purchaseRecord, afterSignature, commitment = 'confirmed', timeoutMs } = params;
    const start = Date.now();
    let before: string | undefined = undefined;

    this.logger.debug({
      msg: 'reseal.event.scan.start',
      programId: programId.toBase58(),
      listing: listingState.toBase58(),
      record: purchaseRecord.toBase58(),
      afterSignature,
      timeoutMs
    });

    while (Date.now() - start < timeoutMs) {
      try {
        const opts: any = { limit: 50 };
        if (afterSignature) opts.until = afterSignature;
        if (before) opts.before = before;

        const sigs = await this.provider.connection.getSignaturesForAddress(
          programId,
          opts,
          commitment as any
        );

        if (!sigs.length) {
          await this.backoffWithJitter(this.POLL_SLEEP_MS);
          continue;
        }

        for (const s of sigs) {
          const tx = await this.provider.connection.getTransaction(s.signature, {
            commitment,
            maxSupportedTransactionVersion: 0
          });

          if (!tx?.meta?.logMessages) continue;

          try {
            const eventParser = new anchor.EventParser(programId, new anchor.BorshCoder(this.program.idl));
            const events = eventParser.parseLogs(tx.meta.logMessages);

            for (const event of events) {
              if (event.name === 'ResealOutput') {
                const ev = event.data as any;

                const evListingStr = ev.listing?.toBase58?.() || ev.listing?.toString?.();
                const evRecordStr = ev.record?.toBase58?.() || ev.record?.toString?.();

                if (evListingStr === listingState.toBase58() && evRecordStr === purchaseRecord.toBase58()) {
                  this.logger.log({
                    msg: 'reseal.event.found',
                    sig: s.signature,
                    listing: evListingStr,
                    record: evRecordStr,
                  });
                  return { signature: s.signature, eventData: ev };
                }
              }
            }
          } catch (parseError) {
            this.logger.debug({ msg: 'reseal.event.parse.error', sig: s.signature, error: (parseError as any).message });
            continue;
          }
        }

        before = sigs[sigs.length - 1].signature;
        await this.backoffWithJitter(this.POLL_SLEEP_MS);
      } catch (error) {
        this.logger.warn({ msg: 'reseal.event.scan.error', error: (error as any).message });
        await this.backoffWithJitter(this.POLL_SLEEP_MS);
      }
    }

    this.logger.warn({ msg: 'reseal.event.scan.timeout', timeoutMs });
    return null;
  }

  /** Start a short-lived onLogs watcher for reseal callback; resolves once finalized */
  private async watchCallbackOnce(params: {
    programId: PublicKey;
    listing: PublicKey;
    record: PublicKey;
    commitment: Finality;
  }): Promise<{ signature: string; buyerCid: string } | null> {
    const { programId, listing, record, commitment } = params;
    let resolved = false;
    const discSet = this.getCallbackDiscSet();

    const handleProgramLogs = async (l: any) => {
      if (resolved) return;
      try {
        const tx = await this.provider.connection.getTransaction(l.signature, {
          maxSupportedTransactionVersion: 0,
          commitment
        });
        if (!tx) return;

        const keys = this.allKeysFromTx(tx);
        const listingSeen = keys.some(k => k.equals(listing));
        const recordSeen  = keys.some(k => k.equals(record));

        // 1) Prefer event path if present
        try {
          const logs = tx.meta?.logMessages ?? [];
          const eventParser = new anchor.EventParser(programId, new anchor.BorshCoder(this.program.idl));
          for (const ev of eventParser.parseLogs(logs)) {
            if (ev.name === 'ResealOutput') {
              const data: any = ev.data;
              const evListing = data.listing?.toBase58?.() || data.listing?.toString?.();
              const evRecord  = data.record?.toBase58?.()  || data.record?.toString?.();
              if (evListing === listing.toBase58() && evRecord === record.toBase58()) {
                const c0 = Buffer.from(data.c0);
                const c1 = Buffer.from(data.c1);
                const c2 = Buffer.from(data.c2);
                const c3 = Buffer.from(data.c3);
                const nonce = Buffer.from(data.nonce);
                const limbs = Buffer.concat([c0, c1, c2, c3]);
                const ciphertext32 = limbs.slice(0, 32);
                const tag16 = limbs.slice(32, 48);
                const iv12 = this.iv12FromNonceLE(nonce);
                const arc1Capsule = packArc1Capsule({
                  senderEphemeral32: new Uint8Array(data.encryption_key || Buffer.alloc(32)),
                  iv12,
                  ciphertext32: new Uint8Array(ciphertext32),
                  tag16: new Uint8Array(tag16),
                });

                await this.writeBuyerCapsuleDebug(Buffer.from(arc1Capsule), '_watch_event');
                const buyerCid = await this.walrus.uploadData(Buffer.from(arc1Capsule));
                await this.solana.finalizePurchaseOnChain({ listing, record, dekCapsuleForBuyerCid: buyerCid });
                this.logger.log({ msg: 'reseal.callback.finalized.event', signature: l.signature, buyerCid });
                resolved = true;
                return { signature: l.signature, buyerCid };
              }
            }
          }
        } catch { /* ignore parse errors; fall back to ix */ }

        // 2) Fallback: decode ix when both listing & record appear in the tx
        if (!(listingSeen && recordSeen)) return;
        const { ixData, hit } = this.extractIxDataByDiscs(tx, programId, discSet, l.signature);
        if (!hit || !ixData) return;

        const decoded = this.decodeResealCallback(ixData);

        await this.writeBuyerCapsuleDebug(decoded.buyerCapsule, '_watch_ix');
        const buyerCid = await this.walrus.uploadData(decoded.buyerCapsule);
        await this.solana.finalizePurchaseOnChain({ listing, record, dekCapsuleForBuyerCid: buyerCid });
        this.logger.log({ msg: 'reseal.callback.finalized.ix', signature: l.signature, buyerCid });
        resolved = true;
        return { signature: l.signature, buyerCid };
      } catch (e) {
        this.logger.warn('onLogs decode/finalize error', e);
        return null;
      }
    };

    return new Promise(async (resolve) => {
      const subId = await this.provider.connection.onLogs(programId, async (l) => {
        const result = await handleProgramLogs(l);
        if (result) {
          this.logger.debug({ msg: 'reseal.websocket.cleanup', subId });
          try { await this.provider.connection.removeOnLogsListener(subId); } catch {}
          resolve(result);
        }
      }, 'processed');

      this.logger.debug({ msg: 'reseal.websocket.subscribed', subId });

      setTimeout(async () => {
        if (!resolved) {
          this.logger.debug({ msg: 'reseal.websocket.timeout_cleanup', subId });
          try { await this.provider.connection.removeOnLogsListener(subId); } catch {}
          resolve(null);
        }
      }, this.CALLBACK_TIMEOUT_MS);
    });
  }

  // ---------------------------------------------------------------------------
  // Legacy polling fallback (unchanged except logs)
  // ---------------------------------------------------------------------------

  private async pollResealCompletion(params: {
    mempoolAccount: PublicKey;
    computationAccount: PublicKey;
    jobPda: PublicKey;
    arciumProgram: PublicKey;
    sig: string;
    listingState: PublicKey;
    purchaseRecord: PublicKey;
    commitment?: anchor.web3.Commitment;
  }): Promise<string> {
    const { mempoolAccount, computationAccount, jobPda, arciumProgram, sig, listingState, purchaseRecord } = params;

    this.logger.debug({ msg:'reseal.poll.start', jobPda: jobPda.toBase58(), tx: sig });

    let resealEventFound = false;
    let buyerCid: string | null = null;
    const programId = this.getAppProgramId();

    const logsSubscription = this.provider.connection.onLogs(
      programId,
      (logs, context) => {
        try {
          const eventParser = new anchor.EventParser(programId, new anchor.BorshCoder(this.program.idl));
          const events = eventParser.parseLogs(logs.logs);

          for (const event of events) {
            if (event.name === 'ResealOutput') {
              const ev = event.data as any;

              const evListingStr = ev.listing?.toBase58?.() || ev.listing?.toString?.();
              const evRecordStr = ev.record?.toBase58?.() || ev.record?.toString?.();

              if (evListingStr === listingState.toBase58() && evRecordStr === purchaseRecord.toBase58()) {
                this.logger.log({
                  msg: 'reseal.event',
                  listing: evListingStr,
                  record: evRecordStr,
                  nonceLen: ev.nonce?.length ?? 0,
                  cLens: [ev.c0?.length ?? 0, ev.c1?.length ?? 0, ev.c2?.length ?? 0, ev.c3?.length ?? 0],
                  c0Hex: ev.c0 ? Buffer.from(ev.c0).subarray(0,4).toString('hex') : 'missing',
                  c1Hex: ev.c1 ? Buffer.from(ev.c1).subarray(0,4).toString('hex') : 'missing',
                  c2Hex: ev.c2 ? Buffer.from(ev.c2).subarray(0,4).toString('hex') : 'missing',
                  c3Hex: ev.c3 ? Buffer.from(ev.c3).subarray(0,4).toString('hex') : 'missing',
                });

                const c0 = Buffer.from(ev.c0);
                const c1 = Buffer.from(ev.c1);
                const c2 = Buffer.from(ev.c2);
                const c3 = Buffer.from(ev.c3);
                const nonce = Buffer.from(ev.nonce);
                const limbs = Buffer.concat([c0, c1, c2, c3]);
                const ciphertext32 = limbs.slice(0, 32);
                const tag16 = limbs.slice(32, 48);
                const iv12 = this.iv12FromNonceLE(nonce);

                const arc1Capsule = packArc1Capsule({
                  senderEphemeral32: new Uint8Array(ev.encryption_key || Buffer.alloc(32)),
                  iv12,
                  ciphertext32: new Uint8Array(ciphertext32),
                  tag16: new Uint8Array(tag16),
                });

                this.writeBuyerCapsuleDebug(Buffer.from(arc1Capsule), '_poll').then(() => {
                  return this.walrus.uploadData(Buffer.from(arc1Capsule));
                }).then(blobId => {
                  this.logger.log({
                    msg:'reseal.upload',
                    blobId,
                    arc1_length: arc1Capsule.length,
                    via: 'poll_path',
                  });

                  return this.finalizePurchase(listingState, purchaseRecord, blobId);
                }).then(txSig => {
                  this.logger.log({ msg:'finalize_purchase.ok', tx: txSig });
                  return this.solana.getPurchaseRecordBuyerCid(purchaseRecord);
                }).then(verifiedBuyerCid => {
                  this.logger.log({ msg:'purchase_record.updated', buyerCid: verifiedBuyerCid });
                  buyerCid = verifiedBuyerCid;
                  resealEventFound = true;
                }).catch(e => {
                  this.logger.error('Failed to finalize purchase after reseal event:', e);
                });

                break;
              }
            }
          }
        } catch (e) {
          this.logger.error('Failed to parse reseal event:', e);
        }
      },
      'confirmed'
    );

    try {
      for (let i = 0; i < 30 && !resealEventFound; i++) {
        this.logger.debug({
          msg: 'reseal.poll.tick',
          i,
          jobPda: jobPda.toBase58(),
          eventFound: resealEventFound,
        });

        if (i > 0 && i % 5 === 0) {
          try {
            const txInfo = await this.provider.connection.getTransaction(sig, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed'
            });

            if (txInfo?.meta?.logMessages) {
              const hasCallbackLogs = txInfo.meta.logMessages.some(log =>
                log.includes('reseal_dek_callback') || (log.includes('invoke') && log.includes(arciumProgram.toBase58()))
              );

              this.logger.debug({
                msg: 'reseal.poll.tx_logs',
                i,
                hasCallbackLogs,
                logCount: txInfo.meta.logMessages.length,
              });
            }
          } catch (e) {
            this.logger.debug('Failed to fetch transaction logs during polling:', e);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!resealEventFound || !buyerCid) {
        throw new Error('reseal.callback.timeout');
      }

      this.logger.log({ msg:'reseal.finalized', jobPda: jobPda.toBase58(), buyerCid });
      return buyerCid;

    } finally {
      try {
        await this.provider.connection.removeOnLogsListener(logsSubscription);
      } catch (e) {
        this.logger.debug('Failed to remove logs listener:', e);
      }
    }
  }

  private async finalizePurchase(listingState: PublicKey, purchaseRecord: PublicKey, dekCapsuleForBuyerCid: string): Promise<string> {
    this.logger.log({ msg:'finalize_purchase.submit', cid: dekCapsuleForBuyerCid });

    const admin = this.provider.wallet.publicKey;
    const [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), admin.toBuffer()],
      this.program.programId,
    );

    const sig = await this.program.methods
      .finalizePurchase(dekCapsuleForBuyerCid)
      .accounts({
        authority: admin,
        marketplace: marketplacePda,
        listingState: listingState,
        purchaseRecord: purchaseRecord,
        clock: new PublicKey('SysvarC1ock11111111111111111111111111111111'),
      })
      .rpc({ commitment: 'confirmed' });

    return sig;
  }

  // ---------------------------------------------------------------------------
  // Client-side ECIES: seal DEK → 144-byte capsule
  // ---------------------------------------------------------------------------

  async sealDekForMxe(dek32: Buffer): Promise<Buffer> {
    if (dek32.length !== 32) throw new Error('DEK must be exactly 32 bytes');

    const mxePublicKey = await this.getMxePublicKeyWithRetry(); // Uint8Array (32)
    const words: bigint[] = [
      dek32.readBigUInt64LE(0),
      dek32.readBigUInt64LE(8),
      dek32.readBigUInt64LE(16),
      dek32.readBigUInt64LE(24),
    ];

    const priv = x25519.utils.randomPrivateKey();
    const sharedSecret = x25519.getSharedSecret(priv, mxePublicKey);
    const nonce = randomBytes(16);
    const cipher = new RescueCipher(sharedSecret);

    const ciphertext: Uint8Array[] = cipher.encrypt(words, nonce).map((arr: number[]) => Uint8Array.from(arr));
    const capsule = Buffer.concat([nonce, ...ciphertext.map((c) => Buffer.from(c))]);
    if (capsule.length !== 16 + 4 * 32) {
      throw new Error(`Serialized capsule must be 144 bytes, got ${capsule.length}`);
    }
    return capsule;
  }

  // ---------------------------------------------------------------------------

  private async assertOwnedByArcium(label: string, pubkey: PublicKey): Promise<void> {
    const arciumPid = getArciumProgAddress();
    const info = await this.provider.connection.getAccountInfo(pubkey, 'confirmed');
    if (!info) {
      throw new Error(`[${label}] account ${pubkey.toBase58()} not found on-chain.`);
    }
    if (!info.owner.equals(arciumPid)) {
      throw new Error(
        `[${label}] account ${pubkey.toBase58()} is not owned by Arcium program (${arciumPid.toBase58()}).`,
      );
    }
  }

  private toFinality(commitment?: anchor.web3.Commitment): Finality {
    if (commitment === 'processed' || commitment === 'confirmed' || commitment === 'finalized') {
      return commitment as Finality;
    }
    return 'confirmed';
  }

  public async debugPrintTx(signature: string, programId: PublicKey) {
    const tx = await this.provider.connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
    if (!tx) { this.logger.warn({ msg: 'debug.tx.null', signature }); return; }
    const msg: any = tx.transaction.message;
    const isV0 = 'compiledInstructions' in msg;
    const keys = this.allKeysFromTx(tx);
    const top = isV0 ? (msg.compiledInstructions ?? []) : (msg.instructions ?? []);
    const inner = tx.meta?.innerInstructions ?? [];

    this.logger.debug({ msg:'debug.tx.shape', signature, isV0, nKeys: keys.length, nTop: top.length, nInnerGroups: inner.length });

    let i = 0;
    for (const ix of top) {
      const pid = keys[ix.programIdIndex];
      const bytes = this.decodeIxDataString(ix.data);
      const head8 = bytes.subarray(0,8).toString('hex');
      const name = this.discHexToName(head8);
      this.logger.debug({ msg:'debug.top.ix', i: i++, pid: pid.toBase58(), len: bytes.length, head8, name: name || '(unknown)' });
    }
    for (const g of inner) {
      for (const ix of (g.instructions ?? [])) {
        const pid = keys[ix.programIdIndex];
        const bytes = this.decodeIxDataString(ix.data);
        const head8 = bytes.subarray(0,8).toString('hex');
        const name = this.discHexToName(head8);
        this.logger.debug({ msg:'debug.inner.ix', pid: pid.toBase58(), len: bytes.length, head8, name: name || '(unknown)' });
      }
    }
  }
}
