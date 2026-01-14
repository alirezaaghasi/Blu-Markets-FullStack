import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllPrices } from '../services/priceService.js';
import { DEFAULT_PRICES, DEFAULT_FX_RATE } from '../constants/index.js';

/**
 * usePrices - Hook for live price feeds
 *
 * Optimizations:
 * - Page Visibility API: Pauses polling when page is hidden
 * - setTimeout-based polling: Avoids overlapping requests on slow networks
 * - AbortController: Cancels in-flight requests on unmount
 * - Exponential backoff on errors (with jitter)
 * - navigator.onLine gating + online/offline event listeners
 *
 * @param {number} interval - Base polling interval in ms (default 30000)
 * @returns {Object} { prices, fxRate, loading, error, lastUpdated, refresh }
 */
export function usePrices(interval = 30000) {
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [fxRate, setFxRate] = useState(DEFAULT_FX_RATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const timeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const isVisibleRef = useRef(true);
  const isOnlineRef = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const consecutiveErrorsRef = useRef(0);
  const maxBackoffRef = useRef(5 * 60 * 1000); // Max 5 minutes

  // Calculate backoff with jitter
  const getBackoffDelay = useCallback(() => {
    if (consecutiveErrorsRef.current === 0) return interval;
    // Exponential backoff: interval * 2^errors, capped at max
    const backoff = Math.min(
      interval * Math.pow(2, consecutiveErrorsRef.current),
      maxBackoffRef.current
    );
    // Add jitter (±20%)
    const jitter = backoff * 0.2 * (Math.random() - 0.5);
    return Math.round(backoff + jitter);
  }, [interval]);

  const refresh = useCallback(async () => {
    // Skip if page is hidden or offline
    if (!isVisibleRef.current || !isOnlineRef.current) return;

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

      // Merge with existing prices (don't lose data if one API fails)
      setPrices(prev => ({
        ...prev,
        ...result.prices,
      }));

      if (result.fxRate) {
        setFxRate(result.fxRate);
      }

      setLastUpdated(result.updatedAt);
      setError(null);
      consecutiveErrorsRef.current = 0; // Reset on success
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError') return;

      // Guard against setting state after unmount
      if (!isMountedRef.current) return;

      console.error('Price refresh error:', err);
      setError(err.message);
      consecutiveErrorsRef.current++; // Increment for backoff
    } finally {
      // Guard against setting state after unmount
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Schedule next poll using setTimeout (with backoff on errors)
  const scheduleNextPoll = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isVisibleRef.current && isMountedRef.current && isOnlineRef.current) {
      const delay = getBackoffDelay();
      timeoutRef.current = setTimeout(async () => {
        await refresh();
        scheduleNextPoll();
      }, delay);
    }
  }, [refresh, getBackoffDelay]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    if (isOnlineRef.current) {
      refresh().then(scheduleNextPoll);
    }

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [refresh, scheduleNextPoll]);

  // Page Visibility API: Pause polling when page is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      isVisibleRef.current = isVisible;

      if (isVisible && isOnlineRef.current) {
        // Resume polling when page becomes visible
        consecutiveErrorsRef.current = 0; // Reset backoff on visibility
        refresh().then(scheduleNextPoll);
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
  }, [refresh, scheduleNextPoll]);

  // Online/Offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      consecutiveErrorsRef.current = 0; // Reset backoff when coming online
      if (isVisibleRef.current) {
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
  }, [refresh, scheduleNextPoll]);

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
