import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllPrices } from '../services/priceService.js';

// Default prices (fallback if APIs fail)
const DEFAULT_PRICES = {
  BTC: 97500,
  ETH: 3200,
  SOL: 185,
  TON: 5.20,
  USDT: 1.0,
  GOLD: 2650,  // per oz
  QQQ: 520,
};

const DEFAULT_FX_RATE = 1456000;  // 1 USD = 1,456,000 IRR

/**
 * usePrices - Hook for live price feeds
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

  const intervalRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchAllPrices();

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
      console.error('Price refresh error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling
  useEffect(() => {
    intervalRef.current = setInterval(refresh, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refresh, interval]);

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
