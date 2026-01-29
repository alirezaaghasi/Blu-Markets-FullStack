/**
 * BLU MARKETS — INTRA-LAYER BALANCING ENGINE
 *
 * Dynamic allocation using Hybrid Risk-Adjusted Momentum (HRAM):
 *   1. Risk Parity (inverse volatility)
 *   2. Momentum (trend following)
 *   3. Correlation (diversification)
 *   4. Liquidity (tradability)
 *
 * Formula:
 *   Weight[i] = normalize(
 *     RiskParityWeight × MomentumFactor × CorrelationFactor × LiquidityFactor
 *   )
 *
 * Ported from blu-markets-web/src/engine/intraLayerBalancer.ts
 */

import type { Layer, AssetId } from '../types/domain.js';
import { getLayerAssets, ASSETS_CONFIG } from '../config/assets.js';
import { prisma } from '../config/database.js';

// HRAM Configuration
export const BALANCER_CONFIG = {
  // Weight caps (per asset within layer)
  MIN_WEIGHT: 0.05,           // 5% minimum per asset
  MAX_WEIGHT: 0.40,           // 40% maximum per asset

  // Factor strengths
  MOMENTUM_STRENGTH: 0.3,     // How much momentum affects weight (0-1)
  CORRELATION_PENALTY: 0.2,   // How much correlation reduces weight (0-1)
  LIQUIDITY_BONUS: 0.1,       // Bonus for high liquidity assets

  // Lookback periods (days)
  VOLATILITY_WINDOW: 30,
  MOMENTUM_WINDOW: 50,
  CORRELATION_WINDOW: 60,

  // Rebalance triggers
  DRIFT_THRESHOLD: 0.05,              // 5% drift triggers normal rebalance
  EMERGENCY_DRIFT_THRESHOLD: 0.10,    // 10% drift triggers immediate rebalance
  MIN_REBALANCE_INTERVAL_DAYS: 1,     // 1 day between normal rebalances

  // Trade execution
  MIN_TRADE_VALUE_IRR: 100000,        // Skip trades smaller than 100,000 IRR
};

// Strategy Presets
export const STRATEGY_PRESETS = {
  // Balanced hybrid (default)
  BALANCED: {
    MOMENTUM_STRENGTH: 0.3,
    CORRELATION_PENALTY: 0.2,
    MIN_WEIGHT: 0.05,
    MAX_WEIGHT: 0.40,
  },

  // Conservative - prefer stability
  CONSERVATIVE: {
    MOMENTUM_STRENGTH: 0.1,
    CORRELATION_PENALTY: 0.3,
    MIN_WEIGHT: 0.10,
    MAX_WEIGHT: 0.35,
  },

  // Aggressive - prefer momentum
  AGGRESSIVE: {
    MOMENTUM_STRENGTH: 0.5,
    CORRELATION_PENALTY: 0.1,
    MIN_WEIGHT: 0.05,
    MAX_WEIGHT: 0.50,
  },
};

export type StrategyPreset = keyof typeof STRATEGY_PRESETS;

interface AssetFactors {
  volatility: number;
  riskParityWeight: number;
  momentum: number;
  momentumFactor: number;
  avgCorrelation: number;
  correlationFactor: number;
  liquidityFactor: number;
}

export interface IntraLayerWeightResult {
  weights: Record<AssetId, number>;
  factors: Record<AssetId, AssetFactors>;
  metadata?: {
    layer: Layer;
    assetCount: number;
    calculatedAt: string;
  };
}

interface BalancerConfig {
  VOLATILITY_WINDOW?: number;
  MOMENTUM_WINDOW?: number;
  CORRELATION_WINDOW?: number;
  MOMENTUM_STRENGTH?: number;
  CORRELATION_PENALTY?: number;
  LIQUIDITY_BONUS?: number;
  MAX_WEIGHT?: number;
  MIN_WEIGHT?: number;
}

/**
 * Market Data Provider
 * Provides volatility, momentum, and correlation data from database or config
 */
class MarketDataProvider {
  private priceHistory: Map<string, { price: number; timestamp: Date }[]> = new Map();

  /**
   * Load price history from database
   * For now, uses baseVolatility from ASSETS_CONFIG as fallback
   */
  async loadPriceHistory(): Promise<void> {
    // In production, this would load from a price_history table
    // For now, we'll use the static baseVolatility from config
  }

  /**
   * Calculate volatility for an asset
   * Uses baseVolatility from ASSETS_CONFIG
   */
  calculateVolatility(asset: AssetId): number {
    const config = ASSETS_CONFIG[asset];
    return config?.baseVolatility || 0.5;
  }

  /**
   * Calculate momentum (price vs SMA)
   * Returns value between -1 and 1
   * For now, returns 0 (neutral) since we don't have historical data
   */
  calculateMomentum(asset: AssetId): number {
    // In production, this would calculate from price history
    // For now, return neutral momentum
    return 0;
  }

  /**
   * Calculate correlation between two assets
   * For now, returns 0 (no correlation) since we don't have historical data
   */
  calculateCorrelation(asset1: AssetId, asset2: AssetId): number {
    // In production, this would calculate from price history
    // For now, return no correlation
    return 0;
  }
}

/**
 * Intra-Layer Balancer
 * Calculates optimal weights for assets within a layer using HRAM algorithm
 */
export class IntraLayerBalancer {
  private marketData: MarketDataProvider;
  private config: BalancerConfig;

  constructor(config: BalancerConfig = {}) {
    this.marketData = new MarketDataProvider();
    this.config = { ...BALANCER_CONFIG, ...config };
  }

  /**
   * Calculate optimal weights for assets within a layer
   */
  calculateWeights(layer: Layer, options: BalancerConfig = {}): IntraLayerWeightResult {
    const layerAssets = getLayerAssets(layer);
    if (layerAssets.length === 0) {
      return { weights: {} as Record<AssetId, number>, factors: {} as Record<AssetId, AssetFactors> };
    }

    const config = { ...this.config, ...options };
    const factors: Record<string, AssetFactors> = {};
    const rawWeights: Record<string, number> = {};

    // Calculate factors for each asset
    for (const asset of layerAssets) {
      factors[asset] = this._calculateFactors(asset, layerAssets, config);
    }

    // Calculate raw weights
    for (const asset of layerAssets) {
      const f = factors[asset];
      rawWeights[asset] = f.riskParityWeight * f.momentumFactor * f.correlationFactor * f.liquidityFactor;
    }

    // Normalize weights
    const totalRaw = Object.values(rawWeights).reduce((a, b) => a + b, 0);
    const normalizedWeights: Record<string, number> = {};
    for (const asset of layerAssets) {
      normalizedWeights[asset] = totalRaw > 0 ? rawWeights[asset] / totalRaw : 1 / layerAssets.length;
    }

    // Apply caps and renormalize
    const cappedWeights = this._applyCaps(normalizedWeights, config);

    return {
      weights: cappedWeights as Record<AssetId, number>,
      factors: factors as Record<AssetId, AssetFactors>,
      metadata: {
        layer,
        assetCount: layerAssets.length,
        calculatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Calculate all four HRAM factors for an asset
   * Uses layerWeight from ASSETS_CONFIG as the base, with small adjustments
   */
  private _calculateFactors(asset: AssetId, allAssets: AssetId[], config: BalancerConfig): AssetFactors {
    const assetConfig = ASSETS_CONFIG[asset];

    // 1. Base Weight from ASSETS_CONFIG (respects intended allocation)
    // Use layerWeight as the primary driver, not pure inverse volatility
    const baseWeight = assetConfig?.layerWeight || (1 / allAssets.length);
    const volatility = this.marketData.calculateVolatility(asset);

    // Apply a mild volatility adjustment (±15% max) instead of pure inverse volatility
    // This preserves the intended layerWeight while still preferring less volatile assets
    const avgVolatility = 0.30; // Approximate average across all assets
    const volatilityRatio = avgVolatility / Math.max(volatility, 0.01);
    const volatilityAdjustment = Math.max(0.85, Math.min(1.15, 0.85 + (volatilityRatio - 1) * 0.15));
    const riskParityWeight = baseWeight * volatilityAdjustment;

    // 2. Momentum Factor
    const momentum = this.marketData.calculateMomentum(asset);
    const momentumFactor = 1 + (momentum * (config.MOMENTUM_STRENGTH || 0.3));

    // 3. Correlation Factor
    let totalCorrelation = 0;
    let correlationCount = 0;
    for (const other of allAssets) {
      if (other !== asset) {
        const corr = this.marketData.calculateCorrelation(asset, other);
        totalCorrelation += Math.abs(corr);
        correlationCount++;
      }
    }
    const avgCorrelation = correlationCount > 0 ? totalCorrelation / correlationCount : 0;
    const correlationFactor = 1 - (avgCorrelation * (config.CORRELATION_PENALTY || 0.2));

    // 4. Liquidity Factor
    const liquidityFactor = this._getLiquidityFactor(asset, config);

    return {
      volatility,
      riskParityWeight,
      momentum,
      momentumFactor,
      avgCorrelation,
      correlationFactor,
      liquidityFactor,
    };
  }

  /**
   * Get liquidity factor from ASSETS_CONFIG
   */
  private _getLiquidityFactor(asset: AssetId, config: BalancerConfig): number {
    const assetConfig = ASSETS_CONFIG[asset];
    if (!assetConfig) return 1;

    const baseScore = assetConfig.liquidityScore || 0.80;
    return 1 + (baseScore - 0.80) * (config.LIQUIDITY_BONUS || 0.1);
  }

  /**
   * Apply min/max caps and renormalize
   */
  private _applyCaps(weights: Record<string, number>, config: BalancerConfig): Record<string, number> {
    const assets = Object.keys(weights);
    const capped = { ...weights };
    const maxWeight = config.MAX_WEIGHT || 0.40;
    const minWeight = config.MIN_WEIGHT || 0.05;

    for (let iteration = 0; iteration < 10; iteration++) {
      let needsRenormalize = false;
      let surplus = 0;
      let uncappedCount = 0;

      for (const asset of assets) {
        if (capped[asset] > maxWeight) {
          surplus += capped[asset] - maxWeight;
          capped[asset] = maxWeight;
          needsRenormalize = true;
        } else if (capped[asset] < minWeight) {
          surplus -= minWeight - capped[asset];
          capped[asset] = minWeight;
          needsRenormalize = true;
        } else {
          uncappedCount++;
        }
      }

      if (!needsRenormalize || uncappedCount === 0) break;

      const surplusPerAsset = surplus / uncappedCount;
      for (const asset of assets) {
        if (capped[asset] > minWeight && capped[asset] < maxWeight) {
          capped[asset] += surplusPerAsset;
        }
      }
    }

    // Final normalization
    const total = Object.values(capped).reduce((a, b) => a + b, 0);
    for (const asset of assets) {
      capped[asset] = capped[asset] / total;
    }

    return capped;
  }
}

/**
 * Create a balancer with a specific strategy preset
 */
export function createBalancer(strategyName: StrategyPreset = 'BALANCED'): IntraLayerBalancer {
  const strategy = STRATEGY_PRESETS[strategyName] || STRATEGY_PRESETS.BALANCED;
  return new IntraLayerBalancer(strategy);
}

/**
 * Get dynamic weights for a layer using HRAM algorithm
 * This replaces the static getLayerWeights() for intra-layer allocation
 */
export function getDynamicLayerWeights(layer: Layer, strategy: StrategyPreset = 'BALANCED'): Record<AssetId, number> {
  const balancer = createBalancer(strategy);
  const result = balancer.calculateWeights(layer);
  return result.weights;
}

/**
 * Calculate weights for all layers
 */
export function calculateAllLayerWeights(strategy: StrategyPreset = 'BALANCED'): Record<Layer, IntraLayerWeightResult> {
  const balancer = createBalancer(strategy);

  return {
    FOUNDATION: balancer.calculateWeights('FOUNDATION'),
    GROWTH: balancer.calculateWeights('GROWTH'),
    UPSIDE: balancer.calculateWeights('UPSIDE'),
  };
}
