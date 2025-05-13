// hooks/useMyDevices.ts
import useSWR from 'swr'
import { DeviceRecord } from './types/device'

const API_ROOT = process.env.NEXT_PUBLIC_API_ROOT || 'http://localhost:3003'

// Simplified fetcher: takes a URL string, returns parsed JSON or throws
async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return (await res.json()) as DeviceRecord[]
}

export function useMyDevices(sellerPubkey: string | null) {
  const shouldFetch = Boolean(sellerPubkey)
  const endpoint = shouldFetch
    ? `${API_ROOT}/dps/my-devices?sellerPubkey=${sellerPubkey}`
    : null

  const { data, error, mutate } = useSWR<DeviceRecord[]>(
    endpoint,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  )

  return {
    devices: data,
    isLoading: shouldFetch && !error && !data,
    isError: error,
    refetch: () => mutate(),
  }
}
