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
 * BUG-013 FIX: Added runtime validation with flexible field handling
 * Supports both backend response formats and provides sensible defaults
 */
function normalizeTradePreview(data: unknown): TradePreview {
  // Runtime validation - check we have an object
  if (!data || typeof data !== 'object') {
    throw new Error('[Trade API] Invalid preview response: expected object');
  }

  const d = data as Record<string, unknown>;

  // Extract numeric fields with fallbacks for different field name conventions
  // Backend may use amountIrr, amountIRR, or amount
  const quantity = typeof d.quantity === 'number' ? d.quantity : 0;
  const amountIRR = typeof d.amountIRR === 'number' ? d.amountIRR
    : typeof d.amountIrr === 'number' ? d.amountIrr
    : typeof d.amount === 'number' ? d.amount
    : 0;

  // Validate we have at least an assetId (minimum required field)
  if (!d.assetId && !d.asset_id) {
    throw new Error('[Trade API] Invalid preview response: assetId required');
  }

  // Validate boundary enum (allow missing for backwards compatibility)
  const validBoundaries = ['SAFE', 'DRIFT', 'STRUCTURAL', 'STRESS'];
  const rawBoundary = (d.boundary as string) || 'SAFE';
  const boundary = validBoundaries.includes(rawBoundary) ? rawBoundary : 'SAFE';

  // Build normalized response with safe defaults
  return {
    side: (d.side ?? d.action ?? 'BUY') as 'BUY' | 'SELL',
    assetId: (d.assetId ?? d.asset_id) as AssetId,
    amountIRR: amountIRR,
    quantity: quantity,
    priceUSD: (d.priceUSD ?? d.priceUsd ?? d.price_usd ?? 0) as number,
    spread: (d.spread ?? 0) as number,
    before: normalizeAllocation(d.before as Record<string, number> | undefined),
    after: normalizeAllocation(d.after as Record<string, number> | undefined),
    target: normalizeAllocation(d.target as Record<string, number> | undefined),
    boundary: boundary as 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS',
    frictionCopy: (d.frictionCopy ?? d.friction_copy ?? []) as string[],
    movesTowardTarget: (d.movesTowardTarget ?? d.moves_toward_target ?? true) as boolean,
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
