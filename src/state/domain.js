// Domain definitions - v10 with 15-asset universe and HRAM balancing
// Holdings store quantities, values computed from live prices

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET UNIVERSE — FINAL 15 ASSETS
// ═══════════════════════════════════════════════════════════════════════════════

export const ASSETS = [
  // Foundation (3) — Capital Preservation
  'USDT',
  'PAXG',
  'IRR_FIXED_INCOME',
  // Growth (6) — Balanced Progress
  'BTC',
  'ETH',
  'BNB',
  'XRP',
  'KAG',
  'QQQ',
  // Upside (6) — Bounded Conviction
  'SOL',
  'TON',
  'LINK',
  'AVAX',
  'MATIC',
  'ARB',
];

// Assets grouped by layer for easy access
export const LAYER_ASSETS = {
  FOUNDATION: ['USDT', 'PAXG', 'IRR_FIXED_INCOME'],
  GROWTH: ['BTC', 'ETH', 'BNB', 'XRP', 'KAG', 'QQQ'],
  UPSIDE: ['SOL', 'TON', 'LINK', 'AVAX', 'MATIC', 'ARB'],
};

export const ASSET_LAYER = {
  // ═══════════════════════════════════════════════════════════════════════════
  // FOUNDATION — Capital Preservation
  // "Sleep at night. Protect purchasing power."
  // ═══════════════════════════════════════════════════════════════════════════
  USDT: 'FOUNDATION',
  PAXG: 'FOUNDATION',
  IRR_FIXED_INCOME: 'FOUNDATION',

  // ═══════════════════════════════════════════════════════════════════════════
  // GROWTH — Balanced Progress
  // "Grow over time. Accept moderate volatility."
  // ═══════════════════════════════════════════════════════════════════════════
  BTC: 'GROWTH',
  ETH: 'GROWTH',
  BNB: 'GROWTH',
  XRP: 'GROWTH',
  KAG: 'GROWTH',
  QQQ: 'GROWTH',

  // ═══════════════════════════════════════════════════════════════════════════
  // UPSIDE — Bounded Conviction
  // "Express conviction. Small allocation, big potential."
  // ═══════════════════════════════════════════════════════════════════════════
  SOL: 'UPSIDE',
  TON: 'UPSIDE',
  LINK: 'UPSIDE',
  AVAX: 'UPSIDE',
  MATIC: 'UPSIDE',
  ARB: 'UPSIDE',
};

// Asset metadata for price feeds and balancing calculations
export const ASSET_META = {
  // ═══════════════════════════════════════════════════════════════════════════
  // FOUNDATION — Capital Preservation
  // ═══════════════════════════════════════════════════════════════════════════

  USDT: {
    name: 'Tether USD',
    coingeckoId: 'tether',
    source: 'coingecko',
    decimals: 2,
    currency: 'USD',
    category: 'stablecoin',
    description: 'USD exposure, instant liquidity',
    baseVolatility: 0.01,      // 1% annual
    maxLTV: 90,
    liquidityScore: 1.00,
    provider: 'Tether',
  },

  PAXG: {
    name: 'Paxos Gold',
    coingeckoId: 'pax-gold',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    unit: 'oz',
    category: 'gold',
    description: '1:1 gold-backed, inflation shield',
    baseVolatility: 0.12,      // 12% annual
    maxLTV: 70,
    liquidityScore: 0.85,
    provider: 'Paxos',
  },

  IRR_FIXED_INCOME: {
    name: 'IRR Fixed Income',
    source: 'internal',
    currency: 'IRR',
    unitPrice: 500000,         // 500,000 IRR per unit
    annualRate: 0.30,          // 30% annual return
    category: 'fixed_income',
    description: 'Charisma 30% yield, Rial-native',
    baseVolatility: 0.05,      // 5% annual (IRR terms)
    maxLTV: 0,                 // Cannot borrow against
    liquidityScore: 0.60,
    provider: 'Charisma',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROWTH — Balanced Progress
  // ═══════════════════════════════════════════════════════════════════════════

  BTC: {
    name: 'Bitcoin',
    coingeckoId: 'bitcoin',
    source: 'coingecko',
    decimals: 8,
    currency: 'USD',
    category: 'crypto_large',
    description: 'Digital gold, macro hedge',
    baseVolatility: 0.45,      // 45% annual
    maxLTV: 50,
    liquidityScore: 0.98,
    provider: 'Native',
  },

  ETH: {
    name: 'Ethereum',
    coingeckoId: 'ethereum',
    source: 'coingecko',
    decimals: 6,
    currency: 'USD',
    category: 'crypto_large',
    description: 'Platform asset, ecosystem growth',
    baseVolatility: 0.55,      // 55% annual
    maxLTV: 50,
    liquidityScore: 0.97,
    provider: 'Native',
  },

  BNB: {
    name: 'BNB',
    coingeckoId: 'binancecoin',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    category: 'crypto_large',
    description: 'Binance ecosystem, high utility',
    baseVolatility: 0.50,      // 50% annual
    maxLTV: 50,
    liquidityScore: 0.95,
    provider: 'Binance',
  },

  XRP: {
    name: 'XRP',
    coingeckoId: 'ripple',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    category: 'crypto_large',
    description: 'Payments infrastructure, high liquidity',
    baseVolatility: 0.60,      // 60% annual
    maxLTV: 45,
    liquidityScore: 0.94,
    provider: 'Ripple',
  },

  KAG: {
    name: 'Kinesis Silver',
    coingeckoId: 'kinesis-silver',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    unit: 'oz',
    category: 'silver',
    description: 'Silver exposure, commodity diversifier',
    baseVolatility: 0.18,      // 18% annual
    maxLTV: 60,
    liquidityScore: 0.75,
    provider: 'Kinesis',
  },

  QQQ: {
    name: 'Nasdaq 100',
    symbol: 'QQQ',
    source: 'finnhub',
    decimals: 2,
    currency: 'USD',
    category: 'equity_etf',
    description: 'US tech equity via Novion',
    baseVolatility: 0.20,      // 20% annual
    maxLTV: 60,
    liquidityScore: 0.90,
    provider: 'Novion',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UPSIDE — Bounded Conviction
  // ═══════════════════════════════════════════════════════════════════════════

  SOL: {
    name: 'Solana',
    coingeckoId: 'solana',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    category: 'alt_l1',
    description: 'High-performance L1, real usage',
    baseVolatility: 0.75,      // 75% annual
    maxLTV: 30,
    liquidityScore: 0.92,
    provider: 'Native',
  },

  TON: {
    name: 'Toncoin',
    coingeckoId: 'the-open-network',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    category: 'alt_l1',
    description: 'Telegram ecosystem, Iran-relevant',
    baseVolatility: 0.65,      // 65% annual
    maxLTV: 30,
    liquidityScore: 0.85,
    provider: 'TON Foundation',
  },

  LINK: {
    name: 'Chainlink',
    coingeckoId: 'chainlink',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    category: 'infrastructure',
    description: 'Oracle network, DeFi backbone',
    baseVolatility: 0.60,      // 60% annual
    maxLTV: 35,
    liquidityScore: 0.90,
    provider: 'Chainlink Labs',
  },

  AVAX: {
    name: 'Avalanche',
    coingeckoId: 'avalanche-2',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    category: 'alt_l1',
    description: 'Fast L1, institutional adoption',
    baseVolatility: 0.70,      // 70% annual
    maxLTV: 30,
    liquidityScore: 0.88,
    provider: 'Ava Labs',
  },

  MATIC: {
    name: 'Polygon',
    coingeckoId: 'matic-network',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    category: 'l2',
    description: 'Ethereum L2, established scaling',
    baseVolatility: 0.65,      // 65% annual
    maxLTV: 30,
    liquidityScore: 0.88,
    provider: 'Polygon Labs',
  },

  ARB: {
    name: 'Arbitrum',
    coingeckoId: 'arbitrum',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    category: 'l2',
    description: 'Leading L2, growing DeFi ecosystem',
    baseVolatility: 0.70,      // 70% annual
    maxLTV: 30,
    liquidityScore: 0.85,
    provider: 'Offchain Labs',
  },
};

// Layer health ranges for portfolio status
export const LAYER_RANGES = {
  FOUNDATION: { min: 40, max: 70, hardMin: 30 },
  GROWTH: { min: 20, max: 45 },
  UPSIDE: { min: 0, max: 20, hardMax: 25 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROFILE MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════════

export const USER_PROFILE_STRATEGIES = {
  ANXIOUS_NOVICE: 'CONSERVATIVE',
  STEADY_BUILDER: 'BALANCED',
  AGGRESSIVE_ACCUMULATOR: 'MOMENTUM_TILT',
  WEALTH_PRESERVER: 'MAX_DIVERSIFICATION',
  SPECULATOR: 'AGGRESSIVE',
};

export const USER_PROFILE_ALLOCATIONS = {
  ANXIOUS_NOVICE:         { FOUNDATION: 80, GROWTH: 18, UPSIDE: 2 },
  STEADY_BUILDER:         { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
  AGGRESSIVE_ACCUMULATOR: { FOUNDATION: 20, GROWTH: 30, UPSIDE: 50 },
  WEALTH_PRESERVER:       { FOUNDATION: 60, GROWTH: 35, UPSIDE: 5 },
  SPECULATOR:             { FOUNDATION: 10, GROWTH: 20, UPSIDE: 70 },
};
