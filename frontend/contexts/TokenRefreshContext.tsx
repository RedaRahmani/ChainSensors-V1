"use client";

import React, { createContext, useContext, useCallback, useRef } from 'react';
import { SensorTokenBadgeRef } from '@/components/SensorTokenBadge';

interface TokenRefreshContextType {
  refreshTokenBalance: () => void;
  registerTokenBadge: (ref: React.RefObject<SensorTokenBadgeRef>) => void;
}

const TokenRefreshContext = createContext<TokenRefreshContextType | null>(null);

export function TokenRefreshProvider({ children }: { children: React.ReactNode }) {
  const tokenBadgeRef = useRef<React.RefObject<SensorTokenBadgeRef> | null>(null);

  const registerTokenBadge = useCallback((ref: React.RefObject<SensorTokenBadgeRef>) => {
    tokenBadgeRef.current = ref;
  }, []);

  const refreshTokenBalance = useCallback(async () => {
    if (tokenBadgeRef.current?.current) {
      await tokenBadgeRef.current.current.refreshBalance();
    }
  }, []);

  return (
    <TokenRefreshContext.Provider value={{ refreshTokenBalance, registerTokenBadge }}>
      {children}
    </TokenRefreshContext.Provider>
  );
}

export function useTokenRefresh() {
  const context = useContext(TokenRefreshContext);
  if (!context) {
    throw new Error('useTokenRefresh must be used within a TokenRefreshProvider');
  }
  return context;
}
