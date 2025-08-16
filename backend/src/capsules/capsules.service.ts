import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalrusService } from '../walrus/walrus.service';
import nacl from 'tweetnacl';

@Injectable()
export class CapsulesService {
  constructor(
    private readonly config: ConfigService,
    private readonly walrus: WalrusService,
  ) {}

  private b64ToBytes(b64: string): Uint8Array {
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  }

  // Sealed-box style "capsule" format:
  // [0..31]  eph_pubkey (32 bytes)
  // [32..55] nonce (24 bytes)
  // [56.. ]  ciphertext = nacl.box(message=DEK, nonce, mxePubKey, eph_secret)
  async createAndUploadCapsuleFromDekB64(dekBase64: string): Promise<{ blobId: string }> {
    if (!dekBase64) throw new BadRequestException('dekBase64 required');
    const dek = this.b64ToBytes(dekBase64);
    if (dek.length !== 32) {
      throw new BadRequestException('DEK must be 32 bytes (base64 of a 32-byte key)');
    }

    const mxePubB64 = this.config.get<string>('MXE_X25519_PUBKEY_BASE64');
    if (!mxePubB64) throw new Error('MXE_X25519_PUBKEY_BASE64 not set');
    const mxePub = this.b64ToBytes(mxePubB64);
    if (mxePub.length !== 32) {
      throw new Error('MXE_X25519_PUBKEY_BASE64 must decode to 32 bytes');
    }

    const eph = nacl.box.keyPair();                          // ephemeral sender key
    const nonce = nacl.randomBytes(nacl.box.nonceLength);    // 24 bytes
    const ct = nacl.box(dek, nonce, mxePub, eph.secretKey);  // encrypt DEK

    const capsule = Buffer.concat([
      Buffer.from(eph.publicKey),  // 32
      Buffer.from(nonce),          // 24
      Buffer.from(ct),             // 48 for 32B msg (32+16)
    ]);

    const blobId = await this.walrus.putCapsule(capsule);
    return { blobId };
  }
}
