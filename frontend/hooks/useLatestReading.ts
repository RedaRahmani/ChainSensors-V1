"use client";

import { useEffect, useState } from "react";

type ReadingLike = {
  [k: string]: any;
  blobId?: string;
  dataBlobId?: string;
  sampleBlobId?: string;
};

const API =
  (process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:3003").replace(/\/$/, "");

/** Build a preview URL that goes through the backend proxy (no CORS) */
function buildPreviewUrl(blobId?: string) {
  if (!blobId) return undefined;
  return `${API}/walrus/blobs/${blobId}`;
}

export function useLatestReading(deviceId: string) {
  const [reading, setReading] = useState<ReadingLike[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!deviceId) {
      setReading([]);
      setIsLoading(false);
      setIsError(false);
      return;
    }

    const ac = new AbortController();

    async function fetchReading() {
      try {
        setIsLoading(true);
        setIsError(false);

        const url = `${API}/readings/${encodeURIComponent(deviceId)}?limit=2`;

        const res = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
        });

        if (!res.ok) {
          setReading([]);
          return;
        }

        const body = await res.json();

        const arr: ReadingLike[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.readings)
          ? body.readings
          : [];

        const withPreview = arr.map((r) => {
          const blobId =
            r.sampleBlobId || r.dataBlobId || r.blobId || r?.metadataBlobId;
          return { ...r, previewUrl: buildPreviewUrl(blobId) };
        });

        setReading(withPreview);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Error fetching latest readings:", err);
        setIsError(true);
        setReading([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchReading();
    return () => ac.abort();
  }, [deviceId]);

  return { reading, isLoading, isError };
}
