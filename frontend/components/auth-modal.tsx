"use client"

import { useState } from "react"
import { useWalletContext } from "@/components/wallet-context-provider"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Check, Wallet, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { connected, googleConnected, connectGoogle } = useWalletContext()
  const [activeTab, setActiveTab] = useState("wallet")

  const handleGoogleAuth = () => {
    connectGoogle()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-dark-100 to-dark-200 border-dark-100 shadow-lg shadow-primary/10">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-secondary-500">
            Connect to Chainsensors
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Connect your wallet to access the decentralized IoT data marketplace
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="wallet" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="wallet" className="data-[state=active]:bg-primary/20">
              <Wallet className="mr-2 h-4 w-4" />
              Wallet
            </TabsTrigger>
            <TabsTrigger
              value="google"
              disabled={!connected}
              className={cn("data-[state=active]:bg-secondary/20", !connected && "opacity-50 cursor-not-allowed")}
            >
              <Mail className="mr-2 h-4 w-4" />
              Google (Optional)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallet" className="space-y-4">
            <div className="flex flex-col items-center justify-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center animate-pulse-slow">
                <div className="w-14 h-14 rounded-full bg-dark-100 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-primary-500" />
                </div>
              </div>

              <p className="text-sm text-center text-muted-foreground max-w-xs">
                Connect your Solana wallet to authenticate and interact with the blockchain
              </p>

              <div className="custom-wallet-button mt-2">
                <WalletMultiButton />
              </div>

              {connected && (
                <div className="flex items-center gap-2 text-sm text-primary mt-2">
                  <Check className="h-4 w-4" />
                  Wallet connected successfully
                </div>
              )}
            </div>

            {connected && (
              <div className="flex justify-center">
                <Button
                  onClick={() => setActiveTab("google")}
                  variant="outline"
                  className="border-secondary/50 text-secondary hover:text-secondary hover:bg-secondary/10"
                >
                  Continue to Google Auth (Optional)
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="google" className="space-y-4">
            <div className="flex flex-col items-center justify-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-secondary-500 to-primary-500 flex items-center justify-center animate-pulse-slow">
                <div className="w-14 h-14 rounded-full bg-dark-100 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-secondary-500" />
                </div>
              </div>

              <p className="text-sm text-center text-muted-foreground max-w-xs">
                Enhance your profile with Google authentication to get a verified badge and additional features
              </p>

              <Button
                onClick={handleGoogleAuth}
                disabled={googleConnected}
                className="bg-white text-black hover:bg-gray-200 flex items-center gap-2"
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
                {googleConnected ? "Google Connected" : "Connect with Google"}
              </Button>

              {googleConnected && (
                <div className="flex items-center gap-2 text-sm text-secondary mt-2">
                  <Check className="h-4 w-4" />
                  Google account connected successfully
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-center gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {connected ? "Continue to App" : "Maybe Later"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
