
import { Injectable, Logger } from '@nestjs/common';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  mintTo,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  createMint,
  getMint,
} from '@solana/spl-token';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private connection: Connection;
  private payer: Keypair;
  private mint: PublicKey;

  private initPromise: Promise<void>;

  constructor() {
    try {
      // 1) Load RPC & payer
      this.connection = new Connection(process.env.SOLANA_RPC!, 'confirmed');

      // Validate and parse keypair
      const keypairJson = process.env.MINT_AUTHORITY_KEYPAIR_JSON;
      if (!keypairJson) {
        throw new Error('MINT_AUTHORITY_KEYPAIR_JSON not found in environment');
      }

      const secret = JSON.parse(keypairJson);
      if (!Array.isArray(secret) || secret.length !== 64) {
        throw new Error('Invalid MINT_AUTHORITY_KEYPAIR_JSON format - must be array of 64 numbers');
      }

      this.payer = Keypair.fromSecretKey(Uint8Array.from(secret));

      // 2) Initialize SENSOR mint asynchronously
      this.initPromise = this.initializeSensorMint();
    } catch (error) {
      console.error('❌ TokenService initialization failed:', error);
      throw error;
    }
  }

  private async initializeSensorMint() {
    try {
      const sensorMint = process.env.SENSOR_MINT;
      if (!sensorMint) {
        throw new Error('SENSOR_MINT environment variable is required');
      }

      this.mint = new PublicKey(sensorMint);

      // Verify the mint exists on chain
      try {
        const mintInfo = await getMint(this.connection, this.mint);
        if (mintInfo.mintAuthority?.equals(this.payer.publicKey)) {
          this.logger.log(
            `🪙 Using SENSOR mint: ${this.mint.toBase58()} (authority: ${this.payer.publicKey.toBase58()})`,
          );
        } else {
          this.logger.error(
            `❌ SENSOR_MINT authority mismatch! Expected: ${this.payer.publicKey.toBase58()}, Actual: ${mintInfo.mintAuthority?.toBase58()}`,
          );
          throw new Error('SENSOR_MINT authority mismatch');
        }
      } catch (error) {
        this.logger.error(
          `❌ Failed to verify SENSOR_MINT on chain: ${error.message}`,
        );
        throw error;
      }

      console.log('✅ TokenService initialized successfully');
      console.log(`🔑 Payer: ${this.payer.publicKey.toBase58()}`);
      console.log(`🪙 SENSOR Mint: ${this.mint.toBase58()}`);
    } catch (error) {
      console.error('❌ SENSOR mint initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Mint SENSOR tokens to a user as reward
   */
  async mintSensorTokens(args: {
    to: string;
    amount: number;
  }): Promise<string> {
    // Ensure initialization is complete
    await this.initPromise;

    try {
      // Validate wallet address
      if (!args.to || typeof args.to !== 'string') {
        throw new Error('Invalid wallet address provided');
      }

      let recipient: PublicKey;
      try {
        recipient = new PublicKey(args.to);
      } catch (error) {
        throw new Error(`Invalid wallet address format: ${args.to}`);
      }

      const amountWithDecimals = args.amount * Math.pow(10, 6); // 6 decimals
      this.logger.log(
        `🪙 Minting ${args.amount} SENSOR tokens (${amountWithDecimals} with decimals) to ${recipient.toBase58()}`,
      );
      this.logger.log(`🏭 Using SENSOR mint: ${this.mint.toBase58()}`);
      this.logger.log(`🔑 Mint authority: ${this.payer.publicKey.toBase58()}`);

      // Get or create associated token account for recipient
      let recipientTokenAccount;
      try {
        recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
          this.connection,
          this.payer, // payer for ATA creation is always backend
          this.mint,
          recipient,
        );
        this.logger.log(
          `✅ Recipient ATA: ${recipientTokenAccount.address.toBase58()}`,
        );
      } catch (ataError) {
        this.logger.error(
          `Failed to create/get ATA for wallet ${recipient.toBase58()} and mint ${this.mint.toBase58()}:`,
          ataError,
        );
        throw new Error(`ATA creation failed: ${ataError.message}`);
      }

      // Mint tokens to the recipient's token account
      // Mint authority and payer is always the backend's keypair
      let txSignature: string;
      try {
        txSignature = await mintTo(
          this.connection,
          this.payer,
          this.mint,
          recipientTokenAccount.address,
          this.payer.publicKey, // mint authority
          amountWithDecimals,
        );
      } catch (mintError) {
        this.logger.error(
          `Minting failed for wallet ${recipient.toBase58()} ATA ${recipientTokenAccount.address.toBase58()}:`,
          mintError,
        );
        throw new Error(`Minting failed: ${mintError.message}`);
      }

      // Wait for confirmation
      try {
        await this.connection.confirmTransaction(txSignature, 'confirmed');
      } catch (confirmError) {
        this.logger.error(
          `Transaction confirmation failed for tx ${txSignature}:`,
          confirmError,
        );
        throw new Error(
          `Transaction confirmation failed: ${confirmError.message}`,
        );
      }

      this.logger.log(
        `✅ Minted ${args.amount} SENSOR to wallet ${args.to} (ATA: ${recipientTokenAccount.address.toBase58()}) — tx ${txSignature}`,
      );
      return txSignature;
    } catch (error) {
      this.logger.error(
        `Failed to mint SENSOR tokens for wallet ${args.to}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get SENSOR token balance for a user
   */
  async getSensorBalance(userPubkey: string): Promise<number> {
    try {
      const userPublicKey = new PublicKey(userPubkey);
      const tokenAccount = await getAssociatedTokenAddress(
        this.mint,
        userPublicKey,
      );

      const accountInfo =
        await this.connection.getTokenAccountBalance(tokenAccount);
      return accountInfo.value.uiAmount || 0;
    } catch (error) {
      // Account doesn't exist or other error
      return 0;
    }
  }
}
