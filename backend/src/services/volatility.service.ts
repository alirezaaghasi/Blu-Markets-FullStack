/**
 * Volatility Service
 * Provides implied volatility estimates for protection pricing
 *
 * Since we're not integrating with Deribit for real IV data,
 * this service uses realistic default values with term structure
 * and regime adjustments.
 *
 * @module services/volatility.service
 */

import type { AssetId, Layer } from '../types/domain.js';

// ============================================================================
// TYPES
// ============================================================================

export type VolatilityRegime = 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH' | 'EXTREME';

export interface VolatilityData {
  assetId: AssetId;
  baseVolatility: number; // Annualized IV (e.g., 0.55 = 55%)
  adjustedVolatility: number; // After term structure and regime adjustments
  regime: VolatilityRegime;
  termMultiplier: number;
  regimeMultiplier: number;
}

// ============================================================================
// DEFAULT VOLATILITIES
// ============================================================================

/**
 * Base annualized implied volatility by asset
 * Based on historical crypto/commodity volatility ranges:
 * - BTC: 50-80% typical, using 55% as baseline
 * - ETH: 60-90% typical, using 65% as baseline
 * - SOL: 70-100% typical, using 85% as baseline
 * - Gold (PAXG): 12-20% typical, using 15% as baseline
 * - QQQ: 18-30% typical, using 22% as baseline
 */
export const DEFAULT_VOLATILITY: Record<string, number> = {
  // Crypto - High volatility
  BTC: 0.55,
  ETH: 0.65,
  SOL: 0.85,
  TON: 0.80,
  BNB: 0.60,
  XRP: 0.70,
  LINK: 0.75,
  AVAX: 0.80,
  MATIC: 0.75,
  ARB: 0.85,

  // Precious metals - Low volatility
  PAXG: 0.15, // Tokenized gold
  KAG: 0.18, // Kinesis silver

  // ETFs - Moderate volatility
  QQQ: 0.22,

  // Stablecoins - Near zero volatility
  USDT: 0.02,

  // Fixed income - Zero volatility
  IRR_FIXED_INCOME: 0,
};

// ============================================================================
// TERM STRUCTURE
// ============================================================================

/**
 * Term structure multipliers
 * Short-dated options typically have higher IV due to event risk
 * Long-dated options have lower IV due to mean reversion
 *
 * Key: duration in days
 */
export const TERM_STRUCTURE: Record<number, number> = {
  7: 1.20, // 1 week - elevated due to short-term uncertainty
  14: 1.12, // 2 weeks
  30: 1.00, // 1 month - baseline
  60: 0.95, // 2 months
  90: 0.92, // 3 months
  180: 0.88, // 6 months - lower due to mean reversion
};

/**
 * Get term structure multiplier for any duration
 * Interpolates between preset values
 */
export function getTermMultiplier(durationDays: number): number {
  // Clamp to valid range
  if (durationDays <= 7) return TERM_STRUCTURE[7];
  if (durationDays >= 180) return TERM_STRUCTURE[180];

  // Find surrounding preset values and interpolate
  const presets = Object.keys(TERM_STRUCTURE)
    .map(Number)
    .sort((a, b) => a - b);

  for (let i = 0; i < presets.length - 1; i++) {
    const lower = presets[i];
    const upper = presets[i + 1];

    if (durationDays >= lower && durationDays <= upper) {
      const ratio = (durationDays - lower) / (upper - lower);
      return TERM_STRUCTURE[lower] + ratio * (TERM_STRUCTURE[upper] - TERM_STRUCTURE[lower]);
    }
  }

  return 1.0; // Fallback
}

// ============================================================================
// VOLATILITY REGIME
// ============================================================================

/**
 * Volatility regime thresholds relative to baseline
 * These determine how current market conditions affect pricing
 */
const REGIME_THRESHOLDS = {
  LOW: 0.7, // Below 70% of baseline
  NORMAL_LOW: 0.85,
  NORMAL_HIGH: 1.15,
  ELEVATED: 1.4,
  HIGH: 1.8,
  // Above HIGH = EXTREME
};

/**
 * Regime multipliers applied to premium
 * When volatility regime is elevated, we charge more
 */
const REGIME_MULTIPLIERS: Record<VolatilityRegime, number> = {
  LOW: 0.85, // Cheaper protection in calm markets
  NORMAL: 1.0, // Baseline
  ELEVATED: 1.15, // Slightly more expensive
  HIGH: 1.35, // Significantly more expensive
  EXTREME: 1.6, // Very expensive, risk is elevated
};

/**
 * Per-asset regime simulation
 * In production, this would be derived from actual market data
 * Each asset can have its own volatility regime for realistic multi-asset pricing
 */
const simulatedRegimeMultipliers = new Map<string, number>();

/**
 * Get the regime multiplier for a specific asset
 * Returns 1.0 (NORMAL) if no specific multiplier is set
 */
function getAssetRegimeMultiplier(assetId: AssetId): number {
  return simulatedRegimeMultipliers.get(assetId) ?? 1.0;
}

/**
 * Get current volatility regime for an asset
 * In production, this would compare current IV to historical average
 */
export function getVolatilityRegime(assetId: AssetId): VolatilityRegime {
  // Use per-asset regime multiplier
  const multiplier = getAssetRegimeMultiplier(assetId);

  if (multiplier < REGIME_THRESHOLDS.LOW) return 'LOW';
  if (multiplier < REGIME_THRESHOLDS.NORMAL_LOW) return 'LOW';
  if (multiplier <= REGIME_THRESHOLDS.NORMAL_HIGH) return 'NORMAL';
  if (multiplier <= REGIME_THRESHOLDS.ELEVATED) return 'ELEVATED';
  if (multiplier <= REGIME_THRESHOLDS.HIGH) return 'HIGH';
  return 'EXTREME';
}

/**
 * Get regime multiplier for pricing adjustments
 */
export function getRegimeMultiplier(regime: VolatilityRegime): number {
  return REGIME_MULTIPLIERS[regime];
}

/**
 * Set simulated regime for a specific asset (for testing/admin)
 * @param assetId - Asset to set regime for
 * @param multiplier - 0.5 to 2.5 range
 */
export function setSimulatedRegime(assetId: AssetId, multiplier: number): void {
  simulatedRegimeMultipliers.set(assetId, Math.max(0.5, Math.min(2.5, multiplier)));
}

/**
 * Set simulated regime for all assets (for testing/admin)
 * @param multiplier - 0.5 to 2.5 range
 */
export function setGlobalSimulatedRegime(multiplier: number): void {
  const clampedMultiplier = Math.max(0.5, Math.min(2.5, multiplier));
  const allAssets: AssetId[] = ['BTC', 'ETH', 'SOL', 'TON', 'BNB', 'XRP', 'LINK', 'AVAX', 'MATIC', 'ARB', 'PAXG', 'KAG', 'QQQ'];
  for (const assetId of allAssets) {
    simulatedRegimeMultipliers.set(assetId, clampedMultiplier);
  }
}

/**
 * Reset regime for a specific asset to normal
 */
export function resetRegime(assetId?: AssetId): void {
  if (assetId) {
    simulatedRegimeMultipliers.delete(assetId);
  } else {
    // Reset all assets
    simulatedRegimeMultipliers.clear();
  }
}

// ============================================================================
// MAIN VOLATILITY FUNCTION
// ============================================================================

/**
 * Get implied volatility for an asset at a specific duration
 *
 * @param assetId - Asset identifier
 * @param durationDays - Duration in days (7-180)
 * @param strikePct - Strike as percentage of spot (1.0 = ATM)
 * @returns Volatility data including base and adjusted values
 */
export function getImpliedVolatility(
  assetId: AssetId,
  durationDays: number = 30,
  strikePct: number = 1.0
): VolatilityData {
  // Get base volatility for asset
  const baseVolatility = DEFAULT_VOLATILITY[assetId] ?? 0.5; // Default to 50% if unknown

  // Apply term structure
  const termMultiplier = getTermMultiplier(durationDays);

  // Get current regime
  const regime = getVolatilityRegime(assetId);
  const regimeMultiplier = getRegimeMultiplier(regime);

  // Apply skew for OTM puts (lower strike = higher IV)
  // This simulates the volatility smile/skew
  const skewMultiplier = getSkewMultiplier(strikePct);

  // Calculate adjusted volatility
  const adjustedVolatility = baseVolatility * termMultiplier * regimeMultiplier * skewMultiplier;

  return {
    assetId,
    baseVolatility,
    adjustedVolatility,
    regime,
    termMultiplier,
    regimeMultiplier,
  };
}

/**
 * Simple function to get just the volatility number
 */
export function getVolatility(assetId: AssetId, durationDays: number = 30): number {
  return getImpliedVolatility(assetId, durationDays).adjustedVolatility;
}

// ============================================================================
// VOLATILITY SKEW
// ============================================================================

/**
 * Skew multiplier for OTM puts
 * Lower strikes (OTM puts) have higher IV due to crash protection demand
 */
export function getSkewMultiplier(strikePct: number): number {
  // ATM (100%) = 1.0
  // 95% strike = slightly higher IV
  // 90% strike = higher IV
  // 85% strike = highest IV

  if (strikePct >= 1.0) return 1.0;
  if (strikePct >= 0.95) return 1.0 + (1.0 - strikePct) * 1.0; // 1.0 to 1.05
  if (strikePct >= 0.90) return 1.05 + (0.95 - strikePct) * 1.4; // 1.05 to 1.12
  if (strikePct >= 0.85) return 1.12 + (0.90 - strikePct) * 1.6; // 1.12 to 1.20
  return 1.20 + (0.85 - strikePct) * 2.0; // Higher skew for deep OTM
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get volatility for all protection-eligible assets
 */
export function getAllVolatilities(durationDays: number = 30): Map<AssetId, VolatilityData> {
  const eligibleAssets: AssetId[] = ['BTC', 'ETH', 'PAXG', 'KAG', 'QQQ', 'SOL'];
  const result = new Map<AssetId, VolatilityData>();

  for (const assetId of eligibleAssets) {
    result.set(assetId, getImpliedVolatility(assetId, durationDays));
  }

  return result;
}

/**
 * Get volatility regime description (for UI)
 */
export function getRegimeDescription(regime: VolatilityRegime): string {
  const descriptions: Record<VolatilityRegime, string> = {
    LOW: 'Market volatility is unusually low. Protection is relatively cheap.',
    NORMAL: 'Market volatility is at normal levels.',
    ELEVATED: 'Market volatility is elevated. Protection costs more but may be valuable.',
    HIGH: 'Market volatility is high. Protection is expensive but risk is elevated.',
    EXTREME: 'Market volatility is extreme. Consider the cost carefully.',
  };
  return descriptions[regime];
}

/**
 * Get volatility regime description in Farsi (for UI)
 */
export function getRegimeDescriptionFa(regime: VolatilityRegime): string {
  const descriptions: Record<VolatilityRegime, string> = {
    LOW: 'نوسانات بازار به طور غیرعادی پایین است. حمایت نسبتاً ارزان است.',
    NORMAL: 'نوسانات بازار در سطح عادی است.',
    ELEVATED: 'نوسانات بازار بالا رفته است. حمایت گران‌تر است اما ممکن است ارزشمند باشد.',
    HIGH: 'نوسانات بازار بالا است. حمایت گران است اما ریسک بالا است.',
    EXTREME: 'نوسانات بازار شدید است. هزینه را با دقت بررسی کنید.',
  };
  return descriptions[regime];
}

/**
 * Get color for volatility regime (for UI)
 */
export function getRegimeColor(regime: VolatilityRegime): string {
  const colors: Record<VolatilityRegime, string> = {
    LOW: '#22C55E', // Green
    NORMAL: '#3B82F6', // Blue
    ELEVATED: '#F59E0B', // Amber
    HIGH: '#EF4444', // Red
    EXTREME: '#7C3AED', // Purple
  };
  return colors[regime];
}

/**
 * Check if asset is eligible for protection based on volatility data availability
 */
export function hasVolatilityData(assetId: AssetId): boolean {
  return assetId in DEFAULT_VOLATILITY && DEFAULT_VOLATILITY[assetId] > 0;
}

/**
 * Get asset layer for profit margin calculation
 */
export function getAssetLayer(assetId: AssetId): Layer {
  const layerMap: Record<string, Layer> = {
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
  return layerMap[assetId] || 'GROWTH';
}
