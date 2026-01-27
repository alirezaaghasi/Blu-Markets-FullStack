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
 * Supports both backend response formats (nested and flat) and provides sensible defaults
 *
 * Backend response structure:
 * {
 *   valid: boolean,
 *   preview: { action, assetId, quantity, amountIrr, priceIrr, spread, spreadAmountIrr },
 *   allocation: { before, target, after },
 *   boundary: 'SAFE',
 *   movesToward: boolean,
 *   error?: string,
 * }
 */
function normalizeTradePreview(data: unknown): TradePreview {
  // Runtime validation - check we have an object
  if (!data || typeof data !== 'object') {
    throw new Error('[Trade API] Invalid preview response: expected object');
  }

  const d = data as Record<string, unknown>;

  // Handle nested backend response format (preview object contains trade details)
  const preview = (d.preview as Record<string, unknown>) || d;
  const allocation = (d.allocation as Record<string, unknown>) || {};

  // Extract trade details from preview object
  const quantity = typeof preview.quantity === 'number' ? preview.quantity : 0;
  const amountIRR = typeof preview.amountIrr === 'number' ? preview.amountIrr
    : typeof preview.amountIRR === 'number' ? preview.amountIRR
    : typeof d.amountIRR === 'number' ? d.amountIRR
    : 0;

  // Get assetId from preview or top level
  const assetId = preview.assetId ?? preview.asset_id ?? d.assetId ?? d.asset_id;
  if (!assetId) {
    throw new Error('[Trade API] Invalid preview response: assetId required');
  }

  // Get allocation data (from allocation object or top level)
  const before = (allocation.before ?? d.before) as Record<string, number> | undefined;
  const after = (allocation.after ?? d.after) as Record<string, number> | undefined;
  const target = (allocation.target ?? d.target ?? allocation.targetAllocation) as Record<string, number> | undefined;

  // Validate boundary enum (allow missing for backwards compatibility)
  const validBoundaries = ['SAFE', 'DRIFT', 'STRUCTURAL', 'STRESS'];
  const rawBoundary = (d.boundary as string) || 'SAFE';
  const boundary = validBoundaries.includes(rawBoundary) ? rawBoundary : 'SAFE';

  // Build normalized response with safe defaults
  return {
    side: (preview.action ?? preview.side ?? d.side ?? 'BUY') as 'BUY' | 'SELL',
    assetId: assetId as AssetId,
    amountIRR: amountIRR,
    quantity: quantity,
    priceUSD: (preview.priceUsd ?? preview.priceUSD ?? preview.priceIrr ?? d.priceUSD ?? 0) as number,
    spread: (preview.spread ?? d.spread ?? 0) as number,
    before: normalizeAllocation(before),
    after: normalizeAllocation(after),
    target: normalizeAllocation(target),
    boundary: boundary as 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS',
    frictionCopy: (d.frictionCopy ?? d.friction_copy ?? []) as string[],
    movesTowardTarget: (d.movesToward ?? d.movesTowardTarget ?? true) as boolean,
  };
}

export const trade = {
  preview: async (assetId: AssetId, action: 'BUY' | 'SELL', amountIrr: number): Promise<TradePreview> => {
    const data = await apiClient.post('/trade/preview', { assetId, action, amountIrr });
    return normalizeTradePreview(data);
  },

  execute: (assetId: AssetId, action: 'BUY' | 'SELL', amountIrr: number, acknowledgedWarning = true): Promise<TradeExecuteResponse> =>
    apiClient.post('/trade/execute', { assetId, action, amountIrr, acknowledgedWarning }),
};
