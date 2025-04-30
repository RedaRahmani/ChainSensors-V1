import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { IDL } from './idl'; // Replace with your program's IDL

@Injectable()
export class SolanaService {
  private program: anchor.Program;
  private provider: anchor.AnchorProvider;
  private readonly logger = new Logger(SolanaService.name);

  constructor(private configService: ConfigService) {
    const solanaRpc = this.configService.get<string>('SOLANA_RPC') || 'https://api.devnet.solana.com';
    const wallet = new anchor.Wallet(/* your keypair here, e.g., from config */);
    const connection = new anchor.web3.Connection(solanaRpc, 'confirmed');
    this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    this.program = new anchor.Program(IDL, new PublicKey('YourProgramIdHere'), this.provider); // Replace with your program ID
  }

  async registerDevice(
    deviceId: string,
    ekPubkeyHash: number[], // Array of 32 bytes
    deviceType: string,
    location: string,
    dataType: string,
    dataUnit: string,
    pricePerUnit: number,
    totalDataUnits: number,
    dataCid: string,
    accessKeyHash: number[], // Array of 32 bytes
    expiresAt: number | null,
    marketplaceAdmin: PublicKey,
  ): Promise<string> {
    try {
      // Derive marketplace PDA
      const [marketplacePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
        this.program.programId,
      );

      // Derive device_registry PDA
      const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
        this.program.programId,
      );

      // Validate inputs (optional, as smart contract also checks)
      if (deviceId.length > 32) throw new Error('Device ID too long');
      if (pricePerUnit <= 0) throw new Error('Price per unit must be positive');

      const tx = await this.program.methods
        .registerDevice(
          deviceId,
          Uint8Array.from(ekPubkeyHash) as any, // Cast to match [u8; 32]
          deviceType,
          location,
          dataType,
          dataUnit,
          new anchor.BN(pricePerUnit),
          new anchor.BN(totalDataUnits),
          dataCid,
          Uint8Array.from(accessKeyHash) as any, // Cast to match [u8; 32]
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
      this.logger.error(`Failed to register device: ${error.message}`);
      throw error;
    }
  }
}