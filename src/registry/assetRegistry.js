// @ts-check
/**
 * Asset Registry - Single source of truth for all asset configuration
 *
 * This file consolidates asset metadata that was previously spread across:
 * - src/state/domain.js (ASSETS, ASSET_LAYER, LAYER_ASSETS, ASSET_META)
 * - src/constants/index.js (DEFAULT_PRICES, WEIGHTS, PROTECTION_ELIGIBLE_ASSETS)
 *
 * All other modules should derive their asset data from this registry.
 */

// ============================================================================
// ASSET CONFIGURATION - Single Source of Truth
// ============================================================================

/**
 * @typedef {'FOUNDATION' | 'GROWTH' | 'UPSIDE'} Layer
 */

/**
 * @typedef {Object} AssetConfig
 * @property {string} id - Asset identifier
 * @property {string} name - Full asset name
 * @property {string} displayName - Short display name (optional, defaults to name)
 * @property {Layer} layer - Portfolio layer classification
 * @property {string} category - Asset category (stablecoin, crypto_large, alt_l1, etc.)
 * @property {string} source - Price source (coingecko, finnhub, internal)
 * @property {string} [coingeckoId] - CoinGecko API ID (if source is coingecko)
 * @property {string} [symbol] - Stock symbol (if source is finnhub)
 * @property {number} defaultPrice - Fallback price in USD
 * @property {number} decimals - Display decimal places
 * @property {string} currency - Price currency (USD, IRR)
 * @property {string} [unit] - Unit of measurement (oz for gold/silver)
 * @property {number} layerWeight - Weight within layer (0-1, must sum to 1 per layer)
 * @property {number} baseVolatility - Annual volatility (0-1)
 * @property {number} maxLTV - Maximum loan-to-value ratio (0-100)
 * @property {number} liquidityScore - Liquidity score (0-1)
 * @property {boolean} protectionEligible - Whether asset can be protected
 * @property {string} description - Brief description
 * @property {string} provider - Service provider
 * @property {number} [unitPrice] - Fixed unit price for internal assets (IRR)
 * @property {number} [annualRate] - Annual return rate for fixed income
 */

/** @type {Record<string, AssetConfig>} */
export const ASSETS_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════════
  // FOUNDATION — Capital Preservation
  // "Sleep at night. Protect purchasing power."
  // ═══════════════════════════════════════════════════════════════════════════

  USDT: {
    id: 'USDT',
    name: 'Tether USD',
    displayName: 'USDT',
    layer: 'FOUNDATION',
    category: 'stablecoin',
    source: 'coingecko',
    coingeckoId: 'tether',
    defaultPrice: 1.00,
    decimals: 2,
    currency: 'USD',
    layerWeight: 0.40,
    baseVolatility: 0.01,
    maxLTV: 90,
    liquidityScore: 1.00,
    protectionEligible: false,
    description: 'USD exposure, instant liquidity',
    provider: 'Tether',
  },

  PAXG: {
    id: 'PAXG',
    name: 'Paxos Gold',
    displayName: 'Gold',
    layer: 'FOUNDATION',
    category: 'gold',
    source: 'coingecko',
    coingeckoId: 'pax-gold',
    defaultPrice: 2650,
    decimals: 4,
    currency: 'USD',
    unit: 'oz',
    layerWeight: 0.30,
    baseVolatility: 0.12,
    maxLTV: 70,
    liquidityScore: 0.85,
    protectionEligible: true,
    description: '1:1 gold-backed, inflation shield',
    provider: 'Paxos',
  },

  IRR_FIXED_INCOME: {
    id: 'IRR_FIXED_INCOME',
    name: 'IRR Fixed Income',
    displayName: 'Fixed Income',
    layer: 'FOUNDATION',
    category: 'fixed_income',
    source: 'internal',
    defaultPrice: 0, // Not USD-priced
    unitPrice: 500000, // 500,000 IRR per unit
    annualRate: 0.30, // 30% annual return
    decimals: 0,
    currency: 'IRR',
    layerWeight: 0.30,
    baseVolatility: 0.05,
    maxLTV: 0, // Cannot borrow against
    liquidityScore: 0.60,
    protectionEligible: false,
    description: 'Charisma 30% yield, Rial-native',
    provider: 'Charisma',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROWTH — Balanced Progress
  // "Grow over time. Accept moderate volatility."
  // ═══════════════════════════════════════════════════════════════════════════

  BTC: {
    id: 'BTC',
    name: 'Bitcoin',
    displayName: 'BTC',
    layer: 'GROWTH',
    category: 'crypto_large',
    source: 'coingecko',
    coingeckoId: 'bitcoin',
    defaultPrice: 97500,
    decimals: 8,
    currency: 'USD',
    layerWeight: 0.25,
    baseVolatility: 0.45,
    maxLTV: 50,
    liquidityScore: 0.98,
    protectionEligible: true,
    description: 'Digital gold, macro hedge',
    provider: 'Native',
  },

  ETH: {
    id: 'ETH',
    name: 'Ethereum',
    displayName: 'ETH',
    layer: 'GROWTH',
    category: 'crypto_large',
    source: 'coingecko',
    coingeckoId: 'ethereum',
    defaultPrice: 3200,
    decimals: 6,
    currency: 'USD',
    layerWeight: 0.20,
    baseVolatility: 0.55,
    maxLTV: 50,
    liquidityScore: 0.97,
    protectionEligible: true,
    description: 'Platform asset, ecosystem growth',
    provider: 'Native',
  },

  BNB: {
    id: 'BNB',
    name: 'BNB',
    displayName: 'BNB',
    layer: 'GROWTH',
    category: 'crypto_large',
    source: 'coingecko',
    coingeckoId: 'binancecoin',
    defaultPrice: 680,
    decimals: 4,
    currency: 'USD',
    layerWeight: 0.15,
    baseVolatility: 0.50,
    maxLTV: 50,
    liquidityScore: 0.95,
    protectionEligible: true,
    description: 'Binance ecosystem, high utility',
    provider: 'Binance',
  },

  XRP: {
    id: 'XRP',
    name: 'XRP',
    displayName: 'XRP',
    layer: 'GROWTH',
    category: 'crypto_large',
    source: 'coingecko',
    coingeckoId: 'ripple',
    defaultPrice: 2.20,
    decimals: 4,
    currency: 'USD',
    layerWeight: 0.10,
    baseVolatility: 0.60,
    maxLTV: 45,
    liquidityScore: 0.94,
    protectionEligible: true,
    description: 'Payments infrastructure, high liquidity',
    provider: 'Ripple',
  },

  KAG: {
    id: 'KAG',
    name: 'Kinesis Silver',
    displayName: 'Silver',
    layer: 'GROWTH',
    category: 'silver',
    source: 'coingecko',
    coingeckoId: 'kinesis-silver',
    defaultPrice: 30,
    decimals: 4,
    currency: 'USD',
    unit: 'oz',
    layerWeight: 0.15,
    baseVolatility: 0.18,
    maxLTV: 60,
    liquidityScore: 0.75,
    protectionEligible: false,
    description: 'Silver exposure, commodity diversifier',
    provider: 'Kinesis',
  },

  QQQ: {
    id: 'QQQ',
    name: 'Nasdaq 100',
    displayName: 'QQQ',
    layer: 'GROWTH',
    category: 'equity_etf',
    source: 'finnhub',
    symbol: 'QQQ',
    defaultPrice: 521,
    decimals: 2,
    currency: 'USD',
    layerWeight: 0.15,
    baseVolatility: 0.20,
    maxLTV: 60,
    liquidityScore: 0.90,
    protectionEligible: true,
    description: 'US tech equity via Novion',
    provider: 'Novion',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UPSIDE — Bounded Conviction
  // "Express conviction. Small allocation, big potential."
  // ═══════════════════════════════════════════════════════════════════════════

  SOL: {
    id: 'SOL',
    name: 'Solana',
    displayName: 'SOL',
    layer: 'UPSIDE',
    category: 'alt_l1',
    source: 'coingecko',
    coingeckoId: 'solana',
    defaultPrice: 185,
    decimals: 4,
    currency: 'USD',
    layerWeight: 0.20,
    baseVolatility: 0.75,
    maxLTV: 30,
    liquidityScore: 0.92,
    protectionEligible: true,
    description: 'High-performance L1, real usage',
    provider: 'Native',
  },

  TON: {
    id: 'TON',
    name: 'Toncoin',
    displayName: 'TON',
    layer: 'UPSIDE',
    category: 'alt_l1',
    source: 'coingecko',
    coingeckoId: 'the-open-network',
    defaultPrice: 5.20,
    decimals: 4,
    currency: 'USD',
    layerWeight: 0.18,
    baseVolatility: 0.65,
    maxLTV: 30,
    liquidityScore: 0.85,
    protectionEligible: false,
    description: 'Telegram ecosystem, Iran-relevant',
    provider: 'TON Foundation',
  },

  LINK: {
    id: 'LINK',
    name: 'Chainlink',
    displayName: 'LINK',
    layer: 'UPSIDE',
    category: 'infrastructure',
    source: 'coingecko',
    coingeckoId: 'chainlink',
    defaultPrice: 22,
    decimals: 4,
    currency: 'USD',
    layerWeight: 0.18,
    baseVolatility: 0.60,
    maxLTV: 35,
    liquidityScore: 0.90,
    protectionEligible: true,
    description: 'Oracle network, DeFi backbone',
    provider: 'Chainlink Labs',
  },

  AVAX: {
    id: 'AVAX',
    name: 'Avalanche',
    displayName: 'AVAX',
    layer: 'UPSIDE',
    category: 'alt_l1',
    source: 'coingecko',
    coingeckoId: 'avalanche-2',
    defaultPrice: 35,
    decimals: 4,
    currency: 'USD',
    layerWeight: 0.16,
    baseVolatility: 0.70,
    maxLTV: 30,
    liquidityScore: 0.88,
    protectionEligible: true,
    description: 'Fast L1, institutional adoption',
    provider: 'Ava Labs',
  },

  MATIC: {
    id: 'MATIC',
    name: 'Polygon',
    displayName: 'MATIC',
    layer: 'UPSIDE',
    category: 'l2',
    source: 'coingecko',
    coingeckoId: 'matic-network',
    defaultPrice: 0.45,
    decimals: 4,
    currency: 'USD',
    layerWeight: 0.14,
    baseVolatility: 0.65,
    maxLTV: 30,
    liquidityScore: 0.88,
    protectionEligible: false,
    description: 'Ethereum L2, established scaling',
    provider: 'Polygon Labs',
  },

  ARB: {
    id: 'ARB',
    name: 'Arbitrum',
    displayName: 'ARB',
    layer: 'UPSIDE',
    category: 'l2',
    source: 'coingecko',
    coingeckoId: 'arbitrum',
    defaultPrice: 0.80,
    decimals: 4,
    currency: 'USD',
    layerWeight: 0.14,
    baseVolatility: 0.70,
    maxLTV: 30,
    liquidityScore: 0.85,
    protectionEligible: false,
    description: 'Leading L2, growing DeFi ecosystem',
    provider: 'Offchain Labs',
  },
};

// ============================================================================
// DERIVED DATA - Computed from ASSETS_CONFIG
// ============================================================================

/** @type {string[]} All asset IDs in canonical order */
export const ASSETS = Object.keys(ASSETS_CONFIG);

/** @type {Record<string, Layer>} Asset ID to Layer mapping */
export const ASSET_LAYER = Object.fromEntries(
  ASSETS.map(id => [id, ASSETS_CONFIG[id].layer])
);

/** @type {Record<Layer, string[]>} Assets grouped by layer */
export const LAYER_ASSETS = ASSETS.reduce((acc, id) => {
  const layer = ASSETS_CONFIG[id].layer;
  if (!acc[layer]) acc[layer] = [];
  acc[layer].push(id);
  return acc;
}, /** @type {Record<Layer, string[]>} */ ({}));

/** @type {Record<string, number>} Default prices in USD */
export const DEFAULT_PRICES = Object.fromEntries(
  ASSETS
    .filter(id => ASSETS_CONFIG[id].source !== 'internal')
    .map(id => [id, ASSETS_CONFIG[id].defaultPrice])
);

/** @type {Record<Layer, Record<string, number>>} Intra-layer weights */
export const WEIGHTS = {
  FOUNDATION: Object.fromEntries(
    LAYER_ASSETS.FOUNDATION.map(id => [id, ASSETS_CONFIG[id].layerWeight])
  ),
  GROWTH: Object.fromEntries(
    LAYER_ASSETS.GROWTH.map(id => [id, ASSETS_CONFIG[id].layerWeight])
  ),
  UPSIDE: Object.fromEntries(
    LAYER_ASSETS.UPSIDE.map(id => [id, ASSETS_CONFIG[id].layerWeight])
  ),
};

/** @type {string[]} Assets eligible for protection */
export const PROTECTION_ELIGIBLE_ASSETS = ASSETS.filter(
  id => ASSETS_CONFIG[id].protectionEligible
);

/**
 * Legacy ASSET_META for backwards compatibility
 * @deprecated Use ASSETS_CONFIG directly
 * @type {Record<string, object>}
 */
export const ASSET_META = Object.fromEntries(
  ASSETS.map(id => {
    const config = ASSETS_CONFIG[id];
    return [id, {
      name: config.name,
      coingeckoId: config.coingeckoId,
      symbol: config.symbol,
      source: config.source,
      decimals: config.decimals,
      currency: config.currency,
      unit: config.unit,
      category: config.category,
      description: config.description,
      baseVolatility: config.baseVolatility,
      maxLTV: config.maxLTV,
      liquidityScore: config.liquidityScore,
      provider: config.provider,
      unitPrice: config.unitPrice,
      annualRate: config.annualRate,
    }];
  })
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get asset configuration by ID
 * @param {string} assetId
 * @returns {AssetConfig | undefined}
 */
export function getAssetConfig(assetId) {
  return ASSETS_CONFIG[assetId];
}

/**
 * Get display name for an asset
 * @param {string} assetId
 * @returns {string}
 */
export function getAssetDisplayName(assetId) {
  const config = ASSETS_CONFIG[assetId];
  return config?.displayName || config?.name || assetId;
}

/**
 * Get CoinGecko IDs for all coingecko-sourced assets
 * @returns {Record<string, string>}
 */
export function getCoinGeckoIds() {
  return Object.fromEntries(
    ASSETS
      .filter(id => ASSETS_CONFIG[id].source === 'coingecko' && ASSETS_CONFIG[id].coingeckoId)
      .map(id => [id, ASSETS_CONFIG[id].coingeckoId])
  );
}

/**
 * Check if an asset is eligible for protection
 * @param {string} assetId
 * @returns {boolean}
 */
export function isProtectionEligible(assetId) {
  return ASSETS_CONFIG[assetId]?.protectionEligible === true;
}

/**
 * Get the layer for an asset
 * @param {string} assetId
 * @returns {Layer | undefined}
 */
export function getAssetLayer(assetId) {
  return ASSETS_CONFIG[assetId]?.layer;
}
