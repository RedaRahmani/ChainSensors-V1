// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as anchor from '@coral-xyz/anchor';
// import {
//   PublicKey,
//   SystemProgram,
//   SYSVAR_RENT_PUBKEY,
//   Transaction,
//   SYSVAR_CLOCK_PUBKEY,
//   SendTransactionError,
//   VersionedTransaction,
// } from '@solana/web3.js';
// import {
//   ASSOCIATED_TOKEN_PROGRAM_ID,
//   TOKEN_PROGRAM_ID,
//   createAssociatedTokenAccountInstruction,
//   getAssociatedTokenAddress,
//   getAssociatedTokenAddressSync,
// } from '@solana/spl-token';
// import idl from './idl.json';
// import { BN, Idl } from '@coral-xyz/anchor';
// type Bytes32 = number[] | Uint8Array | string;;

// @Injectable()
// export class SolanaService {
//   fetchAllBySeed(
//     programId: anchor.web3.PublicKey,
//     arg1: Buffer<ArrayBuffer>,
//     arg2: anchor.web3.PublicKey,
//   ) {
//     throw new Error('Method not implemented.');
//   }
//   private program: anchor.Program<Idl>;
//   private provider: anchor.AnchorProvider;
//   private readonly logger = new Logger(SolanaService.name);
//   private readonly USDC_MINT = new PublicKey(
//     '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
//   ); // USDC mint (devnet)
//   private readonly TOKEN_PROGRAM_ID = new PublicKey(
//     'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
//   );
//   private readonly ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
//     'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
//   );

//   constructor(private configService: ConfigService) {
//     const rpcUrl =
//       this.configService.get<string>('SOLANA_RPC') ||
//       'https://api.devnet.solana.com';
//     const keypairJson = process.env.SOLANA_KEYPAIR_JSON;
//     if (!keypairJson) throw new Error('SOLANA_KEYPAIR_JSON not set');
//     const keypair = anchor.web3.Keypair.fromSecretKey(
//       Uint8Array.from(JSON.parse(keypairJson)),
//     );
//     const wallet = new anchor.Wallet(keypair);
//     const connection = new anchor.web3.Connection(rpcUrl, 'confirmed');
//     this.provider = new anchor.AnchorProvider(connection, wallet, {
//       commitment: 'confirmed',
//     });
//     anchor.setProvider(this.provider);

//     const programIdStr = this.configService.get<string>('SOLANA_PROGRAM_ID');
//     if (!programIdStr) throw new Error('SOLANA_PROGRAM_ID not set');
//     this.program = new anchor.Program(idl as Idl, this.provider);
//   }

//   private toBytes32(input: Bytes32, label = 'bytes32'): Uint8Array {
//     let bytes: Uint8Array;
//     if (typeof input === 'string') {
//       const hex = input.startsWith('0x') ? input.slice(2) : input;
//       if (hex.length !== 64) throw new Error(`${label} hex must be 32 bytes (64 hex chars)`);
//       const arr = new Uint8Array(32);
//       for (let i = 0; i < 32; i++) {
//         arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
//       }
//       bytes = arr;
//     } else if (Array.isArray(input)) {
//       bytes = Uint8Array.from(input);
//     } else {
//       bytes = input;
//     }
//     if (bytes.length !== 32) throw new Error(`${label} must be exactly 32 bytes, got ${bytes.length}`);
//     return bytes;
//   }

//   // -------------------------
//   // LOGGING HELPERS (backend)
//   // -------------------------

//   /** Try to deserialize a base64 signed tx as v0 first, then legacy. */
//   private deserializeSignedTx(b64: string): VersionedTransaction | Transaction {
//     const raw = Buffer.from(b64, 'base64');
//     // Try v0
//     try {
//       return VersionedTransaction.deserialize(raw);
//     } catch {
//       // Fallback to legacy
//       return Transaction.from(raw);
//     }
//   }

//   /** Simulate a signed tx (without changing behavior) and dump validator logs + friendly Anchor error. */
//   private async simulateAndLogSignedTx(signedTxBase64: string, label = 'simulation') {
//     try {
//       const tx = this.deserializeSignedTx(signedTxBase64);
//       const sim = await this.provider.connection.simulateTransaction(tx as any, { sigVerify: true });
//       const logs = sim.value.logs ?? [];
//       if (logs.length) {
//         this.logger.error(`=== ${label.toUpperCase()} LOGS ===\n${logs.join('\n')}`);
//       } else {
//         this.logger.log(`=== ${label.toUpperCase()} LOGS === (none)`);
//       }
//       if (sim.value.err) {
//         this.logger.error(`=== ${label.toUpperCase()} ERROR === ${JSON.stringify(sim.value.err)}`);
//         const friendly = this.explainAnchorErrorFromLogs(logs);
//         if (friendly) this.logger.error(`=== FRIENDLY ERROR === ${friendly}`);
//       } else {
//         this.logger.log(`=== ${label.toUpperCase()} OK ===`);
//       }
//     } catch (e: any) {
//       this.logger.warn(`[${label}] simulateTransaction threw: ${e?.message}`);
//     }
//   }

//   /** When sendRawTransaction throws, print logs and friendly Anchor error if present. */
//   private async logErrorWithOnchainLogs(e: any, label = 'send') {
//     if (e instanceof SendTransactionError) {
//       try {
//         const logs = await e.getLogs(this.provider.connection);
//         if (logs?.length) {
//           this.logger.error(`=== ${label.toUpperCase()} PROGRAM LOGS ===\n${logs.join('\n')}`);
//           const friendly = this.explainAnchorErrorFromLogs(logs);
//           if (friendly) this.logger.error(`=== FRIENDLY ERROR === ${friendly}`);
//         }
//       } catch (inner: any) {
//         this.logger.warn(`[${label}] getLogs failed: ${inner?.message}`);
//       }
//     }
//     this.logger.error(`=== ${label.toUpperCase()} RAW ERROR === ${e?.message}`);
//   }

//   /** Extract custom program error code (hex) from logs and map via IDL. */
//   private explainAnchorErrorFromLogs(logs?: string[] | null): string | null {
//     if (!logs || !logs.length) return null;

//     // 1) Anchor explicit line (sometimes present)
//     const anchorLine = logs.find(l => l.includes('AnchorError'));
//     if (anchorLine) return anchorLine;

//     // 2) Custom program error hex code
//     const line = logs.find(l => l.includes('custom program error: 0x'));
//     if (!line) return null;

//     const hex = line.split('custom program error: ')[1]?.trim();
//     if (!hex) return null;
//     let code: number | null = null;
//     try { code = Number.parseInt(hex, 16); } catch { code = null; }
//     if (code == null) return null;

//     const errs = (idl as any)?.errors as { code: number; name: string; msg?: string }[] | undefined;
//     if (!errs?.length) return `Custom program error ${hex} (${code})`;

//     const found = errs.find(e => e.code === code);
//     if (!found) return `Custom program error ${hex} (${code})`;
//     return `AnchorError ${found.name} (${code})${found.msg ? `: ${found.msg}` : ''}`;
//   }

//   // -------------------------

//   async initializeMarketplace(): Promise<void> {
//     const name = this.configService.get<string>('MARKETPLACE_NAME');
//     const feeBpsStr = this.configService.get<string>('SELLER_FEE_BASIS');
//     const usdcMintStr = this.configService.get<string>('USDC_MINT');
//     if (!name || !feeBpsStr || !usdcMintStr) {
//       this.logger.error(
//         `Config missing -> NAME:${!!name}, FEE:${!!feeBpsStr}, USDC_MINT:${!!usdcMintStr}`,
//       );
//       throw new Error('Marketplace config (NAME, SELLER_FEE_BASIS, USDC_MINT) missing');
//     }
//     const sellerFee = Number(feeBpsStr);
//     const usdcMint = new PublicKey(usdcMintStr);

//     // Snapshot current admin + program
//     const adminPubkey = this.provider.wallet.publicKey;
//     const programId = this.program.programId;
//     this.logger.log(`[init] Starting initializeMarketplace()`);
//     this.logger.log(`[init] Using existing provider wallet (admin): ${adminPubkey.toBase58()}`);
//     this.logger.log(`[init] Current programId from this.program: ${programId.toBase58()}`);
//     this.logger.log(`[init] USDC mint: ${usdcMint.toBase58()}`);
//     // If your IDL has an address, log it for mismatch debugging
//     try {
//       const idlAddr = (idl as any)?.address ?? (idl as any)?.metadata?.address;
//       if (idlAddr) {
//         this.logger.log(`[init] IDL address: ${idlAddr}`);
//         if (idlAddr !== programId.toBase58()) {
//           this.logger.warn(`[init] WARNING: IDL address != this.program.programId`);
//         }
//       }
//     } catch {}

//     const [marketplacePda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('marketplace'), adminPubkey.toBuffer()],
//       programId,
//     );
//     const [treasuryPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('treasury'), adminPubkey.toBuffer()],
//       programId,
//     );
//     this.logger.log(`[init] Derived PDAs (with current admin & programId):`);
//     this.logger.log(`       marketplacePda: ${marketplacePda.toBase58()}`);
//     this.logger.log(`       treasuryPda:    ${treasuryPda.toBase58()}`);

//     try {
//       this.logger.log(`[init] Fetching existing marketplace account…`);
//       await (this.program.account as any)['marketplace'].fetch(marketplacePda);
//       this.logger.log('Marketplace already initialized at ' + marketplacePda.toBase58());
//       return;
//     } catch (e: any) {
//       this.logger.log(`Marketplace not found, proceeding with initialization. fetch error: ${e?.message}`);
//     }

//     this.logger.log('Initializing marketplace on-chain');
//     // Solana RPC fallback logic
//     const rpcList = [
//       this.configService.get<string>('SOLANA_RPC'),
//       'https://api.devnet.solana.com',
//       'https://api.helius.xyz/v0/solana',
//       'https://api.mainnet-beta.solana.com',
//     ].filter(Boolean);

//     this.logger.log(`[init] RPCs to try (in order): ${rpcList.join(', ')}`);

//     let initialized = false;
//     let lastError = null;

//     for (const rpc of rpcList) {
//       this.logger.log(`\n[init] ===== Attempting on RPC: ${rpc} =====`);
//       try {
//         // Re-instantiate provider/program with new RPC
//         const keypairJson = process.env.SOLANA_KEYPAIR_JSON;
//         if (!keypairJson) {
//           this.logger.error('[init] SOLANA_KEYPAIR_JSON is missing or empty.');
//         }
//         const secretBytes = keypairJson ? Uint8Array.from(JSON.parse(keypairJson)) : undefined;
//         this.logger.log(`[init] Keypair bytes present: ${!!secretBytes}`);

//         const keypair = anchor.web3.Keypair.fromSecretKey(secretBytes as Uint8Array);
//         const wallet = new anchor.Wallet(keypair);
//         const connection = new anchor.web3.Connection(rpc, 'confirmed');
//         this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
//         anchor.setProvider(this.provider);

//         // NOTE: we keep your Program construction exactly as-is
//         this.program = new anchor.Program(idl as Idl, this.provider);

//         // Log identities now in-use
//         const signerNow = this.provider.wallet.publicKey;
//         const programIdNow = this.program.programId;
//         this.logger.log(`[init] Provider wallet (signer) now: ${signerNow.toBase58()}`);
//         this.logger.log(`[init] ProgramId now (from Program): ${programIdNow.toBase58()}`);

//         // Detect seed/signing mismatches (just a log, no behavior change)
//         if (signerNow.toBase58() !== adminPubkey.toBase58()) {
//           this.logger.warn(
//             `[init] WARNING: PDA seeds used admin=${adminPubkey.toBase58()} but tx will be signed by ${signerNow.toBase58()}`,
//           );
//         }
//         if (programIdNow.toBase58() !== programId.toBase58()) {
//           this.logger.warn(
//             `[init] WARNING: PDA seeds used programId=${programId.toBase58()} but Program now uses ${programIdNow.toBase58()}`,
//           );
//         }

//         this.logger.log(`[init] Sending initialize()…`);
//         this.logger.log(
//           `[init] Accounts -> admin:${adminPubkey.toBase58()}, marketplace:${marketplacePda.toBase58()}, treasury:${treasuryPda.toBase58()}, usdcMint:${usdcMint.toBase58()}`,
//         );

//         const tx = await this.program.methods
//           .initialize(name, sellerFee)
//           .accounts({
//             admin: adminPubkey,
//             marketplace: marketplacePda,
//             treasury: treasuryPda,
//             usdcMint,
//             tokenProgram: TOKEN_PROGRAM_ID,
//             systemProgram: SystemProgram.programId,
//             rent: SYSVAR_RENT_PUBKEY,
//           })
//           .rpc();

//         this.logger.log(
//           `Marketplace initialized (tx: ${tx}) at PDA ${marketplacePda.toBase58()} using RPC ${rpc}`,
//         );

//         // Post-check: try fetching the account immediately
//         try {
//           const acct = await (this.program.account as any)['marketplace'].fetch(marketplacePda);
//           this.logger.log(
//             `[init] Post-check fetch OK. Marketplace owner: ${acct?.admin?.toBase58?.() ?? 'n/a'}; name: ${acct?.name ?? 'n/a'}`,
//           );
//         } catch (postErr: any) {
//           this.logger.warn(`[init] Post-check fetch failed: ${postErr?.message}`);
//         }

//         initialized = true;
//         break;
//       } catch (error: any) {
//         this.logger.warn(`[init] Marketplace initialization failed on RPC ${rpc}: ${error?.message}`);
//         if (error?.logs) this.logger.warn(`[init] On-chain logs:\n${(error.logs || []).join('\n')}`);
//         if (error?.stack) this.logger.debug(error.stack);
//         lastError = error;
//       }
//     }

//     if (!initialized) {
//       this.logger.warn(
//         `Marketplace initialization failed on all RPCs - continuing without marketplace: ${lastError?.message}`,
//       );
//       // Continue without crashing the app
//     }
//   }

//   private async buildUnsignedTx(
//     txPromise: Promise<Transaction>,
//     feePayer: PublicKey,
//   ): Promise<string> {
//     const tx = await txPromise;
//     const { blockhash } = await this.provider.connection.getLatestBlockhash();
//     tx.recentBlockhash = blockhash;
//     tx.feePayer = feePayer;
//     const serialized = tx.serialize({
//       requireAllSignatures: false,
//       verifySignatures: false,
//     });
//     return serialized.toString('base64');
//   }

//   async registerDevice(
//     deviceId: string,
//     ekPubkeyHash: number[],
//     deviceType: string,
//     location: string,
//     dataType: string,
//     dataUnit: string,
//     pricePerUnit: number,
//     totalDataUnits: number,
//     dataCid: string,
//     accessKeyHash: number[],
//     expiresAt: number | null,
//     marketplaceAdmin: PublicKey,
//     sellerPubkey: PublicKey,
//   ): Promise<{ unsignedTx: string }> {
//     const programId = this.program.programId;

//     const [marketplacePda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
//       programId,
//     );
//     console.log('this is marketplace pda:', marketplacePda);
//     const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
//       programId,
//     );
//     console.log('this is device registry pda:', deviceRegistryPda);

//     this.logger.debug(
//       `Building registerDevice tx for ${deviceId} (dataCid=${dataCid})`,
//     );

//     const unsignedTx = await this.buildUnsignedTx(
//       this.program.methods
//         .registerDevice(
//           deviceId,
//           Uint8Array.from(ekPubkeyHash) as any,
//           deviceType,
//           location,
//           dataType,
//           dataUnit,
//           new anchor.BN(pricePerUnit),
//           new anchor.BN(totalDataUnits),
//           dataCid,
//           Uint8Array.from(accessKeyHash) as any,
//           expiresAt ? new anchor.BN(expiresAt) : null,
//         )
//         .accounts({
//           owner: sellerPubkey,
//           marketplace: marketplacePda,
//           deviceRegistry: deviceRegistryPda,
//           systemProgram: SystemProgram.programId,
//           rent: SYSVAR_RENT_PUBKEY,
//         })
//         .transaction(),
//       sellerPubkey,
//     );

//     this.logger.log(`Built unsigned registerDevice tx for ${deviceId}`);
//     this.logger.log(`this is unsigned registerDevice tx : ${unsignedTx}`);
//     return { unsignedTx };
//   }

//   /**
//    * Phase 2: Submit a seller-signed transaction.
//    * (Added: simulation + program logs on failure)
//    */
//   async submitSignedTransaction(signedTxBase64: string): Promise<string> {
//     this.logger.log('[submitSignedTransaction] starting');
//     await this.simulateAndLogSignedTx(signedTxBase64, 'seller tx preflight');

//     const raw = Buffer.from(signedTxBase64, 'base64');
//     this.logger.debug(`[submitSignedTransaction] raw len=${raw.length}`);

//     try {
//       const signature = await this.provider.connection.sendRawTransaction(raw, {
//         skipPreflight: true,
//         preflightCommitment: 'confirmed',
//       });
//       await this.provider.connection.confirmTransaction(signature, 'confirmed');
//       this.logger.log(`[submitSignedTransaction] Submitted & confirmed tx ${signature}`);
//       return signature;
//     } catch (e: any) {
//       await this.logErrorWithOnchainLogs(e, 'seller send');
//       throw e;
//     }
//   }

//   private async buildUnsignedTxListing(
//     txPromise: Promise<Transaction>,
//     feePayer: PublicKey,
//   ): Promise<string> {
//     const tx = await txPromise;
//     const { blockhash } = await this.provider.connection.getLatestBlockhash();
//     tx.recentBlockhash = blockhash;
//     tx.feePayer = feePayer;
//     return tx
//       .serialize({ requireAllSignatures: false, verifySignatures: false })
//       .toString('base64');
//   }

//   async buildCreateListingTransaction(args: {
//     listingId: string;
//     dataCid: string;
//     pricePerUnit: number;
//     deviceId: string;
//     totalDataUnits: number;
//     expiresAt: number | null;
//     sellerPubkey: PublicKey;
//   }): Promise<{ unsignedTx: string }> {
//     const {
//       listingId,
//       dataCid,
//       pricePerUnit,
//       deviceId,
//       totalDataUnits,
//       expiresAt,
//       sellerPubkey,
//     } = args;
//     const pid = this.program.programId;
//     const marketplaceAdmin = new PublicKey(
//       this.configService.get<string>('MARKETPLACE_ADMIN_PUBKEY')!,
//     );
//     const idBuf = Buffer.from(listingId, 'utf8');

//     // PDAs
//     const [marketplacePda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
//       pid,
//     );
//     const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
//       pid,
//     );
//     const [listingStatePda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('listing'), deviceRegistryPda.toBuffer(), idBuf],
//       pid,
//     );

//     this.logger.debug('[createListing] PDAs: ' +
//       JSON.stringify({
//         marketplacePda: marketplacePda.toBase58(),
//         deviceRegistryPda: deviceRegistryPda.toBase58(),
//         listingStatePda: listingStatePda.toBase58(),
//       }, null, 2)
//     );

//     // Build the instruction
//     const builder = this.program.methods
//       .createListing(
//         listingId,
//         dataCid,
//         new BN(pricePerUnit),
//         deviceId,
//         new BN(totalDataUnits),
//         expiresAt !== null ? new BN(expiresAt) : null,
//       )
//       .accounts({
//         seller: sellerPubkey,
//         marketplace: marketplacePda,
//         deviceRegistry: deviceRegistryPda,
//         listingState: listingStatePda,
//         systemProgram: SystemProgram.programId,
//         rent: SYSVAR_RENT_PUBKEY,
//       });

//     // Optional debug
//     this.logger.debug(
//       'IDL args:',
//       this.program.idl.instructions.find((i) => i.name === 'createListing')
//         ?.args,
//     );
//     this.logger.debug('Call values:', [
//       listingId,
//       dataCid,
//       pricePerUnit,
//       deviceId,
//       totalDataUnits,
//       expiresAt,
//     ]);

//     // Serialize unsigned transaction
//     const txPromise = builder.transaction();
//     const unsignedTx = await this.buildUnsignedTxListing(
//       txPromise,
//       sellerPubkey,
//     );
//     this.logger.log(`Built unsigned createListing tx`);
//     return { unsignedTx };
//   }

//   async submitSignedTransactionListing(
//     signedTxBase64: string,
//   ): Promise<string> {
//     this.logger.log('[submitSignedTransactionListing] starting');
//     await this.simulateAndLogSignedTx(signedTxBase64, 'createListing preflight');

//     const raw = Buffer.from(signedTxBase64, 'base64');
//     try {
//       // Skip the preflight simulation to avoid "already processed" errors:
//       const sig = await this.provider.connection.sendRawTransaction(raw, {
//         skipPreflight: true,
//         preflightCommitment: 'confirmed',
//       });

//       await this.provider.connection.confirmTransaction(sig, 'confirmed');
//       this.logger.log(`Listing tx confirmed: ${sig}`);
//       return sig;
//     } catch (e: any) {
//       await this.logErrorWithOnchainLogs(e, 'createListing send');
//       throw e;
//     }
//   }

//   private async fetchListingState(
//     listingStatePda: PublicKey,
//   ): Promise<{ purchaseCount: BN; seller: PublicKey }> {
//     const listingRaw: any = await this.program.account['listingState'].fetch(listingStatePda);
//     // Anchor returns a Pubkey-like object; coerce to PublicKey
//     const seller = new PublicKey(listingRaw.seller);
//     return {
//       purchaseCount: new BN(listingRaw.purchaseCount),
//       seller,
//     };
//   }

//   /** Builds an unsigned purchase tx (does *not* sign) */
//   /** Builds an unsigned purchase tx (does *not* sign) */
//   async buildPurchaseTransaction(
//     listingId: string,
//     buyer: PublicKey,
//     seller: PublicKey,                // <-- keep param for API compatibility, but we will IGNORE it
//     unitsRequested: number,
//     deviceId: string,
//     buyerEphemeralPubkey: Bytes32,
//   ): Promise<{ tx: Transaction }> {
//     const programId = this.program.programId;
//     const marketplaceAdmin = new PublicKey(this.configService.get('MARKETPLACE_ADMIN_PUBKEY')!);

//     const unitsBN = new BN(unitsRequested);
//     const eph32 = this.toBytes32(buyerEphemeralPubkey, 'buyerEphemeralPubkey');

//     // PDAs (unchanged)
//     const [marketplacePda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
//       programId,
//     );
//     const [treasuryPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('treasury'), marketplaceAdmin.toBuffer()],
//       programId,
//     );
//     const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
//       programId,
//     );
//     const [listingStatePda] = PublicKey.findProgramAddressSync(
//       [Buffer.from('listing'), deviceRegistryPda.toBuffer(), Buffer.from(listingId, 'utf8')],
//       programId,
//     );

//     // *** IMPORTANT: fetch on-chain state to get the canonical seller ***
//     const { purchaseCount, seller: sellerFromState } = await this.fetchListingState(listingStatePda);

//     // Log PDAs and on-chain snapshot to catch mismatches
//     this.logger.debug('[purchase] PDAs: ' +
//       JSON.stringify({
//         marketplacePda: marketplacePda.toBase58(),
//         treasuryPda: treasuryPda.toBase58(),
//         deviceRegistryPda: deviceRegistryPda.toBase58(),
//         listingStatePda: listingStatePda.toBase58(),
//         purchaseRecordIndex: purchaseCount.toString(),
//         sellerOnChain: sellerFromState.toBase58(),
//         buyer: buyer.toBase58(),
//       }, null, 2)
//     );

//     // Also log raw account size of listing_state (helps detect "account too small" issues)
//     try {
//       const acct = await this.provider.connection.getAccountInfo(listingStatePda);
//       this.logger.debug(`[purchase] listing_state account size = ${acct?.data?.length ?? 'null'} bytes`);
//       this.logger.debug(`[purchase] listing_state owner = ${acct?.owner?.toBase58?.() ?? 'unknown'}`);
//     } catch (e: any) {
//       this.logger.warn(`[purchase] getAccountInfo(listing_state) failed: ${e?.message}`);
//     }

//     // purchase_record PDA (unchanged)
//     const [purchaseRecordPda] = PublicKey.findProgramAddressSync(
//       [
//         Buffer.from('purchase'),
//         listingStatePda.toBuffer(),
//         purchaseCount.toArrayLike(Buffer, 'le', 8),
//       ],
//       programId,
//     );

//     // ATAs – derive using the **on-chain** seller
//     const buyerAta = await getAssociatedTokenAddress(this.USDC_MINT, buyer);
//     const sellerAta = await getAssociatedTokenAddress(this.USDC_MINT, sellerFromState);  // <-- on-chain seller
//     const treasuryAta = await getAssociatedTokenAddress(this.USDC_MINT, treasuryPda, true);

//     // Log ATAs and whether they exist
//     try {
//       const [bInfo, sInfo, tInfo] = await Promise.all([
//         this.provider.connection.getAccountInfo(buyerAta),
//         this.provider.connection.getAccountInfo(sellerAta),
//         this.provider.connection.getAccountInfo(treasuryAta),
//       ]);
//       this.logger.debug('[purchase] ATAs: ' + JSON.stringify({
//         buyerAta: buyerAta.toBase58(),
//         buyerAtaExists: !!bInfo,
//         sellerAta: sellerAta.toBase58(),
//         sellerAtaExists: !!sInfo,
//         treasuryAta: treasuryAta.toBase58(),
//         treasuryAtaExists: !!tInfo,
//       }, null, 2));
//     } catch (e: any) {
//       this.logger.warn(`[purchase] getAccountInfo(ATAs) failed: ${e?.message}`);
//     }

//     const tx = new Transaction();

//     // Create missing ATAs (payer = buyer keeps single-signer flow)
//     const buyerInfo = await this.provider.connection.getAccountInfo(buyerAta);
//     if (!buyerInfo) {
//       this.logger.debug('[purchase] adding ix: create buyer ATA');
//       tx.add(
//         createAssociatedTokenAccountInstruction(
//           buyer,
//           buyerAta,
//           buyer,
//           this.USDC_MINT,
//           TOKEN_PROGRAM_ID,
//           ASSOCIATED_TOKEN_PROGRAM_ID,
//         ),
//       );
//     }

//     const sellerInfo = await this.provider.connection.getAccountInfo(sellerAta);
//     if (!sellerInfo) {
//       this.logger.debug('[purchase] adding ix: create seller ATA (authority = on-chain seller)');
//       // OWNER MUST BE listing_state.seller (sellerFromState)
//       tx.add(
//         createAssociatedTokenAccountInstruction(
//           buyer,                 // payer
//           sellerAta,             // ata address
//           sellerFromState,       // *** authority must be on-chain seller ***
//           this.USDC_MINT,
//           TOKEN_PROGRAM_ID,
//           ASSOCIATED_TOKEN_PROGRAM_ID,
//         ),
//       );
//     }

//     const treasuryInfo = await this.provider.connection.getAccountInfo(treasuryAta);
//     if (!treasuryInfo) {
//       this.logger.debug('[purchase] adding ix: create treasury ATA');
//       tx.add(
//         createAssociatedTokenAccountInstruction(
//           buyer,
//           treasuryAta,
//           treasuryPda,
//           this.USDC_MINT,
//           TOKEN_PROGRAM_ID,
//           ASSOCIATED_TOKEN_PROGRAM_ID,
//         ),
//       );
//     }

//     this.logger.debug('[purchase] building program ix: purchaseListing');
//     const devInfo = await this.provider.connection.getAccountInfo(deviceRegistryPda);
//     this.logger.debug(`[purchase] device_registry size = ${devInfo?.data?.length ?? 'null'} bytes`);
//     const mktInfo = await this.provider.connection.getAccountInfo(marketplacePda);
//     this.logger.debug(`[purchase] marketplace size = ${mktInfo?.data?.length ?? 'null'} bytes`);

//     // Program instruction (unchanged except units/eph)
//   const ix = await this.program.methods
//     .purchaseListing(
//       listingId,
//       unitsBN,
//       Array.from(eph32) as any,
//     )
//     .accounts({
//       buyer,
//       buyerAta,
//       sellerAta,          // <-- now guaranteed to match listing_state.seller
//       treasury: treasuryPda,
//       treasuryAta,
//       listingState: listingStatePda,
//       marketplace: marketplacePda,
//       deviceRegistry: deviceRegistryPda,
//       purchaseRecord: purchaseRecordPda,
//       usdcMint: this.USDC_MINT,
//       tokenProgram: TOKEN_PROGRAM_ID,
//       systemProgram: SystemProgram.programId,
//       clock: SYSVAR_CLOCK_PUBKEY,
//       rent: SYSVAR_RENT_PUBKEY,
//     })
//     .instruction();


//     tx.add(ix);
//     tx.feePayer = buyer;

//     this.logger.debug('[purchase] purchase tx built (legacy). Will be serialized and returned unsigned.');
//     return { tx };
//   }

//   /** Returns base64 of serialized, unsigned tx for frontend to sign */
//   async prepareUnsignedPurchaseTx(args: {
//     listingId: string;
//     buyer: PublicKey;
//     seller: PublicKey;
//     unitsRequested: number;
//     deviceId: string;
//     buyerEphemeralPubkey: Bytes32;
//   }): Promise<string> {
//     this.logger.log('[prepareUnsignedPurchaseTx] start');
//     const _ = this.toBytes32(args.buyerEphemeralPubkey, 'buyerEphemeralPubkey');

//     const { tx } = await this.buildPurchaseTransaction(
//       args.listingId,
//       args.buyer,
//       args.seller,
//       args.unitsRequested,
//       args.deviceId,
//       args.buyerEphemeralPubkey,
//     );
//     const { blockhash } =
//       await this.provider.connection.getLatestBlockhash('confirmed');
//     tx.recentBlockhash = blockhash;

//     const b64 = tx.serialize({ requireAllSignatures: false }).toString('base64');
//     this.logger.debug('[prepareUnsignedPurchaseTx] built legacy unsigned tx (base64 length=' + b64.length + ')');
//     return b64;
//   }

//   /** Submits a signed purchase tx and confirms it (added: simulate + log friendly errors) */
//   async submitSignedPurchaseTransaction(
//     signedTxBase64: string,
//   ): Promise<string> {
//     this.logger.log('[submitSignedPurchaseTransaction] start');
//     // Preflight simulate to dump program logs (no behavior change)
//     await this.simulateAndLogSignedTx(signedTxBase64, 'purchase preflight');

//     const raw = Buffer.from(signedTxBase64, 'base64');
//     try {
//       const sig = await this.provider.connection.sendRawTransaction(raw, {
//         skipPreflight: false,
//         preflightCommitment: 'confirmed',
//         maxRetries: 3,
//       });
//       await this.provider.connection.confirmTransaction(sig, 'confirmed');
//       this.logger.log(`Purchase tx confirmed: ${sig}`);
//       return sig;
//     } catch (e: any) {
//       await this.logErrorWithOnchainLogs(e, 'purchase send');
//       throw e;
//     }
//   }
// }

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

  // ——— purchase build (FIXED to pass purchase_index) ———
  async buildPurchaseTransaction(
    listingId: string,
    buyer: PublicKey,
    _sellerIgnored: PublicKey, // kept for API compatibility, we derive on-chain seller
    unitsRequested: number,
    deviceId: string,
    buyerEphemeralPubkey: Bytes32,
  ): Promise<{ tx: Transaction }> {
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

    // *** IMPORTANT: your IDL for purchase_listing requires purchase_index (u64) ***
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
    return { tx };
  }

  async prepareUnsignedPurchaseTx(args: {
    listingId: string;
    buyer: PublicKey;
    seller: PublicKey;
    unitsRequested: number;
    deviceId: string;
    buyerEphemeralPubkey: Bytes32;
  }): Promise<string> {
    const { tx } = await this.buildPurchaseTransaction(
      args.listingId,
      args.buyer,
      args.seller,
      args.unitsRequested,
      args.deviceId,
      args.buyerEphemeralPubkey,
    );
    const { blockhash } = await this.provider.connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    return tx.serialize({ requireAllSignatures: false }).toString('base64');
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

      this.logger.log(`finalize_purchase ok: ${sig}`);
      return sig;
    } catch (e: any) {
      await this.logErrorWithOnchainLogs(e, 'finalize_purchase');
      throw e;
    }
  }

  // ——— read purchase_record (buyer capsule CID) ———
  async getPurchaseRecordBuyerCid(recordPk: PublicKey): Promise<string | null> {
    const acc: any = await this.program.account['purchaseRecord'].fetch(recordPk);
    return acc?.dekCapsuleForBuyerCid || null;
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
   */
  async getPurchasesByBuyer(buyer: PublicKey) {
    // Anchor helper: fetch all purchaseRecord accounts and filter in memory.
    // (Good enough for devnet; swap for memcmp filters later if needed.)
    const all: Array<{ publicKey: PublicKey; account: any }> =
      await (this.program.account as any)['purchaseRecord'].all();

    const mine = all.filter((p) =>
      new PublicKey(p.account.buyer).equals(buyer)
    );

    const out = [];
    for (const pr of mine) {
      const recordPk = pr.publicKey;
      const acc = pr.account;

      // Try to enrich with listing state (best effort; field names may differ slightly)
      let listingMeta: any = null;
      try {
        const listingStatePk = new PublicKey(acc.listingState);
        listingMeta = await (this.program.account as any)['listingState'].fetch(
          listingStatePk
        );
      } catch {
        // ignore – show a minimal row
      }

      out.push({
        // record
        recordPk: recordPk.toBase58(),
        buyer: buyer.toBase58(),
        units: Number(acc?.units ?? 0),
        purchaseIndex: Number(acc?.purchaseIndex ?? 0),
        createdAt: acc?.createdAt ? Number(acc.createdAt) : null,
        dekCapsuleForBuyerCid: acc?.dekCapsuleForBuyerCid ?? null,
        txSignature: acc?.txSignature ?? null,

        // joined listing fields (best effort)
        listingState: acc?.listingState
          ? new PublicKey(acc.listingState).toBase58()
          : null,
        listingId: listingMeta?.listingId ?? null,
        deviceId: listingMeta?.deviceId ?? null,
        dataCid: listingMeta?.dataCid ?? null,
        pricePerUnit: listingMeta?.pricePerUnit
          ? Number(listingMeta.pricePerUnit)
          : null,
        expiresAt: listingMeta?.expiresAt ? Number(listingMeta.expiresAt) : null,
        seller: listingMeta?.seller
          ? new PublicKey(listingMeta.seller).toBase58()
          : null,
        deviceMetadata: listingMeta?.deviceMetadata ?? null,
      });
    }

    return out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }
}
