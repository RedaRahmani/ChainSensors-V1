"use client";

import { useState, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, PublicKey } from "@solana/web3.js";
import type naclType from "tweetnacl";

interface PurchaseResult {
  txSignature: string;
}

interface PurchaseListingHook {
  preparePurchase: (listingId: string, unitsRequested: number) => Promise<void>;
  finalizePurchase: (listingId: string, unitsRequested: number) => Promise<PurchaseResult>;
  isPreparing: boolean;
  isFinalizing: boolean;
  error: string | null;
  unsignedTx: string | null;
  purchaseIndex: number | null;
}

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3003";

function u8ToB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function usePurchaseListing(): PurchaseListingHook {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [isPreparing, setIsPreparing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsignedTx, setUnsignedTx] = useState<string | null>(null);
  const [purchaseIndex, setPurchaseIndex] = useState<number | null>(null);

  const unsignedTxRef = useRef<string | null>(null);
  const purchaseIndexRef = useRef<number | null>(null);

  const preparePurchase = useCallback(
    async (listingId: string, unitsRequested: number) => {
      if (!publicKey) {
        setError("Wallet not connected");
        return;
      }
      if (unitsRequested <= 0) {
        setError("Units requested must be greater than 0");
        return;
      }
      if (isPreparing) return;

      setIsPreparing(true);
      setError(null);

      try {
        const nacl: typeof naclType = (await import("tweetnacl")).default;
        const eph = nacl.box.keyPair();
        console.debug("[preparePurchase] eph.publicKey", eph.publicKey);

        const response = await fetch(`${API}/listings/prepare-purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            buyerPubkey: publicKey.toBase58(),
            unitsRequested,
            buyerEphemeralPubkey: Array.from(eph.publicKey),
          }),
        });

        const text = await response.text();
        if (!response.ok) {
          console.error("[preparePurchase] backend error:", text);
          throw new Error(text || "Failed to prepare purchase");
        }
        const json = text ? JSON.parse(text) : {};
        console.debug("[preparePurchase] backend json:", json);

        const uTx: string | undefined = json?.unsignedTx;
        const pIdx: number | undefined = json?.purchaseIndex;
        if (!uTx || typeof pIdx !== "number") {
          throw new Error("Backend did not return unsignedTx/purchaseIndex");
        }

        unsignedTxRef.current = uTx;
        purchaseIndexRef.current = pIdx;

        setUnsignedTx(uTx);
        setPurchaseIndex(pIdx);

        try {
          const key = `ephSk:${listingId}:${pIdx}`;
          localStorage.setItem(key, u8ToB64(eph.secretKey));
          console.debug("[preparePurchase] stored eph secret at", key);
        } catch {}
      } catch (err: any) {
        setError(err?.message || "Failed to prepare purchase");
        unsignedTxRef.current = null;
        purchaseIndexRef.current = null;
        setUnsignedTx(null);
        setPurchaseIndex(null);
      } finally {
        setIsPreparing(false);
      }
    },
    [publicKey, isPreparing]
  );

  const finalizePurchase = useCallback(
    async (listingId: string, unitsRequested: number) => {
      if (!publicKey || !signTransaction) {
        throw new Error("Wallet not connected or unable to sign");
      }

      const uTx = unsignedTxRef.current;
      if (!uTx) {
        throw new Error("No transaction to finalize");
      }

      setIsFinalizing(true);
      setError(null);

      try {
        const tx = Transaction.from(b64ToU8(uTx));
        if (!tx.feePayer) tx.feePayer = new PublicKey(publicKey);
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;

        const signedTx = await signTransaction(tx);
        const signedTxBase64 = u8ToB64(signedTx.serialize());
        console.debug("[finalizePurchase] sending signedTx len", signedTxBase64.length);

        const response = await fetch(`${API}/listings/finalize-purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            signedTx: signedTxBase64,
            unitsRequested,
          }),
        });

        const text = await response.text();
        if (!response.ok) {
          console.error("[finalizePurchase] backend error", text);
          throw new Error(text || "Failed to finalize purchase");
        }

        const result = text ? JSON.parse(text) : {};
        console.debug("[finalizePurchase] result", result);
        return result as PurchaseResult;
      } catch (err: any) {
        setError(err?.message || "Failed to finalize purchase");
        throw err;
      } finally {
        setIsFinalizing(false);
        unsignedTxRef.current = null;
        purchaseIndexRef.current = null;
        setUnsignedTx(null);
      }
    },
    [publicKey, signTransaction, connection]
  );

  return {
    preparePurchase,
    finalizePurchase,
    isPreparing,
    isFinalizing,
    error,
    unsignedTx,
    purchaseIndex,
  };
}
