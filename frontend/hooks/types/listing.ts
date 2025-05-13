// export enum ListingStatus {
//     Active = "Active",
//     Pending = "Pending",
//     Sold = "Sold",
//   }
  
//   export interface Listing {
//     _id?: string;
//     listingId: string | number;
//     deviceId: string | number;
//     pricePerUnit: number;
//     totalDataUnits: number;
//     status: ListingStatus;
//     createdAt: string | Date;
//   }



// export enum ListingStatus {
//     Pending = 0,
//     Active = 1,
//     Cancelled = 2,
//     Sold = 3,
//   }
  
//   export interface Listing {
//     _id: string;
//     listingId: string;
//     sellerPubkey: string;
//     deviceId: string;
//     dataCid: string;
//     pricePerUnit: number;
//     totalDataUnits: number;
//     expiresAt?: number | null;
//     unsignedTx?: string;
//     txSignature?: string;
//     status: ListingStatus;
//     createdAt: string;
//     updatedAt: string;
//   }


export enum ListingStatus {
    Pending = 0,
    Active = 1,
    Cancelled = 2,
    Sold = 3,
  }
  
  export interface Listing {
    sellerPubkey: any;
    dataCid: any;
    _id: string;
    listingId: string;
    deviceId: string;
    pricePerUnit: number;
    totalDataUnits: number;
    expiresAt?: number | null;
    txSignature?: string;
    status: ListingStatus;
    createdAt: string;
    updatedAt: string;
    deviceMetadata?: {
      deviceName: string;
      model: string;
      location: { city: string; latitude: number; longitude: number };
      dataTypes: { type: string; units: string; frequency: string }[];
    };
  }

//   import useSWR from 'swr';
// import { Listing } from './types/listing';

// const API_ROOT = process.env.NEXT_PUBLIC_API_ROOT || 'http://localhost:3003';

// async function fetcher(url: string) {
//   const res = await fetch(url);
//   if (!res.ok) {
//     const text = await res.text();
//     throw new Error(`API error ${res.status}: ${text}`);
//   }
//   return (await res.json()) as Listing[];
// }

// export function useMyListings(sellerPubkey: string | null) {
//   const shouldFetch = Boolean(sellerPubkey);
//   const endpoint = shouldFetch
//     ? `${API_ROOT}/listings/my-listings?sellerPubkey=${sellerPubkey}`
//     : null;

//   const { data, error, mutate } = useSWR<Listing[]>(
//     endpoint,
//     fetcher,
//     {
//       revalidateOnFocus: false,
//       revalidateOnReconnect: true,
//       dedupingInterval: 5000,
//     }
//   );

//   return {
//     listings: data,
//     isLoading: shouldFetch && !error && !data,
//     isError: error,
//     refetch: () => mutate(),
//   };
// }