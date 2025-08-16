// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as anchor from '@coral-xyz/anchor';
// import { PublicKey } from '@solana/web3.js';
// import idl from '../solana/idl.json';
// import { getMXEPublicKey, x25519 } from '@arcium-hq/client';
// import { randomBytes, createCipheriv, hkdfSync } from 'crypto';

// /**
//  * ArciumService
//  * - getMxePublicKey(): fetch MXE X25519 pubkey from on-chain MXEAccount (or env override)
//  * - sealDekForMxe(dek): X25519-HKDF-SHA256 + AES-256-GCM → "capsule" bytes
//  *
//  * Capsule binary format (versioned):
//  *   0..3    : ASCII 'ARC1' (magic)
//  *   4..35   : ephemeral X25519 public key (32 bytes)
//  *   36..47  : AES-GCM IV (12 bytes)
//  *   48..N-17: ciphertext
//  *   N-16..N-1: GCM tag (16 bytes)
//  */
// @Injectable()
// export class ArciumService {
//   private readonly logger = new Logger(ArciumService.name);
//   private provider: anchor.AnchorProvider;
//   private program: anchor.Program;

//   private cachedMxePub?: Uint8Array;

//   private static readonly MAGIC = Buffer.from('ARC1'); // 4 bytes

//   constructor(private readonly config: ConfigService) {
//     const rpcUrl = this.config.get<string>('SOLANA_RPC') || 'https://api.devnet.solana.com';
//     const keypairJson = process.env.SOLANA_KEYPAIR_JSON;
//     if (!keypairJson) throw new Error('SOLANA_KEYPAIR_JSON not set');

//     const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairJson)));
//     const wallet = new anchor.Wallet(keypair);
//     const connection = new anchor.web3.Connection(rpcUrl, 'confirmed');
//     this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
//     anchor.setProvider(this.provider);

//     this.program = new anchor.Program(idl as any, this.provider);
//   }

//   private getProgramId(): PublicKey {
//     // Prefer explicit env, then IDL address, then program.programId
//     const envPid = this.config.get<string>('ARCIUM_MXE_PROGRAM_ID');
//     const idlAddr = (idl as any)?.address;
//     return new PublicKey(envPid || idlAddr || (this.program as any).programId);
//   }

//   /** Fetch MXE X25519 public key (32 bytes). Env MXE_X25519_PUBKEY_B64 overrides on-chain fetch. */
//   async getMxePublicKey(): Promise<Uint8Array> {
//     if (this.cachedMxePub) return this.cachedMxePub;

//     const envB64 = this.config.get<string>('MXE_X25519_PUBKEY_B64');
//     if (envB64) {
//       const bytes = Buffer.from(envB64, 'base64');
//       if (bytes.length !== 32) throw new Error('MXE_X25519_PUBKEY_B64 must decode to 32 bytes');
//       this.cachedMxePub = new Uint8Array(bytes);
//       return this.cachedMxePub;
//     }

//     const pid = this.getProgramId();
//     const pub = await getMXEPublicKey(this.provider as any, pid);
//     if (!pub || pub.length !== 32) throw new Error('Invalid MXE public key');
//     this.cachedMxePub = pub;
//     return pub;
//   }

//   /** Convenience: base64 string of the MXE pubkey */
//   async getMxePublicKeyB64(): Promise<string> {
//     const pk = await this.getMxePublicKey();
//     return Buffer.from(pk).toString('base64');
//   }

//   /**
//    * Seal a 32-byte DEK for MXE using X25519 + HKDF-SHA256 → AES-256-GCM.
//    * Returns "capsule" bytes suitable for storing on Walrus.
//    */
//   async sealDekForMxe(dek: Buffer): Promise<Buffer> {
//     if (!Buffer.isBuffer(dek) || dek.length !== 32) {
//       throw new Error(`DEK must be a 32-byte Buffer, got ${dek?.length}`);
//     }

//     const mxePub = await this.getMxePublicKey();                 // 32 bytes
//     const ephSk = x25519.utils.randomPrivateKey();               // 32 bytes
//     const ephPk = x25519.getPublicKey(ephSk);                    // 32 bytes
//     const shared = x25519.getSharedSecret(ephSk, mxePub);        // 32 bytes

//     // KDF to 32-byte AES key
//     const key = hkdfSync('sha256', Buffer.from(shared), Buffer.alloc(0), Buffer.from('arcium-seal-dek'), 32);

//     const iv = randomBytes(12);
//     const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), iv);
//     const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
//     const tag = cipher.getAuthTag();

//     return Buffer.concat([ArciumService.MAGIC, Buffer.from(ephPk), iv, ciphertext, tag]);
//   }

//   /** Phase 2 placeholder */
//   async reencryptDekForBuyer(_capsuleForMxe: Buffer, _buyerX25519Pubkey: Uint8Array): Promise<Buffer> {
//     throw new Error('reencryptDekForBuyer is not available until the MXE circuit is deployed (Phase 2).');
//   }
// }
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '../solana/idl.json';
import { getMXEPublicKey, x25519 } from '@arcium-hq/client';
import { randomBytes, createCipheriv, hkdfSync } from 'crypto';

/**
 * ArciumService
 * - getMxePublicKey(): fetch MXE X25519 pubkey from on-chain MXEAccount (or env override)
 * - sealDekForMxe(dek): X25519-HKDF-SHA256 + AES-256-GCM → "capsule" bytes
 *
 * Capsule binary format (versioned):
 *   0..3    : ASCII 'ARC1' (magic)
 *   4..35   : ephemeral X25519 public key (32 bytes)
 *   36..47  : AES-GCM IV (12 bytes)
 *   48..N-17: ciphertext
 *   N-16..N-1: GCM tag (16 bytes)
 */
@Injectable()
export class ArciumService {
  private readonly logger = new Logger(ArciumService.name);
  private provider: anchor.AnchorProvider;
  private program: anchor.Program;

  private cachedMxePub?: Uint8Array;

  private static readonly MAGIC = Buffer.from('ARC1'); // 4 bytes

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

  private getProgramId(): PublicKey {
    const envPid = this.config.get<string>('ARCIUM_MXE_PROGRAM_ID');
    const idlAddr = (idl as any)?.address;
    return new PublicKey(envPid || idlAddr || (this.program as any).programId);
  }

  /** Fetch MXE X25519 public key (32 bytes). Env MXE_X25519_PUBKEY_B64 overrides on-chain fetch. */
  async getMxePublicKey(): Promise<Uint8Array> {
    if (this.cachedMxePub) return this.cachedMxePub;

    const envB64 = this.config.get<string>('MXE_X25519_PUBKEY_B64');
    if (envB64) {
      const bytes = Buffer.from(envB64, 'base64');
      if (bytes.length !== 32) throw new Error('MXE_X25519_PUBKEY_B64 must decode to 32 bytes');
      this.cachedMxePub = new Uint8Array(bytes);
      return this.cachedMxePub;
    }

    const pid = this.getProgramId();
    const pub = await getMXEPublicKey(this.provider as any, pid);
    if (!pub || pub.length !== 32) throw new Error('Invalid MXE public key');
    this.cachedMxePub = pub;
    return pub;
  }

  /** Convenience: base64 string of the MXE pubkey */
  async getMxePublicKeyB64(): Promise<string> {
    const pk = await this.getMxePublicKey();
    return Buffer.from(pk).toString('base64');
  }

  /**
   * Seal a 32-byte DEK for MXE using X25519 + HKDF-SHA256 → AES-256-GCM.
   * Returns "capsule" bytes suitable for storing on Walrus.
   */
  async sealDekForMxe(dek: Buffer): Promise<Buffer> {
    if (!Buffer.isBuffer(dek) || dek.length !== 32) {
      throw new Error(`DEK must be a 32-byte Buffer, got ${dek?.length}`);
    }

    const mxePub = await this.getMxePublicKey();                 // 32 bytes
    const ephSk = x25519.utils.randomPrivateKey();               // 32 bytes
    const ephPk = x25519.getPublicKey(ephSk);                    // 32 bytes
    const shared = x25519.getSharedSecret(ephSk, mxePub);        // 32 bytes

    // KDF to 32-byte AES key
    const key = hkdfSync('sha256', Buffer.from(shared), Buffer.alloc(0), Buffer.from('arcium-seal-dek'), 32);

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), iv);
    const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([ArciumService.MAGIC, Buffer.from(ephPk), iv, ciphertext, tag]);
  }

  /** Phase 2 placeholder (intentionally throws until reseal circuit is live) */
  async reencryptDekForBuyer(_capsuleForMxe: Buffer, _buyerX25519Pubkey: Uint8Array): Promise<Buffer> {
    throw new Error('reencryptDekForBuyer is unavailable until the MXE reseal circuit is deployed.');
  }
}
