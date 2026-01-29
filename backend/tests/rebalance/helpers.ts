/**
 * Rebalance Test Suite - Shared Helpers and Factories
 * Provides utilities for creating test portfolios, holdings, and mock data
 */

import type { AssetId, Layer, PortfolioSnapshot, Holding } from '../../src/types/domain.js';
import type { GapAnalysis, RebalanceTrade } from '../../src/types/api.js';

// ============================================================================
// RISK PROFILE PRESETS (per PRD Section 3.2)
// ============================================================================

export const RISK_PROFILES = {
  CAPITAL_PRESERVATION: { foundation: 80, growth: 15, upside: 5 },
  CONSERVATIVE: { foundation: 70, growth: 25, upside: 5 },
  BALANCED: { foundation: 50, growth: 35, upside: 15 },
  GROWTH: { foundation: 45, growth: 38, upside: 17 },
  AGGRESSIVE: { foundation: 35, growth: 40, upside: 25 },
} as const;

export type RiskProfileName = keyof typeof RISK_PROFILES;

// ============================================================================
// ASSET LAYER MAPPING
// ============================================================================

export const LAYER_ASSETS: Record<Layer, AssetId[]> = {
  FOUNDATION: ['USDT', 'PAXG', 'IRR_FIXED_INCOME'],
  GROWTH: ['BTC', 'ETH', 'BNB', 'XRP', 'KAG', 'QQQ'],
  UPSIDE: ['SOL', 'TON', 'LINK', 'AVAX', 'MATIC', 'ARB'],
};

export const ASSET_TO_LAYER: Record<AssetId, Layer> = {
  // Foundation
  USDT: 'FOUNDATION',
  PAXG: 'FOUNDATION',
  IRR_FIXED_INCOME: 'FOUNDATION',
  // Growth
  BTC: 'GROWTH',
  ETH: 'GROWTH',
  BNB: 'GROWTH',
  XRP: 'GROWTH',
  KAG: 'GROWTH',
  QQQ: 'GROWTH',
  // Upside
  SOL: 'UPSIDE',
  TON: 'UPSIDE',
  LINK: 'UPSIDE',
  AVAX: 'UPSIDE',
  MATIC: 'UPSIDE',
  ARB: 'UPSIDE',
};

// ============================================================================
// SPREAD RATES (per PRD Section 7.1)
// ============================================================================

export const SPREAD_BY_LAYER: Record<Layer, number> = {
  FOUNDATION: 0.0015, // 0.15%
  GROWTH: 0.003,      // 0.30%
  UPSIDE: 0.006,      // 0.60%
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const MIN_TRADE_AMOUNT = 100_000; // 100K IRR
export const MAX_SELL_PERCENTAGE = 0.80; // 80% max sell per asset
export const MIN_ASSET_VALUE_TO_KEEP = 5_000_000; // 5M IRR minimum position
export const INTRA_LAYER_OVERWEIGHT_THRESHOLD = 0.15; // 15%
export const INTRA_LAYER_UNDERWEIGHT_THRESHOLD = 0.10; // 10%
export const INTER_LAYER_DRIFT_THRESHOLD_FOR_INTRA = 5; // 5%

// ============================================================================
// DEFAULT PRICES (IRR)
// ============================================================================

export const DEFAULT_PRICES: Record<AssetId, number> = {
  // Foundation
  USDT: 620_000,                // ~$1 at 620K IRR/USD
  PAXG: 1_643_000_000,         // ~$2650 gold
  IRR_FIXED_INCOME: 500_000,    // 500K per unit
  // Growth
  BTC: 60_450_000_000,         // ~$97,500
  ETH: 1_984_000_000,          // ~$3,200
  BNB: 434_000_000,            // ~$700
  XRP: 1_860_000,              // ~$3
  KAG: 21_700_000,             // ~$35 silver
  QQQ: 310_000_000,            // ~$500
  // Upside
  SOL: 111_600_000,            // ~$180
  TON: 3_410_000,              // ~$5.50
  LINK: 18_600_000,            // ~$30
  AVAX: 24_800_000,            // ~$40
  MATIC: 620_000,              // ~$1
  ARB: 930_000,                // ~$1.50
};

// ============================================================================
// PORTFOLIO SIZE PRESETS
// ============================================================================

export const PORTFOLIO_SIZES = {
  SMALL: 10_000_000_000,        // 10M IRR (~$16K)
  MEDIUM: 100_000_000_000,      // 100M IRR (~$160K)
  LARGE: 1_000_000_000_000,     // 1B IRR (~$1.6M)
  VERY_LARGE: 10_000_000_000_000, // 10T IRR (~$16M)
};

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a single holding
 */
export function createHolding(
  assetId: AssetId,
  valueIrr: number,
  options: {
    frozen?: boolean;
    quantity?: number;
  } = {}
): Holding {
  const priceIrr = DEFAULT_PRICES[assetId];
  const quantity = options.quantity ?? valueIrr / priceIrr;

  return {
    assetId,
    quantity,
    layer: ASSET_TO_LAYER[assetId],
    frozen: options.frozen ?? false,
    valueIrr,
  };
}

/**
 * Create a prices map for mocking getCurrentPrices
 */
export function createPricesMap(
  overrides: Partial<Record<AssetId, number>> = {}
): Map<AssetId, { priceIrr: number }> {
  const prices = new Map<AssetId, { priceIrr: number }>();

  for (const [assetId, priceIrr] of Object.entries(DEFAULT_PRICES)) {
    const finalPrice = overrides[assetId as AssetId] ?? priceIrr;
    prices.set(assetId as AssetId, { priceIrr: finalPrice });
  }

  return prices;
}

/**
 * Create holdings for a layer with specified distribution
 */
export function createLayerHoldings(
  layer: Layer,
  totalValueIrr: number,
  distribution: Partial<Record<AssetId, number>> = {},
  frozenPct = 0
): Holding[] {
  const assets = LAYER_ASSETS[layer];
  const holdings: Holding[] = [];

  // Default: equal distribution if not specified
  const defaultWeight = 1 / assets.length;
  let assignedWeight = 0;

  for (const assetId of assets) {
    const weight = distribution[assetId] ?? defaultWeight;
    assignedWeight += weight;

    const valueIrr = totalValueIrr * weight;
    if (valueIrr > 0) {
      holdings.push(createHolding(assetId, valueIrr, {
        frozen: Math.random() < frozenPct,
      }));
    }
  }

  return holdings;
}

/**
 * Options for creating a portfolio snapshot
 */
export interface PortfolioSnapshotOptions {
  userId?: string;
  cashIrr?: number;
  holdingsValueIrr?: number;
  allocation?: { foundation: number; growth: number; upside: number };
  targetAllocation?: { foundation: number; growth: number; upside: number };
  holdings?: Holding[];
  frozenPct?: number; // Percentage of each holding to freeze
}

/**
 * Create a full portfolio snapshot
 */
export function createPortfolioSnapshot(
  options: PortfolioSnapshotOptions = {}
): PortfolioSnapshot {
  const {
    userId = 'test-user-123',
    cashIrr = 0,
    holdingsValueIrr = 100_000_000_000, // 100M IRR default
    allocation = RISK_PROFILES.BALANCED,
    targetAllocation = RISK_PROFILES.BALANCED,
    holdings,
    frozenPct = 0,
  } = options;

  // Generate holdings if not provided
  let finalHoldings = holdings;
  if (!finalHoldings) {
    finalHoldings = [
      ...createLayerHoldings('FOUNDATION', holdingsValueIrr * (allocation.foundation / 100), {}, frozenPct),
      ...createLayerHoldings('GROWTH', holdingsValueIrr * (allocation.growth / 100), {}, frozenPct),
      ...createLayerHoldings('UPSIDE', holdingsValueIrr * (allocation.upside / 100), {}, frozenPct),
    ];
  }

  const actualHoldingsValue = finalHoldings.reduce((sum, h) => sum + (h.valueIrr ?? 0), 0);
  const totalValueIrr = actualHoldingsValue + cashIrr;

  // Calculate actual allocation from holdings
  const layerValues = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  for (const holding of finalHoldings) {
    layerValues[holding.layer] += holding.valueIrr ?? 0;
  }

  const actualAllocation = {
    foundation: actualHoldingsValue > 0 ? (layerValues.FOUNDATION / actualHoldingsValue) * 100 : 0,
    growth: actualHoldingsValue > 0 ? (layerValues.GROWTH / actualHoldingsValue) * 100 : 0,
    upside: actualHoldingsValue > 0 ? (layerValues.UPSIDE / actualHoldingsValue) * 100 : 0,
  };

  // Calculate drift
  const driftPct = Math.max(
    Math.abs(actualAllocation.foundation - targetAllocation.foundation),
    Math.abs(actualAllocation.growth - targetAllocation.growth),
    Math.abs(actualAllocation.upside - targetAllocation.upside)
  );

  // Determine status
  let status: 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';
  if (driftPct <= 5) {
    status = 'BALANCED';
  } else if (driftPct <= 10) {
    status = 'SLIGHTLY_OFF';
  } else {
    status = 'ATTENTION_REQUIRED';
  }

  return {
    id: `portfolio-${userId}`,
    userId,
    cashIrr,
    holdings: finalHoldings,
    totalValueIrr,
    holdingsValueIrr: actualHoldingsValue,
    allocation: actualAllocation,
    targetAllocation,
    status,
    driftPct,
  };
}

/**
 * Create a portfolio with specific drift from target
 */
export function createDriftedPortfolio(
  profile: RiskProfileName,
  driftPct: number,
  direction: 'overweight-foundation' | 'overweight-growth' | 'overweight-upside' = 'overweight-foundation',
  holdingsValueIrr = PORTFOLIO_SIZES.MEDIUM
): PortfolioSnapshot {
  const target = RISK_PROFILES[profile];
  let allocation: { foundation: number; growth: number; upside: number };

  switch (direction) {
    case 'overweight-foundation':
      allocation = {
        foundation: target.foundation + driftPct,
        growth: target.growth - driftPct * 0.6,
        upside: target.upside - driftPct * 0.4,
      };
      break;
    case 'overweight-growth':
      allocation = {
        foundation: target.foundation - driftPct * 0.6,
        growth: target.growth + driftPct,
        upside: target.upside - driftPct * 0.4,
      };
      break;
    case 'overweight-upside':
      allocation = {
        foundation: target.foundation - driftPct * 0.6,
        growth: target.growth - driftPct * 0.4,
        upside: target.upside + driftPct,
      };
      break;
  }

  // Normalize to ensure sum is 100
  const total = allocation.foundation + allocation.growth + allocation.upside;
  allocation.foundation = (allocation.foundation / total) * 100;
  allocation.growth = (allocation.growth / total) * 100;
  allocation.upside = (allocation.upside / total) * 100;

  return createPortfolioSnapshot({
    holdingsValueIrr,
    allocation,
    targetAllocation: target,
  });
}

// ============================================================================
// PREDEFINED PORTFOLIO STATES
// ============================================================================

/**
 * Perfectly balanced portfolio with no drift
 */
export function createPerfectlyBalancedPortfolio(
  profile: RiskProfileName = 'BALANCED',
  holdingsValueIrr = PORTFOLIO_SIZES.MEDIUM
): PortfolioSnapshot {
  const target = RISK_PROFILES[profile];
  return createPortfolioSnapshot({
    holdingsValueIrr,
    allocation: target,
    targetAllocation: target,
  });
}

/**
 * Portfolio with cash available for deployment
 */
export function createPortfolioWithCash(
  cashIrr: number,
  holdingsValueIrr = PORTFOLIO_SIZES.MEDIUM,
  profile: RiskProfileName = 'BALANCED'
): PortfolioSnapshot {
  const target = RISK_PROFILES[profile];
  return createPortfolioSnapshot({
    cashIrr,
    holdingsValueIrr,
    allocation: target,
    targetAllocation: target,
  });
}

/**
 * Portfolio with frozen assets (loan collateral)
 */
export function createPortfolioWithFrozenAssets(
  frozenPct: number,
  holdingsValueIrr = PORTFOLIO_SIZES.MEDIUM,
  profile: RiskProfileName = 'BALANCED'
): PortfolioSnapshot {
  const target = RISK_PROFILES[profile];
  return createPortfolioSnapshot({
    holdingsValueIrr,
    allocation: target,
    targetAllocation: target,
    frozenPct,
  });
}

/**
 * Cash-only portfolio (no holdings)
 */
export function createCashOnlyPortfolio(
  cashIrr: number,
  profile: RiskProfileName = 'BALANCED'
): PortfolioSnapshot {
  return createPortfolioSnapshot({
    cashIrr,
    holdingsValueIrr: 0,
    holdings: [],
    allocation: { foundation: 0, growth: 0, upside: 0 },
    targetAllocation: RISK_PROFILES[profile],
  });
}

/**
 * Portfolio at minimum trade threshold
 */
export function createMinimumPortfolio(
  profile: RiskProfileName = 'BALANCED'
): PortfolioSnapshot {
  return createPortfolioSnapshot({
    holdingsValueIrr: MIN_TRADE_AMOUNT * 3, // Just enough for one trade per layer
    allocation: RISK_PROFILES[profile],
    targetAllocation: RISK_PROFILES[profile],
  });
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Check if trades are properly sorted (SELLs before BUYs)
 */
export function areTradesSorted(trades: RebalanceTrade[]): boolean {
  let seenBuy = false;
  for (const trade of trades) {
    if (trade.side === 'BUY') {
      seenBuy = true;
    } else if (trade.side === 'SELL' && seenBuy) {
      return false; // Found a SELL after a BUY
    }
  }
  return true;
}

/**
 * Calculate total value of trades by side
 */
export function sumTrades(trades: RebalanceTrade[], side: 'BUY' | 'SELL'): number {
  return trades
    .filter((t) => t.side === side)
    .reduce((sum, t) => sum + t.amountIrr, 0);
}

/**
 * Check if all trades meet minimum amount
 */
export function allTradesMeetMinimum(trades: RebalanceTrade[]): boolean {
  return trades.every((t) => t.amountIrr >= MIN_TRADE_AMOUNT);
}

/**
 * Get trades for a specific layer
 */
export function getLayerTrades(trades: RebalanceTrade[], layer: Layer): RebalanceTrade[] {
  return trades.filter((t) => t.layer === layer);
}

/**
 * Calculate allocation from holdings
 */
export function calculateAllocationFromHoldings(
  holdings: Holding[]
): { foundation: number; growth: number; upside: number } {
  const layerValues = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  let total = 0;

  for (const holding of holdings) {
    const value = holding.valueIrr ?? 0;
    layerValues[holding.layer] += value;
    total += value;
  }

  if (total === 0) {
    return { foundation: 0, growth: 0, upside: 0 };
  }

  return {
    foundation: (layerValues.FOUNDATION / total) * 100,
    growth: (layerValues.GROWTH / total) * 100,
    upside: (layerValues.UPSIDE / total) * 100,
  };
}

/**
 * Calculate drift between two allocations
 */
export function calculateDrift(
  current: { foundation: number; growth: number; upside: number },
  target: { foundation: number; growth: number; upside: number }
): number {
  return Math.max(
    Math.abs(current.foundation - target.foundation),
    Math.abs(current.growth - target.growth),
    Math.abs(current.upside - target.upside)
  );
}

/**
 * Verify gap analysis structure
 */
export function isValidGapAnalysis(gap: GapAnalysis): boolean {
  return (
    typeof gap.layer === 'string' &&
    typeof gap.current === 'number' &&
    typeof gap.target === 'number' &&
    typeof gap.gap === 'number' &&
    typeof gap.gapIrr === 'number' &&
    ['FOUNDATION', 'GROWTH', 'UPSIDE'].includes(gap.layer)
  );
}

// ============================================================================
// MOCK FACTORY FUNCTIONS
// ============================================================================

/**
 * Create mock portfolio database record
 */
export function createMockPortfolioRecord(
  userId: string,
  options: {
    lastRebalanceAt?: Date | null;
    cashIrr?: number;
  } = {}
) {
  return {
    id: `portfolio-${userId}`,
    userId,
    cashIrr: options.cashIrr ?? 0,
    lastRebalanceAt: options.lastRebalanceAt ?? null,
    riskScore: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create mock holding database record
 */
export function createMockHoldingRecord(
  portfolioId: string,
  assetId: AssetId,
  quantity: number,
  frozen = false
) {
  return {
    id: `holding-${portfolioId}-${assetId}`,
    portfolioId,
    assetId,
    quantity,
    layer: ASSET_TO_LAYER[assetId],
    frozen,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ============================================================================
// TIME HELPERS
// ============================================================================

/**
 * Create a date hours ago from now
 */
export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

/**
 * Create a date seconds ago from now
 */
export function secondsAgo(seconds: number): Date {
  return new Date(Date.now() - seconds * 1000);
}
