// Protections Hook
// src/hooks/useProtections.ts

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { protection as protectionApi } from '../services/api/index';
import type { Protection, AssetId } from '../types';
import type { EligibleAssetsResponse } from '../services/api/index';

interface UseProtectionsResult {
  protections: Protection[];
  eligibleAssets: EligibleAssetsResponse['assets'];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  purchaseProtection: (assetId: AssetId, durationMonths: number) => Promise<Protection | null>;
  cancelProtection: (protectionId: string) => Promise<boolean>;
}

export function useProtections(): UseProtectionsResult {
  const [protections, setProtections] = useState<Protection[]>([]);
  const [eligibleAssets, setEligibleAssets] = useState<EligibleAssetsResponse['assets']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProtections = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (protections.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      // Fetch active protections and eligible assets in parallel
      const [activeResponse, eligibleResponse] = await Promise.all([
        protectionApi.getActive(),
        protectionApi.getEligible(),
      ]);

      setProtections(activeResponse.protections);
      setEligibleAssets(eligibleResponse.assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load protections');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [protections.length]);

  const refresh = useCallback(async () => {
    await fetchProtections(true);
  }, [fetchProtections]);

  const purchaseProtection = useCallback(async (
    assetId: AssetId,
    durationMonths: number
  ): Promise<Protection | null> => {
    try {
      setError(null);
      const newProtection = await protectionApi.purchase(assetId, durationMonths);
      setProtections((prev) => [newProtection, ...prev]);
      // Refresh eligible assets after purchase
      const eligibleResponse = await protectionApi.getEligible();
      setEligibleAssets(eligibleResponse.assets);
      return newProtection;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purchase protection');
      return null;
    }
  }, []);

  const cancelProtection = useCallback(async (protectionId: string): Promise<boolean> => {
    try {
      setError(null);
      await protectionApi.cancel(protectionId);
      setProtections((prev) => prev.filter((p) => p.id !== protectionId));
      // Refresh eligible assets after cancellation
      const eligibleResponse = await protectionApi.getEligible();
      setEligibleAssets(eligibleResponse.assets);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel protection');
      return false;
    }
  }, []);

  // Fetch on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchProtections();
    }, [fetchProtections])
  );

  return {
    protections,
    eligibleAssets,
    isLoading,
    isRefreshing,
    error,
    refresh,
    purchaseProtection,
    cancelProtection,
  };
}

export default useProtections;
