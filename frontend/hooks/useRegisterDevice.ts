// frontend/hooks/useRegisterDevice.ts
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL as string;

export function useRegisterDevice() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  return async (csrPem: string, metadata: any) => {
    // 1) Ensure wallet and signing are available
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }
    if (!signTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    // 2) Request unsigned transaction from backend
    const response = await fetch(`${BACKEND_URL}/dps/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrPem, metadata }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    const { deviceId, brokerUrl, unsignedTx, certificatePem } = await response.json();

    // 3) Deserialize transaction
    const rawTx = Buffer.from(unsignedTx, 'base64');
    const tx = Transaction.from(rawTx);

    // 4) Set fee payer to connected wallet
    tx.feePayer = publicKey;

    // 5) Sign transaction with user's wallet
    const signedTx = await signTransaction(tx);
    if (!signedTx) {
      throw new Error('Failed to sign transaction');
    }

    // 6) Send and confirm transaction
    const txid = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(txid, 'confirmed');

    // 7) Return useful info for UI
    return { deviceId, brokerUrl, certificatePem, txid };
  };
}
