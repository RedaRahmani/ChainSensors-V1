import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Generate a new trace ID for request correlation
 */
export function newTraceId(): string {
  return randomUUID();
}

/**
 * Check if debug logging is enabled based on environment variables
 */
function isDebugEnabled(): boolean {
  const logLevel = process.env.LOG_LEVEL?.toLowerCase();
  return logLevel === 'debug' || logLevel === 'verbose';
}

/**
 * Structured logging with key-value pairs and trace correlation.
 * Respects LOG_LEVEL environment variable for debug output.
 */
export function logKV(
  logger: Logger,
  event: string,
  data: Record<string, any>,
  level: 'debug' | 'info' | 'warn' | 'error' = 'info'
): void {
  // Skip debug logs if not in debug mode
  if (level === 'debug' && !isDebugEnabled()) {
    return;
  }

  const logData = {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  };

  const message = JSON.stringify(logData);

  switch (level) {
    case 'debug':
      logger.debug(message);
      break;
    case 'info':
      logger.log(message);
      break;
    case 'warn':
      logger.warn(message);
      break;
    case 'error':
      logger.error(message);
      break;
  }
}
