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

// frontend/components/wallet-context-provider.tsx
// "use client"
// frontend/components/wallet-context-provider.tsx
// "use client"

// import React, { createContext, useContext, useState, useEffect } from "react"
// import { useRouter, usePathname } from "next/navigation"
// import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"
// import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react"
// import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
// import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets"
// import { clusterApiUrl } from "@solana/web3.js"
// import "@solana/wallet-adapter-react-ui/styles.css"
// import { auth } from "@/lib/firebase"
// import { onAuthStateChanged, User } from "firebase/auth"

// type WalletContextType = {
//   connected: boolean
//   publicKey: string | null
//   userType: "seller" | "buyer" | null
//   setUserType: (type: "seller" | "buyer" | null) => void
//   user: User | null
//   googleConnected: boolean
//   logout: () => void
// }

// const WalletContext = createContext<WalletContextType | undefined>(undefined)

// export function WalletContextProvider({ children }: { children: React.ReactNode }) {
//   const network = WalletAdapterNetwork.Devnet
//   const endpoint = clusterApiUrl(network)
//   const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

//   return (
//     <ConnectionProvider endpoint={endpoint}>
//       <WalletProvider wallets={wallets} autoConnect>
//         <WalletModalProvider>
//           <WalletContextContent>{children}</WalletContextContent>
//         </WalletModalProvider>
//       </WalletProvider>
//     </ConnectionProvider>
//   )
// }

// function WalletContextContent({ children }: { children: React.ReactNode }) {
//   const { connected, publicKey, disconnect } = useWallet()
//   const [userType, setUserType] = useState<"seller" | "buyer" | null>(null)
//   const [user, setUser] = useState<User | null>(null)
//   const [googleConnected, setGoogleConnected] = useState(false)
//   const router = useRouter()
//   const pathname = usePathname()

//   // 1) Restore saved role, listen for Firebase auth events
//   useEffect(() => {
//     const stored = localStorage.getItem("userType")
//     if (stored === "seller" || stored === "buyer") {
//       setUserType(stored)
//     }

//     const unsub = onAuthStateChanged(auth, (u) => {
//       if (u) {
//         setUser(u)
//         setGoogleConnected(true)
//       } else {
//         setUser(null)
//         setGoogleConnected(false)
//         // don't auto-clear role here—only on explicit sign-out
//       }
//     })
//     return () => unsub()
//   }, [])

//   // 2) Only redirect back to “/” when on a protected page AND
//   //    they have neither (wallet+role) nor Google auth
//   useEffect(() => {
//     const onProtected = pathname.startsWith("/seller") || pathname.startsWith("/buyer")
//     const hasWalletAndRole = connected && !!userType
//     if (onProtected && !hasWalletAndRole && !googleConnected) {
//       router.push("/")
//     }
//   }, [connected, userType, googleConnected, pathname, router])

//   const handleSetUserType = (type: "seller" | "buyer" | null) => {
//     setUserType(type)
//     if (type) localStorage.setItem("userType", type)
//     else localStorage.removeItem("userType")
//   }

//   const logout = async () => {
//     await auth.signOut()
//     await disconnect()
//     setUser(null)
//     setUserType(null)
//     setGoogleConnected(false)
//     localStorage.removeItem("userType")
//     router.push("/")
//   }

//   return (
//     <WalletContext.Provider
//       value={{
//         connected,
//         publicKey: publicKey?.toString() ?? null,
//         userType,
//         setUserType: handleSetUserType,
//         user,
//         googleConnected,
//         logout,
//       }}
//     >
//       {children}
//     </WalletContext.Provider>
//   )
// }

// export function useWalletContext() {
//   const ctx = useContext(WalletContext)
//   if (!ctx) throw new Error("useWalletContext must be used inside WalletContextProvider")
//   return ctx
// }

