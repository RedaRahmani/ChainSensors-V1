export function newTraceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => 
    (Math.random() * 16 | 0).toString(16)
  );
}

/**
 * Check if frontend debug logging is enabled
 */
function isDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_E2E === '1';
}

/**
 * Frontend E2E logging with trace correlation.
 * Respects NEXT_PUBLIC_DEBUG_E2E environment variable.
 */
export function felog(
  event: string,
  data: Record<string, any>
): void {
  if (!isDebugEnabled()) {
    return;
  }

  const logData = {
    event: `[E2E] ${event}`,
    timestamp: new Date().toISOString(),
    ...data,
  };

  console.log(JSON.stringify(logData));
}
