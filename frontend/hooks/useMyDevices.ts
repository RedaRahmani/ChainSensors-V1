"use client";

import useSWR from "swr";
import { DeviceRecord } from "./types/device";

const API =
  (process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:3003").replace(/\/$/, "");

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return (await res.json()) as DeviceRecord[];
}

export function useMyDevices(sellerPubkey: string | null) {
  const shouldFetch = Boolean(sellerPubkey);
  const endpoint = shouldFetch
    ? `${API}/dps/my-devices?sellerPubkey=${encodeURIComponent(sellerPubkey!)}`
    : null;

  const { data, error, mutate } = useSWR<DeviceRecord[]>(
    endpoint,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  return {
    devices: data,
    isLoading: shouldFetch && !error && !data,
    isError: error,
    refetch: () => mutate(),
  };
}
