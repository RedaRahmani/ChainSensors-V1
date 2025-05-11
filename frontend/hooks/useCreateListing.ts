// hooks/useCreateListing.ts
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';

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
  pricePerUnit: number;
  totalDataUnits: number;
  expiresAt: number | null;
}

export function useCreateListing() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const prepareEndpoint = 'http://localhost:3001/listings';
  const finalizeEndpoint = 'http://localhost:3001/listings/finalize';

  return async (params: CreateListingParams): Promise<string> => {
    if (!publicKey) throw new Error('Wallet not connected');
    if (!signTransaction) throw new Error('Wallet cannot sign');

    // Phase 1: prepare
    const prepareRes = await fetch(prepareEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        sellerPubkey: publicKey.toString(),
      }),
    });
    if (!prepareRes.ok) {
      const text = await prepareRes.text();
      throw new Error(`Prepare listing failed: ${prepareRes.status} ${text}`);
    }
    const { listingId, unsignedTx }: PrepareResponse = await prepareRes.json();

    // Decode the unsigned TX
    const raw = Uint8Array.from(atob(unsignedTx), c => c.charCodeAt(0));
    const tx = Transaction.from(raw);

    // Make sure fee payer is correct
    tx.feePayer = publicKey;

    // Phase 2: have wallet sign it
    const signed = await signTransaction(tx);
    if (!signed) throw new Error('Signing failed');
    const signedBase64 = btoa(String.fromCharCode(...signed.serialize()));

    // Submit signed
    const finalizeRes = await fetch(finalizeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId,
        signedTx: signedBase64,
      }),
    });
    if (!finalizeRes.ok) {
      const text = await finalizeRes.text();
      throw new Error(`Finalize listing failed: ${finalizeRes.status} ${text}`);
    }
    const { txSignature }: FinalizeResponse = await finalizeRes.json();
    return txSignature;
  };
}
