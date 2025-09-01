/**
 * ARC1 Capsule utilities for ChainSensors
 * Handles the packing and conversion of cryptographic capsules for Arcium integration
 */

/**
 * Converts a 16-byte nonce to a 12-byte IV for AES-GCM
 * Takes the first 12 bytes of the 16-byte nonce
 */
export function u128NonceToIv12BE(nonce16: Uint8Array): Uint8Array {
  if (nonce16.length !== 16) {
    throw new Error(`Expected 16-byte nonce, got ${nonce16.length} bytes`);
  }
  
  // Take the first 12 bytes as the IV
  return nonce16.slice(0, 12);
}

/**
 * Packs an ARC1 capsule with the standard layout:
 * - 4 bytes: "ARC1" magic
 * - 32 bytes: sender ephemeral public key
 * - 12 bytes: IV
 * - 32 bytes: ciphertext
 * - 16 bytes: authentication tag
 * Total: 96 bytes
 */
export function packArc1Capsule(params: {
  senderEphemeral32: Uint8Array;
  iv12: Uint8Array;
  ciphertext32: Uint8Array;
  tag16: Uint8Array;
}): Uint8Array {
  const { senderEphemeral32, iv12, ciphertext32, tag16 } = params;

  // Validate input lengths
  if (senderEphemeral32.length !== 32) {
    throw new Error(`senderEphemeral32 must be 32 bytes, got ${senderEphemeral32.length}`);
  }
  if (iv12.length !== 12) {
    throw new Error(`iv12 must be 12 bytes, got ${iv12.length}`);
  }
  if (ciphertext32.length !== 32) {
    throw new Error(`ciphertext32 must be 32 bytes, got ${ciphertext32.length}`);
  }
  if (tag16.length !== 16) {
    throw new Error(`tag16 must be 16 bytes, got ${tag16.length}`);
  }

  // Create the 96-byte capsule
  const capsule = new Uint8Array(96);
  let offset = 0;

  // Magic "ARC1" (4 bytes)
  capsule[0] = 0x41; // 'A'
  capsule[1] = 0x52; // 'R'
  capsule[2] = 0x43; // 'C'
  capsule[3] = 0x31; // '1'
  offset = 4;

  // Sender ephemeral public key (32 bytes)
  capsule.set(senderEphemeral32, offset);
  offset += 32;

  // IV (12 bytes)
  capsule.set(iv12, offset);
  offset += 12;

  // Ciphertext (32 bytes)
  capsule.set(ciphertext32, offset);
  offset += 32;

  // Authentication tag (16 bytes)
  capsule.set(tag16, offset);

  return capsule;
}
