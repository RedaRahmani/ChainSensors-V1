"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets"
import { clusterApiUrl } from "@solana/web3.js"
import "@solana/wallet-adapter-react-ui/styles.css"

type WalletContextType = {
  connected: boolean
  publicKey: string | null
  userType: "seller" | "buyer" | null
  setUserType: (type: "seller" | "buyer") => void
  googleConnected: boolean
  connectGoogle: () => void
  disconnectGoogle: () => void
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  publicKey: null,
  userType: null,
  setUserType: () => {},
  googleConnected: false,
  connectGoogle: () => {},
  disconnectGoogle: () => {},
})

export const useWalletContext = () => useContext(WalletContext)

export function WalletContextProvider({ children }: { children: ReactNode }) {
  // You can also provide the custom RPC endpoint here
  const network = WalletAdapterNetwork.Devnet
  const endpoint = clusterApiUrl(network)

  const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletContextContent>{children}</WalletContextContent>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

function WalletContextContent({ children }: { children: ReactNode }) {
  const { connected, publicKey } = useWallet()
  const [userType, setUserType] = useState<"seller" | "buyer" | null>(null)
  const [googleConnected, setGoogleConnected] = useState(false)

  const connectGoogle = () => {
    // Mock Google authentication
    setGoogleConnected(true)
  }

  const disconnectGoogle = () => {
    setGoogleConnected(false)
  }

  return (
    <WalletContext.Provider
      value={{
        connected,
        publicKey: publicKey ? publicKey.toString() : null,
        userType,
        setUserType,
        googleConnected,
        connectGoogle,
        disconnectGoogle,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}
