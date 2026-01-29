/**
 * Structured logger for Blu Markets
 * In development: Pretty console output
 * In production: JSON format for log aggregation
 *
 * Features:
 * - Request correlation via traceId
 * - Performance timing utilities
 * - Metric counters for operations
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

interface RequestContext {
  traceId: string;
  userId?: string;
  path?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Use process.env directly to avoid circular dependency with env.ts
const NODE_ENV = process.env.NODE_ENV || 'development';
const CURRENT_LEVEL: LogLevel = NODE_ENV === 'production' ? 'info' : 'debug';

// Async local storage for request context (traceId propagation)
const requestContext = new AsyncLocalStorage<RequestContext>();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const reqCtx = getRequestContext();

  // Add traceId if available
  const enrichedContext = {
    ...(reqCtx?.traceId && { traceId: reqCtx.traceId }),
    ...(reqCtx?.userId && { userId: reqCtx.userId }),
    ...context,
  };

  if (NODE_ENV === 'production') {
    return JSON.stringify({ timestamp, level, message, ...enrichedContext });
  }

  const prefix: Record<LogLevel, string> = {
    debug: '[DEBUG]',
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
  };
  const traceStr = reqCtx?.traceId ? ` [${reqCtx.traceId.slice(0, 8)}]` : '';
  const contextStr = Object.keys(enrichedContext).length > 0
    ? ` ${JSON.stringify(enrichedContext)}`
    : '';
  return `${prefix[level]} [${timestamp}]${traceStr} ${message}${contextStr}`;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) console.log(formatMessage('debug', message, context));
  },
  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) console.log(formatMessage('info', message, context));
  },
  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) console.warn(formatMessage('warn', message, context));
  },
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (shouldLog('error')) {
      const errorContext = error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
        : error !== undefined
          ? { error }
          : {};
      console.error(formatMessage('error', message, { ...errorContext, ...context }));
    }
  },
};

export type Logger = typeof logger;

// ============================================================================
// REQUEST CONTEXT (for traceId propagation)
// ============================================================================

/**
 * Run a function with request context (traceId, userId)
 * Use in middleware to propagate context through async operations
 */
export function runWithContext<T>(
  context: RequestContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return requestContext.run(context, fn);
}

/**
 * Create a new request context with a fresh traceId
 */
export function createRequestContext(userId?: string, path?: string): RequestContext {
  return {
    traceId: randomUUID(),
    userId,
    path,
  };
}

/**
 * Get current traceId (or undefined if not in request context)
 */
export function getTraceId(): string | undefined {
  return getRequestContext()?.traceId;
}

// ============================================================================
// PERFORMANCE TIMING
// ============================================================================

/**
 * Timer for measuring operation duration
 */
export function startTimer(): () => number {
  const start = process.hrtime.bigint();
  return () => {
    const end = process.hrtime.bigint();
    return Number(end - start) / 1_000_000; // Convert to milliseconds
  };
}

/**
 * Log operation with timing
 */
export async function logTimed<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const elapsed = startTimer();
  try {
    const result = await fn();
    logger.info(`${operation} completed`, { ...context, durationMs: Math.round(elapsed()) });
    return result;
  } catch (error) {
    logger.error(`${operation} failed`, error, { ...context, durationMs: Math.round(elapsed()) });
    throw error;
  }
}

// ============================================================================
// METRICS COUNTERS (in-memory, for basic observability)
// ============================================================================

const metrics = new Map<string, number>();

/**
 * Increment a metric counter
 */
export function incrementMetric(name: string, amount = 1): void {
  const current = metrics.get(name) || 0;
  metrics.set(name, current + amount);
}

/**
 * Get current metric value
 */
export function getMetric(name: string): number {
  return metrics.get(name) || 0;
}

/**
 * Get all metrics as object
 */
export function getAllMetrics(): Record<string, number> {
  return Object.fromEntries(metrics);
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  metrics.clear();
}
