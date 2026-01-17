/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BLU MARKETS v10 — INTRA-LAYER BALANCING ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Final Asset Universe: 15 Assets
 * 
 * FOUNDATION (3): USDT, PAXG, IRR_FIXED_INCOME
 * GROWTH (6):     BTC, ETH, BNB, XRP, KAG, QQQ
 * UPSIDE (6):     SOL, TON, LINK, AVAX, MATIC, ARB
 * 
 * Dynamic allocation using Hybrid Risk-Adjusted Momentum (HRAM):
 *   1. Risk Parity (inverse volatility)
 *   2. Momentum (trend following)
 *   3. Correlation (diversification)
 *   4. Liquidity (tradability)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// ASSET UNIVERSE — FINAL 15 ASSETS
// ─────────────────────────────────────────────────────────────────────────────

const LAYER_ASSETS = {
  FOUNDATION: ['USDT', 'PAXG', 'IRR_FIXED_INCOME'],
  GROWTH: ['BTC', 'ETH', 'BNB', 'XRP', 'KAG', 'QQQ'],
  UPSIDE: ['SOL', 'TON', 'LINK', 'AVAX', 'MATIC', 'ARB'],
};

const ASSET_METADATA = {
  // ═══════════════════════════════════════════════════════════════════════════
  // FOUNDATION — Capital Preservation
  // "Sleep at night. Protect purchasing power."
  // ═══════════════════════════════════════════════════════════════════════════
  
  USDT: {
    layer: 'FOUNDATION',
    name: 'Tether USD',
    category: 'stablecoin',
    description: 'USD exposure, instant liquidity',
    baseVolatility: 0.01,      // 1% annual
    maxLTV: 90,
    liquidityScore: 1.00,
    provider: 'Tether',
  },
  
  PAXG: {
    layer: 'FOUNDATION',
    name: 'Paxos Gold',
    category: 'gold',
    description: '1:1 gold-backed, inflation shield',
    baseVolatility: 0.12,      // 12% annual
    maxLTV: 70,
    liquidityScore: 0.85,
    provider: 'Paxos',
  },
  
  IRR_FIXED_INCOME: {
    layer: 'FOUNDATION',
    name: 'IRR Fixed Income',
    category: 'fixed_income',
    description: 'Charisma 30% yield, Rial-native',
    baseVolatility: 0.05,      // 5% annual (IRR terms)
    maxLTV: 0,                 // Cannot borrow against
    liquidityScore: 0.60,
    provider: 'Charisma',
    annualYield: 0.30,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROWTH — Balanced Progress
  // "Grow over time. Accept moderate volatility."
  // ═══════════════════════════════════════════════════════════════════════════
  
  BTC: {
    layer: 'GROWTH',
    name: 'Bitcoin',
    category: 'crypto_large',
    description: 'Digital gold, macro hedge',
    baseVolatility: 0.45,      // 45% annual
    maxLTV: 50,
    liquidityScore: 0.98,
    provider: 'Native',
  },
  
  ETH: {
    layer: 'GROWTH',
    name: 'Ethereum',
    category: 'crypto_large',
    description: 'Platform asset, ecosystem growth',
    baseVolatility: 0.55,      // 55% annual
    maxLTV: 50,
    liquidityScore: 0.97,
    provider: 'Native',
  },
  
  BNB: {
    layer: 'GROWTH',
    name: 'BNB',
    category: 'crypto_large',
    description: 'Binance ecosystem, high utility',
    baseVolatility: 0.50,      // 50% annual
    maxLTV: 50,
    liquidityScore: 0.95,
    provider: 'Binance',
  },
  
  XRP: {
    layer: 'GROWTH',
    name: 'XRP',
    category: 'crypto_large',
    description: 'Payments infrastructure, high liquidity',
    baseVolatility: 0.60,      // 60% annual
    maxLTV: 45,
    liquidityScore: 0.94,
    provider: 'Ripple',
  },
  
  KAG: {
    layer: 'GROWTH',
    name: 'Kinesis Silver',
    category: 'silver',
    description: 'Silver exposure, commodity diversifier',
    baseVolatility: 0.18,      // 18% annual
    maxLTV: 60,
    liquidityScore: 0.75,
    provider: 'Kinesis',
  },
  
  QQQ: {
    layer: 'GROWTH',
    name: 'Nasdaq 100',
    category: 'equity_etf',
    description: 'US tech equity via Novion',
    baseVolatility: 0.20,      // 20% annual
    maxLTV: 60,
    liquidityScore: 0.90,
    provider: 'Novion',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UPSIDE — Bounded Conviction
  // "Express conviction. Small allocation, big potential."
  // ═══════════════════════════════════════════════════════════════════════════
  
  SOL: {
    layer: 'UPSIDE',
    name: 'Solana',
    category: 'alt_l1',
    description: 'High-performance L1, real usage',
    baseVolatility: 0.75,      // 75% annual
    maxLTV: 30,
    liquidityScore: 0.92,
    provider: 'Native',
  },
  
  TON: {
    layer: 'UPSIDE',
    name: 'Toncoin',
    category: 'alt_l1',
    description: 'Telegram ecosystem, Iran-relevant',
    baseVolatility: 0.65,      // 65% annual
    maxLTV: 30,
    liquidityScore: 0.85,
    provider: 'TON Foundation',
  },
  
  LINK: {
    layer: 'UPSIDE',
    name: 'Chainlink',
    category: 'infrastructure',
    description: 'Oracle network, DeFi backbone',
    baseVolatility: 0.60,      // 60% annual
    maxLTV: 35,
    liquidityScore: 0.90,
    provider: 'Chainlink Labs',
  },
  
  AVAX: {
    layer: 'UPSIDE',
    name: 'Avalanche',
    category: 'alt_l1',
    description: 'Fast L1, institutional adoption',
    baseVolatility: 0.70,      // 70% annual
    maxLTV: 30,
    liquidityScore: 0.88,
    provider: 'Ava Labs',
  },
  
  MATIC: {
    layer: 'UPSIDE',
    name: 'Polygon',
    category: 'l2',
    description: 'Ethereum L2, established scaling',
    baseVolatility: 0.65,      // 65% annual
    maxLTV: 30,
    liquidityScore: 0.88,
    provider: 'Polygon Labs',
  },
  
  ARB: {
    layer: 'UPSIDE',
    name: 'Arbitrum',
    category: 'l2',
    description: 'Leading L2, growing DeFi ecosystem',
    baseVolatility: 0.70,      // 70% annual
    maxLTV: 30,
    liquidityScore: 0.85,
    provider: 'Offchain Labs',
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
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
  DRIFT_THRESHOLD: 0.05,      // 5% drift triggers rebalance
  MIN_REBALANCE_INTERVAL: 7,  // Days between rebalances
};


// ─────────────────────────────────────────────────────────────────────────────
// BASELINE PRICES (USD)
// ─────────────────────────────────────────────────────────────────────────────

const BASELINE_PRICES = {
  // Foundation
  USDT: 1.00,
  PAXG: 2650,                 // Gold price per oz
  IRR_FIXED_INCOME: 0.0000007, // 1 unit = 500,000 IRR ≈ $0.34 at 1,456,000 IRR/USD
  
  // Growth
  BTC: 97500,
  ETH: 3200,
  BNB: 680,
  XRP: 2.20,
  KAG: 30,                    // Silver price per oz
  QQQ: 521,
  
  // Upside
  SOL: 185,
  TON: 5.20,
  LINK: 22,
  AVAX: 35,
  MATIC: 0.45,
  ARB: 0.80,
};

const FX_RATES = {
  USD_IRR: 1456000,
};


// ─────────────────────────────────────────────────────────────────────────────
// MARKET DATA PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

class MarketDataProvider {
  constructor(priceHistory = {}) {
    this.priceHistory = priceHistory;
  }
  
  getCurrentPrice(asset) {
    const history = this.priceHistory[asset];
    if (!history || history.length === 0) {
      return BASELINE_PRICES[asset] || null;
    }
    return history[history.length - 1].price;
  }
  
  getPriceHistory(asset, days) {
    const history = this.priceHistory[asset] || [];
    return history.slice(-days);
  }
  
  calculateVolatility(asset, days = CONFIG.VOLATILITY_WINDOW) {
    const history = this.getPriceHistory(asset, days + 1);
    if (history.length < 2) {
      return ASSET_METADATA[asset]?.baseVolatility || 0.5;
    }
    
    const returns = [];
    for (let i = 1; i < history.length; i++) {
      const dailyReturn = (history[i].price - history[i-1].price) / history[i-1].price;
      returns.push(dailyReturn);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const dailyVol = Math.sqrt(variance);
    
    return dailyVol * Math.sqrt(365);
  }
  
  calculateMomentum(asset, days = CONFIG.MOMENTUM_WINDOW) {
    const history = this.getPriceHistory(asset, days);
    if (history.length < days * 0.5) return 0;
    
    const currentPrice = history[history.length - 1].price;
    const sma = history.reduce((sum, h) => sum + h.price, 0) / history.length;
    
    const momentum = (currentPrice - sma) / sma;
    return Math.max(-1, Math.min(1, momentum));
  }
  
  calculateCorrelation(asset1, asset2, days = CONFIG.CORRELATION_WINDOW) {
    const history1 = this.getPriceHistory(asset1, days + 1);
    const history2 = this.getPriceHistory(asset2, days + 1);
    
    if (history1.length < 2 || history2.length < 2) return 0;
    
    const minLen = Math.min(history1.length, history2.length);
    
    const returns1 = [];
    const returns2 = [];
    for (let i = 1; i < minLen; i++) {
      returns1.push((history1[i].price - history1[i-1].price) / history1[i-1].price);
      returns2.push((history2[i].price - history2[i-1].price) / history2[i-1].price);
    }
    
    const n = returns1.length;
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

class IntraLayerBalancer {
  constructor(marketData, config = {}) {
    this.marketData = marketData;
    this.config = { ...CONFIG, ...config };
  }
  
  /**
   * Calculate optimal weights for assets within a layer
   */
  calculateWeights(layer, assets = null, options = {}) {
    const layerAssets = assets || LAYER_ASSETS[layer] || [];
    if (layerAssets.length === 0) {
      return { weights: {}, factors: {} };
    }
    
    const config = { ...this.config, ...options };
    const factors = {};
    const rawWeights = {};
    
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
    const normalizedWeights = {};
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
  
  _calculateFactors(asset, allAssets, config) {
    // 1. Risk Parity (inverse volatility)
    const volatility = this.marketData.calculateVolatility(asset);
    const riskParityWeight = 1 / Math.max(volatility, 0.01);
    
    // 2. Momentum Factor
    const momentum = this.marketData.calculateMomentum(asset);
    const momentumFactor = 1 + (momentum * config.MOMENTUM_STRENGTH);
    
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
    const correlationFactor = 1 - (avgCorrelation * config.CORRELATION_PENALTY);
    
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
  
  _getLiquidityFactor(asset, config) {
    const meta = ASSET_METADATA[asset];
    if (!meta) return 1;
    
    const baseScore = meta.liquidityScore || 0.80;
    return 1 + (baseScore - 0.80) * config.LIQUIDITY_BONUS;
  }
  
  _applyCaps(weights, config) {
    const assets = Object.keys(weights);
    const capped = { ...weights };
    
    for (let iteration = 0; iteration < 10; iteration++) {
      let needsRenormalize = false;
      let surplus = 0;
      let uncappedCount = 0;
      
      for (const asset of assets) {
        if (capped[asset] > config.MAX_WEIGHT) {
          surplus += capped[asset] - config.MAX_WEIGHT;
          capped[asset] = config.MAX_WEIGHT;
          needsRenormalize = true;
        } else if (capped[asset] < config.MIN_WEIGHT) {
          surplus -= config.MIN_WEIGHT - capped[asset];
          capped[asset] = config.MIN_WEIGHT;
          needsRenormalize = true;
        } else {
          uncappedCount++;
        }
      }
      
      if (!needsRenormalize || uncappedCount === 0) break;
      
      const surplusPerAsset = surplus / uncappedCount;
      for (const asset of assets) {
        if (capped[asset] > config.MIN_WEIGHT && capped[asset] < config.MAX_WEIGHT) {
          capped[asset] += surplusPerAsset;
        }
      }
    }
    
    const total = Object.values(capped).reduce((a, b) => a + b, 0);
    for (const asset of assets) {
      capped[asset] = capped[asset] / total;
    }
    
    return capped;
  }
  
  needsRebalance(layer, currentWeights, targetWeights) {
    const assets = Object.keys(targetWeights);
    let maxDrift = 0;
    
    for (const asset of assets) {
      const current = currentWeights[asset] || 0;
      const target = targetWeights[asset] || 0;
      const drift = Math.abs(current - target);
      maxDrift = Math.max(maxDrift, drift);
    }
    
    return {
      needsRebalance: maxDrift > this.config.DRIFT_THRESHOLD,
      maxDrift,
      driftByAsset: assets.reduce((acc, asset) => {
        acc[asset] = (currentWeights[asset] || 0) - (targetWeights[asset] || 0);
        return acc;
      }, {}),
    };
  }
  
  generateRebalanceTrades(layer, currentHoldings, targetWeights, layerValue) {
    const trades = [];
    const currentWeights = {};
    
    let totalValue = 0;
    for (const [asset, holding] of Object.entries(currentHoldings)) {
      const price = this.marketData.getCurrentPrice(asset) || 0;
      const value = holding.quantity * price;
      currentWeights[asset] = value;
      totalValue += value;
    }
    
    const portfolioValue = layerValue || totalValue;
    
    for (const asset of Object.keys(currentWeights)) {
      currentWeights[asset] = totalValue > 0 ? currentWeights[asset] / totalValue : 0;
    }
    
    for (const [asset, targetWeight] of Object.entries(targetWeights)) {
      const currentWeight = currentWeights[asset] || 0;
      const weightDiff = targetWeight - currentWeight;
      const valueDiff = weightDiff * portfolioValue;
      
      if (Math.abs(valueDiff) < 100) continue;
      
      const price = this.marketData.getCurrentPrice(asset);
      if (!price) continue;
      
      trades.push({
        asset,
        side: valueDiff > 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(valueDiff / price),
        value: Math.abs(valueDiff),
        currentWeight: (currentWeight * 100).toFixed(2) + '%',
        targetWeight: (targetWeight * 100).toFixed(2) + '%',
      });
    }
    
    trades.sort((a, b) => {
      if (a.side === 'SELL' && b.side === 'BUY') return -1;
      if (a.side === 'BUY' && b.side === 'SELL') return 1;
      return b.value - a.value;
    });
    
    return trades;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY PRESETS
// ─────────────────────────────────────────────────────────────────────────────

const STRATEGY_PRESETS = {
  // Equal weight - simple diversification
  EQUAL_WEIGHT: {
    MOMENTUM_STRENGTH: 0,
    CORRELATION_PENALTY: 0,
    MIN_WEIGHT: 0.05,
    MAX_WEIGHT: 0.50,
  },
  
  // Pure risk parity - volatility-based only
  RISK_PARITY: {
    MOMENTUM_STRENGTH: 0,
    CORRELATION_PENALTY: 0,
    MIN_WEIGHT: 0.05,
    MAX_WEIGHT: 0.40,
  },
  
  // Momentum tilt - follow trends
  MOMENTUM_TILT: {
    MOMENTUM_STRENGTH: 0.5,
    CORRELATION_PENALTY: 0.1,
    MIN_WEIGHT: 0.05,
    MAX_WEIGHT: 0.35,
  },
  
  // Maximum diversification - minimize correlation
  MAX_DIVERSIFICATION: {
    MOMENTUM_STRENGTH: 0.1,
    CORRELATION_PENALTY: 0.4,
    MIN_WEIGHT: 0.10,
    MAX_WEIGHT: 0.30,
  },
  
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


// ─────────────────────────────────────────────────────────────────────────────
// USER PROFILE MAPPING
// ─────────────────────────────────────────────────────────────────────────────

const USER_PROFILE_STRATEGIES = {
  ANXIOUS_NOVICE: 'CONSERVATIVE',
  STEADY_BUILDER: 'BALANCED',
  AGGRESSIVE_ACCUMULATOR: 'MOMENTUM_TILT',
  WEALTH_PRESERVER: 'MAX_DIVERSIFICATION',
  SPECULATOR: 'AGGRESSIVE',
};

const USER_PROFILE_ALLOCATIONS = {
  ANXIOUS_NOVICE:         { FOUNDATION: 80, GROWTH: 18, UPSIDE: 2 },
  STEADY_BUILDER:         { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
  AGGRESSIVE_ACCUMULATOR: { FOUNDATION: 20, GROWTH: 30, UPSIDE: 50 },
  WEALTH_PRESERVER:       { FOUNDATION: 60, GROWTH: 35, UPSIDE: 5 },
  SPECULATOR:             { FOUNDATION: 10, GROWTH: 20, UPSIDE: 70 },
};


// ─────────────────────────────────────────────────────────────────────────────
// WEIGHT MODIFIER (USER PREFERENCES)
// ─────────────────────────────────────────────────────────────────────────────

class WeightModifier {
  static applyPreferences(weights, preferences = {}) {
    const modified = { ...weights };
    const { favorites = [], excluded = [], boosts = {} } = preferences;
    
    for (const asset of excluded) {
      delete modified[asset];
    }
    
    for (const asset of favorites) {
      if (modified[asset]) {
        modified[asset] *= 1.2;
      }
    }
    
    for (const [asset, boost] of Object.entries(boosts)) {
      if (modified[asset]) {
        modified[asset] *= boost;
      }
    }
    
    const total = Object.values(modified).reduce((a, b) => a + b, 0);
    for (const asset of Object.keys(modified)) {
      modified[asset] = modified[asset] / total;
    }
    
    return modified;
  }
  
  static applyRiskTolerance(weights, factors, riskTolerance = 0.5) {
    const modified = { ...weights };
    
    for (const [asset, weight] of Object.entries(weights)) {
      const volatility = factors[asset]?.volatility || 0.5;
      
      if (riskTolerance > 0.5) {
        const boostFactor = 1 + (volatility * (riskTolerance - 0.5) * 2);
        modified[asset] = weight * boostFactor;
      } else {
        const boostFactor = 1 + ((1 - volatility) * (0.5 - riskTolerance) * 2);
        modified[asset] = weight * boostFactor;
      }
    }
    
    const total = Object.values(modified).reduce((a, b) => a + b, 0);
    for (const asset of Object.keys(modified)) {
      modified[asset] = modified[asset] / total;
    }
    
    return modified;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// MOCK PRICE GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

function generateMockPrices(basePrice, dailyVol, days) {
  return generateMockPricesWithTrend(basePrice, dailyVol, days, 0);
}

function generateMockPricesWithTrend(basePrice, dailyVol, days, dailyDrift = 0) {
  const prices = [];
  let price = basePrice * (1 - dailyDrift * days * 0.5);
  const today = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    prices.push({
      date: date.toISOString().split('T')[0],
      price: price,
    });
    
    const noise = (Math.random() - 0.5) * 2 * dailyVol;
    price = price * (1 + dailyDrift + noise);
  }
  
  return prices;
}


// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE USAGE
// ─────────────────────────────────────────────────────────────────────────────

function exampleUsage() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('BLU MARKETS — INTRA-LAYER BALANCING');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\nFINAL ASSET UNIVERSE (15 Assets)\n');
  
  // Print asset universe
  for (const [layer, assets] of Object.entries(LAYER_ASSETS)) {
    console.log(`${layer} (${assets.length})`);
    for (const asset of assets) {
      const meta = ASSET_METADATA[asset];
      console.log(`  └─ ${asset.padEnd(18)} │ ${meta.description}`);
    }
    console.log('');
  }
  
  // Generate mock price data
  const mockPriceHistory = {
    // Foundation
    USDT: generateMockPricesWithTrend(1.00, 0.001, 60, 0),
    PAXG: generateMockPricesWithTrend(2650, 0.008, 60, 0.001),
    IRR_FIXED_INCOME: generateMockPricesWithTrend(0.0000007, 0.001, 60, 0),
    
    // Growth
    BTC: generateMockPricesWithTrend(97500, 0.025, 60, 0.002),
    ETH: generateMockPricesWithTrend(3200, 0.030, 60, 0.003),
    BNB: generateMockPricesWithTrend(680, 0.028, 60, 0.001),
    XRP: generateMockPricesWithTrend(2.20, 0.035, 60, 0.002),
    KAG: generateMockPricesWithTrend(30, 0.012, 60, 0.001),
    QQQ: generateMockPricesWithTrend(521, 0.015, 60, -0.001),
    
    // Upside
    SOL: generateMockPricesWithTrend(185, 0.045, 60, 0.004),
    TON: generateMockPricesWithTrend(5.20, 0.040, 60, 0.002),
    LINK: generateMockPricesWithTrend(22, 0.035, 60, 0.003),
    AVAX: generateMockPricesWithTrend(35, 0.042, 60, 0.001),
    MATIC: generateMockPricesWithTrend(0.45, 0.038, 60, -0.001),
    ARB: generateMockPricesWithTrend(0.80, 0.040, 60, 0.002),
  };
  
  const marketData = new MarketDataProvider(mockPriceHistory);
  const balancer = new IntraLayerBalancer(marketData, STRATEGY_PRESETS.BALANCED);
  
  // Calculate weights for each layer
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('INTRA-LAYER WEIGHTS (Balanced Strategy)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  for (const [layer, assets] of Object.entries(LAYER_ASSETS)) {
    const result = balancer.calculateWeights(layer, assets);
    
    console.log(`\n${layer} LAYER\n`);
    console.log('Asset              │ Weight │ Volatility │ Momentum │ Correlation');
    console.log('───────────────────┼────────┼────────────┼──────────┼────────────');
    
    for (const asset of assets) {
      const weight = (result.weights[asset] * 100).toFixed(1).padStart(5);
      const vol = (result.factors[asset].volatility * 100).toFixed(1).padStart(5);
      const mom = (result.factors[asset].momentum * 100).toFixed(1).padStart(6);
      const corr = (result.factors[asset].avgCorrelation * 100).toFixed(1).padStart(5);
      console.log(`${asset.padEnd(18)} │ ${weight}% │ ${vol}%     │ ${mom}%   │ ${corr}%`);
    }
  }
  
  // Strategy comparison for Growth layer
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('STRATEGY COMPARISON (Growth Layer)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const growthAssets = LAYER_ASSETS.GROWTH;
  
  for (const [strategyName, config] of Object.entries(STRATEGY_PRESETS)) {
    const strategyBalancer = new IntraLayerBalancer(marketData, config);
    const strategyResult = strategyBalancer.calculateWeights('GROWTH', growthAssets);
    
    const weightStr = growthAssets
      .map(a => `${a}:${(strategyResult.weights[a] * 100).toFixed(0)}%`)
      .join(' │ ');
    
    console.log(`${strategyName.padEnd(20)} → ${weightStr}`);
  }
  
  // User profile example
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('USER PROFILE ALLOCATIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  for (const [profile, allocation] of Object.entries(USER_PROFILE_ALLOCATIONS)) {
    const strategy = USER_PROFILE_STRATEGIES[profile];
    console.log(`${profile.padEnd(25)} │ F:${allocation.FOUNDATION}% G:${allocation.GROWTH}% U:${allocation.UPSIDE}% │ Strategy: ${strategy}`);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Classes
  MarketDataProvider,
  IntraLayerBalancer,
  WeightModifier,
  
  // Constants
  LAYER_ASSETS,
  ASSET_METADATA,
  BASELINE_PRICES,
  FX_RATES,
  CONFIG,
  STRATEGY_PRESETS,
  USER_PROFILE_STRATEGIES,
  USER_PROFILE_ALLOCATIONS,
  
  // Utilities
  generateMockPrices,
  generateMockPricesWithTrend,
  exampleUsage,
};


// Run example if executed directly
if (require.main === module) {
  exampleUsage();
}
