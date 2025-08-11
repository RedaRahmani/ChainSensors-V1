import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import type naclType from "tweetnacl";

interface PurchaseResult {
  txSignature: string;
}

interface PurchaseListingHook {
  preparePurchase: (listingId: string, unitsRequested: number) => Promise<void>;
  finalizePurchase: (listingId: string, unitsRequested: number) => Promise<PurchaseResult>; // UPDATED
  isPreparing: boolean;
  isFinalizing: boolean;
  error: string | null;
  unsignedTx: string | null;
}

export function usePurchaseListing(): PurchaseListingHook {
  const { publicKey, signTransaction } = useWallet();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsignedTx, setUnsignedTx] = useState<string | null>(null);

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

      setIsPreparing(true);
      setError(null);

      try {
        // UPDATED: generate ephemeral X25519 keypair for sealed-box (tweetnacl uses curve25519)
        const nacl: typeof naclType = (await import("tweetnacl")).default;
        const eph = nacl.box.keyPair(); // { publicKey: Uint8Array(32), secretKey: Uint8Array(32) }
        // persist secret to decrypt the DEK later (Phase 2)
        localStorage.setItem(`ephSk:${listingId}`, Buffer.from(eph.secretKey).toString("base64"));

        const response = await fetch("http://localhost:3003/listings/prepare-purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            buyerPubkey: publicKey.toBase58(),
            unitsRequested,
            // UPDATED: send buyer ephemeral pubkey as number[]
            buyerEphemeralPubkey: Array.from(eph.publicKey),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to prepare purchase");
        }

        const { unsignedTx } = await response.json();
        setUnsignedTx(unsignedTx);
      } catch (err: any) {
        setError(err.message || "Failed to prepare purchase");
      } finally {
        setIsPreparing(false);
      }
    },
    [publicKey]
  );

  const finalizePurchase = useCallback(
    async (listingId: string, unitsRequested: number) => { // UPDATED
      if (!publicKey || !signTransaction) {
        throw new Error("Wallet not connected or unable to sign");
      }
      if (!unsignedTx) {
        throw new Error("No transaction to finalize");
      }

      setIsFinalizing(true);
      setError(null);

      try {
        const tx = Transaction.from(Buffer.from(unsignedTx, "base64"));
        const signedTx = await signTransaction(tx);
        const signedTxBase64 = Buffer.from(signedTx.serialize()).toString("base64");

        const response = await fetch("http://localhost:3003/listings/finalize-purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            signedTx: signedTxBase64,
            unitsRequested, // UPDATED: backend expects it
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to finalize purchase");
        }

        const result = await response.json();
        return result as PurchaseResult;
      } catch (err: any) {
        setError(err.message || "Failed to finalize purchase");
        throw err;
      } finally {
        setIsFinalizing(false);
        setUnsignedTx(null);
      }
    },
    [publicKey, signTransaction, unsignedTx]
  );

  return {
    preparePurchase,
    finalizePurchase,
    isPreparing,
    isFinalizing,
    error,
    unsignedTx,
  };
}
