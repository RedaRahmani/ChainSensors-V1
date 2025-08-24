import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Finality } from '@solana/web3.js';
import idl from '../solana/idl.json';

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

import { randomBytes } from 'crypto';
const clientAny: any = require('@arcium-hq/client');

@Injectable()
export class ArciumService {
  private readonly logger = new Logger(ArciumService.name);
  private provider!: anchor.AnchorProvider;
  private program!: anchor.Program;
  private cachedMxePub?: Uint8Array;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = this.config.get<string>('SOLANA_RPC') || 'https://api.devnet.solana.com';

    const keypairJson = process.env.SOLANA_KEYPAIR_JSON;
    if (!keypairJson) throw new Error('SOLANA_KEYPAIR_JSON not set');

    const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairJson)));
    const wallet = new anchor.Wallet(keypair);
    const connection = new anchor.web3.Connection(rpcUrl, 'confirmed');
    this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    anchor.setProvider(this.provider);

    this.program = new anchor.Program(idl as any, this.provider);
  }

  private getAppProgramId(): PublicKey {
    const appPid = this.config.get<string>('SOLANA_PROGRAM_ID') || (idl as any)?.address;
    if (!appPid) throw new Error('SOLANA_PROGRAM_ID or idl.address is required');
    return new PublicKey(appPid);
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
   * Docs: pass `pool_account: FeePool` at address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS (Rust constant). 
   * In TS, not all client versions export a named constant. We support:
   *  1) ARCIUM_FEE_POOL_ACCOUNT / ARCIUM_FEE_POOL_ACCOUNT_ADDRESS from env (recommended).
   *  2) clientAny.getFeePoolAccAddress() (if provided by your installed version).
   *  3) clientAny.ARCIUM_FEE_POOL_ACCOUNT_ADDRESS at runtime (no compile-time import).
   * Otherwise we throw (to avoid accidentally passing the legacy StakingPool).
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

    // As a last resort, you *could* flip a flag to allow legacy fallback,
    // but this is strongly discouraged and can cause discriminator mismatches.
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

  private resolveCompDefAccount(programId: PublicKey): PublicKey {
    const envCid =
      this.config.get<string>('ARCIUM_COMP_DEF_PDA') ||
      this.config.get<string>('ARCIUM_CIRCUIT_ID');
    if (envCid) return new PublicKey(envCid);

    const compName = this.config.get<string>('ARCIUM_RESEAL_COMP_NAME') || 'reseal_dek';
    const offBytes = getCompDefAccOffset(compName);
    const idx = Buffer.from(offBytes).readUInt32LE();
    return getCompDefAccAddress(programId, idx);
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
    commitment?: anchor.web3.Commitment;
  }): Promise<{ sig: string; computationOffset: anchor.BN }> {
    const { mxeCapsule, buyerX25519Pubkey } = params;
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
    const compDefAccount = this.resolveCompDefAccount(programId);
    const arciumProgram = getArciumProgAddress();

    this.logger.log('mxeAccount    : ' + mxeAccount.toBase58());
    this.logger.log('clusterAccount: ' + clusterAccount.toBase58());
    this.logger.log('executingPool : ' + executingPool.toBase58());
    this.logger.log('feePoolAccount: ' + feePoolAccount.toBase58());
    this.logger.log('clockAccount  : ' + clockAccount.toBase58());

    // Your program-specific PDA (unchanged)
    const [jobPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('quality_job'), computationAccount.toBuffer()],
      programId,
    );

    const expectedExec = getExecutingPoolAccAddress(programId);
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
        jobPda,
        systemProgram: SystemProgram.programId,
        arciumProgram,
      })
      .rpc({ skipPreflight: false, commitment: params.commitment ?? 'confirmed' });

    // Wait for MPC completion + callback
    await awaitComputationFinalization(
      this.provider as anchor.AnchorProvider,
      computationOffset,
      programId,
      this.toFinality(params.commitment),
    );

    this.logger.log(`reseal_dek ok: ${sig} offset=${computationOffset.toString()}`);
    return { sig, computationOffset };
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
}
