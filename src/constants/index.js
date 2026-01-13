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
