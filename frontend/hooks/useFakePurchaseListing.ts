"use client";

import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram, PublicKey, TransactionInstruction } from "@solana/web3.js";

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

export function useFakePurchaseListing(): PurchaseListingHook {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsignedTx, setUnsignedTx] = useState<string | null>(null);
  const [purchaseIndex, setPurchaseIndex] = useState<number | null>(null);

  const preparePurchase = useCallback(
    async (listingId: string, unitsRequested: number) => {
      if (!publicKey) {
        setError("Wallet not connected");
        return;
      }

      setIsPreparing(true);
      setError(null);

      try {
        console.log("[FAKE] Preparing purchase for listing:", listingId);
        
        // Simulate some delay for realism
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Generate fake transaction data
        const fakeUnsignedTx = "fake_transaction_" + Math.random().toString(36);
        const fakePurchaseIndex = Math.floor(Math.random() * 1000);
        
        setUnsignedTx(fakeUnsignedTx);
        setPurchaseIndex(fakePurchaseIndex);
        
        console.log("[FAKE] Purchase prepared successfully");
      } catch (e: any) {
        console.error("[FAKE] Prepare purchase error:", e);
        setError(e?.message || "Failed to prepare purchase");
      } finally {
        setIsPreparing(false);
      }
    },
    [publicKey]
  );

  const finalizePurchase = useCallback(
    async (listingId: string, unitsRequested: number): Promise<PurchaseResult> => {
      if (!publicKey || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      setIsFinalizing(true);
      setError(null);

      try {
        console.log("[FAKE] Finalizing purchase for listing:", listingId);
        
        // Create a realistic transaction that shows actual payment amount
        const pricePerUnit = 1.5; // $1.50 per unit
        const totalValueSOL = (pricePerUnit * unitsRequested) / 100; // Convert to SOL (assuming 1 SOL = $100 for demo)
        const lamportsToTransfer = Math.floor(totalValueSOL * 1000000000); // Convert SOL to lamports
        
        // Create a fake merchant wallet for the transfer
        const merchantWallet = new PublicKey("11111111111111111111111111111112"); // System program address as fake merchant
        
        const { blockhash } = await connection.getLatestBlockhash();
        const transaction = new Transaction({
          feePayer: publicKey,
          recentBlockhash: blockhash,
        });

        // Add realistic transfer instruction showing actual purchase amount
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: merchantWallet, // Transfer to fake merchant
            lamports: lamportsToTransfer, // Show actual purchase value
          })
        );

        // Add memo instruction to show purchase details
        const memoData = Buffer.from(
          `ChainSensors Purchase: ${unitsRequested} units of sensor data from device ${listingId.substring(0, 8)}`,
          'utf8'
        );
        transaction.add(
          new TransactionInstruction({
            keys: [],
            programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), // Memo program
            data: memoData,
          })
        );

        console.log("[FAKE] Requesting wallet signature...");
        
        // This will trigger the actual wallet popup!
        const signedTransaction = await signTransaction(transaction);
        
        console.log("[FAKE] Transaction signed by wallet!");
        
        // Generate fake transaction signature (don't actually submit to blockchain)
        const fakeTxSignature = "fake_tx_" + Math.random().toString(36).substring(2, 15) + Date.now();
        
        // Create fake purchase record with value > $1 (using the same pricePerUnit from above)
        const totalValue = pricePerUnit * unitsRequested;
        
        const purchaseData = {
          recordPk: "fake_record_" + Math.random().toString(36),
          listingId,
          buyer: publicKey.toBase58(),
          units: unitsRequested,
          txSignature: fakeTxSignature,
          purchaseIndex: purchaseIndex || Math.floor(Math.random() * 1000),
          createdAt: Date.now() / 1000, // Unix timestamp
          dekCapsuleForBuyerCid: "fake_capsule_" + Math.random().toString(36),
          dataCid: "fake_data_" + Math.random().toString(36),
          // Add listing metadata for the purchase
          listingState: "active",
          deviceId: "fake_device_" + listingId.substring(0, 8),
          pricePerUnit: pricePerUnit, // $1.50 per unit
          totalValue: totalValue, // Total purchase value
          expiresAt: (Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days from now
          seller: "fake_seller_" + Math.random().toString(36).substring(2, 8),
          deviceMetadata: {
            deviceName: `BME280 Environmental Sensor`,
            deviceType: "temperature",
            location: { city: "San Francisco", country: "USA" }
          }
        };

        // Store the fake purchase in localStorage so it appears in purchases page
        const existingPurchases = JSON.parse(localStorage.getItem('fakePurchases') || '[]');
        existingPurchases.push(purchaseData);
        localStorage.setItem('fakePurchases', JSON.stringify(existingPurchases));

        console.log(`[FAKE] Purchase completed! Total value: $${totalValue.toFixed(2)}`);
        console.log("[FAKE] Purchase will appear in your purchases page!");
        
        return { txSignature: fakeTxSignature };
      } catch (e: any) {
        console.error("[FAKE] Finalize purchase error:", e);
        setError(e?.message || "Failed to finalize purchase");
        throw e;
      } finally {
        setIsFinalizing(false);
      }
    },
    [publicKey, signTransaction, connection, purchaseIndex]
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
