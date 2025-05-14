"use client"

import { ReactNode } from "react"
import { SessionProvider } from "next-auth/react"
import { WalletContextProvider } from "@/components/wallet-context-provider"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <WalletContextProvider>
        {children}
      </WalletContextProvider>
    </SessionProvider>
  )
}
