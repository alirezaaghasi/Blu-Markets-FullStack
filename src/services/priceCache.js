// @ts-check
/**
 * Price Cache - LocalStorage operations for price caching
 *
 * Provides persistent caching of prices across page reloads with TTL validation.
 * Uses requestIdleCallback for debounced writes to avoid blocking the main thread.
 */

import { DEFAULT_PRICES, DEFAULT_FX_RATE } from '../constants/index';

// LocalStorage keys for price caching
const PRICE_CACHE_KEY = 'blu_prices_cache';
const FX_CACHE_KEY = 'blu_fx_cache';
const CACHE_TIMESTAMP_KEY = 'blu_prices_cache_ts';

// Cache TTL: 10 minutes (prevents stale data across sessions)
const CACHE_TTL_MS = 10 * 60 * 1000;

// Debounce timer for localStorage writes
let cacheWriteTimer = null;
let pendingCacheData = null;

/**
 * Check if cache is still valid (within TTL)
 * @returns {boolean}
 */
export function isCacheValid() {
  try {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return false;
    const age = Date.now() - parseInt(timestamp, 10);
    return age < CACHE_TTL_MS;
  } catch (e) {
    return false;
  }
}

/**
 * Load cached prices from localStorage (with TTL check)
 * @returns {Record<string, number>}
 */
export function loadCachedPrices() {
  try {
    // Check if cache is still valid
    if (!isCacheValid()) {
      return DEFAULT_PRICES;
    }
    const cached = localStorage.getItem(PRICE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Validate structure - must have at least some expected keys
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return { ...DEFAULT_PRICES, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Failed to load cached prices:', e);
  }
  return DEFAULT_PRICES;
}

/**
 * Load cached FX rate from localStorage (with TTL check)
 * @returns {number}
 */
export function loadCachedFxRate() {
  try {
    // Check if cache is still valid (uses same timestamp as prices)
    if (!isCacheValid()) {
      return DEFAULT_FX_RATE;
    }
    const cached = localStorage.getItem(FX_CACHE_KEY);
    if (cached) {
      const parsed = parseFloat(cached);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load cached FX rate:', e);
  }
  return DEFAULT_FX_RATE;
}

/**
 * Save prices to localStorage cache (debounced to reduce main thread blocking)
 * Uses requestIdleCallback when available, falls back to setTimeout
 * @param {Record<string, number>} prices
 * @param {number} fxRate
 */
export function cachePrices(prices, fxRate) {
  // Store pending data
  pendingCacheData = { prices, fxRate };

  // Cancel any pending write
  if (cacheWriteTimer) {
    if (typeof cancelIdleCallback !== 'undefined') {
      cancelIdleCallback(cacheWriteTimer);
    } else {
      clearTimeout(cacheWriteTimer);
    }
  }

  // Schedule write during idle time (or after 1s timeout)
  const writeToStorage = () => {
    if (!pendingCacheData) return;
    try {
      localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(pendingCacheData.prices));
      localStorage.setItem(FX_CACHE_KEY, String(pendingCacheData.fxRate));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
    } catch (e) {
      // Ignore storage errors (quota exceeded, etc.)
    }
    pendingCacheData = null;
    cacheWriteTimer = null;
  };

  if (typeof requestIdleCallback !== 'undefined') {
    cacheWriteTimer = requestIdleCallback(writeToStorage, { timeout: 1000 });
  } else {
    // Fallback for browsers without requestIdleCallback
    cacheWriteTimer = setTimeout(writeToStorage, 100);
  }
}

/**
 * Clear all cached price data
 */
export function clearPriceCache() {
  try {
    localStorage.removeItem(PRICE_CACHE_KEY);
    localStorage.removeItem(FX_CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  } catch (e) {
    // Ignore storage errors
  }
}
