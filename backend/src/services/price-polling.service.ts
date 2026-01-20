import { env } from '../config/env.js';
import { updateAllPrices } from './price-fetcher.service.js';

let pollingInterval: NodeJS.Timeout | null = null;
let isPolling = false;

/**
 * Start the price polling service
 * Fetches prices at regular intervals and broadcasts updates via WebSocket
 */
export function startPricePolling(): void {
  if (!env.PRICE_POLL_ENABLED) {
    console.log('⏸️  Price polling disabled via PRICE_POLL_ENABLED');
    return;
  }

  if (pollingInterval) {
    console.warn('Price polling already running');
    return;
  }

  const intervalMs = env.PRICE_POLL_INTERVAL_MS;
  console.log(`🔄 Starting price polling (interval: ${intervalMs}ms)`);

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
    console.log('🛑 Price polling stopped');
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
    console.log('⏳ Price fetch already in progress, skipping');
    return;
  }

  isPolling = true;

  try {
    await updateAllPrices();
  } catch (error) {
    console.error('Failed to fetch prices:', error);

    if (retries > 0) {
      console.log(`Retrying price fetch (${retries} retries left)...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      isPolling = false;
      return fetchPricesWithRetry(retries - 1);
    }
  } finally {
    isPolling = false;
  }
}
