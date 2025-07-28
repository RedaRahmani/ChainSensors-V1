"use client"

import { ReactNode } from "react"
import { SessionProvider } from "next-auth/react"
import { WalletContextProvider } from "@/components/wallet-context-provider"
import { TokenRefreshProvider } from "@/contexts/TokenRefreshContext"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <WalletContextProvider>
        <TokenRefreshProvider>
          {children}
        </TokenRefreshProvider>
      </WalletContextProvider>
    </SessionProvider>
  )
}
