// frontend/hooks/useRegisterDevice.ts
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { EnrollMetadata } from '../app/seller/index'; // adjust your path

export function useRegisterDevice() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const enrollEndpoint = 'http://localhost:3003/dps/enroll';
  const finalizeEndpoint = 'http://localhost:3003/dps/finalize';

  return async (
    csrPem: string,
    metadata: EnrollMetadata
  ): Promise<{
    deviceId: string;
    certificatePem: string;
    brokerUrl: string;
    txSignature: string;
  }> => {
    // 1) Wallet checks
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }
    if (!signTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    // 2) Phase 1: request unsignedTx + cert
    const enrollRes = await fetch(enrollEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csrPem,
        metadata,
        sellerPubkey: publicKey.toString(),
        token: '123456789'
      }),
    });
    if (!enrollRes.ok) {
      const errText = await enrollRes.text();
      throw new Error(`Enroll failed: ${enrollRes.status} ${errText}`);
    }
    const {
      deviceId,
      certificatePem,
      unsignedTx,
      brokerUrl,
    }: {
      deviceId: string;
      certificatePem: string;
      unsignedTx: string;
      brokerUrl: string;
    } = await enrollRes.json();

    // 3) Decode & deserialize the unsigned transaction
    const raw = Uint8Array.from(
      atob(unsignedTx),
      (c) => c.charCodeAt(0)
    );
    const tx = Transaction.from(raw);
    console.log(tx)
    // 4) (Optional) ensure fee payer is set to this wallet
    tx.feePayer = publicKey;
    console.log(tx.feePayer)
    // 5) Phase 2: have the wallet sign it
    const signedTx = await signTransaction(tx);
    console.log(signedTx)
    if (!signedTx) {
      throw new Error('Failed to sign transaction');
    }
    const signedBase64 = btoa(
      String.fromCharCode(...signedTx.serialize())
    );

    // 6) Submit the signed tx to your backend for on-chain broadcast
    const finalizeRes = await fetch(finalizeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, signedTx: signedBase64 }),
    });
    if (!finalizeRes.ok) {
      const errText = await finalizeRes.text();
      throw new Error(`Finalize failed: ${finalizeRes.status} ${errText}`);
    }
    
    const { txSignature }: { txSignature: string } = await finalizeRes.json();

    // // 7) Return everything the UI needs
    return { deviceId, certificatePem, brokerUrl, txSignature };
  };
}
