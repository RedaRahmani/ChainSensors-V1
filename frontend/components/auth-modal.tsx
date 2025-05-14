
"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useWallet, Wallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Wallet as WalletIcon, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWalletContext } from "./wallet-context-provider";

export function AuthModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: session } = useSession();
  const { wallets, select, connect, connected, wallet: currentWallet, disconnect, publicKey } = useWallet();
  const { googleConnected, connectGoogle } = useWalletContext();
  const [activeTab, setActiveTab] = useState<"google" | "wallet">("google");
  const [showWalletPopup, setShowWalletPopup] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null); // Track connecting wallet to prevent duplicate clicks

  useEffect(() => {
    if (session?.user && activeTab === "google" && !googleConnected) {
      connectGoogle(); 
      setActiveTab("wallet");
    }
  }, [session, activeTab, googleConnected, connectGoogle]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && (!session || !connected)) {
      return; 
    }
    onOpenChange(isOpen);
    if (!isOpen) {
      setShowWalletPopup(false); 
    }
  };

  const handleWalletSelect = async (wallet: Wallet) => {
    if (connectingWallet === wallet.adapter.name) return;

    setConnectingWallet(wallet.adapter.name);

    if (!["Installed", "Loadable"].includes(wallet.adapter.readyState)) {
      console.warn(`Wallet ${wallet.adapter.name} is not ready. State: ${wallet.adapter.readyState}`);
      setConnectingWallet(null);
      return;
    }

    try {
      select(wallet.adapter.name);

      let attempts = 0;
      const maxAttempts = 30; 
      while (attempts < maxAttempts && (!currentWallet || currentWallet.adapter.name !== wallet.adapter.name)) {
        await new Promise((resolve) => setTimeout(resolve, 100)); 
        attempts++;
        console.log(`Attempt ${attempts}: Current wallet: ${currentWallet?.adapter.name || "undefined"}`);
      }

      if (!currentWallet || currentWallet.adapter.name !== wallet.adapter.name) {
        console.warn(`Wallet ${wallet.adapter.name} not selected after ${maxAttempts * 100}ms. Retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); 
        if (!currentWallet || currentWallet.adapter.name !== wallet.adapter.name) {
          throw new Error("Wallet selection timed out after retry");
        }
      }

      await connect();
      setShowWalletPopup(false); 
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      disconnect(); 
      setShowWalletPopup(false); 
    } finally {
      setConnectingWallet(null);
    }
  };

  const detectedWallet = !publicKey && wallets.find((w) => w.adapter.readyState === "Installed");
  const displayedWallet = currentWallet || detectedWallet;

  const handleDismissWallet = () => {
    disconnect(); 
    setShowWalletPopup(false);
    setConnectingWallet(null);
  };

  useEffect(() => {
    console.log("Wallets available:", wallets.map((w) => ({
      name: w.adapter.name,
      readyState: w.adapter.readyState,
    })));
    console.log("Current wallet:", currentWallet?.adapter.name, "Public key:", publicKey?.toString());
  }, [wallets, currentWallet, publicKey]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-dark-100/90 backdrop-blur-md border border-primary-500/30 shadow-2xl shadow-primary-500/10 rounded-xl overflow-hidden">
        <DialogHeader className="relative z-20">
          <DialogTitle className="text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-secondary-500 animate-glow-pulse">
            Join Chainsensors
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground text-sm max-w-md mx-auto">
            Sign in with Google to verify your identity, then connect your Solana wallet to access the IoT data marketplace.
          </DialogDescription>
          <button
            onClick={() => {
              handleDismissWallet();
              onOpenChange(false); // Allow dismissing the entire modal
            }}
            className="absolute top-4 right-4 text-muted-foreground hover:text-white z-30"
          >
            <X size={20} />
          </button>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "google" | "wallet")}
          className="w-full mt-6 relative z-20"
        >
          <TabsList className="grid grid-cols-2 bg-dark-200/50 rounded-full p-1 border border-primary-500/20">
            <TabsTrigger
              value="google"
              className={cn(
                "rounded-full py-2.5 text-sm font-medium",
                activeTab === "google" ? "bg-gradient-to-r from-primary-500 to-secondary-500 text-white" : "text-muted-foreground"
              )}
            >
              <Mail className="mr-2 h-4 w-4" />
              Google
            </TabsTrigger>
            <TabsTrigger
              value="wallet"
              disabled={!session}
              className={cn(
                "rounded-full py-2.5 text-sm font-medium",
                !session && "opacity-50 cursor-not-allowed",
                activeTab === "wallet" && session ? "bg-gradient-to-r from-primary-500 to-secondary-500 text-white" : "text-muted-foreground"
              )}
            >
              <WalletIcon className="mr-2 h-4 w-4" />
              Wallet
            </TabsTrigger>
          </TabsList>

          {/* Google Tab */}
          <TabsContent value="google" className="pt-6 pb-4">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center animate-pulse-slow">
                <div className="w-14 h-14 rounded-full bg-dark-100 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground max-w-xs">
                Sign in with Google to verify your account and unlock marketplace features.
              </p>
              <Button
                onClick={() => signIn("google", { callbackUrl: "/" })}
                disabled={googleConnected}
                className={cn(
                  "w-full flex items-center justify-center gap-2 text-sm font-medium",
                  googleConnected
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-white text-black hover:bg-gray-200"
                )}
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                    <path
                      fill="#4285F4"
                      d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
                    />
                    <path
                      fill="#34A853"
                      d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
                    />
                  </g>
                </svg>
                {googleConnected ? "Google Connected" : "Sign in with Google"}
              </Button>
              {session && (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <Check className="h-4 w-4" />
                  Connected as {session.user?.email}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Wallet Tab */}
          <TabsContent value="wallet" className="pt-6 pb-4">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center animate-pulse-slow">
                <div className="w-14 h-14 rounded-full bg-dark-100 flex items-center justify-center">
                  <WalletIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground max-w-xs">
                Connect your Solana wallet to interact with the blockchain and access the marketplace.
              </p>
              <div className="w-full wallet-button-container relative z-50">
                {displayedWallet ? (
                  <div className="flex items-center justify-between p-3 bg-dark-200 rounded-lg border border-primary-500/30 wallet-display">
                    <div className="flex items-center gap-2">
                      {displayedWallet.adapter.icon && (
                        <img
                          src={displayedWallet.adapter.icon}
                          alt={displayedWallet.adapter.name}
                          className="w-6 h-6"
                        />
                      )}
                      <span className="text-white">{displayedWallet.adapter.name}</span>
                      {displayedWallet === detectedWallet && !currentWallet && (
                        <span className="text-green-500 text-sm ml-2">Detected</span>
                      )}
                      {currentWallet && displayedWallet === currentWallet && (
                        <span className="text-green-500 text-sm ml-2">Connected</span>
                      )}
                    </div>
                    <Button
                      onClick={() => setShowWalletPopup(true)}
                      className="bg-transparent border border-primary-500/50 text-primary-500 hover:bg-primary-500/10 text-sm h-8"
                    >
                      Connect Other Wallet
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="wallet-adapter-button w-full"
                    onClick={() => setShowWalletPopup(true)}
                  >
                    Connect Wallet
                  </Button>
                )}
                {showWalletPopup && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60" style={{ pointerEvents: "auto" }}>
                    <div className="bg-dark-200 rounded-lg border border-primary-500/30 p-6 shadow-lg shadow-primary-500/10 animate-fade-in max-w-md w-full mx-4">
                      <h3 className="text-xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-secondary-500 mb-4">
                        Select a Wallet
                      </h3>
                      <div className="space-y-3">
                        {wallets.map((wallet) => (
                          <div
                            key={wallet.adapter.name}
                            className={cn(
                              "flex items-center justify-between p-3 wallet-item cursor-pointer",
                              connectingWallet === wallet.adapter.name && "opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => handleWalletSelect(wallet)}
                          >
                            <div className="flex items-center gap-2">
                              {wallet.adapter.icon && (
                                <img
                                  src={wallet.adapter.icon}
                                  alt={wallet.adapter.name}
                                  className="w-6 h-6"
                                />
                              )}
                              <span className="text-white">{wallet.adapter.name}</span>
                              <span className="text-gray-400 text-sm ml-2">
                                ({wallet.adapter.readyState})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        onClick={handleDismissWallet}
                        className="w-full mt-6 bg-transparent border border-primary-500/50 text-primary-500 hover:bg-primary-500/10"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {connected && (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <Check className="h-4 w-4" />
                  Wallet connected successfully
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 relative z-20">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={!session || !connected}
            className={cn(
              "w-full border-primary-500/50 text-primary-500 hover:bg-primary-500/10",
              session && connected && "bg-green-500 text-white hover:bg-green-600"
            )}
          >
            {session && connected ? "Proceed to Marketplace" : "Complete Authentication"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}