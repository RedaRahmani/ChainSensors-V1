
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useWalletContext } from "@/components/wallet-context-provider";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, Database, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";
import { SensorBalance, useSensorBalance, useSensorReward, emitReward } from "@/components/sensor";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false, loading: () => <Button disabled>Select Wallet</Button> }
);

export function Navbar() {
  const pathname = usePathname();
  const { connected, userType, setUserType, disconnectGoogle } = useWalletContext();
  const { data: session } = useSession();
  const { disconnect } = useWallet();
  const [scrolled, setScrolled] = useState(false);
  const { balance, isLoading } = useSensorBalance();
  const { rewardSequence } = useSensorReward();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await disconnect();
    // Note: setUserType doesn't accept null in the current type definition
    // This might need to be handled differently in the wallet context
    disconnectGoogle();
    await signOut({ callbackUrl: "/" });
  };

  const navLinks = [
    { name: "Home", href: "/" },
    ...(connected && userType === "seller"
      ? [
          { name: "Dashboard", href: "/seller/dashboard" },
          { name: "My Devices", href: "/seller/devices" },
          { name: "My Listings", href: "/seller/listings" },
        ]
      : []),
    ...(connected && userType === "buyer"
      ? [
          { name: "Marketplace", href: "/buyer/marketplace" },
          { name: "My Purchases", href: "/buyer/purchases" },
        ]
      : []),
    { name: "About", href: "/about" },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "bg-black/80 backdrop-blur-md py-2 shadow-md" : "bg-transparent py-4"
      )}
    >
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center">
            <div className="absolute inset-0.5 rounded-full bg-dark-100 flex items-center justify-center">
              <span className="text-white font-bold text-lg">CS</span>
            </div>
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-secondary-500">
            Chainsensors
          </span>
        </Link>

        <div className="hidden md:flex items-center space-x-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === link.href ? "text-primary" : "text-muted-foreground"
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {!connected ? (
            <div className="custom-wallet-button">
              <WalletMultiButton />
            </div>
          ) : (
            <>
              {/* SENSOR Token Balance */}
              <SensorBalance 
                amount={balance}
                decimals={6}
                symbol="SENSOR"
                loading={isLoading}
                rewardSequence={rewardSequence}
                size="md"
              />
              
              {!userType && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-1">
                      Select Role <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setUserType("seller")}>
                      <Database className="mr-2 h-4 w-4" />
                      <span>Data Seller</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setUserType("buyer")}>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      <span>Data Buyer</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative rounded-full h-8 w-8 p-0">
                    {session?.user?.image ? (
                      <img
                        src={session.user.image}
                        alt="Profile"
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center">
                        <ShoppingCart className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Disconnect</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}