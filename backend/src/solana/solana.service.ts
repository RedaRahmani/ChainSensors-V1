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
import { Idl } from '@coral-xyz/anchor';

@Injectable()
export class SolanaService {
  private program: anchor.Program<Idl>;
  private provider: anchor.AnchorProvider;
  private readonly logger = new Logger(SolanaService.name);

  constructor(private configService: ConfigService) {
    // Initialize Anchor provider and program
    const rpcUrl = this.configService.get<string>('SOLANA_RPC') || 'https://api.devnet.solana.com';
    const keypairJson = process.env.SOLANA_KEYPAIR_JSON;
    if (!keypairJson) throw new Error('SOLANA_KEYPAIR_JSON not set');
    const keypair = anchor.web3.Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(keypairJson))
    );
    const wallet = new anchor.Wallet(keypair);
    const connection = new anchor.web3.Connection(rpcUrl, 'confirmed');
    this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    anchor.setProvider(this.provider);

    // Program initialization
    const programIdStr = this.configService.get<string>('SOLANA_PROGRAM_ID');
    if (!programIdStr) throw new Error('SOLANA_PROGRAM_ID not set');
    const programId = new PublicKey(programIdStr);
    this.program = new anchor.Program(idl as Idl, this.provider);
  }

  /**
   * One-time initialization of the marketplace on-chain.
   * Idempotent: skips if already initialized.
   */
  async initializeMarketplace(): Promise<void> {
    const name = this.configService.get<string>('MARKETPLACE_NAME');
    const feeBpsStr = this.configService.get<string>('SELLER_FEE_BASIS');
    const usdcMintStr = this.configService.get<string>('USDC_MINT');
    if (!name || !feeBpsStr || !usdcMintStr) {
      throw new Error('Marketplace config (NAME, SELLER_FEE_BASIS, USDC_MINT) missing');
    }
    const sellerFee = Number(feeBpsStr);
    const usdcMint = new PublicKey(usdcMintStr);

    const adminPubkey = this.provider.wallet.publicKey;
    const programId = this.program.programId;

    // Derive PDAs and bumps
    const [marketplacePda, marketplaceBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), adminPubkey.toBuffer()],
      programId
    );
    const [treasuryPda, treasuryBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), adminPubkey.toBuffer()],
      programId
    );

    // Check if already initialized
    try {
      await (this.program.account as any)['marketplace'].fetch(marketplacePda);
      this.logger.log('Marketplace already initialized at ' + marketplacePda.toBase58());
      return;
    } catch {
      this.logger.log('Marketplace not found, proceeding with initialization');
    }

    // Call initialize instruction
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
      .transaction();

    this.logger.log(
      `Marketplace initialized (tx: ${tx}) at PDA ${marketplacePda.toBase58()}`
    );
  }

  /** Helper: build, attach blockhash/fee, serialize & base64-encode */
  private async buildUnsignedTx(
    txBuilder: Promise<Transaction>
  ): Promise<string> {
    const tx = await txBuilder;
    const { blockhash } = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = this.provider.wallet.publicKey;
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    return serialized.toString('base64');
  }

  /**
   * Register a device on-chain under the existing marketplace.
   */
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
  ): Promise<{ unsignedTx: string }> {
    try {
      const programId = this.program.programId;
      const [marketplacePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
        programId,
      );
      const deviceSeed = Buffer.from(deviceId);
      const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('device'), marketplacePda.toBuffer(), deviceSeed],
        programId,
      );

      this.logger.debug(
        `Calling registerDevice with dataCid=${dataCid}`
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
            owner: this.provider.wallet.publicKey,
            marketplace: marketplacePda,
            deviceRegistry: deviceRegistryPda,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .transaction()
      );

      this.logger.log(`Built unsigned registerDevice tx for ${deviceId}`);
      return { unsignedTx };
    } catch (error) {
      this.logger.error(`Failed to register device: ${error}`);
      throw error;
    }
  }

  /**
   * Create a new on‑chain listing.
   */
  async createListing(
    listingId: string,
    dataCid: string,
    pricePerUnit: number,
    totalDataUnits: number,
    deviceId: string,
  ): Promise<{ unsignedTx: string }> {
    const programId = this.program.programId;
    const seller = this.provider.wallet.publicKey;
    const [marketplace] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), seller.toBuffer()],
      programId,
    );
    const [deviceRegistry] = PublicKey.findProgramAddressSync(
      [Buffer.from('device'), marketplace.toBuffer(), Buffer.from(deviceId)],
      programId,
    );
    const [listingState, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), deviceRegistry.toBuffer(), Buffer.from(listingId)],
      programId,
    );

    const unsignedTx = await this.buildUnsignedTx(
      this.program.methods
        .createListing(
          dataCid,
          new anchor.BN(pricePerUnit),
          new anchor.BN(totalDataUnits),
          listingId,
          Array(32).fill(0),
          Array(32).fill(0),
          bump,
        )
        .accounts({
          seller,
          marketplace,
          deviceRegistry,
          listingState,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .transaction()
    );

    this.logger.log(`Built unsigned createListing tx ${listingId}`);
    return { unsignedTx };
  }

  async cancelListing(
    listingId: string,
    deviceId: string,
  ): Promise<{ unsignedTx: string }> {
    const programId = this.program.programId;
    const seller = this.provider.wallet.publicKey;
    const [marketplace] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), seller.toBuffer()],
      programId,
    );
    const [deviceRegistry] = PublicKey.findProgramAddressSync(
      [Buffer.from('device'), marketplace.toBuffer(), Buffer.from(deviceId)],
      programId,
    );
    const [listingState] = PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), deviceRegistry.toBuffer(), Buffer.from(listingId)],
      programId,
    );

    const unsignedTx = await this.buildUnsignedTx(
      this.program.methods
        .cancelListing(listingId)
        .accounts({
          seller,
          listingState,
          deviceRegistry,
          systemProgram: SystemProgram.programId,
        })
        .transaction()
    );

    this.logger.log(`Built unsigned cancelListing tx ${listingId}`);
    return { unsignedTx };
  }
}