import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";

interface PurchaseResult {
  txSignature: string;
}

interface PurchaseListingHook {
  preparePurchase: (listingId: string, unitsRequested: number) => Promise<void>;
  finalizePurchase: (listingId: string) => Promise<PurchaseResult>;
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
      console.log("usePurchaseListing: preparePurchase called", { listingId, unitsRequested, publicKey: publicKey?.toBase58() });
      if (!publicKey) {
        console.log("usePurchaseListing: Wallet not connected");
        setError("Wallet not connected");
        return;
      }
      if (unitsRequested <= 0) {
        console.log("usePurchaseListing: Invalid unitsRequested", { unitsRequested });
        setError("Units requested must be greater than 0");
        return;
      }

      setIsPreparing(true);
      setError(null);

      try {
        console.log("usePurchaseListing: Sending prepare-purchase request", { url: "http://localhost:3003/listings/prepare-purchase" });
        const response = await fetch("http://localhost:3003/listings/prepare-purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            buyerPubkey: publicKey.toBase58(),
            unitsRequested,
          }),
        });

        console.log("usePurchaseListing: prepare-purchase response", { status: response.status, ok: response.ok });
        if (!response.ok) {
          const errorData = await response.json();
          console.log("usePurchaseListing: prepare-purchase failed", { errorData });
          throw new Error(errorData.message || "Failed to prepare purchase");
        }

        const { unsignedTx } = await response.json();
        console.log("usePurchaseListing: prepare-purchase succeeded", { unsignedTx: unsignedTx.slice(0, 50) + "..." });
        setUnsignedTx(unsignedTx);
      } catch (err: any) {
        console.log("usePurchaseListing: prepare-purchase error", { error: err.message });
        setError(err.message || "Failed to prepare purchase");
      } finally {
        setIsPreparing(false);
      }
    },
    [publicKey]
  );

  const finalizePurchase = useCallback(
    async (listingId: string) => {
      console.log("usePurchaseListing: finalizePurchase called", { listingId, unsignedTx: unsignedTx?.slice(0, 50) + "..." });
      if (!publicKey || !signTransaction) {
        console.log("usePurchaseListing: Wallet not connected or unable to sign");
        throw new Error("Wallet not connected or unable to sign");
      }
      if (!unsignedTx) {
        console.log("usePurchaseListing: No transaction to finalize");
        throw new Error("No transaction to finalize");
      }

      setIsFinalizing(true);
      setError(null);

      try {
        console.log("usePurchaseListing: Signing transaction");
        const tx = Transaction.from(Buffer.from(unsignedTx, "base64"));
        const signedTx = await signTransaction(tx);
        const signedTxBase64 = Buffer.from(signedTx.serialize()).toString("base64");
        console.log("usePurchaseListing: Transaction signed", { signedTxBase64: signedTxBase64.slice(0, 50) + "..." });

        console.log("usePurchaseListing: Sending finalize-purchase request", { url: "http://localhost:3003/listings/finalize-purchase" });
        const response = await fetch("http://localhost:3003/listings/finalize-purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            signedTx: signedTxBase64,
          }),
        });

        console.log("usePurchaseListing: finalize-purchase response", { status: response.status, ok: response.ok });
        if (!response.ok) {
          const errorData = await response.json();
          console.log("usePurchaseListing: finalize-purchase failed", { errorData });
          throw new Error(errorData.message || "Failed to finalize purchase");
        }

        const result = await response.json();
        console.log("usePurchaseListing: finalize-purchase succeeded", { result });
        return result;
      } catch (err: any) {
        console.log("usePurchaseListing: finalize-purchase error", { error: err.message });
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