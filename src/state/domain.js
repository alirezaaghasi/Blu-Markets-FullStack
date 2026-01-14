// Domain definitions - v10 with advanced risk profiling
// Holdings store quantities, values computed from live prices

export const ASSETS = [
  "USDT",
  "IRR_FIXED_INCOME",
  "GOLD",
  "BTC",
  "ETH",
  "QQQ",
  "SOL",
  "TON",
];

export const ASSET_LAYER = {
  // Foundation (Stable)
  USDT: "FOUNDATION",
  IRR_FIXED_INCOME: "FOUNDATION",

  // Growth (Balanced)
  GOLD: "GROWTH",
  BTC: "GROWTH",
  QQQ: "GROWTH",

  // Upside (Volatile)
  ETH: "UPSIDE",
  SOL: "UPSIDE",
  TON: "UPSIDE",
};

// Asset metadata for price feeds
export const ASSET_META = {
  USDT: {
    coingeckoId: 'tether',
    source: 'coingecko',
    decimals: 2,
    currency: 'USD',
  },
  BTC: {
    coingeckoId: 'bitcoin',
    source: 'coingecko',
    decimals: 8,
    currency: 'USD',
  },
  ETH: {
    coingeckoId: 'ethereum',
    source: 'coingecko',
    decimals: 6,
    currency: 'USD',
  },
  SOL: {
    coingeckoId: 'solana',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
  },
  TON: {
    coingeckoId: 'the-open-network',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
  },
  GOLD: {
    coingeckoId: 'pax-gold',  // PAXG as gold proxy (1 PAXG = 1 oz gold)
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    unit: 'oz',
  },
  QQQ: {
    symbol: 'QQQ',
    source: 'finnhub',
    decimals: 2,
    currency: 'USD',
  },
  IRR_FIXED_INCOME: {
    source: 'internal',
    currency: 'IRR',
    unitPrice: 500000,      // 500,000 IRR per unit
    annualRate: 0.30,       // 30% annual return
  },
};

export const LAYER_RANGES = {
  FOUNDATION: { min: 40, max: 70, hardMin: 30 },
  GROWTH: { min: 20, max: 45 },
  UPSIDE: { min: 0, max: 20, hardMax: 25 },
};

// v10: Risk profile metadata for 10 granular levels
export const RISK_PROFILES = {
  1: {
    name: 'Capital Preservation',
    description: 'Maximum safety, minimal volatility',
    maxDrawdown: '5%'
  },
  2: {
    name: 'Capital Preservation',
    description: 'Maximum safety, minimal volatility',
    maxDrawdown: '5%'
  },
  3: {
    name: 'Conservative',
    description: 'Stability with modest growth',
    maxDrawdown: '10%'
  },
  4: {
    name: 'Conservative',
    description: 'Stability with modest growth',
    maxDrawdown: '10%'
  },
  5: {
    name: 'Balanced',
    description: 'Growth with protection',
    maxDrawdown: '20%'
  },
  6: {
    name: 'Balanced',
    description: 'Growth with protection',
    maxDrawdown: '20%'
  },
  7: {
    name: 'Growth',
    description: 'Long-term wealth building',
    maxDrawdown: '30%'
  },
  8: {
    name: 'Growth',
    description: 'Long-term wealth building',
    maxDrawdown: '30%'
  },
  9: {
    name: 'Aggressive',
    description: 'Maximum growth potential',
    maxDrawdown: '40%'
  },
  10: {
    name: 'Aggressive',
    description: 'Maximum growth potential',
    maxDrawdown: '40%'
  }
};
