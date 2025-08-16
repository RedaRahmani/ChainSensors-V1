import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { EnrollMetadata } from '../app/seller/index';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3003';

function b64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function uint8ToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function useRegisterDevice() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  return async (
    csrPem: string,
    metadata: EnrollMetadata
  ): Promise<{
    deviceId: string;
    certificatePem: string;
    brokerUrl: string;
    txSignature: string;
  }> => {
    if (!publicKey) throw new Error('Wallet not connected');
    if (!signTransaction) throw new Error('Wallet cannot sign transactions');

    // 1) Ask backend to build CSR + unsigned tx
    const enrollRes = await fetch(`${API}/dps/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csrPem,
        metadata,
        sellerPubkey: publicKey.toString(),
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

    // 2) Deserialize, refresh blockhash (keeps Phantom happy), sign
    const tx = Transaction.from(b64ToUint8(unsignedTx));
    if (!tx.feePayer) tx.feePayer = new PublicKey(publicKey);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;

    const signed = await signTransaction(tx);
    const signedB64 = uint8ToB64(signed.serialize());

    // 3) Send back to backend to broadcast & confirm
    const finalizeRes = await fetch(`${API}/dps/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, signedTx: signedB64 }),
    });
    if (!finalizeRes.ok) {
      const errText = await finalizeRes.text();
      throw new Error(`Finalize failed: ${finalizeRes.status} ${errText}`);
    }
    const { txSignature }: { txSignature: string } = await finalizeRes.json();

    return { deviceId, certificatePem, brokerUrl, txSignature };
  };
}
