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
 *
 * @param {number} interval - Polling interval in ms (default 30000)
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

  const refresh = useCallback(async () => {
    // Skip if page is hidden
    if (!isVisibleRef.current) return;

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
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError') return;

      // Guard against setting state after unmount
      if (!isMountedRef.current) return;

      console.error('Price refresh error:', err);
      setError(err.message);
    } finally {
      // Guard against setting state after unmount
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Schedule next poll using setTimeout (avoids overlapping requests)
  const scheduleNextPoll = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isVisibleRef.current && isMountedRef.current) {
      timeoutRef.current = setTimeout(async () => {
        await refresh();
        scheduleNextPoll();
      }, interval);
    }
  }, [refresh, interval]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    refresh().then(scheduleNextPoll);

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

      if (isVisible) {
        // Resume polling when page becomes visible
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
