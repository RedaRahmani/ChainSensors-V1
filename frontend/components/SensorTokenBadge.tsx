"use client";

import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Coins, TrendingUp, Zap } from "lucide-react";
import Image from "next/image";

interface SensorTokenBadgeProps {
  className?: string;
}

export interface SensorTokenBadgeRef {
  refreshBalance: () => Promise<void>;
}

export const SensorTokenBadge = forwardRef<SensorTokenBadgeRef, SensorTokenBadgeProps>(
  ({ className = "" }, ref) => {
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showRewardAnimation, setShowRewardAnimation] = useState(false);

  const SENSOR_MINT = process.env.NEXT_PUBLIC_SENSOR_MINT || "qYPF5D94YCN3jfvsdM92Qfu2CukFFbbMmJyHgE6iZUV";
  const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

  // Expose refresh function to parent components
  useImperativeHandle(ref, () => ({
    refreshBalance: fetchBalance
  }));

  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance(0);
      return;
    }

    fetchBalance();
    
    // More frequent polling right after connecting, then slower
    const interval = setInterval(fetchBalance, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [connected, publicKey]);

  const fetchBalance = async () => {
    if (!publicKey || !connected) return;

    try {
      setIsLoading(true);
      const connection = new Connection(RPC_URL, 'confirmed');
      const mintPubkey = new PublicKey(SENSOR_MINT);
      
      // Get associated token account
      const tokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        publicKey
      );

      try {
        const accountInfo = await getAccount(connection, tokenAccount);
        const newBalance = Number(accountInfo.amount) / Math.pow(10, 6); // 6 decimals
        
        // Check if balance increased (reward received)
        if (newBalance > balance && balance > 0) {
          setPreviousBalance(balance);
          setShowRewardAnimation(true);
          setTimeout(() => setShowRewardAnimation(false), 3000);
        }
        
        setBalance(newBalance);
      } catch (error) {
        // Token account doesn't exist yet
        setBalance(0);
      }
    } catch (error) {
      console.error('Error fetching SENSOR balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!connected) {
    return null;
  }

  const rewardAmount = balance - previousBalance;

  return (
    <div className={`relative ${className}`}>
      <Badge
        variant="secondary"
        className="bg-gradient-to-r from-blue-600 via-purple-600 to-green-500 text-white border-0 px-4 py-2 text-sm font-medium shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer"
        onClick={fetchBalance}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-6 h-6 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
            <Image 
              src="/images/sensors/sensor-logo.png"
              alt="SENSOR Token"
              width={16}
              height={16}
              className="w-4 h-4 object-contain"
            />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs text-white/80 font-normal">SENSOR</span>
            <span className="font-bold text-lg leading-none">
              {isLoading ? "..." : balance.toFixed(2)}
            </span>
          </div>
        </div>
      </Badge>

      {/* Bomb Explosion Reward Animation */}
      <AnimatePresence>
        {showRewardAnimation && rewardAmount > 0 && (
          <>
            {/* Explosion particles */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  opacity: 1, 
                  scale: 0,
                  x: 0,
                  y: 0
                }}
                animate={{ 
                  opacity: [1, 1, 0],
                  scale: [0, 1.5, 0],
                  x: Math.cos(i * 45 * Math.PI / 180) * 40,
                  y: Math.sin(i * 45 * Math.PI / 180) * 40,
                }}
                transition={{ 
                  duration: 1.2,
                  ease: "easeOut"
                }}
                className="absolute top-1/2 left-1/2 w-2 h-2 bg-yellow-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"
              />
            ))}
            
            {/* Central explosion burst */}
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ 
                scale: [0, 2, 0],
                opacity: [1, 0.8, 0]
              }}
              transition={{ 
                duration: 0.8,
                ease: "easeOut"
              }}
              className="absolute top-1/2 left-1/2 w-8 h-8 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"
            />
            
            {/* Reward amount popup */}
            <motion.div
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ 
                opacity: [0, 1, 1, 0], 
                y: [0, -50, -60, -80],
                scale: [0.5, 1.2, 1, 1]
              }}
              transition={{
                duration: 2.5,
                times: [0, 0.2, 0.8, 1],
                ease: "easeOut"
              }}
              className="absolute -top-16 left-1/2 transform -translate-x-1/2 pointer-events-none z-50"
            >
              <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-sm font-bold border-2 border-white">
                <Zap className="w-4 h-4 text-yellow-200" />
                <span>+{rewardAmount.toFixed(2)} SENSOR!</span>
                <Zap className="w-4 h-4 text-yellow-200" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Pulsing glow effect on reward */}
      {showRewardAnimation && (
        <motion.div
          initial={{ scale: 1, opacity: 0 }}
          animate={{ 
            scale: [1, 1.3, 1.1, 1],
            opacity: [0, 0.8, 0.6, 0],
            boxShadow: [
              "0 0 0 0 rgba(249, 115, 22, 0)",
              "0 0 20px 10px rgba(249, 115, 22, 0.4)",
              "0 0 30px 15px rgba(249, 115, 22, 0.3)",
              "0 0 0 0 rgba(249, 115, 22, 0)"
            ]
          }}
          transition={{ 
            duration: 2,
          ease: "easeOut"
        }}
        className="absolute inset-0 rounded-full"
      />
    )}
  </div>
);
});

SensorTokenBadge.displayName = "SensorTokenBadge";