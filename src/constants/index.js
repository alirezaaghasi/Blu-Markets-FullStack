// Constants for Blu Markets v9.6

export const STAGES = {
  WELCOME: 'WELCOME',
  ONBOARDING_PHONE: 'ONBOARDING_PHONE',
  ONBOARDING_QUESTIONNAIRE: 'ONBOARDING_QUESTIONNAIRE',
  ONBOARDING_RESULT: 'ONBOARDING_RESULT',
  AMOUNT_REQUIRED: 'AMOUNT_REQUIRED',
  ACTIVE: 'ACTIVE',
};

export const LAYER_EXPLANATIONS = {
  FOUNDATION: {
    name: 'Foundation',
    nameFa: 'پایه',
    icon: '🛡️',
    assets: ['USDT', 'Fixed Income'],
    description: 'Stable assets. Your safety net.',
    descriptionFa: 'دارایی‌های پایدار. پشتوانه‌ی امنت.',
  },
  GROWTH: {
    name: 'Growth',
    nameFa: 'رشد',
    icon: '📈',
    assets: ['Gold', 'BTC', 'QQQ'],
    description: 'Balanced assets for steady growth.',
    descriptionFa: 'دارایی‌های متعادل برای رشد تدریجی.',
  },
  UPSIDE: {
    name: 'Upside',
    nameFa: 'رشد بالا',
    icon: '🚀',
    assets: ['ETH', 'SOL', 'TON'],
    description: 'Higher potential, more ups and downs.',
    descriptionFa: 'پتانسیل بالاتر، بالا و پایین بیشتر.',
  },
};

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
// Foundation = stable = higher LTV allowed
// Upside = volatile = lower LTV to protect user
export const COLLATERAL_LTV_BY_LAYER = {
  FOUNDATION: 0.7,  // 70% - stable assets
  GROWTH: 0.5,      // 50% - moderate volatility
  UPSIDE: 0.3,      // 30% - high volatility
};

// Target allocations based on risk score
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
export const PROTECTION_ELIGIBLE_ASSETS = ['BTC', 'ETH', 'GOLD', 'QQQ', 'SOL'];

export const WEIGHTS = {
  FOUNDATION: { IRR_FIXED_INCOME: 0.55, USDT: 0.45 },
  GROWTH: { GOLD: 0.20, BTC: 0.50, QQQ: 0.30 },
  UPSIDE: { ETH: 0.40, SOL: 0.35, TON: 0.25 },
};

export const PORTFOLIO_STATUS_LABELS = {
  BALANCED: 'Balanced',
  SLIGHTLY_OFF: 'Slightly Off',
  ATTENTION_REQUIRED: 'Attention Required',
};

export const BOUNDARY_LABELS = {
  SAFE: 'Safe',
  DRIFT: 'Drift',
  STRUCTURAL: 'Structural',
  STRESS: 'Stress',
};

// User-friendly error messages for validation errors
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
  ASSET_NOT_ELIGIBLE_FOR_PROTECTION: 'This asset is not eligible for protection. Only assets with liquid derivative markets (BTC, ETH, GOLD, QQQ, SOL) can be protected.',

  // Borrow
  ASSET_ALREADY_FROZEN: 'This asset is already used as collateral for another loan.',
  EXCEEDS_MAX_BORROW: 'Amount exceeds maximum you can borrow against this asset.',

  // Repay
  NO_ACTIVE_LOAN: 'No active loan to repay.',
  NO_CASH: 'No cash available to make a repayment.',

  // Rebalance
  INVALID_MODE: 'Invalid rebalance mode.',
};
