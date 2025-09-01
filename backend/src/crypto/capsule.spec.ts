import { u128NonceToIv12BE, packArc1Capsule } from './capsule';

describe('Capsule crypto utilities', () => {
  describe('u128NonceToIv12BE', () => {
    it('should convert 16-byte nonce to 12-byte IV', () => {
      // Input: nonce16 = [0x00, 0x01, 0x02, ..., 0x0F]
      const nonce16 = Uint8Array.from([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F
      ]);
      
      const iv12 = u128NonceToIv12BE(nonce16);
      
      // Expect: iv12 = [0x00..0x0B] (first 12 bytes)
      const expected = Uint8Array.from([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0A, 0x0B
      ]);
      
      expect(iv12).toEqual(expected);
      expect(iv12.length).toBe(12);
    });

    it('should throw error for invalid nonce length', () => {
      const invalidNonce = new Uint8Array(15); // Wrong length
      
      expect(() => u128NonceToIv12BE(invalidNonce))
        .toThrow('Expected 16-byte nonce, got 15 bytes');
    });

    it('should handle zero-filled nonce', () => {
      const zeroNonce = new Uint8Array(16); // All zeros
      const iv12 = u128NonceToIv12BE(zeroNonce);
      
      expect(iv12).toEqual(new Uint8Array(12)); // All zeros
      expect(iv12.length).toBe(12);
    });

    it('should handle max-value nonce', () => {
      const maxNonce = new Uint8Array(16).fill(0xFF);
      const iv12 = u128NonceToIv12BE(maxNonce);
      
      expect(iv12).toEqual(new Uint8Array(12).fill(0xFF));
      expect(iv12.length).toBe(12);
    });
  });

  describe('packArc1Capsule', () => {
    it('should pack ARC1 capsule with correct layout', () => {
      // Given fixed inputs
      const senderEphemeral32 = new Uint8Array(32).fill(0xAA);
      const iv12 = new Uint8Array(12).fill(0xBB);
      const ciphertext32 = new Uint8Array(32).fill(0xCC);
      const tag16 = new Uint8Array(16).fill(0xDD);
      
      const capsule = packArc1Capsule({
        senderEphemeral32,
        iv12,
        ciphertext32,
        tag16,
      });
      
      // Assert output length is 96 bytes
      expect(capsule.length).toBe(96);
      
      // Assert magic "ARC1" at bytes [0..4]
      expect(capsule[0]).toBe(0x41); // 'A'
      expect(capsule[1]).toBe(0x52); // 'R'
      expect(capsule[2]).toBe(0x43); // 'C'
      expect(capsule[3]).toBe(0x31); // '1'
      
      // Assert sender ephemeral at bytes [4..36]
      for (let i = 4; i < 36; i++) {
        expect(capsule[i]).toBe(0xAA);
      }
      
      // Assert IV at bytes [36..48]
      for (let i = 36; i < 48; i++) {
        expect(capsule[i]).toBe(0xBB);
      }
      
      // Assert ciphertext at bytes [48..80]
      for (let i = 48; i < 80; i++) {
        expect(capsule[i]).toBe(0xCC);
      }
      
      // Assert tag at bytes [80..96]
      for (let i = 80; i < 96; i++) {
        expect(capsule[i]).toBe(0xDD);
      }
    });

    it('should throw error for invalid senderEphemeral32 length', () => {
      const invalidSender = new Uint8Array(31); // Wrong length
      const iv12 = new Uint8Array(12);
      const ciphertext32 = new Uint8Array(32);
      const tag16 = new Uint8Array(16);
      
      expect(() => packArc1Capsule({
        senderEphemeral32: invalidSender,
        iv12,
        ciphertext32,
        tag16,
      })).toThrow('senderEphemeral32 must be 32 bytes, got 31');
    });

    it('should throw error for invalid iv12 length', () => {
      const senderEphemeral32 = new Uint8Array(32);
      const invalidIv = new Uint8Array(11); // Wrong length
      const ciphertext32 = new Uint8Array(32);
      const tag16 = new Uint8Array(16);
      
      expect(() => packArc1Capsule({
        senderEphemeral32,
        iv12: invalidIv,
        ciphertext32,
        tag16,
      })).toThrow('iv12 must be 12 bytes, got 11');
    });

    it('should throw error for invalid ciphertext32 length', () => {
      const senderEphemeral32 = new Uint8Array(32);
      const iv12 = new Uint8Array(12);
      const invalidCiphertext = new Uint8Array(31); // Wrong length
      const tag16 = new Uint8Array(16);
      
      expect(() => packArc1Capsule({
        senderEphemeral32,
        iv12,
        ciphertext32: invalidCiphertext,
        tag16,
      })).toThrow('ciphertext32 must be 32 bytes, got 31');
    });

    it('should throw error for invalid tag16 length', () => {
      const senderEphemeral32 = new Uint8Array(32);
      const iv12 = new Uint8Array(12);
      const ciphertext32 = new Uint8Array(32);
      const invalidTag = new Uint8Array(15); // Wrong length
      
      expect(() => packArc1Capsule({
        senderEphemeral32,
        iv12,
        ciphertext32,
        tag16: invalidTag,
      })).toThrow('tag16 must be 16 bytes, got 15');
    });

    it('should produce consistent output for same inputs', () => {
      const senderEphemeral32 = new Uint8Array(32).fill(0x11);
      const iv12 = new Uint8Array(12).fill(0x22);
      const ciphertext32 = new Uint8Array(32).fill(0x33);
      const tag16 = new Uint8Array(16).fill(0x44);
      
      const capsule1 = packArc1Capsule({
        senderEphemeral32,
        iv12,
        ciphertext32,
        tag16,
      });
      
      const capsule2 = packArc1Capsule({
        senderEphemeral32,
        iv12,
        ciphertext32,
        tag16,
      });
      
      expect(capsule1).toEqual(capsule2);
    });

    it('should handle edge case with all-zero inputs', () => {
      const senderEphemeral32 = new Uint8Array(32);
      const iv12 = new Uint8Array(12);
      const ciphertext32 = new Uint8Array(32);
      const tag16 = new Uint8Array(16);
      
      const capsule = packArc1Capsule({
        senderEphemeral32,
        iv12,
        ciphertext32,
        tag16,
      });
      
      expect(capsule.length).toBe(96);
      
      // Magic should still be present
      expect(capsule[0]).toBe(0x41); // 'A'
      expect(capsule[1]).toBe(0x52); // 'R'
      expect(capsule[2]).toBe(0x43); // 'C'
      expect(capsule[3]).toBe(0x31); // '1'
      
      // Rest should be zeros
      for (let i = 4; i < 96; i++) {
        expect(capsule[i]).toBe(0x00);
      }
    });

    it('should handle edge case with all-max inputs', () => {
      const senderEphemeral32 = new Uint8Array(32).fill(0xFF);
      const iv12 = new Uint8Array(12).fill(0xFF);
      const ciphertext32 = new Uint8Array(32).fill(0xFF);
      const tag16 = new Uint8Array(16).fill(0xFF);
      
      const capsule = packArc1Capsule({
        senderEphemeral32,
        iv12,
        ciphertext32,
        tag16,
      });
      
      expect(capsule.length).toBe(96);
      
      // Magic should still be present
      expect(capsule[0]).toBe(0x41); // 'A'
      expect(capsule[1]).toBe(0x52); // 'R'
      expect(capsule[2]).toBe(0x43); // 'C'
      expect(capsule[3]).toBe(0x31); // '1'
      
      // Rest should be 0xFF
      for (let i = 4; i < 96; i++) {
        expect(capsule[i]).toBe(0xFF);
      }
    });
  });

  describe('Integration test', () => {
    it('should work with real-world nonce conversion and capsule packing', () => {
      // Simulate a realistic 16-byte nonce from Arcium
      const nonce16 = new Uint8Array([
        0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0,
        0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88
      ]);
      
      // Convert to IV
      const iv12 = u128NonceToIv12BE(nonce16);
      expect(iv12).toEqual(new Uint8Array([
        0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0,
        0x11, 0x22, 0x33, 0x44
      ]));
      
      // Create realistic ephemeral key (simulated)
      const senderEphemeral32 = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        senderEphemeral32[i] = i % 256;
      }
      
      // Create realistic ciphertext and tag
      const ciphertext32 = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        ciphertext32[i] = (i * 3) % 256;
      }
      
      const tag16 = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        tag16[i] = (i * 7) % 256;
      }
      
      // Pack the capsule
      const capsule = packArc1Capsule({
        senderEphemeral32,
        iv12,
        ciphertext32,
        tag16,
      });
      
      expect(capsule.length).toBe(96);
      
      // Verify the layout
      expect(capsule.slice(0, 4)).toEqual(new Uint8Array([0x41, 0x52, 0x43, 0x31])); // "ARC1"
      expect(capsule.slice(4, 36)).toEqual(senderEphemeral32);
      expect(capsule.slice(36, 48)).toEqual(iv12);
      expect(capsule.slice(48, 80)).toEqual(ciphertext32);
      expect(capsule.slice(80, 96)).toEqual(tag16);
    });
  });
});
