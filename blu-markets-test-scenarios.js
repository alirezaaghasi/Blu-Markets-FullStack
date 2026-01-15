/**
 * Blu Markets v10 - Test Scenarios Data
 * Constants and configurations for additional test cases
 */

// Baseline prices in USD
export const BASELINE_PRICES = {
  BTC: 97500,
  ETH: 3200,
  SOL: 185,
  TON: 5.20,
  QQQ: 521,
  GOLD: 2650,
  USDT: 1.00,
};

// Baseline prices in IRR
export const FX_RATES = {
  USD_IRR: 1456000,
};

export const BASELINE_PRICES_IRR = {
  BTC: BASELINE_PRICES.BTC * FX_RATES.USD_IRR,
  ETH: BASELINE_PRICES.ETH * FX_RATES.USD_IRR,
  SOL: BASELINE_PRICES.SOL * FX_RATES.USD_IRR,
  TON: BASELINE_PRICES.TON * FX_RATES.USD_IRR,
  QQQ: BASELINE_PRICES.QQQ * FX_RATES.USD_IRR,
  GOLD: BASELINE_PRICES.GOLD * FX_RATES.USD_IRR,
  USDT: BASELINE_PRICES.USDT * FX_RATES.USD_IRR,
};

// Volatility scenarios
export const VOLATILITY_SCENARIOS = {
  V1_NORMAL: {
    name: 'Normal Market',
    prices: BASELINE_PRICES,
  },
  V2_BULL_RUN: {
    name: 'Bull Run',
    prices: { BTC: 125000, ETH: 4200, SOL: 280, TON: 7.80, GOLD: 2600, USDT: 1.00 },
  },
  V3_CORRECTION: {
    name: 'Market Correction',
    prices: { BTC: 72000, ETH: 2300, SOL: 120, TON: 3.60, GOLD: 2780, USDT: 1.00 },
  },
  V4_FLASH_CRASH: {
    name: 'Flash Crash',
    prices: { BTC: 78000, ETH: 2500, SOL: 140, TON: 3.90, GOLD: 2700, USDT: 1.00 },
  },
  V5_CRYPTO_WINTER: {
    name: 'Crypto Winter',
    prices: { BTC: 40000, ETH: 1250, SOL: 50, TON: 1.50, GOLD: 2950, USDT: 1.00 },
  },
};

// User profiles
export const USER_PROFILES = {
  ANXIOUS_NOVICE: {
    name: 'Anxious Novice',
    riskProfile: {
      targetAllocation: { FOUNDATION: 80, GROWTH: 18, UPSIDE: 2 },
    },
    investmentPattern: {
      initialAmount: 50_000_000,      // 50M IRR
      monthlyContribution: 5_000_000, // 5M IRR
    },
    behavioralPatterns: {
      panicSellThreshold: -10, // -10%
    },
  },
  STEADY_BUILDER: {
    name: 'Steady Builder',
    riskProfile: {
      targetAllocation: { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
    },
    investmentPattern: {
      initialAmount: 200_000_000,      // 200M IRR
      monthlyContribution: 20_000_000, // 20M IRR
    },
    behavioralPatterns: {
      panicSellThreshold: -20,
    },
  },
  AGGRESSIVE_ACCUMULATOR: {
    name: 'Aggressive Accumulator',
    riskProfile: {
      targetAllocation: { FOUNDATION: 20, GROWTH: 30, UPSIDE: 50 },
    },
    investmentPattern: {
      initialAmount: 500_000_000,       // 500M IRR
      monthlyContribution: 50_000_000,  // 50M IRR
      dipReserve: 500_000_000,          // 500M IRR for dip buying
    },
    behavioralPatterns: {
      panicSellThreshold: -40,
    },
  },
  WEALTH_PRESERVER: {
    name: 'Wealth Preserver',
    riskProfile: {
      targetAllocation: { FOUNDATION: 60, GROWTH: 35, UPSIDE: 5 },
    },
    investmentPattern: {
      initialAmount: 2_000_000_000,     // 2B IRR
      monthlyContribution: 100_000_000, // 100M IRR
    },
    behavioralPatterns: {
      panicSellThreshold: -15,
    },
  },
  SPECULATOR: {
    name: 'Speculator',
    riskProfile: {
      targetAllocation: { FOUNDATION: 10, GROWTH: 20, UPSIDE: 70 },
    },
    investmentPattern: {
      initialAmount: 100_000_000,      // 100M IRR
      monthlyContribution: 10_000_000, // 10M IRR
    },
    behavioralPatterns: {
      panicSellThreshold: -50,
    },
  },
};

// Cash-in patterns
export const CASH_IN_PATTERNS = {
  DCA_FIXED_MONTHLY: {
    name: 'Fixed Monthly DCA',
    pattern: {
      type: 'dca',
      frequency: 'monthly',
    },
    amounts: {
      small: {
        initial: 50_000_000,    // 50M IRR
        monthly: 5_000_000,     // 5M IRR
        yearTotal: 110_000_000, // 110M IRR
      },
      medium: {
        initial: 200_000_000,
        monthly: 20_000_000,
        yearTotal: 440_000_000,
      },
      large: {
        initial: 500_000_000,
        monthly: 50_000_000,
        yearTotal: 1_100_000_000,
      },
    },
  },
  DCA_VARIABLE: {
    name: 'Variable DCA',
    pattern: {
      type: 'dca_variable',
      frequency: 'monthly',
    },
    exampleSequence: [
      { month: 1, amount: 20_000_000 },
      { month: 2, amount: 15_000_000 },
      { month: 3, amount: 25_000_000 },
      { month: 4, amount: 20_000_000 },
      { month: 5, amount: 30_000_000 }, // Bonus month
      { month: 6, amount: 20_000_000 },
      { month: 7, amount: 15_000_000 },
      { month: 8, amount: 25_000_000 },
      { month: 9, amount: 20_000_000 },
      { month: 10, amount: 20_000_000 },
      { month: 11, amount: 40_000_000 }, // Year-end bonus
      { month: 12, amount: 20_000_000 },
    ],
    yearlyStats: {
      total: 270_000_000,
      average: 22_500_000,
    },
  },
  DCA_OPPORTUNISTIC: {
    name: 'Opportunistic DCA',
    pattern: {
      type: 'dca_opportunistic',
      frequency: 'monthly',
      dipThreshold: -10, // Buy extra when market drops 10%+
    },
  },
  LUMP_SUM: {
    name: 'Lump Sum',
    pattern: {
      type: 'one_time',
      frequency: null,
    },
    amounts: {
      small: 100_000_000,
      medium: 500_000_000,
      large: 2_000_000_000,
      whale: 10_000_000_000,
    },
  },
  HYBRID: {
    name: 'Hybrid (Lump Sum + DCA)',
    pattern: {
      initialType: 'lump_sum',
      followUpType: 'dca',
    },
    examples: [
      {
        profile: 'AGGRESSIVE_ACCUMULATOR',
        initial: 1_000_000_000,  // 1B IRR lump sum
        monthly: 100_000_000,    // 100M IRR monthly
      },
      {
        profile: 'STEADY_BUILDER',
        initial: 200_000_000,
        monthly: 20_000_000,
      },
    ],
  },
  MICRO_DCA: {
    name: 'Micro DCA (Weekly)',
    pattern: {
      type: 'dca',
      frequency: 'weekly',
    },
    amounts: {
      weekly: 1_000_000,      // 1M IRR per week
      yearTotal: 52_000_000,  // 52M IRR per year
    },
  },
};
