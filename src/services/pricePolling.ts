/**
 * Price Polling - Interval and backoff logic for price fetching
 *
 * Provides intelligent polling with:
 * - Exponential backoff on errors
 * - Per-service error tracking
 * - Jitter to prevent thundering herd
 */

import type { AllPricesResult } from './priceService';

export interface PollingConfig {
  interval: number;    // Base polling interval in ms
  maxBackoff: number;  // Maximum backoff delay in ms
}

export interface ServiceErrors {
  crypto: number;
  stock: number;
  fx: number;
}

/**
 * Create initial service errors state
 */
export function createServiceErrors(): ServiceErrors {
  return { crypto: 0, stock: 0, fx: 0 };
}

/**
 * Update service errors based on result
 */
export function updateServiceErrors(
  errors: ServiceErrors,
  resultErrors: { crypto: string | null; stock: string | null; fx: string | null }
): ServiceErrors {
  return {
    crypto: resultErrors.crypto ? errors.crypto + 1 : 0,
    stock: resultErrors.stock ? errors.stock + 1 : 0,
    fx: resultErrors.fx ? errors.fx + 1 : 0,
  };
}

/**
 * Increment all service errors (used on total failure)
 */
export function incrementAllErrors(errors: ServiceErrors): ServiceErrors {
  return {
    crypto: errors.crypto + 1,
    stock: errors.stock + 1,
    fx: errors.fx + 1,
  };
}

/**
 * Calculate backoff delay based on service errors
 */
export function calculateBackoffDelay(errors: ServiceErrors, config: PollingConfig): number {
  const maxErrors = Math.max(errors.crypto, errors.stock, errors.fx);
  if (maxErrors === 0) return config.interval;

  // Exponential backoff: interval * 2^errors, capped at max
  const backoff = Math.min(
    config.interval * Math.pow(2, maxErrors),
    config.maxBackoff
  );

  // Add jitter (±20%) to prevent thundering herd
  const jitter = backoff * 0.2 * (Math.random() - 0.5);
  return Math.round(backoff + jitter);
}

/**
 * Shallow compare two price objects
 */
export function shallowEqualPrices(a: Record<string, number>, b: Record<string, number>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export interface PricePoller {
  start: () => void;
  stop: () => void;
  reset: () => void;
  fetchNow: () => Promise<void>;
}

export interface PricePollerCallbacks {
  onFetch: () => Promise<AllPricesResult>;
  onSuccess: (result: AllPricesResult) => void;
  onError: (error: Error) => void;
  canPoll: () => boolean;
}

/**
 * Create a price poller instance
 */
export function createPricePoller(config: PollingConfig, callbacks: PricePollerCallbacks): PricePoller {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let serviceErrors = createServiceErrors();
  let isRunning = false;

  const poll = async (): Promise<void> => {
    if (!isRunning || !callbacks.canPoll()) {
      return;
    }

    try {
      const result = await callbacks.onFetch();
      serviceErrors = updateServiceErrors(serviceErrors, result.errors || { crypto: null, stock: null, fx: null });
      callbacks.onSuccess(result);
    } catch (error) {
      serviceErrors = incrementAllErrors(serviceErrors);
      callbacks.onError(error as Error);
    }

    scheduleNext();
  };

  const scheduleNext = (): void => {
    if (!isRunning) return;

    const delay = calculateBackoffDelay(serviceErrors, config);
    timeoutId = setTimeout(poll, delay);
  };

  return {
    start(): void {
      if (isRunning) return;
      isRunning = true;
      poll(); // Immediate first poll
    },

    stop(): void {
      isRunning = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },

    reset(): void {
      serviceErrors = createServiceErrors();
    },

    async fetchNow(): Promise<void> {
      await poll();
    },
  };
}
