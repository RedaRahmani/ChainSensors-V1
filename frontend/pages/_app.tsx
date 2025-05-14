import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { WalletContextProvider } from "@/components/wallet-context-provider";
import "@/styles/globals.css";

export default function App({
    Component,
    pageProps: { session, ...pageProps },
}: AppProps) {

  return (
    <SessionProvider session={session}>
       <WalletContextProvider>
         <Component {...pageProps} />
       </WalletContextProvider>
     </SessionProvider>
   );
 }
