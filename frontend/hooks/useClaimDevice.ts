"use client";

import { useWallet } from "@solana/wallet-adapter-react";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3003";

export function useClaimDevice() {
  const { publicKey } = useWallet();

  return async (deviceId: string, code: string): Promise<{ ok: true }> => {
    if (!publicKey) throw new Error("Connect your wallet first");

    const res = await fetch(`${API}/dps/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        code, // same as PoP
        sellerPubkey: publicKey.toString(),
      }),
    });

    if (!res.ok) {
      let msg = await res.text();
      try {
        const j = JSON.parse(msg);
        msg = j?.message || msg;
      } catch {}
      throw new Error(`Claim failed: ${res.status} ${msg}`);
    }
    return res.json();
  };
}
