// @ts-check
/**
 * usePrices - Hook for live price feeds
 *
 * Orchestrates price fetching, caching, and multi-tab coordination.
 * Extracted modules: priceCache.js, pricePolling.js, priceCoordinator.js
 *
 * Features:
 * - LocalStorage caching with TTL
 * - Exponential backoff on errors
 * - Multi-tab coordination (only leader polls)
 * - Page visibility awareness
 * - Online/offline handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllPrices } from '../services/priceService.js';
import { loadCachedPrices, loadCachedFxRate, cachePrices } from '../services/priceCache.js';
import { shallowEqualPrices, createServiceErrors, updateServiceErrors, incrementAllErrors, calculateBackoffDelay } from '../services/pricePolling.js';
import { createTabCoordinator } from '../services/priceCoordinator.js';

/** @type {import('../services/pricePolling.js').PollingConfig} */
const DEFAULT_CONFIG = {
  interval: 30000,
  maxBackoff: 5 * 60 * 1000, // 5 minutes
};

/**
 * @param {number} interval - Base polling interval in ms
 * @param {boolean} enabled - Whether to enable price polling
 * @returns {{ prices: Record<string, number>, fxRate: number, loading: boolean, error: string|null, lastUpdated: string|null, refresh: () => Promise<void> }}
 */
export function usePrices(interval = 30000, enabled = true) {
  // Initialize from localStorage cache for instant display
  const [prices, setPrices] = useState(loadCachedPrices);
  const [fxRate, setFxRate] = useState(loadCachedFxRate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Refs for lifecycle management
  const timeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const isVisibleRef = useRef(true);
  const isOnlineRef = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const coordinatorRef = useRef(null);
  const serviceErrorsRef = useRef(createServiceErrors());

  // Store current values in refs to avoid callback dependencies
  const pricesRef = useRef(prices);
  const fxRateRef = useRef(fxRate);
  pricesRef.current = prices;
  fxRateRef.current = fxRate;

  const config = { ...DEFAULT_CONFIG, interval };

  // Calculate backoff based on service errors
  const getBackoffDelay = useCallback(() => {
    return calculateBackoffDelay(serviceErrorsRef.current, config);
  }, [config.interval]);

  // Stabilized refresh callback
  const refresh = useCallback(async () => {
    // Skip if disabled, page is hidden, or offline
    if (!enabled || !isVisibleRef.current || !isOnlineRef.current) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const result = await fetchAllPrices(abortControllerRef.current.signal);
      if (!isMountedRef.current) return;

      // Update service errors
      serviceErrorsRef.current = updateServiceErrors(serviceErrorsRef.current, result.errors);

      // Compute new values
      const computedPrices = { ...pricesRef.current, ...result.prices };
      const computedFxRate = result.fxRate || fxRateRef.current;

      // Update state with shallow comparison
      let pricesChanged = false;
      setPrices(prev => {
        if (shallowEqualPrices(prev, computedPrices)) return prev;
        pricesChanged = true;
        return computedPrices;
      });

      let fxChanged = false;
      if (result.fxRate && result.fxRate !== fxRateRef.current) {
        setFxRate(computedFxRate);
        fxChanged = true;
      }

      // Cache and broadcast if values changed
      if (pricesChanged || fxChanged) {
        cachePrices(computedPrices, computedFxRate);
        if (coordinatorRef.current?.isLeader) {
          coordinatorRef.current.broadcastPrices(computedPrices, computedFxRate, result.updatedAt);
        }
      }

      setLastUpdated(result.updatedAt);
      setError(null);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!isMountedRef.current) return;

      console.error('Price refresh error:', err);
      setError(err.message);
      serviceErrorsRef.current = incrementAllErrors(serviceErrorsRef.current);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  // Schedule next poll with backoff
  const scheduleNextPoll = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (enabled && isVisibleRef.current && isMountedRef.current && isOnlineRef.current) {
      const delay = getBackoffDelay();
      timeoutRef.current = setTimeout(async () => {
        await refresh();
        scheduleNextPoll();
      }, delay);
    }
  }, [enabled, refresh, getBackoffDelay]);

  // Initial setup and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    coordinatorRef.current = createTabCoordinator();

    // Handle price broadcasts from leader
    coordinatorRef.current.onPricesReceived((newPrices, newFxRate, updatedAt) => {
      if (!isMountedRef.current) return;

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

    // Start polling if leader and enabled
    if (enabled && isOnlineRef.current) {
      if (coordinatorRef.current.isLeader) {
        refresh().then(scheduleNextPoll);
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (coordinatorRef.current) {
        coordinatorRef.current.cleanup();
        coordinatorRef.current = null;
      }
    };
  }, [enabled, refresh, scheduleNextPoll]);

  // Page visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      isVisibleRef.current = isVisible;

      if (isVisible && enabled && isOnlineRef.current) {
        if (coordinatorRef.current?.isLeader) {
          serviceErrorsRef.current = createServiceErrors();
          refresh().then(scheduleNextPoll);
        } else if (coordinatorRef.current?.tryBecomeLeader()) {
          serviceErrorsRef.current = createServiceErrors();
          refresh().then(scheduleNextPoll);
        }
      } else if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, refresh, scheduleNextPoll]);

  // Online/offline handling
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      serviceErrorsRef.current = createServiceErrors();
      if (enabled && isVisibleRef.current && coordinatorRef.current?.isLeader) {
        refresh().then(scheduleNextPoll);
      }
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
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

  return { prices, fxRate, loading, error, lastUpdated, refresh };
}

export default usePrices;
