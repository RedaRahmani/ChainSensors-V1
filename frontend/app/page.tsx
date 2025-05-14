"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWalletContext } from "@/components/wallet-context-provider";
import { Navbar } from "@/components/navbar";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { ArrowRight, Database, ShoppingCart, Cpu, BarChart3, Shield, Zap } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { connected, userType, setUserType } = useWalletContext();
  const [showAuthModal, setShowAuthModal] = useState(true); // Open modal on load

  useEffect(() => {
    if (connected && userType === "seller") {
      router.push("/seller/dashboard");
    } else if (connected && userType === "buyer") {
      router.push("/buyer/marketplace");
    }
  }, [connected, userType, router]);

  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-70 z-0"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent to-background z-10"></div>

        <div className="container mx-auto px-4 relative z-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-secondary-500">
                  Decentralized IoT
                </span>
                <br />
                Data Marketplace
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg">
                Monetize your IoT device data or purchase verified, high-quality datasets on the Solana blockchain.
                Transparent, secure, and equitable.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  onClick={() => setShowAuthModal(true)}
                  size="lg"
                  className="bg-gradient-to-r from-primary-500 to-secondary-500 hover:opacity-90 transition-all duration-300 animate-glow-pulse"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUserType("seller");
                      setShowAuthModal(true);
                    }}
                    className="border-primary-500/50 text-primary-500 hover:bg-primary-500/10 flex-1"
                  >
                    <Database className="mr-2 h-4 w-4" />
                    Sell Data
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setUserType("buyer");
                      setShowAuthModal(true);
                    }}
                    className="border-secondary-500/50 text-secondary-500 hover:bg-secondary-500/10 flex-1"
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Buy Data
                  </Button>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative w-full h-[400px] animate-float">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary-500/20 animate-pulse-slow"></div>
                <div
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-secondary-500/20 animate-pulse-slow"
                  style={{ animationDelay: "1s" }}
                ></div>

                <div className="absolute top-1/4 left-1/4 w-16 h-16 rounded-lg bg-dark-100 border border-primary-500/50 shadow-lg shadow-primary-500/20 flex items-center justify-center">
                  <Cpu className="h-8 w-8 text-primary-500" />
                </div>

                <div className="absolute top-1/3 right-1/4 w-20 h-20 rounded-lg bg-dark-100 border border-secondary-500/50 shadow-lg shadow-secondary-500/20 flex items-center justify-center">
                  <BarChart3 className="h-10 w-10 text-secondary-500" />
                </div>

                <div className="absolute bottom-1/4 left-1/3 w-24 h-24 rounded-lg bg-dark-100 border border-primary-500/50 shadow-lg shadow-primary-500/20 flex items-center justify-center">
                  <Shield className="h-12 w-12 text-primary-500" />
                </div>

                <div className="absolute bottom-1/3 right-1/5 w-16 h-16 rounded-lg bg-dark-100 border border-secondary-500/50 shadow-lg shadow-secondary-500/20 flex items-center justify-center">
                  <Zap className="h-8 w-8 text-secondary-500" />
                </div>

                {/* Animated connection lines */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
                  <path
                    d="M100,100 Q200,50 300,150"
                    stroke="url(#lineGradient)"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="5,5"
                    className="animate-data-flow"
                  />
                  <path
                    d="M300,150 Q250,200 150,250"
                    stroke="url(#lineGradient)"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="5,5"
                    className="animate-data-flow"
                    style={{ animationDelay: "1s" }}
                  />
                  <path
                    d="M150,250 Q100,300 250,300"
                    stroke="url(#lineGradient)"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="5,5"
                    className="animate-data-flow"
                    style={{ animationDelay: "2s" }}
                  />
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00CC99" />
                      <stop offset="100%" stopColor="#00A3FF" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative">
        <div className="absolute inset-0 data-flow-bg opacity-30 z-0"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-secondary-500">
                Revolutionary IoT Data Exchange
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Chainsensors combines blockchain technology with IoT to create a secure, transparent marketplace for
              real-time data streams.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-dark-100/50 backdrop-blur-sm rounded-xl p-6 border border-primary-500/20 hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/10 group">
              <div className="w-14 h-14 rounded-lg bg-primary-500/10 flex items-center justify-center mb-6 group-hover:bg-primary-500/20 transition-all duration-300">
                <Database className="h-7 w-7 text-primary-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">Monetize Your IoT Data</h3>
              <p className="text-muted-foreground">
                Connect your devices, set your price, and start earning SOL for the valuable data your sensors collect.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-dark-100/50 backdrop-blur-sm rounded-xl p-6 border border-secondary-500/20 hover:border-secondary-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-secondary-500/10 group">
              <div className="w-14 h-14 rounded-lg bg-secondary-500/10 flex items-center justify-center mb-6 group-hover:bg-secondary-500/20 transition-all duration-300">
                <ShoppingCart className="h-7 w-7 text-secondary-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">Access Quality Datasets</h3>
              <p className="text-muted-foreground">
                Browse verified IoT data streams from around the world, with transparent pricing and instant access.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-dark-100/50 backdrop-blur-sm rounded-xl p-6 border border-primary-500/20 hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/10 group">
              <div className="w-14 h-14 rounded-lg bg-primary-500/10 flex items-center justify-center mb-6 group-hover:bg-primary-500/20 transition-all duration-300">
                <Shield className="h-7 w-7 text-primary-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">Blockchain Security</h3>
              <p className="text-muted-foreground">
                All transactions and data authenticity are secured by Solana's high-performance blockchain technology.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}