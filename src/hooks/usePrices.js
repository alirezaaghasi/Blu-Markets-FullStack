import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllPrices } from '../services/priceService.js';
import { DEFAULT_PRICES, DEFAULT_FX_RATE } from '../constants/index.js';
import { createTabCoordinator } from '../utils/tabCoordinator.js';

// LocalStorage keys for price caching
const PRICE_CACHE_KEY = 'blu_prices_cache';
const FX_CACHE_KEY = 'blu_fx_cache';
const CACHE_TIMESTAMP_KEY = 'blu_prices_cache_ts';

// Cache TTL: 10 minutes (prevents stale data across sessions)
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Shallow compare two price objects
 * Returns true if they are equal
 */
function shallowEqualPrices(a, b) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Check if cache is still valid (within TTL)
 */
function isCacheValid() {
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
 */
function loadCachedPrices() {
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
 */
function loadCachedFxRate() {
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
 * Save prices to localStorage cache (with timestamp for TTL)
 */
function cachePrices(prices, fxRate) {
  try {
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(prices));
    localStorage.setItem(FX_CACHE_KEY, String(fxRate));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
  } catch (e) {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * usePrices - Hook for live price feeds
 *
 * Optimizations:
 * - Shallow comparison: Only updates state when prices actually change
 * - LocalStorage seeding: Loads cached prices on mount for instant display
 * - Enabled flag: Skips polling when disabled (e.g., during onboarding)
 * - Page Visibility API: Pauses polling when page is hidden
 * - setTimeout-based polling: Avoids overlapping requests on slow networks
 * - AbortController: Cancels in-flight requests on unmount
 * - Exponential backoff on errors (with jitter)
 * - navigator.onLine gating + online/offline event listeners
 * - Per-service error tracking for smarter backoff
 * - Multi-tab coordination: Only one tab polls, others receive broadcasts
 *
 * @param {number} interval - Base polling interval in ms (default 30000)
 * @param {boolean} enabled - Whether to enable price polling (default true)
 * @returns {Object} { prices, fxRate, loading, error, lastUpdated, refresh }
 */
export function usePrices(interval = 30000, enabled = true) {
  // Initialize from localStorage cache for instant display
  const [prices, setPrices] = useState(loadCachedPrices);
  const [fxRate, setFxRate] = useState(loadCachedFxRate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const timeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const isVisibleRef = useRef(true);
  const isOnlineRef = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const coordinatorRef = useRef(null);

  // Per-service error counters for smarter backoff
  const serviceErrorsRef = useRef({ crypto: 0, stock: 0, fx: 0 });
  const maxBackoffRef = useRef(5 * 60 * 1000); // Max 5 minutes

  // Store current prices/fxRate in refs to avoid refresh callback dependency churn
  const pricesRef = useRef(prices);
  const fxRateRef = useRef(fxRate);
  pricesRef.current = prices;
  fxRateRef.current = fxRate;

  // Calculate backoff based on worst-performing service
  const getBackoffDelay = useCallback(() => {
    const errors = serviceErrorsRef.current;
    const maxErrors = Math.max(errors.crypto, errors.stock, errors.fx);
    if (maxErrors === 0) return interval;

    // Exponential backoff: interval * 2^errors, capped at max
    const backoff = Math.min(
      interval * Math.pow(2, maxErrors),
      maxBackoffRef.current
    );
    // Add jitter (±20%)
    const jitter = backoff * 0.2 * (Math.random() - 0.5);
    return Math.round(backoff + jitter);
  }, [interval]);

  // Stabilized refresh callback - uses refs to avoid dependency on prices/fxRate
  const refresh = useCallback(async () => {
    // Skip if disabled, page is hidden, or offline
    if (!enabled || !isVisibleRef.current || !isOnlineRef.current) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const result = await fetchAllPrices(abortControllerRef.current.signal);

      // Guard against setting state after unmount
      if (!isMountedRef.current) return;

      // Update per-service error counters
      const errors = serviceErrorsRef.current;
      errors.crypto = result.errors.crypto ? errors.crypto + 1 : 0;
      errors.stock = result.errors.stock ? errors.stock + 1 : 0;
      errors.fx = result.errors.fx ? errors.fx + 1 : 0;

      // Compute new values upfront so we can cache them correctly
      // (refs still hold old values until next render)
      const computedPrices = { ...pricesRef.current, ...result.prices };
      const computedFxRate = result.fxRate || fxRateRef.current;

      // Use functional update with shallow compare to avoid unnecessary re-renders
      let pricesChanged = false;
      setPrices(prev => {
        if (shallowEqualPrices(prev, computedPrices)) {
          return prev; // Return same reference to avoid re-render
        }
        pricesChanged = true;
        return computedPrices;
      });

      // Only update fxRate if it changed
      let fxChanged = false;
      if (result.fxRate && result.fxRate !== fxRateRef.current) {
        setFxRate(computedFxRate);
        fxChanged = true;
      }

      // Cache using computed values (not stale refs)
      if (pricesChanged || fxChanged) {
        cachePrices(computedPrices, computedFxRate);

        // Broadcast to other tabs if we're the leader
        if (coordinatorRef.current?.isLeader) {
          coordinatorRef.current.broadcastPrices(computedPrices, computedFxRate, result.updatedAt);
        }
      }

      setLastUpdated(result.updatedAt);
      setError(null);
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError') return;

      // Guard against setting state after unmount
      if (!isMountedRef.current) return;

      console.error('Price refresh error:', err);
      setError(err.message);

      // Increment all service errors on total failure
      const errors = serviceErrorsRef.current;
      errors.crypto++;
      errors.stock++;
      errors.fx++;
    } finally {
      // Guard against setting state after unmount
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]); // Removed prices/fxRate dependencies - using refs instead

  // Schedule next poll using setTimeout (with backoff on errors)
  const scheduleNextPoll = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (enabled && isVisibleRef.current && isMountedRef.current && isOnlineRef.current) {
      const delay = getBackoffDelay();
      timeoutRef.current = setTimeout(async () => {
        await refresh();
        scheduleNextPoll();
      }, delay);
    }
  }, [enabled, refresh, getBackoffDelay]);

  // Initial fetch (only when enabled)
  // Multi-tab coordination: only leader tab polls, followers receive broadcasts
  useEffect(() => {
    isMountedRef.current = true;

    // Create tab coordinator for multi-tab price sync
    coordinatorRef.current = createTabCoordinator();

    // Set up callback to receive prices from leader tab
    coordinatorRef.current.onPricesReceived((newPrices, newFxRate, updatedAt) => {
      if (!isMountedRef.current) return;

      // Update state with broadcast prices
      setPrices(prev => {
        const merged = { ...prev, ...newPrices };
        if (shallowEqualPrices(prev, merged)) return prev;
        return merged;
      });

      if (newFxRate && newFxRate !== fxRateRef.current) {
        setFxRate(newFxRate);
      }

      setLastUpdated(updatedAt);
      setLoading(false);
      setError(null);
    });

    if (enabled && isOnlineRef.current) {
      // Only poll if we're the leader tab
      if (coordinatorRef.current.isLeader) {
        refresh().then(scheduleNextPoll);
      } else {
        // Follower tab: just mark as not loading (will receive broadcasts)
        setLoading(false);
      }
    } else {
      // Mark as not loading if disabled
      setLoading(false);
    }

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clean up coordinator
      if (coordinatorRef.current) {
        coordinatorRef.current.cleanup();
        coordinatorRef.current = null;
      }
    };
  }, [enabled, refresh, scheduleNextPoll]);

  // Page Visibility API: Pause polling when page is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      isVisibleRef.current = isVisible;

      if (isVisible && enabled && isOnlineRef.current) {
        // Only resume polling if we're the leader
        if (coordinatorRef.current?.isLeader) {
          serviceErrorsRef.current = { crypto: 0, stock: 0, fx: 0 }; // Reset backoff
          refresh().then(scheduleNextPoll);
        } else if (coordinatorRef.current) {
          // Try to become leader in case previous leader closed
          if (coordinatorRef.current.tryBecomeLeader()) {
            serviceErrorsRef.current = { crypto: 0, stock: 0, fx: 0 };
            refresh().then(scheduleNextPoll);
          }
        }
      } else {
        // Clear pending timeout when page is hidden
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, refresh, scheduleNextPoll]);

  // Online/Offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      serviceErrorsRef.current = { crypto: 0, stock: 0, fx: 0 }; // Reset backoff

      // Only poll if we're the leader
      if (enabled && isVisibleRef.current && coordinatorRef.current?.isLeader) {
        refresh().then(scheduleNextPoll);
      }
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
      // Clear pending timeout when going offline
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, refresh, scheduleNextPoll]);

  return {
    prices,
    fxRate,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}

export default usePrices;
