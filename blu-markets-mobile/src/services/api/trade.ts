// Trade API Module
// src/services/api/trade.ts

import { apiClient } from './client';
import type { AssetId, TradePreview, TradeExecuteResponse, TargetLayerPct } from './types';

/**
 * Normalize allocation values from backend format to frontend format
 * Backend: lowercase keys (foundation, growth, upside) with integer percentages (85, 12, 3)
 * Frontend: UPPERCASE keys (FOUNDATION, GROWTH, UPSIDE) with decimals (0.85, 0.12, 0.03)
 */
function normalizeAllocation(allocation: Record<string, number> | undefined): TargetLayerPct {
  if (!allocation) {
    return { FOUNDATION: 0.5, GROWTH: 0.35, UPSIDE: 0.15 };
  }

  const normalizeValue = (val: number | undefined): number => {
    if (val === undefined || val === null) return 0;
    return val > 1 ? val / 100 : val;
  };

  return {
    FOUNDATION: normalizeValue(allocation.FOUNDATION ?? allocation.foundation),
    GROWTH: normalizeValue(allocation.GROWTH ?? allocation.growth),
    UPSIDE: normalizeValue(allocation.UPSIDE ?? allocation.upside),
  };
}

/**
 * Normalize trade preview response
 */
function normalizeTradePreview(data: any): TradePreview {
  return {
    ...data,
    before: normalizeAllocation(data.before),
    after: normalizeAllocation(data.after),
    target: normalizeAllocation(data.target),
  };
}

export const trade = {
  preview: async (assetId: AssetId, action: 'BUY' | 'SELL', amountIrr: number): Promise<TradePreview> => {
    const data = await apiClient.post('/trade/preview', { assetId, action, amountIrr });
    return normalizeTradePreview(data);
  },

  execute: (assetId: AssetId, action: 'BUY' | 'SELL', amountIrr: number): Promise<TradeExecuteResponse> =>
    apiClient.post('/trade/execute', { assetId, action, amountIrr }),
};
