/**
 * Business Rules Configuration
 *
 * Centralized location for all business rules, limits, and thresholds.
 * This file is the single source of truth for business logic constants.
 *
 * @module config/business-rules
 */

import type { AssetId, Layer } from '../types/domain.js';

// ============================================================================
// TRADING RULES
// ============================================================================

/**
 * Trading spreads by asset layer (per PRD Section 8.2)
 * Applied to both buy and sell trades
 */
export const SPREAD_BY_LAYER: Record<Layer, number> = {
  FOUNDATION: 0.0015, // 0.15%
  GROWTH: 0.0030, // 0.30%
  UPSIDE: 0.0060, // 0.60%
};

/**
 * Minimum trade amount in IRR
 * Prevents dust trades that cost more in fees than value
 */
export const MIN_TRADE_IRR = 100_000; // 100K IRR (~$2)

/**
 * Maximum single trade amount in IRR
 * Risk limit to prevent market impact
 */
export const MAX_SINGLE_TRADE_IRR = 50_000_000_000; // 50B IRR (~$1M)

// ============================================================================
// LOAN RULES (per PRD Section 10)
// ============================================================================

/**
 * LTV limits by asset layer
 * Foundation assets allow higher leverage due to lower volatility
 */
export const LTV_BY_LAYER: Record<Layer, number> = {
  FOUNDATION: 0.70, // 70%
  GROWTH: 0.50, // 50%
  UPSIDE: 0.30, // 30%
};

/**
 * Critical LTV threshold for auto-liquidation
 * When LTV exceeds this, collateral is liquidated to repay loan
 */
export const CRITICAL_LTV_THRESHOLD = 0.90; // 90%

/**
 * Warning LTV threshold for margin call
 * User notified when LTV exceeds this
 */
export const WARNING_LTV_THRESHOLD = 0.80; // 80%

/**
 * Loan interest rate (annual)
 */
export const LOAN_INTEREST_RATE = 0.30; // 30% APR

/**
 * Available loan durations in months
 */
export const LOAN_DURATION_MONTHS = [3, 6] as const;
export type LoanDurationMonths = (typeof LOAN_DURATION_MONTHS)[number];

/**
 * Minimum loan amount in IRR
 */
export const MIN_LOAN_IRR = 10_000_000; // 10M IRR

/**
 * Maximum loan amount in IRR (portfolio-level limit)
 */
export const MAX_TOTAL_LOANS_IRR = 1_000_000_000_000; // 1T IRR

// ============================================================================
// PROTECTION RULES (per PRD Section 11)
// ============================================================================

/**
 * Protection duration presets in days
 */
export const PROTECTION_DURATION_DAYS = [7, 14, 30, 60, 90, 180] as const;
export type ProtectionDurationDays = (typeof PROTECTION_DURATION_DAYS)[number];

/**
 * Coverage percentage limits
 */
export const MIN_COVERAGE_PCT = 0.10; // 10%
export const MAX_COVERAGE_PCT = 1.00; // 100%
export const DEFAULT_COVERAGE_PCT = 1.00; // 100%

/**
 * Minimum notional value for protection in IRR
 * Below this, protection isn't cost-effective
 */
export const MIN_NOTIONAL_IRR = 1_000_000; // 1M IRR

/**
 * Quote validity duration in milliseconds
 */
export const QUOTE_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Premium tolerance for purchase validation
 * Allows for minor price changes between quote and purchase
 */
export const PREMIUM_TOLERANCE = 0.05; // 5%

/**
 * Global minimum premium floor (per 30 days)
 * Ensures profitability even on low-vol assets
 */
export const GLOBAL_MIN_PREMIUM_FLOOR_30D = 0.025; // 2.5%

/**
 * Execution spread by asset (added to fair value premium)
 */
export const EXECUTION_SPREAD: Record<string, number> = {
  BTC: 0.003, // 0.3%
  ETH: 0.004, // 0.4%
  SOL: 0.005, // 0.5%
  PAXG: 0.002, // 0.2%
  KAG: 0.003, // 0.3%
  QQQ: 0.002, // 0.2%
};

/**
 * Minimum premium by asset (per 30 days)
 * All values >= GLOBAL_MIN_PREMIUM_FLOOR_30D
 */
export const MIN_PREMIUM_30D: Record<string, number> = {
  BTC: 0.05, // 5%
  ETH: 0.06, // 6%
  SOL: 0.08, // 8%
  PAXG: 0.025, // 2.5% (floor)
  KAG: 0.025, // 2.5% (floor)
  QQQ: 0.025, // 2.5% (floor)
};

/**
 * Maximum premium by asset (per 30 days)
 * Prevents unreasonable premiums during high volatility
 */
export const MAX_PREMIUM_30D: Record<string, number> = {
  BTC: 0.08, // 8%
  ETH: 0.10, // 10%
  SOL: 0.12, // 12%
  PAXG: 0.03, // 3%
  KAG: 0.035, // 3.5%
  QQQ: 0.04, // 4%
};

/**
 * Protection eligible assets
 * Must have liquid derivatives market for hedging
 */
export const PROTECTION_ELIGIBLE_ASSETS: AssetId[] = [
  'BTC', // CME futures, Deribit/Binance options
  'ETH', // CME futures, major exchange options
  'QQQ', // Nasdaq-100 options (most liquid)
  'PAXG', // Gold - COMEX futures/options
  'SOL', // CME futures, exchange perps
  'KAG', // Silver - COMEX futures/options
];

// ============================================================================
// REBALANCE RULES (per PRD Section 7)
// ============================================================================

/**
 * Rebalance cooldown period in milliseconds
 * Prevents excessive rebalancing
 */
export const REBALANCE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Minimum drift threshold to trigger rebalance
 * Below this, rebalance is not cost-effective
 */
export const MIN_REBALANCE_DRIFT_PCT = 0.05; // 5%

/**
 * Target allocation percentages
 */
export const DEFAULT_TARGET_ALLOCATION = {
  FOUNDATION: 35,
  GROWTH: 40,
  UPSIDE: 25,
} as const;

// ============================================================================
// PORTFOLIO RULES
// ============================================================================

/**
 * Minimum initial deposit in IRR
 */
export const MIN_INITIAL_DEPOSIT_IRR = 50_000_000; // 50M IRR (~$1000)

/**
 * Minimum add funds amount in IRR
 */
export const MIN_ADD_FUNDS_IRR = 1_000_000; // 1M IRR (~$20)

/**
 * Boundary thresholds for allocation drift
 * Used to classify portfolio status
 */
export const BOUNDARY_THRESHOLDS = {
  SAFE: 0.05, // Within 5% of target
  MILD: 0.10, // 5-10% drift
  STRONG: 0.15, // 10-15% drift
  // Beyond 15% is OVERRIDING
} as const;

// ============================================================================
// RISK RULES
// ============================================================================

/**
 * Risk thresholds for protection exposure
 */
export const RISK_THRESHOLDS = {
  /** Maximum total notional before critical alert */
  NOTIONAL_CRITICAL_USD: 10_000_000, // $10M
  /** Maximum total notional before warning */
  NOTIONAL_WARNING_USD: 5_000_000, // $5M
  /** Maximum concentration in single asset */
  SINGLE_ASSET_CONCENTRATION_PCT: 0.30, // 30%
  /** Maximum concentration in single expiry window */
  EXPIRY_CONCENTRATION_PCT: 0.40, // 40%
  /** Delta warning threshold (portfolio level) */
  DELTA_WARNING: -0.50,
} as const;

// ============================================================================
// PRICE RULES
// ============================================================================

/**
 * Maximum price age before considered stale
 */
export const MAX_PRICE_AGE_MINUTES = 2;

/**
 * Price polling interval in milliseconds
 */
export const DEFAULT_PRICE_POLL_INTERVAL_MS = 30_000; // 30 seconds

// ============================================================================
// RATE LIMITS
// ============================================================================

/**
 * OTP rate limiting
 */
export const OTP_RATE_LIMIT = {
  MAX_REQUESTS: 3,
  WINDOW_MINUTES: 5,
  EXPIRY_SECONDS: 120,
  MAX_ATTEMPTS: 3,
} as const;

/**
 * WebSocket connection limits
 */
export const WEBSOCKET_LIMITS = {
  MAX_CONNECTIONS_PER_USER: 5,
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get spread for an asset based on its layer
 */
export function getSpreadForLayer(layer: Layer): number {
  return SPREAD_BY_LAYER[layer];
}

/**
 * Get LTV limit for an asset based on its layer
 */
export function getLtvForLayer(layer: Layer): number {
  return LTV_BY_LAYER[layer];
}

/**
 * Check if an asset is eligible for protection
 */
export function isProtectionEligible(assetId: AssetId): boolean {
  return PROTECTION_ELIGIBLE_ASSETS.includes(assetId);
}

/**
 * Get execution spread for protection premium
 */
export function getExecutionSpread(assetId: string): number {
  return EXECUTION_SPREAD[assetId] || 0.005; // Default 0.5%
}

/**
 * Get premium bounds for an asset
 */
export function getPremiumBounds(assetId: string, durationDays: number): { min: number; max: number } {
  const assetMin = MIN_PREMIUM_30D[assetId] || GLOBAL_MIN_PREMIUM_FLOOR_30D;
  const effectiveMin = Math.max(assetMin, GLOBAL_MIN_PREMIUM_FLOOR_30D);
  const scaledMin = effectiveMin * (durationDays / 30);

  const assetMax = MAX_PREMIUM_30D[assetId] || 0.10;
  const scaledMax = assetMax * (durationDays / 30);

  return { min: scaledMin, max: scaledMax };
}
