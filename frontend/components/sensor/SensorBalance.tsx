"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useSpring, useMotionValue, animate } from 'framer-motion';
import { Eye, EyeOff, Sparkles, Copy } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { 
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { formatToken, formatTokenCompact } from './formatToken';
import { useSensorReward } from './useSensorReward';
import { RewardParticles } from './RewardParticles';

export interface SensorBalanceProps {
  /** Raw amount in base units (e.g., lamports-like for SPL). */
  amount: string | number | bigint;
  /** Token decimals, default 6. */
  decimals?: number;
  /** Token symbol, default "SENSOR". */
  symbol?: string;
  /** Logo URL (fallback to local asset). */
  logoUrl?: string;
  /** Loading flag for skeleton state. */
  loading?: boolean;
  /** Optional: small/medium size variants. */
  size?: "sm" | "md";
  /** Called when user toggles privacy. Persisted internally too. */
  onPrivacyChange?: (hidden: boolean) => void;
  /** Reward animation trigger: when this number increases, animate. */
  rewardSequence?: number;
  /** Optional: on click the chip opens a popover with details. */
  onClick?: () => void;
}

const PRIVACY_KEY = 'sensor.balance.hidden';

export function SensorBalance({
  amount,
  decimals = 6,
  symbol = 'SENSOR',
  logoUrl,
  loading = false,
  size = 'md',
  onPrivacyChange,
  rewardSequence = 0,
  onClick
}: SensorBalanceProps) {
  const [isHidden, setIsHidden] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevAmountRef = useRef<string>('0');
  const { getRecentRewardTotal } = useSensorReward();

  // Motion values for count-up animation
  const displayValue = useMotionValue(0);
  const [animatedAmount, setAnimatedAmount] = useState('0');

  // Load privacy setting from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRIVACY_KEY);
      if (saved) {
        setIsHidden(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load privacy setting:', error);
    }
  }, []);

  // Format the current amount
  const formattedAmount = formatToken(amount, decimals);
  const compactAmount = formatTokenCompact(amount, decimals);
  const displayAmount = size === 'sm' ? compactAmount : formattedAmount;

  // Handle privacy toggle
  const togglePrivacy = useCallback(() => {
    const newHidden = !isHidden;
    setIsHidden(newHidden);
    
    try {
      localStorage.setItem(PRIVACY_KEY, JSON.stringify(newHidden));
    } catch (error) {
      console.warn('Failed to save privacy setting:', error);
    }
    
    onPrivacyChange?.(newHidden);
  }, [isHidden, onPrivacyChange]);

  // Handle reward animation when rewardSequence changes
  useEffect(() => {
    if (rewardSequence > 0 && formattedAmount !== prevAmountRef.current) {
      const from = parseFloat(prevAmountRef.current || '0');
      const to = parseFloat(formattedAmount);
      
      if (to > from) {
        // Trigger glow effect
        setIsGlowing(true);
        setTimeout(() => setIsGlowing(false), 600);

        // Animate count-up
        animate(displayValue, to, {
          duration: 0.8,
          ease: 'easeOut',
          onUpdate: (latest) => {
            setAnimatedAmount(latest.toFixed(decimals).replace(/\.?0+$/, ''));
          }
        });
      }
    }
    prevAmountRef.current = formattedAmount;
  }, [rewardSequence, formattedAmount, decimals, displayValue]);

  // Set initial animated amount
  useEffect(() => {
    if (!loading && animatedAmount === '0' && formattedAmount !== '0') {
      setAnimatedAmount(formattedAmount);
      displayValue.set(parseFloat(formattedAmount));
    }
  }, [formattedAmount, loading, animatedAmount, displayValue]);

  // Handle copy token address (you can replace with actual token mint)
  const copyTokenAddress = useCallback(() => {
    const tokenMint = 'qYPF5D94YCN3jfvsdM92Qfu2CukFFbbMmJyHgE6iZUV'; // Your SENSOR token mint
    navigator.clipboard.writeText(tokenMint);
  }, []);

  // Determine the logo source
  const logoSrc = logoUrl || '/images/sensors/sensor-logo-001.png';

  const recentRewardTotal = getRecentRewardTotal();

  const chipContent = (
    <motion.div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full px-3 py-1.5",
        "backdrop-blur-md border border-white/10 bg-white/5",
        "shadow-[0_0_20px_rgba(0,255,255,0.05)]",
        "hover:bg-white/7 transition-all duration-200",
        "cursor-pointer group",
        size === 'sm' ? 'gap-1.5 px-2 py-1' : 'gap-2 px-3 py-1.5',
        onClick && 'hover:shadow-[0_0_25px_rgba(0,255,255,0.1)]'
      )}
      onClick={onClick}
      animate={{
        boxShadow: isGlowing 
          ? '0 0 30px rgba(16, 185, 129, 0.4), 0 0 60px rgba(16, 185, 129, 0.2)'
          : '0 0 20px rgba(0, 255, 255, 0.05)'
      }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* Gradient border */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 p-[1px]">
        <div className="h-full w-full rounded-full bg-slate-900/90 backdrop-blur-md" />
      </div>

      {/* Content */}
      <div className="relative flex items-center gap-2">
        {/* Token Logo */}
        <div className={cn(
          "relative rounded-full overflow-hidden",
          "shadow-[0_0_10px_rgba(16,185,129,0.3)]",
          size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'
        )}>
          {loading ? (
            <div className="w-full h-full bg-slate-700 animate-pulse rounded-full" />
          ) : (
            <Image
              src={logoSrc}
              alt={`${symbol} logo`}
              width={size === 'sm' ? 20 : 24}
              height={size === 'sm' ? 20 : 24}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to GitHub logo if local fails
                if (e.currentTarget.src !== 'https://raw.githubusercontent.com/khadira1937/chainsensors-assets/main/logos/sensor-logo-011.png') {
                  e.currentTarget.src = 'https://raw.githubusercontent.com/khadira1937/chainsensors-assets/main/logos/sensor-logo-011.png';
                }
              }}
            />
          )}
        </div>

        {/* Token Info */}
        <div className="flex flex-col">
          {size === 'md' && (
            <div className="text-slate-100 font-semibold text-xs leading-tight">
              {symbol}
            </div>
          )}
          <div 
            className={cn(
              "font-mono font-medium",
              size === 'sm' ? 'text-sm' : 'text-sm',
              loading ? 'text-slate-500' : 'text-slate-200'
            )}
            aria-live="polite"
          >
            {loading ? (
              <div className="h-4 w-16 bg-slate-700 animate-pulse rounded" />
            ) : isHidden ? (
              <span className="text-slate-400">•••••</span>
            ) : (
              <motion.span
                key={animatedAmount}
                initial={rewardSequence > 0 ? { scale: 1.1, color: '#10b981' } : false}
                animate={{ scale: 1, color: '#e2e8f0' }}
                transition={{ duration: 0.3 }}
              >
                {animatedAmount}
              </motion.span>
            )}
          </div>
        </div>

        {/* Privacy Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 text-slate-400 hover:text-slate-200",
                  "hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-400/70",
                  size === 'sm' && 'h-5 w-5'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePrivacy();
                }}
                aria-pressed={isHidden}
                aria-label={isHidden ? 'Show balance' : 'Hide balance'}
              >
                {isHidden ? (
                  <EyeOff className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
                ) : (
                  <Eye className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isHidden ? 'Show balance' : 'Hide balance'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </motion.div>
  );

  // If onClick is provided, wrap in HoverCard for details
  if (onClick) {
    return (
      <>
        <HoverCard>
          <HoverCardTrigger asChild>
            {chipContent}
          </HoverCardTrigger>
          <HoverCardContent className="w-80 bg-slate-900/95 border-slate-700/50 backdrop-blur-md">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Image
                  src={logoSrc}
                  alt={`${symbol} logo`}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
                <h4 className="font-semibold text-slate-100">
                  {symbol} Balance
                </h4>
              </div>
              
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-slate-400">Full Balance</p>
                  <p className="font-mono text-lg text-slate-100">
                    {formatToken(amount, decimals, decimals)} {symbol}
                  </p>
                </div>
                
                {recentRewardTotal > 0 && (
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Sparkles className="h-3 w-3" />
                    <span className="text-sm">
                      +{formatToken(recentRewardTotal, decimals)} {symbol} earned
                    </span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800"
                onClick={copyTokenAddress}
              >
                <Copy className="h-3 w-3 mr-2" />
                Copy Token Address
              </Button>
            </div>
          </HoverCardContent>
        </HoverCard>
        <RewardParticles 
          trigger={rewardSequence} 
          containerRef={containerRef}
        />
      </>
    );
  }

  return (
    <>
      {chipContent}
      <RewardParticles 
        trigger={rewardSequence} 
        containerRef={containerRef}
      />
    </>
  );
}
