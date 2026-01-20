// Price Polling Hook
// Based on PRD Section 29 - Performance Optimizations
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppDispatch, useAppSelector } from './useStore';
import { fetchPrices, fetchFxRate } from '../store/slices/pricesSlice';
import {
  PRICE_POLLING_INTERVAL_MS,
  PRICE_MAX_BACKOFF_MS,
  PRICE_BACKOFF_MULTIPLIER,
} from '../constants/business';

interface UsePricePollingOptions {
  enabled?: boolean;
}

export const usePricePolling = (options: UsePricePollingOptions = {}) => {
  const { enabled = true } = options;
  const dispatch = useAppDispatch();
  const { isLoading, error, updatedAt } = useAppSelector((state) => state.prices);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef<number>(PRICE_POLLING_INTERVAL_MS);
  const consecutiveErrorsRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Fetch all prices
  const fetchAllPrices = useCallback(async () => {
    try {
      await Promise.all([
        dispatch(fetchPrices()).unwrap(),
        dispatch(fetchFxRate()).unwrap(),
      ]);
      // Reset backoff on success
      backoffRef.current = PRICE_POLLING_INTERVAL_MS;
      consecutiveErrorsRef.current = 0;
    } catch (err) {
      // Increase backoff on error
      consecutiveErrorsRef.current += 1;
      backoffRef.current = Math.min(
        backoffRef.current * PRICE_BACKOFF_MULTIPLIER,
        PRICE_MAX_BACKOFF_MS
      );
      console.warn(
        `Price fetch failed (attempt ${consecutiveErrorsRef.current}), next retry in ${backoffRef.current / 1000}s`
      );
    }
  }, [dispatch]);

  // Schedule next poll
  const scheduleNextPoll = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setTimeout(async () => {
      if (appStateRef.current === 'active') {
        await fetchAllPrices();
      }
      scheduleNextPoll();
    }, backoffRef.current);
  }, [fetchAllPrices]);

  // Start polling
  const startPolling = useCallback(() => {
    // Fetch immediately on start
    fetchAllPrices();
    // Then schedule periodic updates
    scheduleNextPoll();
  }, [fetchAllPrices, scheduleNextPoll]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Handle app state changes (pause when backgrounded)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - fetch immediately
        fetchAllPrices();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [fetchAllPrices]);

  // Start/stop polling based on enabled flag and auth state
  useEffect(() => {
    if (enabled && isAuthenticated) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, isAuthenticated, startPolling, stopPolling]);

  // Manual refresh function
  const refresh = useCallback(() => {
    backoffRef.current = PRICE_POLLING_INTERVAL_MS;
    consecutiveErrorsRef.current = 0;
    fetchAllPrices();
  }, [fetchAllPrices]);

  return {
    isLoading,
    error,
    updatedAt,
    refresh,
    startPolling,
    stopPolling,
  };
};

export default usePricePolling;
