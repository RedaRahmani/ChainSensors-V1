/**
 * Token formatting utilities for SENSOR tokens
 * Handles proper decimal conversion without floating point errors
 */

/**
 * Format token amount from base units to human readable format
 * @param amount - Raw amount in base units (lamports-like)
 * @param decimals - Token decimals (default 6 for SENSOR)
 * @param maxDecimals - Maximum decimal places to show (default 6)
 * @returns Formatted token amount as string
 */
export function formatToken(
  amount: string | number | bigint,
  decimals: number = 6,
  maxDecimals: number = 6
): string {
  try {
    const amountBig = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    
    const wholePart = amountBig / divisor;
    const fractionalPart = amountBig % divisor;
    
    if (fractionalPart === 0n) {
      return wholePart.toString();
    }
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '').slice(0, maxDecimals);
    
    if (trimmedFractional === '') {
      return wholePart.toString();
    }
    
    return `${wholePart}.${trimmedFractional}`;
  } catch (error) {
    console.error('Error formatting token:', error);
    return '0';
  }
}

/**
 * Format token amount for display in compact spaces
 * @param amount - Raw amount in base units
 * @param decimals - Token decimals
 * @returns Shortened format (e.g., 12.3K, 1.2M)
 */
export function formatTokenCompact(
  amount: string | number | bigint,
  decimals: number = 6
): string {
  try {
    const formatted = formatToken(amount, decimals);
    const num = parseFloat(formatted);
    
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    }
    
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    
    if (num >= 1) {
      return num.toFixed(2);
    }
    
    if (num >= 0.01) {
      return num.toFixed(4);
    }
    
    return num.toFixed(6);
  } catch (error) {
    console.error('Error formatting token compact:', error);
    return '0';
  }
}

/**
 * Parse token amount from human readable to base units
 * @param amount - Human readable amount (e.g., "123.45")
 * @param decimals - Token decimals
 * @returns Amount in base units as string
 */
export function parseToken(amount: string, decimals: number = 6): string {
  try {
    const [wholePart = '0', fractionalPart = ''] = amount.split('.');
    const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
    const combined = wholePart + paddedFractional;
    return BigInt(combined).toString();
  } catch (error) {
    console.error('Error parsing token:', error);
    return '0';
  }
}
