/**
 * Portfolio Sync Hook
 *
 * Bridges RTK Query with existing Redux slices for backward compatibility.
 * This hook automatically syncs portfolio data from RTK Query cache to
 * the portfolioSlice, allowing gradual migration of components.
 *
 * Benefits:
 * - Components using useAppSelector continue to work
 * - RTK Query handles caching and automatic refetching
 * - Cache invalidation propagates to Redux state
 * - Single source of truth (RTK Query cache)
 */
import { useEffect } from 'react';
import { useAppDispatch } from './useStore';
import { useGetPortfolioQuery, useGetPricesQuery } from '../store/api/apiSlice';
import {
  setHoldings,
  updateCash,
  setStatus,
  setPortfolioValues,
  setTargetLayerPct,
} from '../store/slices/portfolioSlice';
import { setPrices, setFxRate, setPricesIrr } from '../store/slices/pricesSlice';
import type { Holding } from '../types';

interface UsePortfolioSyncOptions {
  /** Skip syncing (e.g., when user is not authenticated) */
  skip?: boolean;
  /** Polling interval in milliseconds (0 = no polling) */
  pollingInterval?: number;
}

/**
 * Syncs RTK Query portfolio data to Redux slices.
 * Place this hook in your app's root or main layout component.
 *
 * @example
 * function AppLayout() {
 *   usePortfolioSync(); // Auto-syncs portfolio data
 *   return <MainTabs />;
 * }
 */
export function usePortfolioSync(options: UsePortfolioSyncOptions = {}) {
  const { skip = false, pollingInterval = 0 } = options;
  const dispatch = useAppDispatch();

  // Fetch portfolio data with RTK Query
  const {
    data: portfolioData,
    isLoading: isPortfolioLoading,
    isError: isPortfolioError,
    refetch: refetchPortfolio,
  } = useGetPortfolioQuery(undefined, {
    skip,
    pollingInterval,
    // Refetch when component mounts if data is stale (> 60 seconds)
    refetchOnMountOrArgChange: 60,
  });

  // Fetch prices with RTK Query
  const {
    data: pricesData,
    isLoading: isPricesLoading,
    isError: isPricesError,
    refetch: refetchPrices,
  } = useGetPricesQuery(undefined, {
    skip,
    // Prices update more frequently
    pollingInterval: pollingInterval > 0 ? Math.min(pollingInterval, 30000) : 0,
    refetchOnMountOrArgChange: 30,
  });

  // Sync portfolio data to Redux when it changes
  useEffect(() => {
    if (!portfolioData) return;

    // Map holdings to the format expected by the slice
    const holdings: Holding[] = portfolioData.holdings.map((h) => ({
      id: h.id,
      assetId: h.assetId,
      quantity: h.quantity,
      frozen: h.frozen,
      layer: h.layer,
      purchasedAt: h.purchasedAt,
    }));

    // Dispatch all portfolio updates
    dispatch(setHoldings(holdings));
    dispatch(updateCash(portfolioData.cashIrr));
    dispatch(setStatus(portfolioData.status));
    dispatch(setPortfolioValues({
      totalValueIrr: portfolioData.totalValueIrr,
      holdingsValueIrr: portfolioData.holdingsValueIrr || 0,
      currentAllocation: portfolioData.allocation || { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
      driftPct: portfolioData.driftPct || 0,
      status: portfolioData.status,
    }));

    if (portfolioData.targetAllocation) {
      dispatch(setTargetLayerPct(portfolioData.targetAllocation));
    }

    if (__DEV__) {
      console.log('[usePortfolioSync] Synced portfolio:', {
        holdings: holdings.length,
        cash: portfolioData.cashIrr,
        status: portfolioData.status,
      });
    }
  }, [portfolioData, dispatch]);

  // Sync prices to Redux when they change
  useEffect(() => {
    if (!pricesData) return;

    // Extract USD prices and IRR prices
    const prices: Record<string, number> = {};
    const pricesIrr: Record<string, number> = {};

    if (pricesData.prices) {
      // Backend returns prices as an ARRAY of objects, not a Record
      // Each item has: { assetId, priceUsd, priceIrr, change24hPct, source, fetchedAt }
      if (Array.isArray(pricesData.prices)) {
        pricesData.prices.forEach((p: { assetId: string; priceUsd?: number; priceIrr?: number }) => {
          if (p.assetId) {
            prices[p.assetId] = p.priceUsd ?? 0;
            pricesIrr[p.assetId] = p.priceIrr ?? 0;
          }
        });
      } else {
        // Fallback: handle as object/record format (legacy or local mock)
        Object.entries(pricesData.prices).forEach(([assetId, priceData]) => {
          if (typeof priceData === 'number') {
            prices[assetId] = priceData;
          } else if (typeof priceData === 'object' && priceData !== null) {
            const p = priceData as { priceUsd?: number; priceIrr?: number; usd?: number; irr?: number };
            prices[assetId] = p.priceUsd ?? p.usd ?? 0;
            pricesIrr[assetId] = p.priceIrr ?? p.irr ?? 0;
          }
        });
      }
    }

    // Extract fxRate - backend returns { usdIrr, source, fetchedAt } object
    const fxRateValue = typeof pricesData.fxRate === 'number'
      ? pricesData.fxRate
      : (pricesData.fxRate as { usdIrr?: number })?.usdIrr ?? 0;

    dispatch(setPrices(prices));
    dispatch(setFxRate({ rate: fxRateValue, source: 'bonbast' }));
    if (Object.keys(pricesIrr).length > 0) {
      dispatch(setPricesIrr(pricesIrr));
    }

    if (__DEV__) {
      console.log('[usePortfolioSync] Synced prices:', {
        count: Object.keys(prices).length,
        irrCount: Object.keys(pricesIrr).length,
        fxRate: fxRateValue,
      });
    }
  }, [pricesData, dispatch]);

  return {
    // Loading states
    isLoading: isPortfolioLoading || isPricesLoading,
    isPortfolioLoading,
    isPricesLoading,
    // Error states
    isError: isPortfolioError || isPricesError,
    isPortfolioError,
    isPricesError,
    // Manual refetch functions
    refetchPortfolio,
    refetchPrices,
    refetchAll: () => {
      refetchPortfolio();
      refetchPrices();
    },
    // Data (from RTK Query cache)
    portfolioData,
    pricesData,
  };
}

export default usePortfolioSync;
