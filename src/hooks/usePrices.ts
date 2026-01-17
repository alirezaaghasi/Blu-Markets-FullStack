/**
 * usePrices - Hook for live price feeds
 *
 * Orchestrates price fetching, caching, and multi-tab coordination.
 * Extracted modules: priceCache.ts, pricePolling.ts, priceCoordinator.ts
 *
 * Features:
 * - LocalStorage caching with TTL
 * - Exponential backoff on errors
 * - Multi-tab coordination (only leader polls)
 * - Page visibility awareness
 * - Online/offline handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllPrices } from '../services/priceService';
import { loadCachedPrices, loadCachedFxRate, cachePrices } from '../services/priceCache';
import { shallowEqualPrices, createServiceErrors, updateServiceErrors, incrementAllErrors, calculateBackoffDelay } from '../services/pricePolling';
import type { ServiceErrors, PollingConfig } from '../services/pricePolling';
import { createTabCoordinator } from '../services/priceCoordinator';
import type { TabCoordinator } from '../services/priceCoordinator';

const DEFAULT_CONFIG: PollingConfig = {
  interval: 30000,
  maxBackoff: 5 * 60 * 1000, // 5 minutes
};

export interface UsePricesResult {
  prices: Record<string, number>;
  fxRate: number;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  refresh: () => Promise<void>;
}

export function usePrices(interval: number = 30000, enabled: boolean = true): UsePricesResult {
  // Initialize from localStorage cache for instant display
  const [prices, setPrices] = useState<Record<string, number>>(loadCachedPrices);
  const [fxRate, setFxRate] = useState<number>(loadCachedFxRate);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Refs for lifecycle management
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const isVisibleRef = useRef<boolean>(true);
  const isOnlineRef = useRef<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const coordinatorRef = useRef<TabCoordinator | null>(null);
  const serviceErrorsRef = useRef<ServiceErrors>(createServiceErrors());

  // Store current values in refs to avoid callback dependencies
  const pricesRef = useRef<Record<string, number>>(prices);
  const fxRateRef = useRef<number>(fxRate);
  pricesRef.current = prices;
  fxRateRef.current = fxRate;

  const config: PollingConfig = { ...DEFAULT_CONFIG, interval };

  // Calculate backoff based on service errors
  const getBackoffDelay = useCallback((): number => {
    return calculateBackoffDelay(serviceErrorsRef.current, config);
  }, [config.interval]);

  // Stabilized refresh callback
  const refresh = useCallback(async (): Promise<void> => {
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
        // Only update lastUpdated when data actually changes (reduces render churn)
        setLastUpdated(result.updatedAt);
      }

      // Only clear error if it was set (avoids unnecessary re-render)
      setError(prev => prev === null ? prev : null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (!isMountedRef.current) return;

      console.error('Price refresh error:', err);
      setError((err as Error).message);
      serviceErrorsRef.current = incrementAllErrors(serviceErrorsRef.current);
    } finally {
      if (isMountedRef.current) {
        // Only update loading if it was true (avoids unnecessary re-render)
        setLoading(prev => prev === false ? prev : false);
      }
    }
  }, [enabled]);

  // Schedule next poll with backoff
  const scheduleNextPoll = useCallback((): void => {
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

      let dataChanged = false;
      setPrices(prev => {
        const merged = { ...prev, ...newPrices };
        if (shallowEqualPrices(prev, merged)) return prev;
        dataChanged = true;
        return merged;
      });

      if (newFxRate && newFxRate !== fxRateRef.current) {
        setFxRate(newFxRate);
        dataChanged = true;
      }

      // Only update lastUpdated when data actually changes (reduces render churn)
      if (dataChanged) {
        setLastUpdated(updatedAt);
      }
      setLoading(prev => prev === false ? prev : false);
      setError(prev => prev === null ? prev : null);
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
    const handleVisibilityChange = (): void => {
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
    const handleOnline = (): void => {
      isOnlineRef.current = true;
      serviceErrorsRef.current = createServiceErrors();
      if (enabled && isVisibleRef.current && coordinatorRef.current?.isLeader) {
        refresh().then(scheduleNextPoll);
      }
    };

    const handleOffline = (): void => {
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
