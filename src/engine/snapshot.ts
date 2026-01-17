import type { Holding, Layer, AssetId, TargetLayerPct } from '../types';
import { ASSET_LAYER } from '../state/domain';
import { calculateFixedIncomeValue, FixedIncomeBreakdown } from './fixedIncome';
import { DEFAULT_PRICES, DEFAULT_FX_RATE } from '../constants/index';

// Per-holding value cache for incremental updates
// Key format: "assetId:quantity:price" -> cached result
// This avoids recomputation when only some holdings change
const holdingValueCache = new Map<string, HoldingValueResult>();
const CACHE_MAX_SIZE = 100; // Prevent unbounded growth

interface HoldingValueResult {
  valueIRR: number;
  priceUSD: number | null;
  breakdown: FixedIncomeBreakdown | null;
}

export interface HoldingValue {
  assetId: AssetId;
  quantity: number;
  valueIRR: number;
  priceUSD: number | null;
  breakdown: FixedIncomeBreakdown | null;
  layer: Layer;
  frozen: boolean;
}

export interface ComputedSnapshot {
  totalIRR: number;
  holdingsIRR: number;
  cashIRR: number;
  holdingsIRRByAsset: Record<AssetId, number>;
  holdingValues: HoldingValue[];
  layerPct: TargetLayerPct;
  layerIRR: Record<Layer, number>;
}

// Extended holding type for legacy support
interface HoldingWithLegacy extends Holding {
  valueIRR?: number;
}

/**
 * Generate cache key for holding value
 * For fixed income, includes purchasedAt since accrual depends on time
 */
function getHoldingCacheKey(
  assetId: string,
  quantity: number,
  priceUSD: number,
  purchasedAt?: string
): string {
  if (assetId === 'IRR_FIXED_INCOME') {
    // Include day portion of purchasedAt for accrual calculation caching
    const dateKey = purchasedAt ? purchasedAt.slice(0, 10) : 'none';
    return `${assetId}:${quantity}:${dateKey}`;
  }
  return `${assetId}:${quantity}:${priceUSD}`;
}

/**
 * Compute holding value in IRR with caching
 * Supports both quantity-based (v10+) and legacy valueIRR holdings
 */
function computeHoldingValue(
  holding: HoldingWithLegacy,
  prices: Record<string, number>,
  fxRate: number
): HoldingValueResult {
  // Legacy support: if valueIRR exists and quantity doesn't, use valueIRR directly
  if (holding.valueIRR !== undefined && holding.quantity === undefined) {
    return { valueIRR: holding.valueIRR, priceUSD: null, breakdown: null };
  }

  // Quantity-based calculation (v10+)
  const quantity = holding.quantity || 0;
  const priceUSD = prices[holding.assetId] || DEFAULT_PRICES[holding.assetId] || 0;

  // Check cache first
  const cacheKey = getHoldingCacheKey(holding.assetId, quantity, priceUSD, holding.purchasedAt);
  const cached = holdingValueCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let result: HoldingValueResult;

  if (holding.assetId === 'IRR_FIXED_INCOME') {
    // Special handling for fixed income - price is unit price in IRR
    const breakdown = calculateFixedIncomeValue(quantity, holding.purchasedAt);
    result = { valueIRR: breakdown.total, priceUSD: null, breakdown };
  } else {
    // Standard: quantity × priceUSD × fxRate
    const valueIRR = Math.round(quantity * priceUSD * fxRate);
    result = { valueIRR, priceUSD, breakdown: null };
  }

  // Store in cache (with size limit)
  if (holdingValueCache.size >= CACHE_MAX_SIZE) {
    // Clear oldest entries (simple FIFO via iterator)
    const firstKey = holdingValueCache.keys().next().value;
    if (firstKey) holdingValueCache.delete(firstKey);
  }
  holdingValueCache.set(cacheKey, result);

  return result;
}

/**
 * Compute portfolio snapshot from holdings and cash.
 * Supports live prices for quantity-based holdings.
 *
 * Performance notes:
 * - This function is memoized in App.jsx via useMemo (recomputes only when
 *   holdings/cash/prices/fxRate change)
 * - Caller should gate calls (e.g., skip during onboarding with empty holdings)
 * - Single O(n) loop where n = holdings count (typically 6-15 assets)
 * - For current portfolio sizes, full recomputation is ~0.1ms which is negligible
 *
 * Incremental update consideration:
 * - If portfolio grows to 50+ assets or polling frequency increases to <5s,
 *   consider caching per-holding values with price-keyed invalidation
 * - Current approach is optimal for the expected use case (15 assets, 30s polls)
 */
export function computeSnapshot(
  holdings: Holding[],
  cashIRR: number,
  prices: Record<string, number> = DEFAULT_PRICES,
  fxRate: number = DEFAULT_FX_RATE
): ComputedSnapshot {
  // Early return for empty holdings (no computation needed)
  if (!holdings || holdings.length === 0) {
    return {
      totalIRR: cashIRR,
      holdingsIRR: 0,
      cashIRR,
      holdingsIRRByAsset: {} as Record<AssetId, number>,
      holdingValues: [],
      layerPct: { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
      layerIRR: { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
    };
  }

  const holdingsIRRByAsset: Record<string, number> = {};
  const holdingValues: HoldingValue[] = [];
  let holdingsTotal = 0;
  const layerIRR: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

  // Single loop: compute values, build asset map, totals, and layer allocations
  for (const h of holdings) {
    const { valueIRR, priceUSD, breakdown } = computeHoldingValue(h, prices, fxRate);
    const layer = ASSET_LAYER[h.assetId] as Layer;

    holdingsIRRByAsset[h.assetId] = valueIRR;
    holdingsTotal += valueIRR;
    layerIRR[layer] += valueIRR;

    holdingValues.push({
      assetId: h.assetId,
      quantity: h.quantity,
      valueIRR,
      priceUSD,
      breakdown,
      layer,
      frozen: h.frozen,
    });
  }

  // Total includes cash (for display), but layer calc excludes cash
  const totalIRR = holdingsTotal + cashIRR;

  // Layer percentages based on holdings total (not total with cash)
  const layerPct: TargetLayerPct = {
    FOUNDATION: holdingsTotal ? (layerIRR.FOUNDATION / holdingsTotal) * 100 : 0,
    GROWTH: holdingsTotal ? (layerIRR.GROWTH / holdingsTotal) * 100 : 0,
    UPSIDE: holdingsTotal ? (layerIRR.UPSIDE / holdingsTotal) * 100 : 0,
  };

  return {
    totalIRR,                           // Holdings + Cash (total portfolio value)
    holdingsIRR: holdingsTotal,         // Holdings only
    cashIRR,                            // Cash separate
    holdingsIRRByAsset: holdingsIRRByAsset as Record<AssetId, number>,
    holdingValues,                      // Computed values with breakdowns
    layerPct,                           // Based on holdings only
    layerIRR,                           // Based on holdings only
  };
}
