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
  eligibleAssets: ProtectableHolding[]; // Alias for backwards compatibility
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
  // Convenience function: gets quote and purchases in one step
  quickPurchaseProtection: (holdingId: string, durationDays?: number) => Promise<Protection | null>;
  cancelProtection: (protectionId: string) => Promise<boolean>;
}

export function useProtections(): UseProtectionsResult {
  const [protections, setProtections] = useState<Protection[]>([]);
  const [protectableHoldings, setProtectableHoldings] = useState<ProtectableHolding[]>([]);
  const [durationPresets, setDurationPresets] = useState<number[]>([30, 90, 180]); // 1, 3, 6 months only per PRD
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
      // Handle union type - check if response has 'holdings' property
      const holdings = Array.isArray(holdingsResponse) ? holdingsResponse : (holdingsResponse as any)?.holdings || [];
      setProtectableHoldings(holdings);

      // Type narrow for optional properties
      if (!Array.isArray(holdingsResponse) && holdingsResponse?.durationPresets) {
        setDurationPresets(holdingsResponse.durationPresets);
      }
      if (!Array.isArray(holdingsResponse) && holdingsResponse?.coverageRange) {
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
      const holdings = Array.isArray(holdingsResponse) ? holdingsResponse : (holdingsResponse as any)?.holdings || [];
      setProtectableHoldings(holdings);
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
      const holdings = Array.isArray(holdingsResponse) ? holdingsResponse : (holdingsResponse as any)?.holdings || [];
      setProtectableHoldings(holdings);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to cancel protection'));
      return false;
    }
  }, []);

  // Convenience function: get quote and purchase in one step
  const quickPurchaseProtection = useCallback(async (
    holdingId: string,
    durationDays: number = 30
  ): Promise<Protection | null> => {
    try {
      setError(null);
      // Step 1: Get a quote for the holding
      const quote = await protectionApi.getQuote(holdingId, 1.0, durationDays);

      if (!quote?.quoteId) {
        setError('Failed to get protection quote');
        return null;
      }

      // Step 2: Purchase using the quote
      const newProtection = await protectionApi.purchase({
        quoteId: quote.quoteId,
        holdingId,
        coveragePct: quote.coveragePct,
        durationDays: quote.durationDays,
        premiumIrr: quote.premiumIrr,
        acknowledgedPremium: true,
      });

      setProtections((prev) => [newProtection, ...prev]);
      // Refresh protectable holdings after purchase
      const holdingsResponse = await protectionApi.getHoldings();
      const holdings = Array.isArray(holdingsResponse) ? holdingsResponse : (holdingsResponse as any)?.holdings || [];
      setProtectableHoldings(holdings);
      return newProtection;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to purchase protection'));
      return null;
    }
  }, []);

  // Fetch on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchProtections();
    }, [fetchProtections])
  );

  // Ensure protectableHoldings is always an array for safety
  const safeProtectableHoldings = protectableHoldings || [];

  return {
    protections,
    protectableHoldings: safeProtectableHoldings,
    eligibleAssets: safeProtectableHoldings, // Alias for backwards compatibility
    durationPresets,
    coverageRange,
    isLoading,
    isRefreshing,
    error,
    refresh,
    purchaseProtection,
    quickPurchaseProtection,
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
