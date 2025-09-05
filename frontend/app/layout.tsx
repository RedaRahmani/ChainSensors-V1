// app/layout.tsx
import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "./providers";
import Script from "next/script";
import GA from "@/components/ga";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chainsensors | Decentralized IoT Data Marketplace",
  description:
    "A pioneering decentralized IoT data marketplace powered by the Solana blockchain",
  generator: "v0.dev",
  // Search Console
  verification: {
    google: "G8F5jGbtluf_0mrU9FwKbGxK0u7wtbgYyYW4Js81ZiM",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-P0Y1QTDXBK";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { page_path: window.location.pathname });
              `}
            </Script>
          </>
        )}
      </head>
      <body className={inter.className}>
        {/* IMPORTANT: wrap hooks like useSearchParams in Suspense */}
        {GA_ID ? (
          <Suspense fallback={null}>
            <GA gaId={GA_ID} />
          </Suspense>
        ) : null}

        <Providers>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
