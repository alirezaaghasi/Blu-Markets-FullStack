// Rebalance API Module
// src/services/api/rebalance.ts

import { apiClient } from './client';
import type { RebalancePreview, PortfolioStatus, TargetLayerPct } from './types';

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
 * Normalize rebalance preview response
 * Backend uses: currentAllocation, targetAllocation, afterAllocation
 * Frontend expects: before, target, after (with UPPERCASE keys as fractions)
 */
function normalizeRebalancePreview(data: any): RebalancePreview {
  return {
    ...data,
    // Handle both naming conventions (before/currentAllocation, after/afterAllocation, target/targetAllocation)
    before: normalizeAllocation(data.before ?? data.currentAllocation),
    after: normalizeAllocation(data.after ?? data.afterAllocation),
    target: normalizeAllocation(data.target ?? data.targetAllocation),
  };
}

// Import RebalanceMode type
type RebalanceMode = 'HOLDINGS_ONLY' | 'HOLDINGS_PLUS_CASH' | 'SMART';

export const rebalance = {
  getStatus: (): Promise<{
    needsRebalance: boolean;
    lastRebalanceAt: string | null;
    canRebalance: boolean;
    reason?: string;
  }> =>
    apiClient.get('/rebalance/status'),

  // BUG-E FIX: Accept mode parameter to support Deploy Cash mode
  preview: async (mode: RebalanceMode = 'HOLDINGS_ONLY'): Promise<RebalancePreview> => {
    const data = await apiClient.get(`/rebalance/preview?mode=${mode}`);
    return normalizeRebalancePreview(data);
  },

  execute: (mode: RebalanceMode = 'HOLDINGS_ONLY'): Promise<{
    success: boolean;
    tradesExecuted: number;
    newStatus: PortfolioStatus;
  }> =>
    apiClient.post('/rebalance/execute', { mode }),
};
