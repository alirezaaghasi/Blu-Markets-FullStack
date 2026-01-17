// Constants for Blu Markets v10 — 15-Asset Universe

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT PRICES (USD)
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_PRICES = {
  // Foundation
  USDT: 1.00,
  PAXG: 2650,               // Gold price per oz
  // Growth
  BTC: 97500,
  ETH: 3200,
  BNB: 680,
  XRP: 2.20,
  KAG: 30,                  // Silver price per oz
  QQQ: 521,
  // Upside
  SOL: 185,
  TON: 5.20,
  LINK: 22,
  AVAX: 35,
  MATIC: 0.45,
  ARB: 0.80,
};

// Centralized default FX rate (single source of truth)
// 1 USD = 1,456,000 IRR
export const DEFAULT_FX_RATE = 1456000;

// ═══════════════════════════════════════════════════════════════════════════════
// APPLICATION STAGES
// ═══════════════════════════════════════════════════════════════════════════════

export const STAGES = {
  WELCOME: 'WELCOME',
  ONBOARDING_PHONE: 'ONBOARDING_PHONE',
  ONBOARDING_QUESTIONNAIRE: 'ONBOARDING_QUESTIONNAIRE',
  ONBOARDING_RESULT: 'ONBOARDING_RESULT',
  AMOUNT_REQUIRED: 'AMOUNT_REQUIRED',
  ACTIVE: 'ACTIVE',
};

// Centralized layer list - use this everywhere to avoid drift
export const LAYERS = ['FOUNDATION', 'GROWTH', 'UPSIDE'];

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER EXPLANATIONS (UI)
// ═══════════════════════════════════════════════════════════════════════════════

export const LAYER_EXPLANATIONS = {
  FOUNDATION: {
    name: 'Foundation',
    nameFa: 'پایه',
    icon: '🛡️',
    assets: ['USDT', 'PAXG', 'Fixed Income'],
    tagline: 'Your safety net',
    description: 'Stable assets that protect you during market drops',
    descriptionFa: 'دارایی‌های پایدار. پشتوانه‌ی امنت.',
  },
  GROWTH: {
    name: 'Growth',
    nameFa: 'رشد',
    icon: '📈',
    assets: ['BTC', 'ETH', 'BNB', 'XRP', 'KAG', 'QQQ'],
    tagline: 'Steady wealth building',
    description: 'Balanced assets that grow over time',
    descriptionFa: 'دارایی‌های متعادل برای رشد تدریجی.',
  },
  UPSIDE: {
    name: 'Upside',
    nameFa: 'رشد بالا',
    icon: '🚀',
    assets: ['SOL', 'TON', 'LINK', 'AVAX', 'MATIC', 'ARB'],
    tagline: 'Higher potential returns',
    description: 'Riskier assets for bigger gains',
    descriptionFa: 'پتانسیل بالاتر، بالا و پایین بیشتر.',
  },
};

// Issue 11: Onboarding step labels
export const ONBOARDING_STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'profile', label: 'Profile' },
  { id: 'amount', label: 'Amount' },
  { id: 'confirm', label: 'Confirm' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// THRESHOLDS & LIMITS
// ═══════════════════════════════════════════════════════════════════════════════

export const THRESHOLDS = {
  MIN_AMOUNT_IRR: 1_000_000,
  // Protection
  PROTECTION_MIN_MONTHS: 1,
  PROTECTION_MAX_MONTHS: 6,
  // Risk score thresholds for allocation calculation
  RISK_LOW_THRESHOLD: 5,
  RISK_MED_THRESHOLD: 10,
};

// Collateral LTV limits by layer (based on asset volatility)
export const COLLATERAL_LTV_BY_LAYER = {
  FOUNDATION: 0.7,  // 70% - stable assets
  GROWTH: 0.5,      // 50% - moderate volatility
  UPSIDE: 0.3,      // 30% - high volatility
};

// ═══════════════════════════════════════════════════════════════════════════════
// RISK ALLOCATIONS (Layer %)
// ═══════════════════════════════════════════════════════════════════════════════

export const RISK_ALLOCATIONS = {
  LOW: { FOUNDATION: 65, GROWTH: 30, UPSIDE: 5 },
  MEDIUM: { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
  HIGH: { FOUNDATION: 40, GROWTH: 40, UPSIDE: 20 },
};

// Premium rates per layer for protection pricing
export const PREMIUM_RATES = {
  FOUNDATION: 0.004,
  GROWTH: 0.008,
  UPSIDE: 0.012,
};

// Assets eligible for protection (must have liquid derivative markets)
export const PROTECTION_ELIGIBLE_ASSETS = [
  'BTC', 'ETH', 'PAXG', 'QQQ', 'SOL', 'BNB', 'XRP', 'LINK', 'AVAX'
];

// ═══════════════════════════════════════════════════════════════════════════════
// INTRA-LAYER WEIGHTS (Static defaults, overridden by dynamic balancer)
// ═══════════════════════════════════════════════════════════════════════════════

export const WEIGHTS = {
  FOUNDATION: {
    USDT: 0.40,
    PAXG: 0.30,
    IRR_FIXED_INCOME: 0.30,
  },
  GROWTH: {
    BTC: 0.25,
    ETH: 0.20,
    BNB: 0.15,
    XRP: 0.10,
    KAG: 0.15,
    QQQ: 0.15,
  },
  UPSIDE: {
    SOL: 0.20,
    TON: 0.18,
    LINK: 0.18,
    AVAX: 0.16,
    MATIC: 0.14,
    ARB: 0.14,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// INTRA-LAYER BALANCING CONFIG (HRAM)
// ═══════════════════════════════════════════════════════════════════════════════

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
  DRIFT_THRESHOLD: 0.05,      // 5% drift triggers rebalance
  MIN_REBALANCE_INTERVAL: 7,  // Days between rebalances
};

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGY PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const STRATEGY_PRESETS = {
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

// ═══════════════════════════════════════════════════════════════════════════════
// UI LABELS
// ═══════════════════════════════════════════════════════════════════════════════

export const PORTFOLIO_STATUS_LABELS = {
  BALANCED: 'Balanced',
  SLIGHTLY_OFF: 'Slightly Off',
  ATTENTION_REQUIRED: 'Attention Required',
};

export const BOUNDARY_LABELS = {
  SAFE: '✓ Looks good',
  DRIFT: '⚠ Minor drift',
  STRUCTURAL: '⚠ Needs review',
  STRESS: '⛔ High risk',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

export const ERROR_MESSAGES = {
  // General
  INVALID_AMOUNT: 'Please enter a valid amount.',
  INVALID_ASSET: 'Invalid asset selected.',
  INSUFFICIENT_CASH: 'Not enough cash available for this action.',

  // Trade
  INVALID_SIDE: 'Invalid trade side. Choose Buy or Sell.',
  INSUFFICIENT_ASSET_VALUE: 'Not enough of this asset to sell.',
  ASSET_FROZEN: 'This asset is locked as loan collateral and cannot be sold.',

  // Protect
  INVALID_MONTHS: 'Please select a duration between 1 and 6 months.',
  NO_NOTIONAL: 'This asset has no value to protect.',
  ASSET_ALREADY_PROTECTED: 'This asset already has active protection.',
  INSUFFICIENT_CASH_FOR_PREMIUM: 'Not enough cash to pay the protection premium.',
  ASSET_NOT_ELIGIBLE_FOR_PROTECTION: 'This asset is not eligible for protection. Only assets with liquid derivative markets can be protected.',

  // Borrow
  ASSET_ALREADY_FROZEN: 'This asset is already used as collateral for another loan.',
  EXCEEDS_MAX_BORROW: 'Amount exceeds maximum you can borrow against this asset.',

  // Repay
  NO_ACTIVE_LOAN: 'No active loan to repay.',
  NO_CASH: 'No cash available to make a repayment.',

  // Rebalance
  INVALID_MODE: 'Invalid rebalance mode.',
};
