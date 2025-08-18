"use client";

import { useEffect, useMemo, useState } from "react";
import { useWalletContext } from "@/components/wallet-context-provider";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3003";

export type PurchaseRow = {
  recordPk: string;
  buyer: string;
  units: number;
  purchaseIndex?: number | null;
  createdAt?: number | null; // unix (ms or s, best effort)
  dekCapsuleForBuyerCid?: string | null;
  txSignature?: string | null;

  listingState?: string | null;
  listingId?: string | null;
  deviceId?: string | null;
  dataCid?: string | null;
  pricePerUnit?: number | null;
  expiresAt?: number | null; // unix seconds (expected)
  seller?: string | null;
  deviceMetadata?: any | null;
};

export function useMyPurchases() {
  const { connected, publicKey, userType } = useWalletContext();
  const [data, setData] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !publicKey || userType !== "buyer") return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/purchases/buyer/${publicKey}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const { purchases } = (await res.json()) as { purchases: PurchaseRow[] };
        if (!cancelled) setData(purchases || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load purchases");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, publicKey, userType]);

  return { data, loading, error };
}

export function unixToISO(ts?: number | null) {
  if (!ts) return null;
  // Some programs store seconds, some ms. Heuristic:
  const ms = ts < 10_000_000_000 ? ts * 1000 : ts;
  return new Date(ms).toISOString();
}
