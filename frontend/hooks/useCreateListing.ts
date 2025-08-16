// hooks/useCreateListing.ts
"use client";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";

interface PrepareResponse {
  listingId: string;
  unsignedTx: string;
}

interface FinalizeResponse {
  txSignature: string;
}

export interface CreateListingParams {
  deviceId: string;
  dataCid: string;
  /** Walrus blobId of the MXE DEK capsule (string ≤ 64) */
  dekCapsuleForMxeCid: string;
  pricePerUnit: number;
  totalDataUnits: number;
  expiresAt: number | null;
}

const API =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3003";

/** Safe base64 <-> bytes helpers */
function b64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function uint8ToB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

export function useCreateListing() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  return async (params: CreateListingParams): Promise<string> => {
    if (!publicKey) throw new Error("Wallet not connected");
    if (!signTransaction) throw new Error("Wallet cannot sign");

    // Validate capsule id early to avoid 400 from backend
    if (
      !params.dekCapsuleForMxeCid ||
      typeof params.dekCapsuleForMxeCid !== "string" ||
      params.dekCapsuleForMxeCid.length > 64
    ) {
      throw new Error(
        "dekCapsuleForMxeCid is required, must be a string, and ≤ 64 chars"
      );
    }

    // ===== Phase 1: prepare (backend builds tx) =====
    const prepareRes = await fetch(`${API}/listings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: params.deviceId,
        dataCid: params.dataCid,
        dekCapsuleForMxeCid: params.dekCapsuleForMxeCid.trim(),
        pricePerUnit: params.pricePerUnit,
        totalDataUnits: params.totalDataUnits,
        expiresAt: params.expiresAt,
        sellerPubkey: publicKey.toBase58(),
      }),
    });

    if (!prepareRes.ok) {
      const text = await prepareRes.text();
      throw new Error(`Prepare listing failed: ${prepareRes.status} ${text}`);
    }

    const { listingId, unsignedTx }: PrepareResponse =
      await prepareRes.json();

    // Deserialize & refresh blockhash (Phantom-friendly)
    const tx = Transaction.from(b64ToUint8(unsignedTx));
    if (!tx.feePayer) tx.feePayer = new PublicKey(publicKey);
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    // ===== Phase 2: user signs in wallet =====
    const signed = await signTransaction(tx);
    const signedBase64 = uint8ToB64(signed.serialize());

    // ===== Phase 3: finalize (backend broadcasts & confirms) =====
    const finalizeRes = await fetch(`${API}/listings/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, signedTx: signedBase64 }),
    });

    if (!finalizeRes.ok) {
      const text = await finalizeRes.text();
      throw new Error(`Finalize listing failed: ${finalizeRes.status} ${text}`);
    }

    const { txSignature }: FinalizeResponse = await finalizeRes.json();
    return txSignature;
  };
}
