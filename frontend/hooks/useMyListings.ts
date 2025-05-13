// import { useState, useEffect } from 'react';
// import { Listing } from '@/hooks/types/listing';

// export function useMyListings(publicKey: string | null) {
//   const [listings, setListings] = useState<Listing[]>([]);
//   const [isLoading, setIsLoading] = useState<boolean>(true);

//   useEffect(() => {
//     if (!publicKey) return;
//     const fetchListings = async () => {
//       setIsLoading(true);
//       try {
//         const response = await fetch(`/api/listings?publicKey=${publicKey}`);
//         const data: Listing[] = await response.json();
//         setListings(data);
//       } catch (error) {
//         console.error('Failed to fetch listings:', error);
//       } finally {
//         setIsLoading(false);
//       }
//     };
//     fetchListings();
//   }, [publicKey]);

//   return { listings, isLoading };
// }
import useSWR from 'swr';
import { Listing } from './types/listing';

const API_ROOT = process.env.NEXT_PUBLIC_API_ROOT || 'http://localhost:3003';

async function fetcher([url, sellerPubkey]: [string, string]) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sellerPubkey }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return (await res.json()) as Listing[];
}

export function useMyListings(sellerPubkey: string | null) {
  const shouldFetch = Boolean(sellerPubkey);
  const endpoint = `${API_ROOT}/listings/by-seller`;

  const { data, error, mutate } = useSWR<Listing[]>(
    shouldFetch ? [endpoint, sellerPubkey!] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  return {
    listings: data,
    isLoading: shouldFetch && !error && !data,
    isError: error,
    refetch: () => mutate(),
  };
}