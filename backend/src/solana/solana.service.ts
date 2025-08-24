import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as anchor from '@coral-xyz/anchor';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  SYSVAR_CLOCK_PUBKEY,
  SendTransactionError,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID as ATA_PROGRAM,
  TOKEN_PROGRAM_ID as TOKEN_PROGRAM,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import idl from './idl.json';
import { BN, Idl } from '@coral-xyz/anchor';

type Bytes32 = number[] | Uint8Array | string;

@Injectable()
export class SolanaService {
  // ——— fields ———
  private program: anchor.Program<Idl>;
  private provider: anchor.AnchorProvider;
  private readonly logger = new Logger(SolanaService.name);
  private readonly USDC_MINT = new PublicKey(
    process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // devnet
  );

  constructor(private configService: ConfigService) {
    const rpcUrl =
      this.configService.get<string>('SOLANA_RPC') ||
      'https://api.devnet.solana.com';

    const keypairJson = process.env.SOLANA_KEYPAIR_JSON;
    if (!keypairJson) throw new Error('SOLANA_KEYPAIR_JSON not set');
    const keypair = anchor.web3.Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(keypairJson)),
    );
    const wallet = new anchor.Wallet(keypair);
    const connection = new anchor.web3.Connection(rpcUrl, 'confirmed');
    this.provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    anchor.setProvider(this.provider);

    // NOTE: Program is constructed from IDL (which contains "address").
    // If your env provides SOLANA_PROGRAM_ID, ensure it matches the IDL to avoid mismatched PDAs.
    this.program = new anchor.Program(idl as Idl, this.provider);
  }

  // ——— utils ———
  private toBytes32(input: Bytes32, label = 'bytes32'): Uint8Array {
    let bytes: Uint8Array;
    if (typeof input === 'string') {
      const hex = input.startsWith('0x') ? input.slice(2) : input;
      if (hex.length !== 64) throw new Error(`${label} hex must be 32 bytes (64 hex chars)`);
      const arr = new Uint8Array(32);
      for (let i = 0; i < 32; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      bytes = arr;
    } else if (Array.isArray(input)) {
      bytes = Uint8Array.from(input);
    } else {
      bytes = input;
    }
    if (bytes.length !== 32) throw new Error(`${label} must be exactly 32 bytes, got ${bytes.length}`);
    return bytes;
  }

  // ——— logging helpers ———
  private deserializeSignedTx(b64: string): VersionedTransaction | Transaction {
    const raw = Buffer.from(b64, 'base64');
    try {
      return VersionedTransaction.deserialize(raw);
    } catch {
      return Transaction.from(raw);
    }
  }

  private async simulateAndLogSignedTx(signedTxBase64: string, label = 'simulation') {
    try {
      const tx = this.deserializeSignedTx(signedTxBase64);
      const sim = await this.provider.connection.simulateTransaction(tx as any, { sigVerify: true });
      const logs = sim.value.logs ?? [];
      if (logs.length) {
        this.logger.error(`=== ${label.toUpperCase()} LOGS ===\n${logs.join('\n')}`);
      } else {
        this.logger.log(`=== ${label.toUpperCase()} LOGS === (none)`);
      }
      if (sim.value.err) {
        this.logger.error(`=== ${label.toUpperCase()} ERROR === ${JSON.stringify(sim.value.err)}`);
        const friendly = this.explainAnchorErrorFromLogs(logs);
        if (friendly) this.logger.error(`=== FRIENDLY ERROR === ${friendly}`);
      } else {
        this.logger.log(`=== ${label.toUpperCase()} OK ===`);
      }
    } catch (e: any) {
      this.logger.warn(`[${label}] simulateTransaction threw: ${e?.message}`);
    }
  }

  private async logErrorWithOnchainLogs(e: any, label = 'send') {
    if (e instanceof SendTransactionError) {
      try {
        const logs = await e.getLogs(this.provider.connection);
        if (logs?.length) {
          this.logger.error(`=== ${label.toUpperCase()} PROGRAM LOGS ===\n${logs.join('\n')}`);
          const friendly = this.explainAnchorErrorFromLogs(logs);
          if (friendly) this.logger.error(`=== FRIENDLY ERROR === ${friendly}`);
        }
      } catch {}
    }
    this.logger.error(`=== ${label.toUpperCase()} RAW ERROR === ${e?.message}`);
  }

  private explainAnchorErrorFromLogs(logs?: string[] | null): string | null {
    if (!logs?.length) return null;
    const anchorLine = logs.find(l => l.includes('AnchorError'));
    if (anchorLine) return anchorLine;

    const line = logs.find(l => l.includes('custom program error: 0x'));
    if (!line) return null;

    const hex = line.split('custom program error: ')[1]?.trim();
    let code: number | null = null;
    try { code = Number.parseInt(hex, 16); } catch {}
    const errs = (idl as any)?.errors as { code: number; name: string; msg?: string }[] | undefined;
    if (!errs?.length || code == null) return `Custom program error ${hex ?? ''}`;
    const found = errs.find(e => e.code === code);
    return found ? `AnchorError ${found.name} (${code})${found.msg ? `: ${found.msg}` : ''}` : `Custom program error ${hex}`;
  }

  // ——— marketplace init ———
  async initializeMarketplace(): Promise<void> {
    const name = this.configService.get<string>('MARKETPLACE_NAME');
    const feeBpsStr = this.configService.get<string>('SELLER_FEE_BASIS');
    const usdcMintStr = this.configService.get<string>('USDC_MINT');

    if (!name || !feeBpsStr || !usdcMintStr) {
      this.logger.error(`Config missing -> NAME:${!!name}, FEE:${!!feeBpsStr}, USDC_MINT:${!!usdcMintStr}`);
      throw new Error('Marketplace config (NAME, SELLER_FEE_BASIS, USDC_MINT) missing');
    }
    const sellerFee = Number(feeBpsStr);
    const usdcMint = new PublicKey(usdcMintStr);

    const adminPubkey = this.provider.wallet.publicKey;
    const programId = this.program.programId;

    try {
      const [marketplacePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace'), adminPubkey.toBuffer()],
        programId,
      );
      // If already exists, return early
      await (this.program.account as any)['marketplace'].fetch(marketplacePda);
      this.logger.log('Marketplace already initialized at ' + marketplacePda.toBase58());
      return;
    } catch {
      // proceed
    }

    const [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), adminPubkey.toBuffer()],
      programId,
    );
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), adminPubkey.toBuffer()],
      programId,
    );

    this.logger.log('Initializing marketplace on-chain');
    try {
      const tx = await this.program.methods
        .initialize(name, sellerFee)
        .accounts({
          admin: adminPubkey,
          marketplace: marketplacePda,
          treasury: treasuryPda,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      this.logger.log(`Marketplace initialized (tx: ${tx}) at PDA ${marketplacePda.toBase58()}`);
    } catch (error: any) {
      await this.logErrorWithOnchainLogs(error, 'initialize marketplace');
      throw error;
    }
  }

  // ——— general unsigned tx builder ———
  private async buildUnsignedTx(txPromise: Promise<Transaction>, feePayer: PublicKey): Promise<string> {
    const tx = await txPromise;
    const { blockhash } = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = feePayer;
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
  }

  // ——— device register (as you had) ———
  async registerDevice(
    deviceId: string,
    ekPubkeyHash: number[],
    deviceType: string,
    location: string,
    dataType: string,
    dataUnit: string,
    pricePerUnit: number,
    totalDataUnits: number,
    dataCid: string,
    accessKeyHash: number[],
    expiresAt: number | null,
    marketplaceAdmin: PublicKey,
    sellerPubkey: PublicKey,
  ): Promise<{ unsignedTx: string }> {
    const programId = this.program.programId;

    const [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
      programId,
    );
    const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
      programId,
    );

    const unsignedTx = await this.buildUnsignedTx(
      this.program.methods
        .registerDevice(
          deviceId,
          Uint8Array.from(ekPubkeyHash) as any,
          deviceType,
          location,
          dataType,
          dataUnit,
          new BN(pricePerUnit),
          new BN(totalDataUnits),
          dataCid,
          Uint8Array.from(accessKeyHash) as any,
          expiresAt ? new BN(expiresAt) : null,
        )
        .accounts({
          owner: sellerPubkey,
          marketplace: marketplacePda,
          deviceRegistry: deviceRegistryPda,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .transaction(),
      sellerPubkey,
    );

    return { unsignedTx };
  }

  async submitSignedTransaction(signedTxBase64: string): Promise<string> {
    await this.simulateAndLogSignedTx(signedTxBase64, 'seller tx preflight');

    const raw = Buffer.from(signedTxBase64, 'base64');
    try {
      const signature = await this.provider.connection.sendRawTransaction(raw, {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      });
      await this.provider.connection.confirmTransaction(signature, 'confirmed');
      return signature;
    } catch (e: any) {
      await this.logErrorWithOnchainLogs(e, 'seller send');
      throw e;
    }
  }

  // ——— listing create (FIXED to include dek_capsule_for_mxe_cid) ———
  async buildCreateListingTransaction(args: {
    listingId: string;
    dataCid: string;
    dekCapsuleForMxeCid: string;       // NEW required by your IDL
    pricePerUnit: number;
    deviceId: string;
    totalDataUnits: number;
    expiresAt: number | null;
    sellerPubkey: PublicKey;
  }): Promise<{ unsignedTx: string }> {
    const {
      listingId,
      dataCid,
      dekCapsuleForMxeCid,
      pricePerUnit,
      deviceId,
      totalDataUnits,
      expiresAt,
      sellerPubkey,
    } = args;

    const pid = this.program.programId;
    const marketplaceAdmin = new PublicKey(this.configService.get<string>('MARKETPLACE_ADMIN_PUBKEY')!);
    const idBuf = Buffer.from(listingId, 'utf8');

    const [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
      pid,
    );
    const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
      pid,
    );
    const [listingStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), deviceRegistryPda.toBuffer(), idBuf],
      pid,
    );

    const builder = this.program.methods
      .createListing(
        listingId,
        dataCid,
        dekCapsuleForMxeCid,                // <<<<<< required by IDL
        new BN(pricePerUnit),
        deviceId,
        new BN(totalDataUnits),
        expiresAt !== null ? new BN(expiresAt) : null,
      )
      .accounts({
        seller: sellerPubkey,
        marketplace: marketplacePda,
        deviceRegistry: deviceRegistryPda,
        listingState: listingStatePda,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      });

    const unsignedTx = await this.buildUnsignedTx(builder.transaction(), sellerPubkey);
    return { unsignedTx };
  }

  async submitSignedTransactionListing(signedTxBase64: string): Promise<string> {
    await this.simulateAndLogSignedTx(signedTxBase64, 'createListing preflight');
    const raw = Buffer.from(signedTxBase64, 'base64');
    try {
      const sig = await this.provider.connection.sendRawTransaction(raw, {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      });
      await this.provider.connection.confirmTransaction(sig, 'confirmed');
      return sig;
    } catch (e: any) {
      await this.logErrorWithOnchainLogs(e, 'createListing send');
      throw e;
    }
  }

  // ——— helpers for purchase flow ———
  private async fetchListingState(
    listingStatePda: PublicKey,
  ): Promise<{ purchaseCount: BN; seller: PublicKey }> {
    const listingRaw: any = await this.program.account['listingState'].fetch(listingStatePda);
    return {
      purchaseCount: new BN(listingRaw.purchaseCount),
      seller: new PublicKey(listingRaw.seller),
    };
  }

  // ——— purchase build (return purchaseIndex too) ———
  async buildPurchaseTransaction(
    listingId: string,
    buyer: PublicKey,
    _sellerIgnored: PublicKey, // kept for API compatibility, we derive on-chain seller
    unitsRequested: number,
    deviceId: string,
    buyerEphemeralPubkey: Bytes32,
  ): Promise<{ tx: Transaction; purchaseIndex: number }> {
    const programId = this.program.programId;
    const marketplaceAdmin = new PublicKey(this.configService.get('MARKETPLACE_ADMIN_PUBKEY')!);
    const eph32 = this.toBytes32(buyerEphemeralPubkey, 'buyerEphemeralPubkey');

    const [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
      programId,
    );
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), marketplaceAdmin.toBuffer()],
      programId,
    );
    const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
      programId,
    );
    const [listingStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), deviceRegistryPda.toBuffer(), Buffer.from(listingId, 'utf8')],
      programId,
    );

    const { purchaseCount, seller: sellerOnChain } = await this.fetchListingState(listingStatePda);

    const [purchaseRecordPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('purchase'),
        listingStatePda.toBuffer(),
        purchaseCount.toArrayLike(Buffer, 'le', 8),
      ],
      programId,
    );

    const buyerAta = await getAssociatedTokenAddress(this.USDC_MINT, buyer);
    const sellerAta = await getAssociatedTokenAddress(this.USDC_MINT, sellerOnChain);
    const treasuryAta = await getAssociatedTokenAddress(this.USDC_MINT, treasuryPda, true);

    const tx = new Transaction();
    const conn = this.provider.connection;

    const [bInfo, sInfo, tInfo] = await Promise.all([
      conn.getAccountInfo(buyerAta),
      conn.getAccountInfo(sellerAta),
      conn.getAccountInfo(treasuryAta),
    ]);
    if (!bInfo)
      tx.add(createAssociatedTokenAccountInstruction(buyer, buyerAta, buyer, this.USDC_MINT, TOKEN_PROGRAM, ATA_PROGRAM));
    if (!sInfo)
      tx.add(createAssociatedTokenAccountInstruction(buyer, sellerAta, sellerOnChain, this.USDC_MINT, TOKEN_PROGRAM, ATA_PROGRAM));
    if (!tInfo)
      tx.add(createAssociatedTokenAccountInstruction(buyer, treasuryAta, treasuryPda, this.USDC_MINT, TOKEN_PROGRAM, ATA_PROGRAM));

    // *** IDL requires purchase_index (u64) ***
    const ix = await this.program.methods
      .purchaseListing(
        listingId,
        new BN(unitsRequested),
        Array.from(eph32) as any,
        purchaseCount, // <-- purchase_index from on-chain state
      )
      .accounts({
        buyer,
        buyerAta,
        marketplace: marketplacePda,
        deviceRegistry: deviceRegistryPda,
        listingState: listingStatePda,
        sellerAta,
        treasury: treasuryPda,
        treasuryAta,
        usdcMint: this.USDC_MINT,
        tokenProgram: TOKEN_PROGRAM,
        clock: SYSVAR_CLOCK_PUBKEY,
        purchaseRecord: purchaseRecordPda,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    tx.add(ix);
    tx.feePayer = buyer;
    return { tx, purchaseIndex: Number(purchaseCount) };
  }

  async prepareUnsignedPurchaseTx(args: {
    listingId: string;
    buyer: PublicKey;
    seller: PublicKey;
    unitsRequested: number;
    deviceId: string;
    buyerEphemeralPubkey: Bytes32;
  }): Promise<{ unsignedTx: string; purchaseIndex: number }> {
    const { tx, purchaseIndex } = await this.buildPurchaseTransaction(
      args.listingId,
      args.buyer,
      args.seller,
      args.unitsRequested,
      args.deviceId,
      args.buyerEphemeralPubkey,
    );
    const { blockhash } = await this.provider.connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    return {
      unsignedTx: tx.serialize({ requireAllSignatures: false }).toString('base64'),
      purchaseIndex,
    };
  }

  async submitSignedPurchaseTransaction(signedTxBase64: string): Promise<string> {
    await this.simulateAndLogSignedTx(signedTxBase64, 'purchase preflight');
    const raw = Buffer.from(signedTxBase64, 'base64');
    try {
      const sig = await this.provider.connection.sendRawTransaction(raw, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      await this.provider.connection.confirmTransaction(sig, 'confirmed');
      return sig;
    } catch (e: any) {
      await this.logErrorWithOnchainLogs(e, 'purchase send');
      throw e;
    }
  }

  // ——— finalize purchase on-chain (persist buyer capsule CID) ———
  async finalizePurchaseOnChain(params: {
    listing: PublicKey;
    record: PublicKey;
    dekCapsuleForBuyerCid: string;
  }): Promise<string> {
    const admin = this.provider.wallet.publicKey;
    const [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), admin.toBuffer()],
      this.program.programId,
    );

    try {
      const sig = await this.program.methods
        .finalizePurchase(params.dekCapsuleForBuyerCid)
        .accounts({
          authority: admin,
          marketplace: marketplacePda,
          listingState: params.listing,
          purchaseRecord: params.record,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .rpc({ commitment: 'confirmed' });

      this.logger.log(`finalize_purchase ok: ${sig} (record=${params.record.toBase58()})`);
      return sig;
    } catch (e: any) {
      await this.logErrorWithOnchainLogs(e, 'finalize_purchase');
      throw e;
    }
  }

  // ——— read purchase_record (buyer capsule CID) ———
  async getPurchaseRecordBuyerCid(recordPk: PublicKey): Promise<string | null> {
    this.logger.log(`[getPurchaseRecordBuyerCid] Fetching purchase record: ${recordPk.toBase58()}`);
    
    try {
      const acc: any = await this.program.account['purchaseRecord'].fetch(recordPk);
      
      this.logger.debug(`[getPurchaseRecordBuyerCid] Account data retrieved for ${recordPk.toBase58()}`);
      this.logger.debug(`[getPurchaseRecordBuyerCid] Account keys: ${Object.keys(acc || {}).join(', ')}`);
      
      const buyerCid = acc?.dekCapsuleForBuyerCid || null;
      
      if (buyerCid) {
        this.logger.log(`[getPurchaseRecordBuyerCid] Found buyer CID: ${buyerCid.substring(0, 20)}...`);
      } else {
        this.logger.warn(`[getPurchaseRecordBuyerCid] No dekCapsuleForBuyerCid found in record ${recordPk.toBase58()}`);
        this.logger.debug(`[getPurchaseRecordBuyerCid] Available fields: ${JSON.stringify(acc, null, 2)}`);
      }
      
      return buyerCid;
    } catch (error: any) {
      this.logger.error(`[getPurchaseRecordBuyerCid] Failed to fetch purchase record ${recordPk.toBase58()}: ${error?.message}`);
      if (error?.stack) {
        this.logger.debug(`[getPurchaseRecordBuyerCid] Error stack: ${error.stack}`);
      }
      throw error;
    }
  }

  // ——— event helpers (for backend listeners) ———
  addPurchaseFinalizedListener(handler: (ev: any) => void | Promise<void>): Promise<number> {
    return Promise.resolve(this.program.addEventListener('PurchaseFinalized' as any, handler));
  }
  async removeEventListener(id: number) {
    await this.program.removeEventListener(id);
  }

  /**
   * Returns purchases for a buyer by scanning on-chain purchaseRecord accounts
   * and joining minimal listing info for the UI.
   * Ensures listingId/deviceId/dataCid are decoded to UTF-8 strings.
   */
  async getPurchasesByBuyer(buyer: PublicKey) {
    const toUtf8 = (x: any): string | null => {
      if (x == null) return null;
      if (typeof x === 'string') return x;
      try {
        if (x instanceof Uint8Array) return Buffer.from(x).toString('utf8').replace(/\0+$/,'');
        if (Array.isArray(x))       return Buffer.from(Uint8Array.from(x)).toString('utf8').replace(/\0+$/,'');
      } catch {}
      return null;
    };
    const toNumber = (x: any): number | null => {
      if (x == null) return null;
      if (typeof x === 'number') return x;
      try {
        if (typeof x === 'object' && x !== null) {
          if ('toNumber' in x && typeof x.toNumber === 'function') return x.toNumber();
          if ('toString' in x && typeof x.toString === 'function') {
            const n = Number(x.toString());
            return Number.isFinite(n) ? n : null;
          }
        }
        const n = Number(x);
        return Number.isFinite(n) ? n : null;
      } catch { return null; }
    };
    const toU8 = (x: any): Uint8Array | null => {
      try {
        if (x instanceof Uint8Array) return x;
        if (Array.isArray(x)) return Uint8Array.from(x);
        return null;
      } catch { return null; }
    };
    const b64 = (u8: Uint8Array | null) => u8 ? Buffer.from(u8).toString('base64') : null;

    const all: Array<{ publicKey: PublicKey; account: any }> =
      await (this.program.account as any)['purchaseRecord'].all();
    const mine = all.filter((p) => new PublicKey(p.account.buyer).equals(buyer));

    const out = [];
    for (const pr of mine) {
      const recordPk = pr.publicKey;
      const acc = pr.account;

      // Try joining listing state
      let listingMeta: any = null;
      let listingId: string | null = null;
      let deviceId: string | null = null;
      let dataCid: string | null = null;
      let pricePerUnit: number | null = null;
      let expiresAt: number | null = null;
      let seller: string | null = null;
      try {
        // 👇 tolerate both field names
        const listingStatePk = new PublicKey((acc as any).listingState ?? (acc as any).listing);
        listingMeta = await (this.program.account as any)['listingState'].fetch(listingStatePk);
        listingId    = toUtf8(listingMeta?.listingId ?? listingMeta?.listing_id ?? listingMeta?.id);
        deviceId     = toUtf8(listingMeta?.deviceId  ?? listingMeta?.device_id);
        dataCid      = toUtf8(listingMeta?.dataCid   ?? listingMeta?.data_cid);
        pricePerUnit = toNumber(listingMeta?.pricePerUnit ?? listingMeta?.price_per_unit);
        expiresAt    = toNumber(listingMeta?.expiresAt    ?? listingMeta?.expires_at);
        seller       = (() => {
          const s = listingMeta?.seller ?? listingMeta?.sellerPubkey ?? listingMeta?.seller_pubkey;
          try { return s ? new PublicKey(s).toBase58() : null; } catch { return null; }
        })();
      } catch { /* best effort */ }

      // Buyer ephemeral pubkey (good to expose for manual reseals)
      const buyerEph = toU8(acc?.buyerEphemeralPubkey ?? acc?.buyerX25519Pubkey ?? acc?.buyer_ephemeral_pubkey);
      const buyerEphemeralPubkeyB64 = b64(buyerEph);

      out.push({
        recordPk: recordPk.toBase58(),
        buyer: buyer.toBase58(),
        units: toNumber(acc?.units) ?? 0,
        purchaseIndex: toNumber(acc?.purchaseIndex) ?? 0,
        createdAt: toNumber(acc?.createdAt),
        dekCapsuleForBuyerCid: acc?.dekCapsuleForBuyerCid ?? null,
        txSignature: acc?.txSignature ?? null,
        listingState: (acc?.listingState || acc?.listing) ? new PublicKey(acc.listingState ?? acc.listing).toBase58() : null,
        listingId,
        deviceId,
        dataCid,
        pricePerUnit,
        expiresAt,
        seller,
        deviceMetadata: listingMeta?.deviceMetadata ?? null,

        // helpful for manual reseal
        buyerEphemeralPubkeyB64,
      });
    }
    this.logger.log(`getPurchasesByBuyer(${buyer.toBase58()}) -> ${out.length} rows`);

    return out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }


/** Light read of purchaseRecord for controller use (tolerates older field names) */
async getPurchaseRecordLight(recordPk: PublicKey): Promise<{
  listingState: PublicKey;
  buyerEphemeralPubkey: Uint8Array;
  purchaseIndex: number;
}> {
  const acc: any = await (this.program.account as any)['purchaseRecord'].fetch(recordPk);

  const tryPub = (v: any): PublicKey | null => {
    try {
      if (!v) return null;
      if (v instanceof PublicKey) return v;
      if (typeof v === 'string') return new PublicKey(v);
      if (v instanceof Uint8Array) return new PublicKey(v);
      if (Array.isArray(v)) return new PublicKey(Uint8Array.from(v));
      if (typeof v?.toBytes === 'function') return new PublicKey(v.toBytes());
      return null;
    } catch {
      return null;
    }
  };

  const toUtf8 = (x: any): string | null => {
    if (x == null) return null;
    if (typeof x === 'string') return x.replace(/\0+$/, '');
    try {
      if (x instanceof Uint8Array) return Buffer.from(x).toString('utf8').replace(/\0+$/, '');
      if (Array.isArray(x))       return Buffer.from(Uint8Array.from(x)).toString('utf8').replace(/\0+$/, '');
    } catch {}
    return null;
  };

  // 1) Listing pointer — support multiple legacy names; derive as a fallback
  let listingStatePk: PublicKey | null =
    tryPub(acc.listingState) ||
    tryPub(acc.listing_state) ||
    tryPub(acc.listing) ||
    tryPub(acc.listingPda) ||
    tryPub(acc.listing_pk);

  // Optional fallback: derive from deviceRegistry + listingId if present
  if (!listingStatePk) {
    const deviceRegistry = tryPub(acc.deviceRegistry) || tryPub(acc.device_registry);
    const listingIdStr = toUtf8(acc.listingId ?? acc.listing_id ?? acc.id);
    if (deviceRegistry && listingIdStr) {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), deviceRegistry.toBuffer(), Buffer.from(listingIdStr, 'utf8')],
        this.program.programId,
      );
      listingStatePk = pda;
    }
  }

  if (!listingStatePk) {
    throw new Error(
      'purchaseRecord is missing a listing pointer (tried listingState/listing/etc., and PDA fallback)',
    );
  }

  // 2) Buyer ephemeral X25519 pubkey (supports legacy names)
  const ephRaw =
    acc?.buyerEphemeralPubkey ??
    acc?.buyer_ephemeral_pubkey ??
    acc?.buyerX25519Pubkey ??
    acc?.buyer_x25519_pubkey;
  const buyerEphemeralPubkey =
    ephRaw instanceof Uint8Array ? ephRaw : Array.isArray(ephRaw) ? Uint8Array.from(ephRaw) : null;

  if (!buyerEphemeralPubkey || buyerEphemeralPubkey.length !== 32) {
    throw new Error('purchaseRecord missing/invalid buyer ephemeral pubkey (expected 32 bytes)');
  }

  // 3) Purchase index in many shapes
  const piRaw = acc?.purchaseIndex ?? acc?.purchase_index ?? acc?.index ?? 0;
  const purchaseIndex =
    typeof piRaw?.toNumber === 'function' ? piRaw.toNumber()
      : typeof piRaw?.toString === 'function' ? Number(piRaw.toString())
      : Number(piRaw || 0);

  return { listingState: listingStatePk, buyerEphemeralPubkey, purchaseIndex };
}


/** Read listingState to obtain ids and the MXE capsule CID */
async getListingStateInfo(listingPk: PublicKey): Promise<{
  listingId: string | null;
  deviceId: string | null;
  dataCid: string | null;
  dekCapsuleForMxeCid: string | null;
  pricePerUnit: number | null;
  expiresAt: number | null;
  seller: string | null;
}> {
  const toUtf8 = (x: any): string | null => {
    if (x == null) return null;
    if (typeof x === 'string') return x.replace(/\0+$/, '');
    try {
      if (x instanceof Uint8Array) return Buffer.from(x).toString('utf8').replace(/\0+$/, '');
      if (Array.isArray(x))       return Buffer.from(Uint8Array.from(x)).toString('utf8').replace(/\0+$/, '');
    } catch {}
    return null;
  };
  const toNumber = (x: any): number | null => {
    if (x == null) return null;
    if (typeof x === 'number') return x;
    try {
      if (typeof x === 'object' && x !== null) {
        if ('toNumber' in x && typeof x.toNumber === 'function') return x.toNumber();
        if ('toString' in x && typeof x.toString === 'function') {
          const n = Number(x.toString()); return Number.isFinite(n) ? n : null;
        }
      }
      const n = Number(x); return Number.isFinite(n) ? n : null;
    } catch { return null; }
  };

  const acc: any = await (this.program.account as any)['listingState'].fetch(listingPk);
  const sellerPkRaw = acc?.seller ?? acc?.sellerPubkey ?? acc?.seller_pubkey ?? null;

  return {
    listingId: toUtf8(acc?.listingId ?? acc?.listing_id ?? acc?.id),
    deviceId: toUtf8(acc?.deviceId ?? acc?.device_id),
    dataCid: toUtf8(acc?.dataCid ?? acc?.data_cid),
    dekCapsuleForMxeCid: toUtf8(acc?.dekCapsuleForMxeCid ?? acc?.dek_capsule_for_mxe_cid),
    pricePerUnit: toNumber(acc?.pricePerUnit ?? acc?.price_per_unit),
    expiresAt: toNumber(acc?.expiresAt ?? acc?.expires_at),
    seller: (() => {
      try { return sellerPkRaw ? new PublicKey(sellerPkRaw).toBase58() : null; } catch { return null; }
    })(),
  };
}

}
