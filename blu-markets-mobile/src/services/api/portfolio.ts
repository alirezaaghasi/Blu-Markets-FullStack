// Portfolio API Module
// src/services/api/portfolio.ts

import { apiClient } from './client';
import type { PortfolioResponse, AssetId, Holding, TargetLayerPct } from './types';

/**
 * Normalize allocation values from backend format to frontend format
 * Backend: lowercase keys (foundation, growth, upside) with integer percentages (85, 12, 3)
 * Frontend: UPPERCASE keys (FOUNDATION, GROWTH, UPSIDE) with decimals (0.85, 0.12, 0.03)
 */
function normalizeAllocation(allocation: Record<string, number> | undefined): TargetLayerPct {
  if (!allocation) {
    return { FOUNDATION: 0.5, GROWTH: 0.35, UPSIDE: 0.15 }; // Default allocation
  }

  const normalizeValue = (val: number | undefined): number => {
    if (val === undefined || val === null) return 0;
    // Convert integers (>1) to decimals
    return val > 1 ? val / 100 : val;
  };

  return {
    FOUNDATION: normalizeValue(allocation.FOUNDATION ?? allocation.foundation),
    GROWTH: normalizeValue(allocation.GROWTH ?? allocation.growth),
    UPSIDE: normalizeValue(allocation.UPSIDE ?? allocation.upside),
  };
}

/**
 * Normalize backend portfolio response to match mobile PortfolioResponse type
 */
function normalizePortfolioResponse(data: any): PortfolioResponse {
  return {
    cashIrr: data.cashIrr ?? data.cash_irr ?? 0,
    holdings: data.holdings ?? [],
    targetAllocation: normalizeAllocation(data.targetAllocation ?? data.target_allocation),
    status: data.status ?? 'IDLE',
    totalValueIrr: data.totalValueIrr ?? data.total_value_irr ?? data.totalValue ?? 0,
    dailyChangePercent: data.dailyChangePercent ?? data.daily_change_percent ?? 0,
  };
}

export const portfolio = {
  get: async (): Promise<PortfolioResponse> => {
    const data = await apiClient.get('/portfolio') as unknown as Record<string, unknown>;
    return normalizePortfolioResponse(data);
  },

  addFunds: async (amountIrr: number): Promise<PortfolioResponse> => {
    const data = await apiClient.post('/portfolio/add-funds', { amountIrr }) as unknown as Record<string, unknown>;
    // Backend may return partial response, so fetch full portfolio after add-funds
    if (!data.holdings) {
      // Fetch full portfolio data
      return portfolio.get();
    }
    return normalizePortfolioResponse(data);
  },

  getAsset: (assetId: AssetId): Promise<{
    holding: Holding;
    currentPriceUsd: number;
    valueIrr: number;
    changePercent24h: number;
  }> =>
    apiClient.get(`/portfolio/asset/${assetId}`) as unknown as Promise<{
      holding: Holding;
      currentPriceUsd: number;
      valueIrr: number;
      changePercent24h: number;
    }>,
};
