// Portfolio Hook
// src/hooks/usePortfolio.ts

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { portfolio as portfolioApi } from '../services/api/index';
import type { PortfolioResponse } from '../services/api/index';
import { getErrorMessage } from '../utils/errorUtils';

interface UsePortfolioResult {
  portfolio: PortfolioResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addFunds: (amountIrr: number) => Promise<PortfolioResponse | null>;
}

export function usePortfolio(): UsePortfolioResult {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (!portfolio) {
        setIsLoading(true);
      }
      setError(null);

      const response = await portfolioApi.get();
      setPortfolio(response);
      return response;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load portfolio'));
      return null;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [portfolio]);

  const refresh = useCallback(async () => {
    await fetchPortfolio(true);
  }, [fetchPortfolio]);

  const addFunds = useCallback(async (amountIrr: number): Promise<PortfolioResponse | null> => {
    try {
      setError(null);
      const response = await portfolioApi.addFunds(amountIrr);
      setPortfolio(response);
      return response;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add funds'));
      return null;
    }
  }, []);

  // Fetch on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchPortfolio();
    }, [fetchPortfolio])
  );

  return {
    portfolio,
    isLoading,
    isRefreshing,
    error,
    refresh,
    addFunds,
  };
}

export default usePortfolio;
