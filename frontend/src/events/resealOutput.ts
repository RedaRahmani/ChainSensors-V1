import { Program, utils } from "@coral-xyz/anchor";

export type ResealEvent = {
  listing: string;
  record: string;
  encryption_key: number[]; // 32 bytes
  nonce: number[];          // 16 bytes (little-endian)
  c0: number[]; c1: number[]; c2: number[]; c3: number[];
};

export function onResealOutput(program: Program, handler: (e: ResealEvent) => void) {
  // Anchor event name exactly as declared in the program: "ResealOutput"
  return program.addEventListener("ResealOutput", (raw: any) => {
    handler({
      listing: raw.listing.toString(),
      record: raw.record.toString(),
      encryption_key: Array.from(raw.encryptionKey ?? raw.encryption_key ?? []),
      nonce: Array.from(raw.nonce ?? []),
      c0: Array.from(raw.c0 ?? []),
      c1: Array.from(raw.c1 ?? []),
      c2: Array.from(raw.c2 ?? []),
      c3: Array.from(raw.c3 ?? []),
    });
  });
}
