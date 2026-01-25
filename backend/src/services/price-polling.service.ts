import { env } from '../config/env.js';
import { updateAllPrices } from './price-fetcher.service.js';
import { logger } from '../utils/logger.js';

let pollingInterval: NodeJS.Timeout | null = null;
let isPolling = false;

/**
 * Start the price polling service
 * Fetches prices at regular intervals and broadcasts updates via WebSocket
 */
export function startPricePolling(): void {
  if (!env.PRICE_POLL_ENABLED) {
    logger.info('Price polling disabled via PRICE_POLL_ENABLED');
    return;
  }

  if (pollingInterval) {
    logger.warn('Price polling already running');
    return;
  }

  const intervalMs = env.PRICE_POLL_INTERVAL_MS;
  logger.info('Starting price polling', { intervalMs });

  // Fetch immediately on start
  fetchPricesWithRetry();

  // Then fetch at intervals
  pollingInterval = setInterval(() => {
    fetchPricesWithRetry();
  }, intervalMs);
}

/**
 * Stop the price polling service
 */
export function stopPricePolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('Price polling stopped');
  }
}

/**
 * Check if price polling is currently running
 */
export function isPricePollingActive(): boolean {
  return pollingInterval !== null;
}

/**
 * Manually trigger a price update (useful for testing or forced refresh)
 */
export async function triggerPriceUpdate(): Promise<void> {
  await fetchPricesWithRetry();
}

/**
 * Fetch prices with basic retry logic
 */
async function fetchPricesWithRetry(retries = 2): Promise<void> {
  if (isPolling) {
    logger.debug('Price fetch already in progress, skipping');
    return;
  }

  isPolling = true;

  try {
    await updateAllPrices();
  } catch (error) {
    logger.error('Failed to fetch prices', error);

    if (retries > 0) {
      logger.info('Retrying price fetch', { retriesLeft: retries });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      isPolling = false;
      return fetchPricesWithRetry(retries - 1);
    }
  } finally {
    isPolling = false;
  }
}
