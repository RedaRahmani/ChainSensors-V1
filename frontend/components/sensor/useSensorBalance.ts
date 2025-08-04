/**
 * Hook for fetching SENSOR token balance
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

export function useSensorBalance() {
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [previousBalance, setPreviousBalance] = useState<string>('0');

  const SENSOR_MINT = process.env.NEXT_PUBLIC_SENSOR_MINT || "qYPF5D94YCN3jfvsdM92Qfu2CukFFbbMmJyHgE6iZUV";
  const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

  const fetchBalance = useCallback(async () => {
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
        const newBalance = accountInfo.amount.toString(); // Keep as string for precision
        
        // Check if balance increased (reward received)
        if (BigInt(newBalance) > BigInt(balance) && BigInt(balance) > BigInt(0)) {
          setPreviousBalance(balance);
        }
        
        setBalance(newBalance);
      } catch (error) {
        // Token account doesn't exist yet
        setBalance('0');
      }
    } catch (error) {
      console.error('Error fetching SENSOR balance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connected, balance, RPC_URL, SENSOR_MINT]);

  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance('0');
      return;
    }

    fetchBalance();
    
    // Poll for balance updates
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [connected, publicKey, fetchBalance]);

  return {
    balance,
    previousBalance,
    isLoading,
    fetchBalance,
    connected
  };
}
