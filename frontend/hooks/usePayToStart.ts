"use client";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";

const API =
  (process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:3003").replace(/\/$/, "");

function b64ToU8(b64: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function u8ToB64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function usePayToStart() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  return async (contact: {
    fullName: string;
    email: string;
    phone?: string;
    address: string;
  }): Promise<{ orderId: string; txSignature: string }> => {
    if (!publicKey) throw new Error("Wallet not connected");
    if (!signTransaction) throw new Error("Wallet cannot sign transactions");

    // 1) ask backend for unsigned transfer tx
    const intentRes = await fetch(`${API}/dps/pay-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contact, sellerPubkey: publicKey.toString() }),
    });
    if (!intentRes.ok) throw new Error(await intentRes.text());
    const { orderId, unsignedTxB64 } = await intentRes.json();

    // 2) sign locally
    const tx = Transaction.from(b64ToU8(unsignedTxB64));
    if (!tx.feePayer) tx.feePayer = new PublicKey(publicKey);
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    const signed = await signTransaction(tx);

    // 3) send signed tx back for broadcast
    const finRes = await fetch(`${API}/dps/pay-finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        signedTxB64: u8ToB64(signed.serialize()),
      }),
    });
    if (!finRes.ok) throw new Error(await finRes.text());
    const { txSignature } = await finRes.json();
    return { orderId, txSignature };
  };
}
