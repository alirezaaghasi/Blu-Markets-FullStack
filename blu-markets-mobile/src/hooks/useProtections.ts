// Protections Hook
// Updated to work with Black-Scholes pricing backend
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { protection as protectionApi } from '../services/api/index';
import type { Protection, ProtectableHolding, AssetId } from '../types';
import { getErrorMessage } from '../utils/errorUtils';

interface UseProtectionsResult {
  protections: Protection[];
  protectableHoldings: ProtectableHolding[];
  durationPresets: number[];
  coverageRange: { min: number; max: number; step: number };
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  purchaseProtection: (params: {
    holdingId: string;
    coveragePct: number;
    durationDays: number;
    quoteId: string;
    premiumIrr: number;
  }) => Promise<Protection | null>;
  cancelProtection: (protectionId: string) => Promise<boolean>;
}

export function useProtections(): UseProtectionsResult {
  const [protections, setProtections] = useState<Protection[]>([]);
  const [protectableHoldings, setProtectableHoldings] = useState<ProtectableHolding[]>([]);
  const [durationPresets, setDurationPresets] = useState<number[]>([7, 14, 30, 60, 90, 180]);
  const [coverageRange, setCoverageRange] = useState({ min: 0.1, max: 1.0, step: 0.1 });
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

      // Fetch active protections and protectable holdings in parallel
      const [activeProtections, holdingsResponse] = await Promise.all([
        protectionApi.getActive(),
        protectionApi.getHoldings(),
      ]);

      setProtections(activeProtections || []);
      setProtectableHoldings(holdingsResponse?.holdings || []);

      if (holdingsResponse?.durationPresets) {
        setDurationPresets(holdingsResponse.durationPresets);
      }
      if (holdingsResponse?.coverageRange) {
        setCoverageRange(holdingsResponse.coverageRange);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load protections'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [protections.length]);

  const refresh = useCallback(async () => {
    await fetchProtections(true);
  }, [fetchProtections]);

  const purchaseProtection = useCallback(async (params: {
    holdingId: string;
    coveragePct: number;
    durationDays: number;
    quoteId: string;
    premiumIrr: number;
  }): Promise<Protection | null> => {
    try {
      setError(null);
      const newProtection = await protectionApi.purchase({
        ...params,
        acknowledgedPremium: true,
      });
      setProtections((prev) => [newProtection, ...prev]);
      // Refresh protectable holdings after purchase
      const holdingsResponse = await protectionApi.getHoldings();
      setProtectableHoldings(holdingsResponse?.holdings || []);
      return newProtection;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to purchase protection'));
      return null;
    }
  }, []);

  const cancelProtection = useCallback(async (protectionId: string): Promise<boolean> => {
    try {
      setError(null);
      await protectionApi.cancel(protectionId);
      setProtections((prev) => prev.filter((p) => p.id !== protectionId));
      // Refresh protectable holdings after cancellation
      const holdingsResponse = await protectionApi.getHoldings();
      setProtectableHoldings(holdingsResponse?.holdings || []);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to cancel protection'));
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
    protectableHoldings,
    durationPresets,
    coverageRange,
    isLoading,
    isRefreshing,
    error,
    refresh,
    purchaseProtection,
    cancelProtection,
  };
}

// Legacy export for backwards compatibility
export default useProtections;

// Also export eligibleAssets alias for backwards compatibility
export function useProtectionsLegacy() {
  const result = useProtections();
  return {
    ...result,
    eligibleAssets: result.protectableHoldings,
  };
}
