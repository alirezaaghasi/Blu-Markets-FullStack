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
};

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

  // Borrow
  INVALID_LTV: 'LTV must be between 20% and 70%.',
  LOAN_ALREADY_ACTIVE: 'You already have an active loan. Repay it first.',
  ASSET_ALREADY_FROZEN: 'This asset is already used as collateral.',
  EXCEEDS_MAX_BORROW: 'Requested amount exceeds maximum borrowable.',

  // Repay
  NO_ACTIVE_LOAN: 'No active loan to repay.',
  NO_CASH: 'No cash available to make a repayment.',

  // Rebalance
  INVALID_MODE: 'Invalid rebalance mode.',
};
