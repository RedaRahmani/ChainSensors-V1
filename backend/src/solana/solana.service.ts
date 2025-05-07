// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as anchor from '@coral-xyz/anchor';
// import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
// import idl from './idl.json';
// import { Idl } from '@coral-xyz/anchor';

// @Injectable()
// export class SolanaService {
//   private program: anchor.Program;
//   private provider: anchor.AnchorProvider;
//   private readonly logger = new Logger(SolanaService.name);

//   constructor(private configService: ConfigService) {
//     const solanaRpc = this.configService.get<string>('SOLANA_RPC') || 'https://api.devnet.solana.com';
//     const keypair = anchor.web3.Keypair.fromSecretKey(
//       Uint8Array.from(JSON.parse(process.env.SOLANA_KEYPAIR_JSON))
//     );
//     const wallet = new anchor.Wallet(keypair);
//     const connection = new anchor.web3.Connection(solanaRpc, 'confirmed');
//     this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
//     const programId = new PublicKey(this.configService.get<string>('SOLANA_PROGRAM_ID'));
//     this.program = new anchor.Program(idl as Idl, this.provider);

//   }

//   async registerDevice(
//     deviceId: string,
//     ekPubkeyHash: number[], // Array of 32 bytes
//     deviceType: string,
//     location: string,
//     dataType: string,
//     dataUnit: string,
//     pricePerUnit: number,
//     totalDataUnits: number,
//     dataCid: string,
//     accessKeyHash: number[], // Array of 32 bytes
//     expiresAt: number | null,
//     marketplaceAdmin: PublicKey,
//   ): Promise<string> {
//     try {
//       // Derive marketplace PDA
//       const [marketplacePda] = PublicKey.findProgramAddressSync(
//         [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
//         this.program.programId,
//       );

//       // Derive device_registry PDA
//       // const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
//       //   [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
//       //   this.program.programId,
//       // );
//       // Convert UUID string to 16‑byte hex buffer
//       const rawHex = deviceId.replace(/-/g, '');
//       const seedBytes = Buffer.from(rawHex, 'hex');

//       // (Optional) Log seed lengths
//       this.logger.debug(`Seed lengths: device(6), marketplace(${marketplacePda.toBuffer().length}), id(${seedBytes.length})`);

//       // Derive PDA
//       const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
//         [Buffer.from('device'), marketplacePda.toBuffer(), seedBytes],
//         this.program.programId,
//       );


//       // Validate inputs (optional, as smart contract also checks)
//       if (deviceId.length > 32) throw new Error('Device ID too long');
//       if (pricePerUnit <= 0) throw new Error('Price per unit must be positive');

//       const tx = await this.program.methods
//         .registerDevice(
//           deviceId,
//           Uint8Array.from(ekPubkeyHash) as any, // Cast to match [u8; 32]
//           deviceType,
//           location,
//           dataType,
//           dataUnit,
//           new anchor.BN(pricePerUnit),
//           new anchor.BN(totalDataUnits),
//           dataCid,
//           Uint8Array.from(accessKeyHash) as any, // Cast to match [u8; 32]
//           expiresAt ? new anchor.BN(expiresAt) : null,
//         )
//         .accounts({
//           owner: this.provider.wallet.publicKey,
//           marketplace: marketplacePda,
//           deviceRegistry: deviceRegistryPda,
//           systemProgram: SystemProgram.programId,
//           rent: SYSVAR_RENT_PUBKEY,
//         })
//         .rpc();

//       this.logger.log(`Device registered with signature: ${tx}`);
//       return tx;
//     } catch (error) {
//       this.logger.error(`Failed to register device: ${error.message}`);
//       throw error;
//     }
//   }
// }
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
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
    this.program = new anchor.Program(idl as Idl,this.provider);

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
      await (this.program.account as any)["marketplace"].fetch(marketplacePda);
      this.logger.log('Marketplace already initialized at ' + marketplacePda.toBase58());
      return;
    } catch (err) {
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
        usdcMint: usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    this.logger.log(`Marketplace initialized (tx: ${tx}) at PDA ${marketplacePda.toBase58()}`);
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
  ): Promise<string> {
    try {
      const programId = this.program.programId;

      // Marketplace PDA
      const [marketplacePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
        programId,
      );

      // Device registry PDA (seed: 16-byte hex UUID)
      const rawHex = deviceId.replace(/-/g, '');
      const seedBytes = Buffer.from(rawHex, 'hex');
      this.logger.debug(`Seed lengths: device(6), marketplace(${marketplacePda.toBuffer().length}), id(${seedBytes.length})`);


      // after marketplacePda…
      const deviceSeed = Buffer.from(deviceId);           // 32‑byte ASCII hex string
      const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
        [ Buffer.from('device'), marketplacePda.toBuffer(), deviceSeed ],
        this.program.programId,
      );

      
      this.logger.debug(`Seed lengths → device tag: 6, marketplace: ${marketplacePda.toBuffer().length}, id: ${seedBytes.length}`);
      this.logger.debug('Calling registerDevice with dataCid=' + dataCid);

      // Call registerDevice instruction
      const tx = await this.program.methods
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
        .rpc();

      this.logger.log(`Device registered with signature: ${tx}`);
      return tx;
    } catch (error) {
      this.logger.error(`Failed to register device: ${error}`);
      if ((error as any).logs) {
        this.logger.error('Simulation logs:\n' + (error as any).logs.join('\n'));
      }
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
    ): Promise<string> {
      const programId = this.program.programId;
      const seller = this.provider.wallet.publicKey;
    
      // PDAs
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
    
      const tx = await this.program.methods
        .createListing(
          dataCid,
          new anchor.BN(pricePerUnit),
          new anchor.BN(totalDataUnits),
          listingId,
          Array(32).fill(0), // placeholder access_key_hash
          Array(32).fill(0), // placeholder ek_pubkey_hash
          bump,
        )
        .accounts({
          seller,
          marketplace,
          deviceRegistry,
          listingState,              // ← must match your IDL!
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    
      this.logger.log(`createListing tx: ${tx}`);
      return tx;
    }
    
    async cancelListing(
      listingId: string,
      deviceId: string,
    ): Promise<string> {
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
    
      const tx = await this.program.methods
        .cancelListing(listingId)
        .accounts({
          seller,
          listingState,
          deviceRegistry,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    
      this.logger.log(`cancelListing tx: ${tx}`);
      return tx;
    }
    
}
