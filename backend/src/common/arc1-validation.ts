/**
 * ARC1 capsule validation utilities for ChainSensors.
 * Provides defensive checks for encrypted DEK capsules to prevent
 * purchase flow failures due to malformed or incorrectly sized capsules.
 */

import { Logger } from '@nestjs/common';
import { Buffer } from 'buffer';
import { logKV } from './trace';

const ARC1_HEADER_SIZE = 16; // 16-byte nonce
const ARC1_CIPHERTEXT_SIZE = 128; // 4 * 32 bytes encrypted limbs
const ARC1_EXPECTED_SIZE = ARC1_HEADER_SIZE + ARC1_CIPHERTEXT_SIZE; // 144 bytes
const ARC1_MIN_BUYER_SIZE = 48; // Minimum reasonable size for buyer capsule

/**
 * Inspect ARC1 capsule structure and log analysis.
 */
export function inspectArc1Capsule(
  capsule: Buffer,
  capsuleType: 'mxe' | 'buyer',
  logger: Logger,
  context?: {
    traceId?: string;
    recordPk?: string;
    deviceId?: string;
    cid?: string;
  }
): {
  isValid: boolean;
  size: number;
  hasValidHeader: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  let isValid = true;
  let hasValidHeader = false;

  const size = capsule.length;

  // Size validation
  if (capsuleType === 'mxe') {
    if (size !== ARC1_EXPECTED_SIZE) {
      issues.push(`MXE capsule size ${size} != expected ${ARC1_EXPECTED_SIZE}`);
      isValid = false;
    }
  } else if (capsuleType === 'buyer') {
    if (size < ARC1_MIN_BUYER_SIZE) {
      issues.push(`Buyer capsule size ${size} < minimum ${ARC1_MIN_BUYER_SIZE}`);
      isValid = false;
    }
    if (size !== ARC1_EXPECTED_SIZE) {
      issues.push(`Buyer capsule size ${size} != expected ${ARC1_EXPECTED_SIZE}`);
      // Note: This is a warning for buyer capsules, not necessarily invalid
    }
  }

  // Header validation (basic structure check)
  if (size >= ARC1_HEADER_SIZE) {
    const nonce = capsule.subarray(0, ARC1_HEADER_SIZE);
    // Check if nonce is not all zeros (basic validation)
    const isNonceValid = !nonce.every(byte => byte === 0);
    hasValidHeader = isNonceValid;
    
    if (!isNonceValid) {
      issues.push('Capsule nonce appears to be all zeros');
      isValid = false;
    }
  } else {
    issues.push(`Capsule too small for header (${size} < ${ARC1_HEADER_SIZE})`);
    isValid = false;
  }

  // Log analysis
  logKV(logger, 'arc1.capsule.inspect', {
    traceId: context?.traceId,
    recordPk: context?.recordPk,
    deviceId: context?.deviceId,
    cid: context?.cid,
    capsuleType,
    size,
    isValid,
    hasValidHeader,
    issues: issues.length > 0 ? issues : undefined,
    expectedSize: capsuleType === 'mxe' ? ARC1_EXPECTED_SIZE : null,
    minSize: capsuleType === 'buyer' ? ARC1_MIN_BUYER_SIZE : null,
  }, isValid ? 'debug' : 'warn');

  return {
    isValid,
    size,
    hasValidHeader,
    issues,
  };
}

/**
 * Validate buyer capsule before allowing download.
 * Returns true if capsule is acceptable for download.
 */
export function validateBuyerCapsuleForDownload(
  capsule: Buffer,
  logger: Logger,
  context?: {
    traceId?: string;
    recordPk?: string;
    cid?: string;
  }
): boolean {
  const inspection = inspectArc1Capsule(capsule, 'buyer', logger, context);
  
  if (!inspection.isValid) {
    logKV(logger, 'arc1.buyer.validation.fail', {
      traceId: context?.traceId,
      recordPk: context?.recordPk,
      cid: context?.cid,
      size: inspection.size,
      issues: inspection.issues,
    }, 'error');
    return false;
  }

  // Additional buyer-specific checks
  if (inspection.size < ARC1_MIN_BUYER_SIZE) {
    logKV(logger, 'arc1.buyer.validation.too_small', {
      traceId: context?.traceId,
      recordPk: context?.recordPk,
      cid: context?.cid,
      size: inspection.size,
      minSize: ARC1_MIN_BUYER_SIZE,
    }, 'error');
    return false;
  }

  return true;
}

/**
 * Validate MXE capsule before reseal operation.
 */
export function validateMxeCapsuleForReseal(
  capsule: Buffer,
  logger: Logger,
  context?: {
    traceId?: string;
    recordPk?: string;
    deviceId?: string;
  }
): boolean {
  const inspection = inspectArc1Capsule(capsule, 'mxe', logger, context);
  
  if (!inspection.isValid) {
    logKV(logger, 'arc1.mxe.validation.fail', {
      traceId: context?.traceId,
      recordPk: context?.recordPk,
      deviceId: context?.deviceId,
      size: inspection.size,
      issues: inspection.issues,
    }, 'error');
    return false;
  }

  return true;
}
