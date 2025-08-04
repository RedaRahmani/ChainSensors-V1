/**
 * Hook for managing SENSOR reward animations and events
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface RewardEvent {
  amount: number;
  timestamp: number;
}

class RewardEventBus {
  private listeners: Set<(amount: number) => void> = new Set();
  
  emit(amount: number) {
    this.listeners.forEach(listener => listener(amount));
  }
  
  subscribe(listener: (amount: number) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

const rewardBus = new RewardEventBus();

/**
 * Emit a reward event globally
 * @param amount - Reward amount received
 */
export function emitReward(amount: number) {
  rewardBus.emit(amount);
}

/**
 * Hook for tracking reward sequence and recent rewards
 */
export function useSensorReward() {
  const [rewardSequence, setRewardSequence] = useState(0);
  const [recentRewards, setRecentRewards] = useState<RewardEvent[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleReward = useCallback((amount: number) => {
    const reward: RewardEvent = {
      amount,
      timestamp: Date.now()
    };

    setRecentRewards(prev => [...prev, reward]);
    setRewardSequence(prev => prev + 1);

    // Trigger haptic feedback if supported
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }

    // Clear old rewards after 1 minute
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setRecentRewards(prev => 
        prev.filter(r => Date.now() - r.timestamp < 60000)
      );
    }, 60000);
  }, []);

  useEffect(() => {
    const unsubscribe = rewardBus.subscribe(handleReward);
    return () => {
      unsubscribe();
    };
  }, [handleReward]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Get total rewards in the last minute
  const getRecentRewardTotal = useCallback(() => {
    const now = Date.now();
    return recentRewards
      .filter(r => now - r.timestamp < 60000)
      .reduce((sum, r) => sum + r.amount, 0);
  }, [recentRewards]);

  return {
    rewardSequence,
    recentRewards,
    getRecentRewardTotal,
    emitReward: (amount: number) => emitReward(amount)
  };
}
