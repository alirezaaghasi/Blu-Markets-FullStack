/**
 * BLU MARKETS v10 — INTRA-LAYER BALANCING ENGINE
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
 */

import type { Layer, AssetId, TradeSide, StrategyPreset, IntraLayerWeightResult } from '../types';
import { LAYER_ASSETS, ASSET_META } from '../state/domain';
import { BALANCER_CONFIG, STRATEGY_PRESETS, DEFAULT_PRICES } from '../constants/index';

interface PricePoint {
  price: number;
  [key: string]: unknown;
}

interface PriceHistory {
  [assetId: string]: PricePoint[];
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
  DRIFT_THRESHOLD?: number;
  EMERGENCY_DRIFT_THRESHOLD?: number;
  MIN_REBALANCE_INTERVAL_DAYS?: number;
  MIN_TRADE_VALUE_IRR?: number;
}

interface AssetFactors {
  volatility: number;
  riskParityWeight: number;
  momentum: number;
  momentumFactor: number;
  avgCorrelation: number;
  correlationFactor: number;
  liquidityFactor: number;
}

interface RebalanceDecision {
  shouldRebalance: boolean;
  reason: 'EMERGENCY' | 'NORMAL' | null;
  maxDrift: number;
  driftByAsset: Record<string, number>;
  daysSinceLastRebalance: number;
}

interface TradeOrder {
  asset: string;
  layer: string;
  side: TradeSide;
  quantity: number;
  valueIRR: number;
  currentWeight: number;
  targetWeight: number;
}

interface HoldingData {
  quantity?: number;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKET DATA PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provides market data for balancing calculations
 * Can use historical price data or fall back to base volatility from ASSET_META
 */
export class MarketDataProvider {
  private priceHistory: PriceHistory;

  constructor(priceHistory: PriceHistory = {}) {
    this.priceHistory = priceHistory;
  }

  /**
   * Get current price for an asset
   */
  getCurrentPrice(asset: string): number | null {
    const history = this.priceHistory[asset];
    if (history && history.length > 0) {
      return history[history.length - 1].price;
    }
    return DEFAULT_PRICES[asset] || null;
  }

  /**
   * Get price history for an asset
   */
  getPriceHistory(asset: string, days: number): PricePoint[] {
    const history = this.priceHistory[asset] || [];
    return history.slice(-days);
  }

  /**
   * Calculate realized volatility from price history
   * Falls back to base volatility from ASSET_META if insufficient data
   */
  calculateVolatility(asset: string, days: number = BALANCER_CONFIG.VOLATILITY_WINDOW): number {
    const history = this.getPriceHistory(asset, days + 1);
    if (history.length < 2) {
      return ASSET_META[asset]?.baseVolatility || 0.5;
    }

    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const dailyReturn = (history[i].price - history[i - 1].price) / history[i - 1].price;
      returns.push(dailyReturn);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const dailyVol = Math.sqrt(variance);

    // Annualize
    return dailyVol * Math.sqrt(365);
  }

  /**
   * Calculate momentum (price vs SMA)
   * Returns value between -1 and 1
   */
  calculateMomentum(asset: string, days: number = BALANCER_CONFIG.MOMENTUM_WINDOW): number {
    const history = this.getPriceHistory(asset, days);
    if (history.length < days * 0.5) return 0;

    const currentPrice = history[history.length - 1].price;
    const sma = history.reduce((sum, h) => sum + h.price, 0) / history.length;

    const momentum = (currentPrice - sma) / sma;
    return Math.max(-1, Math.min(1, momentum));
  }

  /**
   * Calculate correlation between two assets
   */
  calculateCorrelation(asset1: string, asset2: string, days: number = BALANCER_CONFIG.CORRELATION_WINDOW): number {
    const history1 = this.getPriceHistory(asset1, days + 1);
    const history2 = this.getPriceHistory(asset2, days + 1);

    if (history1.length < 2 || history2.length < 2) return 0;

    const minLen = Math.min(history1.length, history2.length);

    const returns1: number[] = [];
    const returns2: number[] = [];
    for (let i = 1; i < minLen; i++) {
      returns1.push((history1[i].price - history1[i - 1].price) / history1[i - 1].price);
      returns2.push((history2[i].price - history2[i - 1].price) / history2[i - 1].price);
    }

    const n = returns1.length;
    if (n === 0) return 0;

    const mean1 = returns1.reduce((a, b) => a + b, 0) / n;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }

    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTRA-LAYER BALANCING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates optimal weights for assets within a layer
 * using the HRAM (Hybrid Risk-Adjusted Momentum) algorithm
 */
export class IntraLayerBalancer {
  private marketData: MarketDataProvider;
  private config: BalancerConfig;

  constructor(marketData: MarketDataProvider, config: BalancerConfig = {}) {
    this.marketData = marketData;
    this.config = { ...BALANCER_CONFIG, ...config };
  }

  /**
   * Calculate optimal weights for assets within a layer
   */
  calculateWeights(layer: string, assets: string[] | null = null, options: BalancerConfig = {}): IntraLayerWeightResult {
    const layerAssets = assets || LAYER_ASSETS[layer as Layer] || [];
    if (layerAssets.length === 0) {
      return { weights: {}, factors: {} };
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
      weights: cappedWeights,
      factors: factors,
      metadata: {
        layer,
        assetCount: layerAssets.length,
        calculatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Calculate all four HRAM factors for an asset
   */
  private _calculateFactors(asset: string, allAssets: string[], config: BalancerConfig): AssetFactors {
    // 1. Risk Parity (inverse volatility)
    const volatility = this.marketData.calculateVolatility(asset);
    const riskParityWeight = 1 / Math.max(volatility, 0.01);

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
   * Get liquidity factor from ASSET_META
   */
  private _getLiquidityFactor(asset: string, config: BalancerConfig): number {
    const meta = ASSET_META[asset];
    if (!meta) return 1;

    const baseScore = meta.liquidityScore || 0.80;
    return 1 + (baseScore - 0.80) * (config.LIQUIDITY_BONUS || 0.5);
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

  /**
   * Check if rebalance is needed based on drift threshold and time
   */
  needsRebalance(
    layer: string,
    currentWeights: Record<string, number>,
    targetWeights: Record<string, number>,
    lastRebalanceTime: Date | string | null = null
  ): RebalanceDecision {
    const assets = Object.keys(targetWeights);
    let maxDrift = 0;
    const driftByAsset: Record<string, number> = {};

    for (const asset of assets) {
      const current = currentWeights[asset] || 0;
      const target = targetWeights[asset] || 0;
      const drift = current - target;
      driftByAsset[asset] = drift;
      maxDrift = Math.max(maxDrift, Math.abs(drift));
    }

    // Calculate days since last rebalance
    const now = new Date();
    const daysSinceLastRebalance = lastRebalanceTime
      ? (now.getTime() - new Date(lastRebalanceTime).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    // Decision logic
    let shouldRebalance = false;
    let reason: 'EMERGENCY' | 'NORMAL' | null = null;

    const emergencyThreshold = this.config.EMERGENCY_DRIFT_THRESHOLD || 0.10;
    const normalThreshold = this.config.DRIFT_THRESHOLD || 0.05;
    const minIntervalDays = this.config.MIN_REBALANCE_INTERVAL_DAYS || 1;

    if (maxDrift > emergencyThreshold) {
      shouldRebalance = true;
      reason = 'EMERGENCY';
    } else if (maxDrift > normalThreshold && daysSinceLastRebalance >= minIntervalDays) {
      shouldRebalance = true;
      reason = 'NORMAL';
    }

    return {
      shouldRebalance,
      reason,
      maxDrift,
      driftByAsset,
      daysSinceLastRebalance,
    };
  }

  /**
   * Alias for needsRebalance for API consistency
   */
  shouldRebalance(
    layer: string,
    currentWeights: Record<string, number>,
    targetWeights: Record<string, number>,
    lastRebalanceTime: Date | string | null = null
  ): RebalanceDecision {
    return this.needsRebalance(layer, currentWeights, targetWeights, lastRebalanceTime);
  }

  /**
   * Generate trades needed to rebalance from current to target weights
   */
  generateRebalanceTrades(
    layer: string,
    currentHoldings: Record<string, HoldingData>,
    targetWeights: Record<string, number>,
    layerValue: number,
    fxRate: number
  ): TradeOrder[] {
    const trades: TradeOrder[] = [];
    const currentWeights: Record<string, number> = {};

    // Calculate current weights
    let totalValue = 0;
    const holdingValues: Record<string, number> = {};

    for (const [asset, holding] of Object.entries(currentHoldings)) {
      const price = this.marketData.getCurrentPrice(asset) || 0;
      const value = (holding.quantity || 0) * price * fxRate;
      holdingValues[asset] = value;
      totalValue += value;
    }

    // Add any target assets not in current holdings
    for (const asset of Object.keys(targetWeights)) {
      if (!(asset in holdingValues)) {
        holdingValues[asset] = 0;
      }
    }

    const portfolioValue = layerValue || totalValue;

    for (const asset of Object.keys(holdingValues)) {
      currentWeights[asset] = totalValue > 0 ? holdingValues[asset] / totalValue : 0;
    }

    // Generate trades
    for (const [asset, targetWeight] of Object.entries(targetWeights)) {
      const currentWeight = currentWeights[asset] || 0;
      const weightDiff = targetWeight - currentWeight;
      const valueDiff = weightDiff * portfolioValue;

      const minTradeValue = this.config.MIN_TRADE_VALUE_IRR || 100000;
      if (Math.abs(valueDiff) < minTradeValue) continue;

      const price = this.marketData.getCurrentPrice(asset);
      if (!price) continue;

      trades.push({
        asset,
        layer,
        side: valueDiff > 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(valueDiff / (price * fxRate)),
        valueIRR: Math.abs(valueDiff),
        currentWeight: currentWeight,
        targetWeight: targetWeight,
      });
    }

    // Sort: SELL first, then by value descending
    trades.sort((a, b) => {
      if (a.side === 'SELL' && b.side === 'BUY') return -1;
      if (a.side === 'BUY' && b.side === 'SELL') return 1;
      return b.valueIRR - a.valueIRR;
    });

    return trades;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHT MODIFIER (USER PREFERENCES)
// ─────────────────────────────────────────────────────────────────────────────

interface UserPreferences {
  favorites?: string[];
  excluded?: string[];
  boosts?: Record<string, number>;
}

/**
 * Applies user preferences to calculated weights
 */
export class WeightModifier {
  /**
   * Apply user preferences like favorites, exclusions, and boosts
   */
  static applyPreferences(weights: Record<string, number>, preferences: UserPreferences = {}): Record<string, number> {
    const modified = { ...weights };
    const { favorites = [], excluded = [], boosts = {} } = preferences;

    // Remove excluded assets
    for (const asset of excluded) {
      delete modified[asset];
    }

    // Boost favorites by 20%
    for (const asset of favorites) {
      if (modified[asset]) {
        modified[asset] *= 1.2;
      }
    }

    // Apply custom boosts
    for (const [asset, boost] of Object.entries(boosts)) {
      if (modified[asset]) {
        modified[asset] *= boost;
      }
    }

    // Renormalize
    const total = Object.values(modified).reduce((a, b) => a + b, 0);
    for (const asset of Object.keys(modified)) {
      modified[asset] = modified[asset] / total;
    }

    return modified;
  }

  /**
   * Adjust weights based on user risk tolerance
   * riskTolerance: 0 = conservative, 0.5 = neutral, 1 = aggressive
   */
  static applyRiskTolerance(
    weights: Record<string, number>,
    factors: Record<string, AssetFactors>,
    riskTolerance: number = 0.5
  ): Record<string, number> {
    const modified = { ...weights };

    for (const [asset, weight] of Object.entries(weights)) {
      const volatility = factors[asset]?.volatility || 0.5;

      if (riskTolerance > 0.5) {
        // Boost high-volatility assets
        const boostFactor = 1 + (volatility * (riskTolerance - 0.5) * 2);
        modified[asset] = weight * boostFactor;
      } else {
        // Boost low-volatility assets
        const boostFactor = 1 + ((1 - volatility) * (0.5 - riskTolerance) * 2);
        modified[asset] = weight * boostFactor;
      }
    }

    // Renormalize
    const total = Object.values(modified).reduce((a, b) => a + b, 0);
    for (const asset of Object.keys(modified)) {
      modified[asset] = modified[asset] / total;
    }

    return modified;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a balancer with a specific strategy preset
 */
export function createBalancer(strategyName: StrategyPreset = 'BALANCED', priceHistory: PriceHistory = {}): IntraLayerBalancer {
  const strategy = STRATEGY_PRESETS[strategyName] || STRATEGY_PRESETS.BALANCED;
  const marketData = new MarketDataProvider(priceHistory);
  return new IntraLayerBalancer(marketData, strategy);
}

interface LayerWeightsResult {
  FOUNDATION: IntraLayerWeightResult;
  GROWTH: IntraLayerWeightResult;
  UPSIDE: IntraLayerWeightResult;
}

/**
 * Calculate weights for all layers
 */
export function calculateAllLayerWeights(strategyName: StrategyPreset = 'BALANCED', priceHistory: PriceHistory = {}): LayerWeightsResult {
  const balancer = createBalancer(strategyName, priceHistory);

  return {
    FOUNDATION: balancer.calculateWeights('FOUNDATION'),
    GROWTH: balancer.calculateWeights('GROWTH'),
    UPSIDE: balancer.calculateWeights('UPSIDE'),
  };
}

/**
 * Get static weights (fallback when no price history available)
 * Uses base volatility from ASSET_META
 */
export function getStaticWeights(strategyName: StrategyPreset = 'BALANCED'): LayerWeightsResult {
  return calculateAllLayerWeights(strategyName, {});
}
