// app/layout.tsx
import React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Chainsensors | Decentralized IoT Data Marketplace",
  description:
    "A pioneering decentralized IoT data marketplace powered by the Solana blockchain",
  generator: "v0.dev",
  verification: {
    google: "G8F5jGbtluf_0mrU9FwKbGxK0u7wtbgYyYW4Js81ZiM",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
