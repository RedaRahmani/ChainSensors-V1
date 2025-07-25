
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as anchor from '@coral-xyz/anchor';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID , createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync } from '@solana/spl-token';
import idl from './idl.json';
import { BN, Idl } from '@coral-xyz/anchor';

@Injectable()
export class SolanaService {
  fetchAllBySeed(programId: anchor.web3.PublicKey, arg1: Buffer<ArrayBuffer>, arg2: anchor.web3.PublicKey) {
      throw new Error('Method not implemented.');
  }
  private program: anchor.Program<Idl>;
  private provider: anchor.AnchorProvider;
  private readonly logger = new Logger(SolanaService.name);
  private readonly USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint (devnet)
  private readonly TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  private readonly ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');


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

    const programIdStr = this.configService.get<string>(
      'SOLANA_PROGRAM_ID',
    );
    if (!programIdStr) throw new Error('SOLANA_PROGRAM_ID not set');
    this.program = new anchor.Program(idl as Idl, this.provider);
  }


  async initializeMarketplace(): Promise<void> {
    const name = this.configService.get<string>('MARKETPLACE_NAME');
    const feeBpsStr = this.configService.get<string>('SELLER_FEE_BASIS');
    const usdcMintStr = this.configService.get<string>('USDC_MINT');
    if (!name || !feeBpsStr || !usdcMintStr) {
      throw new Error(
        'Marketplace config (NAME, SELLER_FEE_BASIS, USDC_MINT) missing',
      );
    }
    const sellerFee = Number(feeBpsStr);
    const usdcMint = new PublicKey(usdcMintStr);

    const adminPubkey = this.provider.wallet.publicKey;
    const programId = this.program.programId;

    const [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), adminPubkey.toBuffer()],
      programId,
    );
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), adminPubkey.toBuffer()],
      programId,
    );

    try {
      await (this.program.account as any)['marketplace'].fetch(
        marketplacePda,
      );
      this.logger.log(
        'Marketplace already initialized at ' + marketplacePda.toBase58(),
      );
      return;
    } catch {
      this.logger.log('Marketplace not found, proceeding with initialization');
    }

    this.logger.log('Initializing marketplace on-chain');
    const tx = await this.program.methods
      .initialize(name, sellerFee)
      .accounts({
        admin: adminPubkey,
        marketplace: marketplacePda,
        treasury: treasuryPda,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    this.logger.log(
      `Marketplace initialized (tx: ${tx}) at PDA ${marketplacePda.toBase58()}`,
    );
  }


  private async buildUnsignedTx(
    txPromise: Promise<Transaction>,
    feePayer: PublicKey,
  ): Promise<string> {
    const tx = await txPromise;
    const { blockhash } =
      await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = feePayer;
    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    return serialized.toString('base64');
  }

  
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
    console.log('this is marketplace pda:', marketplacePda);
    const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('device'),
        marketplacePda.toBuffer(),
        Buffer.from(deviceId),
      ],
      programId,
    );
    console.log('this is device registry pda:', deviceRegistryPda);

    this.logger.debug(
      `Building registerDevice tx for ${deviceId} (dataCid=${dataCid})`,
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
          new anchor.BN(pricePerUnit),
          new anchor.BN(totalDataUnits),
          dataCid,
          Uint8Array.from(accessKeyHash) as any,
          expiresAt ? new anchor.BN(expiresAt) : null,
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

    this.logger.log(`Built unsigned registerDevice tx for ${deviceId}`);
    this.logger.log(`this is unsigned registerDevice tx : ${unsignedTx}`);
    return { unsignedTx };
  }

  /**
   * Phase 2: Submit a seller-signed transaction.
   */
  async submitSignedTransaction(
    signedTxBase64: string,
  ): Promise<string> {
    console.log("inside finale signing in solana service")
    const raw = Buffer.from(signedTxBase64, 'base64');
    console.log(`this is the raw${raw}`)
    const signature = await this.provider.connection.sendRawTransaction(
      raw,
      {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      },
    );
    
    await this.provider.connection.confirmTransaction(
      signature,
      'confirmed',
    );
    this.logger.log(`Submitted & confirmed tx ${signature}`);
    return signature;
  }


  private async buildUnsignedTxListing(
    txPromise: Promise<Transaction>,
    feePayer: PublicKey,
  ): Promise<string> {
    const tx = await txPromise;
    const { blockhash } = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = feePayer;
    return tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString('base64');
  }

  async buildCreateListingTransaction(args: {
    listingId: string;
    dataCid: string;
    pricePerUnit: number;
    deviceId: string;
    totalDataUnits: number;
    expiresAt: number | null;
    sellerPubkey: PublicKey;
  }): Promise<{ unsignedTx: string }> {
    const {
      listingId,
      dataCid,
      pricePerUnit,
      deviceId,
      totalDataUnits,
      expiresAt,
      sellerPubkey,
    } = args;
    const pid = this.program.programId;
    const marketplaceAdmin = new PublicKey(
      this.configService.get<string>('MARKETPLACE_ADMIN_PUBKEY')!,
    );
    const idBuf = Buffer.from(listingId, 'utf8');

    // PDAs
    const [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
      pid,
    );
    const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
      pid,
    );
    const [listingStatePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('listing'),
        deviceRegistryPda.toBuffer(),
        idBuf,
      ],
      pid,
    );

    // Build the instruction
    const builder = this.program.methods
      .createListing(
        listingId,
        dataCid,
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

    // Optional debug
    this.logger.debug('IDL args:', this.program.idl.instructions.find(i => i.name === 'createListing')?.args);
    this.logger.debug('Call values:', [listingId, dataCid, pricePerUnit, deviceId, totalDataUnits, expiresAt]);

    // Serialize unsigned transaction
    const txPromise = builder.transaction();
    const unsignedTx = await this.buildUnsignedTxListing(txPromise, sellerPubkey);
    this.logger.log(`Built unsigned createListing tx`);
    return { unsignedTx };
  }

async submitSignedTransactionListing(
  signedTxBase64: string,
): Promise<string> {
  const raw = Buffer.from(signedTxBase64, 'base64');
  // Skip the preflight simulation to avoid "already processed" errors:
  const sig = await this.provider.connection.sendRawTransaction(raw, {
    skipPreflight: true,
    preflightCommitment: 'confirmed',
  });

  await this.provider.connection.confirmTransaction(sig, 'confirmed');
  this.logger.log(`Listing tx confirmed: ${sig}`);
  return sig;
}


  private async fetchListingState(
    listingStatePda: PublicKey,
  ): Promise<{ purchaseCount: BN }> {
    // If `program.account.listingState` isn't recognized by TS, use bracket syntax:
    const listingRaw: any = await this.program.account['listingState'].fetch(
      listingStatePda,
    );
    return {
      purchaseCount: new BN(listingRaw.purchaseCount),
    };
  }
  /** Builds an unsigned purchase tx (does *not* sign) */
/** Builds an unsigned purchase tx (does *not* sign) */
async buildPurchaseTransaction(
  listingId: string,
  buyer: PublicKey,
  seller: PublicKey,
  unitsRequested: number,
  deviceId: string,
): Promise<{ tx: Transaction }> {
  const programId = this.program.programId;
  const marketplaceAdmin = new PublicKey(this.configService.get('MARKETPLACE_ADMIN_PUBKEY')!);
  const idBuf = Buffer.from(listingId, 'utf8');

  // Derive PDAs
  const [marketplacePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
    programId,
  );
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury'), marketplacePda.toBuffer()],
    programId,
  );
  const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
    programId,
  );
  const [listingStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('listing'), deviceRegistryPda.toBuffer(), idBuf],
    programId,
  );

  // Fetch on‑chain state to get purchaseCount
  const { purchaseCount } = await this.fetchListingState(listingStatePda);

  // Derive purchaseRecord PDA
  const [purchaseRecordPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('purchase'),
      listingStatePda.toBuffer(),
      purchaseCount.toArrayLike(Buffer, 'le', 8),
    ],
    programId,
  );

  const buyerAta    = await getAssociatedTokenAddress(this.USDC_MINT, buyer);
  const sellerAta   = await getAssociatedTokenAddress(this.USDC_MINT, seller);
  const treasuryAta = await getAssociatedTokenAddress(this.USDC_MINT, treasuryPda, true);

  const tx = new Transaction();

  // ONLY create the buyer's ATA if it's missing
  const buyerInfo = await this.provider.connection.getAccountInfo(buyerAta);
  if (!buyerInfo) {
    this.logger.log(`Creating buyer ATA for ${buyerAta.toBase58()}`);
    tx.add(
      createAssociatedTokenAccountInstruction(
        buyer,    // payer
        buyerAta, // ATA
        buyer,    // owner
        this.USDC_MINT,
      ),
    );
  }

  // now attach the CPI to your program
  const ix = await this.program.methods
    .purchaseListing(Buffer.from(listingId.padEnd(32, '\0')), new BN(unitsRequested))
    .accounts({
      buyer,
      buyerAta,
      sellerAta,
      treasuryAta,
      listingState: listingStatePda,
      marketplace: marketplacePda,
      deviceRegistry: deviceRegistryPda,
      purchaseRecord: purchaseRecordPda,
      usdcMint: this.USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      clock: SYSVAR_CLOCK_PUBKEY,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();
  tx.add(ix);

  tx.feePayer = buyer;

  // DEBUG: dump every instruction
  this.logger.debug('Assembled Purchase TX:');
  tx.instructions.forEach((ins, idx) => {
    this.logger.debug(` Instruction ${idx}: programId = ${ins.programId.toBase58()}`);
    ins.keys.forEach((k, ki) =>
      this.logger.debug(
        `   key[${ki}]: ${k.pubkey.toBase58()} signer=${k.isSigner} writable=${k.isWritable}`
      )
    );
  });

  return { tx };
}

/** Returns base64 of serialized, unsigned tx for frontend to sign */
async prepareUnsignedPurchaseTx(args: {
  listingId: string;
  buyer: PublicKey;
  seller: PublicKey;
  unitsRequested: number;
  deviceId: string;
}): Promise<string> {
  const { tx } = await this.buildPurchaseTransaction(
    args.listingId,
    args.buyer,
    args.seller,
    args.unitsRequested,
    args.deviceId,
  );
  const { blockhash } = await this.provider.connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  return tx.serialize({ requireAllSignatures: false }).toString('base64');
}

/** Submits a signed purchase tx and confirms it */
async submitSignedPurchaseTransaction(signedTxBase64: string): Promise<string> {
  const raw = Buffer.from(signedTxBase64, 'base64');
  const sig = await this.provider.connection.sendRawTransaction(raw, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });
  await this.provider.connection.confirmTransaction(sig, 'confirmed');
  this.logger.log(`Purchase tx confirmed: ${sig}`);
  return sig;
}


  }




  //   async submitPurchaseTransaction(
//     listingId: string,
//     buyerPubkey: PublicKey,
//     sellerPubkey: PublicKey,
//     unitsRequested: number,
//     pricePerUnit: number,
//   ): Promise<string> {
//     this.logger.debug(`Building purchase tx for listing ${listingId}`);

//     const transaction = new Transaction();
//     const programId = new PublicKey('E3yceGcwF38aFzoJHzmNGGZKEk9bmMqZRNTvQ8ehVms3');

//     // Get buyer's USDC ATA
//     const buyerAta = await getAssociatedTokenAddress(
//       this.USDC_MINT,
//       buyerPubkey,
//       false,
//       TOKEN_PROGRAM_ID,
//       ASSOCIATED_TOKEN_PROGRAM_ID,
//     );

//     // Check and create buyer's ATA if needed
//     const buyerAtaInfo = await this.provider.connection.getAccountInfo(buyerAta);
// if (!buyerAtaInfo) {
//   this.logger.log(`Buyer ATA ${buyerAta.toBase58()} not found, adding creation instruction`);
//   transaction.add(
//     createAssociatedTokenAccountInstruction(
//       buyerPubkey,
//       buyerAta,
//       buyerPubkey,
//       this.USDC_MINT,
//       TOKEN_PROGRAM_ID,
//       ASSOCIATED_TOKEN_PROGRAM_ID,
//     ),
//   );
// } else {
//   this.logger.log(`Buyer ATA ${buyerAta.toBase58()} exists with ${buyerAtaInfo.data.length} bytes`);
// }

//     // Get seller's USDC ATA
//     const sellerAta = await getAssociatedTokenAddress(
//       this.USDC_MINT,
//       sellerPubkey,
//       false,
//       TOKEN_PROGRAM_ID,
//       ASSOCIATED_TOKEN_PROGRAM_ID,
//     );

//     // Add purchase instruction (simplified, adjust based on Anchor IDL)
//     // const instructionData = Buffer.from(
//     //   Buffer.concat([
//     //     Buffer.from([/* discriminator for PurchaseListing */]),
//     //     Buffer.from(new Uint8Array(new Uint32Array([unitsRequested]).buffer)),
//     //     Buffer.from(new Uint8Array(new Uint64Array([BigInt(Math.floor(unitsRequested * pricePerUnit * 1e6))]).buffer)), // USDC has 6 decimals
//     //   ]),
//     // );
//     const amount = BigInt(Math.floor(unitsRequested * pricePerUnit * 1e6)); // USDC has 6 decimals
// const amountBuffer = Buffer.alloc(8); // u64 is 8 bytes
// amountBuffer.writeBigUInt64LE(amount); // Little-endian encoding for u64

// const instructionData = Buffer.concat([
//   Buffer.from([
//     246,
//     29,
//     226,
//     161,
//     105,
//     118,
//     198,
//     150
//   ]),
//   Buffer.from(new Uint8Array(new Uint32Array([unitsRequested]).buffer)), // u32 for unitsRequested
//   amountBuffer, // u64 for amount
// ]);

//     transaction.add({
//       keys: [
//         { pubkey: buyerPubkey, isSigner: true, isWritable: true },
//         { pubkey: buyerAta, isSigner: false, isWritable: true },
//         { pubkey: sellerAta, isSigner: false, isWritable: true },
//         { pubkey: this.USDC_MINT, isSigner: false, isWritable: false },
//         { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
//         // Add listing PDA or other accounts as required
//       ],
//       programId,
//       data: instructionData,
//     });

//     // Set recent blockhash and fee payer
//     const { blockhash } = await this.provider.connection.getLatestBlockhash();
//     transaction.recentBlockhash = blockhash;
//     transaction.feePayer = buyerPubkey;

//     // Serialize transaction
//     const serializedTx = transaction.serialize({ requireAllSignatures: false }).toString('base64');
//     this.logger.log(`Built unsigned purchase tx for listing ${listingId}`);
//     return serializedTx;
//   }

//   async submitSignedPurchaseTransaction(signedTx: string): Promise<string> {
//     this.logger.log('Submitting signed purchase transaction');
//     try {
//       const transaction = Transaction.from(Buffer.from(signedTx, 'base64'));
//       this.logger.debug(`Using original blockhash: ${transaction.recentBlockhash}`);
//       const serializedTx = transaction.serialize().toString('base64');
//       const txSignature = await this.provider.connection.sendEncodedTransaction(serializedTx, {
//         skipPreflight: false,
//         preflightCommitment: 'confirmed',
//         maxRetries: 3,
//       });
//       await this.provider.connection.confirmTransaction(txSignature, 'confirmed');
//       this.logger.log(`Purchase transaction confirmed: ${txSignature}`);
//       return txSignature;
//     } catch (error: any) {
//       this.logger.error('Failed to submit purchase transaction', { error: error.message, stack: error.stack });
//       if (error.message.includes('Blockhash not found')) {
//         throw new Error('Transaction blockhash expired. Please try again.');
//       }
//       if (error.message.includes('Signature verification failed')) {
//         throw new Error('Invalid transaction signature. Ensure the correct wallet is used.');
//       }
//       throw error;
//     }
//   }