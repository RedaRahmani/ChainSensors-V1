
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as anchor from '@coral-xyz/anchor';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
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
      { skipPreflight: false, preflightCommitment: 'confirmed' },
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
        Buffer.from(listingId),
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
    const sig = await this.provider.connection.sendRawTransaction(raw, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    await this.provider.connection.confirmTransaction(sig, 'confirmed');
    this.logger.log(`Transaction confirmed: ${sig}`);
    return sig;
  }
  async submitPurchaseTransaction(params: { listingId: string; buyerPubkey: string; sellerPubkey: string; price: number }) {
    // Simulate a Solana transaction for now
    return "mock-tx-signature";
  }
  }
