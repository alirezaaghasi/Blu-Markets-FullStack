/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BLU MARKETS v10 — COMPREHENSIVE TEST SCENARIOS FOR CLAUDE CODE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This file contains exhaustive test scenarios covering:
 *   1. Historical Market Volatility & Price Fluctuations
 *   2. User Profiles & Risk Behaviors
 *   3. Cash-In Patterns (Initial & Incremental)
 * 
 * Usage: Import into Claude Code test runner
 * Document Version: 1.0
 * Created: January 15, 2026
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: BASELINE PRICES & FX RATES
// ═══════════════════════════════════════════════════════════════════════════════

const BASELINE_PRICES = {
  // As of January 2026
  BTC: 97_500,        // USD
  ETH: 3_200,         // USD
  SOL: 185,           // USD
  TON: 5.20,          // USD
  QQQ: 521,           // USD
  GOLD: 2_650,        // USD per oz
  USDT: 1.00,         // USD
  IRR_FIXED_INCOME: 1, // IRR (23% annual yield)
};

const FX_RATES = {
  USD_IRR: 1_456_000, // 1 USD = 1,456,000 IRR
};

// Helper: Convert USD to IRR
const toIRR = (usd) => Math.round(usd * FX_RATES.USD_IRR);

// Asset prices in IRR (baseline)
const BASELINE_PRICES_IRR = {
  BTC: toIRR(BASELINE_PRICES.BTC),       // ~141.96B IRR per BTC
  ETH: toIRR(BASELINE_PRICES.ETH),       // ~4.66B IRR per ETH
  SOL: toIRR(BASELINE_PRICES.SOL),       // ~269.36M IRR per SOL
  TON: toIRR(BASELINE_PRICES.TON),       // ~7.57M IRR per TON
  QQQ: toIRR(BASELINE_PRICES.QQQ),       // ~758.58M IRR per share
  GOLD: toIRR(BASELINE_PRICES.GOLD / 31.1035), // per gram (~123.97M IRR)
  USDT: toIRR(BASELINE_PRICES.USDT),     // ~1.456M IRR per USDT
  IRR_FIXED_INCOME: 1,                    // 1 IRR = 1 IRR
};

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: MARKET VOLATILITY SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * These scenarios simulate real market conditions based on historical patterns
 * from July 2025 - January 2026 and extended stress scenarios.
 */

const VOLATILITY_SCENARIOS = {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // V1: NORMAL MARKET (Low Volatility Baseline)
  // ─────────────────────────────────────────────────────────────────────────────
  V1_NORMAL: {
    id: 'V1_NORMAL',
    name: 'Normal Market Conditions',
    nameFa: 'شرایط عادی بازار',
    description: 'Typical sideways market with minor fluctuations',
    duration: '30 days',
    
    priceSequence: [
      { day: 0,  BTC: 97500, ETH: 3200, SOL: 185, TON: 5.20, GOLD: 2650, USDT: 1.00 },
      { day: 7,  BTC: 98200, ETH: 3180, SOL: 182, TON: 5.15, GOLD: 2660, USDT: 1.00 },
      { day: 14, BTC: 96800, ETH: 3150, SOL: 188, TON: 5.25, GOLD: 2670, USDT: 1.00 },
      { day: 21, BTC: 97100, ETH: 3210, SOL: 184, TON: 5.18, GOLD: 2655, USDT: 1.00 },
      { day: 30, BTC: 97800, ETH: 3190, SOL: 186, TON: 5.22, GOLD: 2665, USDT: 1.00 },
    ],
    
    volatilityMetrics: {
      btcRange: [-2, +2],     // % from baseline
      ethRange: [-3, +3],
      solRange: [-4, +4],
      tonRange: [-3, +3],
      goldRange: [-1, +1],
    },
    
    expectedPortfolioImpact: {
      conservative: { min: -1, max: +2 },
      balanced: { min: -2, max: +4 },
      aggressive: { min: -4, max: +6 },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // V2: BULL RUN (Strong Upward Momentum)
  // ─────────────────────────────────────────────────────────────────────────────
  V2_BULL_RUN: {
    id: 'V2_BULL_RUN',
    name: 'Bull Market Rally',
    nameFa: 'روند صعودی بازار',
    description: 'Strong upward momentum across crypto markets',
    duration: '14 days',
    
    priceSequence: [
      { day: 0,  BTC: 97500,  ETH: 3200,  SOL: 185, TON: 5.20, GOLD: 2650, USDT: 1.00 },
      { day: 3,  BTC: 102000, ETH: 3400,  SOL: 205, TON: 5.80, GOLD: 2640, USDT: 1.00 },
      { day: 7,  BTC: 112000, ETH: 3750,  SOL: 235, TON: 6.50, GOLD: 2620, USDT: 1.00 },
      { day: 10, BTC: 118000, ETH: 4000,  SOL: 260, TON: 7.20, GOLD: 2610, USDT: 1.00 },
      { day: 14, BTC: 125000, ETH: 4200,  SOL: 280, TON: 7.80, GOLD: 2600, USDT: 1.00 },
    ],
    
    volatilityMetrics: {
      btcChange: +28,        // % total change
      ethChange: +31,
      solChange: +51,
      tonChange: +50,
      goldChange: -2,        // Gold often dips in risk-on
    },
    
    expectedPortfolioImpact: {
      conservative: { min: +8, max: +15 },
      balanced: { min: +18, max: +28 },
      aggressive: { min: +35, max: +55 },
    },
    
    rebalanceTriggered: true,
    upsideLayerOverweight: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // V3: MARKET CORRECTION (-25% to -35%)
  // ─────────────────────────────────────────────────────────────────────────────
  V3_CORRECTION: {
    id: 'V3_CORRECTION',
    name: 'Market Correction',
    nameFa: 'اصلاح بازار',
    description: 'Significant market pullback following bull run',
    duration: '21 days',
    
    priceSequence: [
      { day: 0,  BTC: 97500, ETH: 3200,  SOL: 185, TON: 5.20, GOLD: 2650, USDT: 1.00 },
      { day: 3,  BTC: 92000, ETH: 3000,  SOL: 165, TON: 4.80, GOLD: 2680, USDT: 1.00 },
      { day: 7,  BTC: 85000, ETH: 2750,  SOL: 145, TON: 4.30, GOLD: 2720, USDT: 1.00 },
      { day: 14, BTC: 75000, ETH: 2400,  SOL: 125, TON: 3.80, GOLD: 2750, USDT: 1.00 },
      { day: 21, BTC: 72000, ETH: 2300,  SOL: 120, TON: 3.60, GOLD: 2780, USDT: 1.00 },
    ],
    
    volatilityMetrics: {
      btcChange: -26,
      ethChange: -28,
      solChange: -35,
      tonChange: -31,
      goldChange: +5,        // Flight to safety
    },
    
    expectedPortfolioImpact: {
      conservative: { min: -8, max: -5 },
      balanced: { min: -18, max: -12 },
      aggressive: { min: -32, max: -25 },
    },
    
    loanStressLevel: 'warning',
    rebalanceTriggered: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // V4: FLASH CRASH (Intraday -20%, Recovery Same Day)
  // ─────────────────────────────────────────────────────────────────────────────
  V4_FLASH_CRASH: {
    id: 'V4_FLASH_CRASH',
    name: 'Flash Crash & Recovery',
    nameFa: 'سقوط ناگهانی و بازیابی',
    description: 'Sharp intraday drop with rapid recovery',
    duration: '1 day (hourly)',
    
    priceSequence: [
      { hour: 0,  BTC: 97500, ETH: 3200,  SOL: 185, TON: 5.20, GOLD: 2650, USDT: 1.00 },
      { hour: 2,  BTC: 92000, ETH: 3000,  SOL: 170, TON: 4.80, GOLD: 2660, USDT: 1.00 },
      { hour: 4,  BTC: 82000, ETH: 2650,  SOL: 150, TON: 4.20, GOLD: 2680, USDT: 1.00 },
      { hour: 6,  BTC: 78000, ETH: 2500,  SOL: 140, TON: 3.90, GOLD: 2700, USDT: 1.00 }, // Bottom
      { hour: 8,  BTC: 85000, ETH: 2750,  SOL: 158, TON: 4.40, GOLD: 2690, USDT: 1.00 },
      { hour: 12, BTC: 90000, ETH: 2950,  SOL: 172, TON: 4.80, GOLD: 2670, USDT: 1.00 },
      { hour: 18, BTC: 94000, ETH: 3100,  SOL: 180, TON: 5.00, GOLD: 2660, USDT: 1.00 },
      { hour: 24, BTC: 95500, ETH: 3150,  SOL: 182, TON: 5.10, GOLD: 2655, USDT: 1.00 },
    ],
    
    volatilityMetrics: {
      maxDrawdown: -20,      // At hour 6
      recoveryPercent: 92,   // Returns to 92% of original by EOD
      maxLtvSpike: true,
    },
    
    expectedPortfolioImpact: {
      conservative: { min: -3, max: -1 },
      balanced: { min: -8, max: -4 },
      aggressive: { min: -15, max: -8 },
    },
    
    loanStressLevel: 'critical_temporary',
    liquidationRisk: 'high_if_leveraged',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // V5: CRYPTO WINTER (Extended Bear Market)
  // ─────────────────────────────────────────────────────────────────────────────
  V5_CRYPTO_WINTER: {
    id: 'V5_CRYPTO_WINTER',
    name: 'Crypto Winter',
    nameFa: 'زمستان کریپتو',
    description: 'Extended bear market lasting months',
    duration: '180 days',
    
    priceSequence: [
      { day: 0,   BTC: 97500, ETH: 3200,  SOL: 185, TON: 5.20, GOLD: 2650, USDT: 1.00 },
      { day: 30,  BTC: 85000, ETH: 2700,  SOL: 150, TON: 4.20, GOLD: 2700, USDT: 1.00 },
      { day: 60,  BTC: 72000, ETH: 2200,  SOL: 110, TON: 3.30, GOLD: 2750, USDT: 1.00 },
      { day: 90,  BTC: 58000, ETH: 1800,  SOL: 85,  TON: 2.50, GOLD: 2800, USDT: 1.00 },
      { day: 120, BTC: 48000, ETH: 1500,  SOL: 65,  TON: 2.00, GOLD: 2850, USDT: 1.00 },
      { day: 150, BTC: 42000, ETH: 1350,  SOL: 55,  TON: 1.70, GOLD: 2900, USDT: 1.00 },
      { day: 180, BTC: 40000, ETH: 1250,  SOL: 50,  TON: 1.50, GOLD: 2950, USDT: 1.00 },
    ],
    
    volatilityMetrics: {
      btcChange: -59,
      ethChange: -61,
      solChange: -73,
      tonChange: -71,
      goldChange: +11,
    },
    
    expectedPortfolioImpact: {
      conservative: { min: -15, max: -10 },
      balanced: { min: -40, max: -30 },
      aggressive: { min: -65, max: -55 },
    },
    
    loanStressLevel: 'catastrophic',
    dcaOpportunity: 'excellent',
    protectionValue: 'critical',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // V6: GOLD SURGE (Safe Haven Rally)
  // ─────────────────────────────────────────────────────────────────────────────
  V6_GOLD_SURGE: {
    id: 'V6_GOLD_SURGE',
    name: 'Gold Safe Haven Rally',
    nameFa: 'افزایش طلا به عنوان پناهگاه امن',
    description: 'Gold appreciation during risk-off environment',
    duration: '60 days',
    
    priceSequence: [
      { day: 0,  BTC: 97500, ETH: 3200, SOL: 185, TON: 5.20, GOLD: 2650, USDT: 1.00 },
      { day: 15, BTC: 95000, ETH: 3100, SOL: 175, TON: 5.00, GOLD: 2800, USDT: 1.00 },
      { day: 30, BTC: 92000, ETH: 3000, SOL: 168, TON: 4.80, GOLD: 2950, USDT: 1.00 },
      { day: 45, BTC: 90000, ETH: 2950, SOL: 165, TON: 4.70, GOLD: 3100, USDT: 1.00 },
      { day: 60, BTC: 88000, ETH: 2900, SOL: 160, TON: 4.60, GOLD: 3200, USDT: 1.00 },
    ],
    
    volatilityMetrics: {
      btcChange: -10,
      ethChange: -9,
      solChange: -14,
      tonChange: -12,
      goldChange: +21,
    },
    
    expectedPortfolioImpact: {
      conservative: { min: +3, max: +8 },   // Gold-heavy benefits
      balanced: { min: -3, max: +2 },
      aggressive: { min: -12, max: -8 },
    },
    
    foundationLayerBenefit: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // V7: IRR DEVALUATION (Local Currency Crisis)
  // ─────────────────────────────────────────────────────────────────────────────
  V7_IRR_DEVALUATION: {
    id: 'V7_IRR_DEVALUATION',
    name: 'IRR Devaluation Event',
    nameFa: 'افت ارزش ریال',
    description: 'Iranian Rial loses value against USD',
    duration: '30 days',
    
    fxSequence: [
      { day: 0,  USD_IRR: 1_456_000 },
      { day: 7,  USD_IRR: 1_550_000 },
      { day: 14, USD_IRR: 1_680_000 },
      { day: 21, USD_IRR: 1_750_000 },
      { day: 30, USD_IRR: 1_820_000 },
    ],
    
    priceSequence: [
      // USD prices stable, IRR prices increase
      { day: 0,  BTC: 97500, ETH: 3200, SOL: 185, TON: 5.20, GOLD: 2650, USDT: 1.00 },
      { day: 30, BTC: 97500, ETH: 3200, SOL: 185, TON: 5.20, GOLD: 2650, USDT: 1.00 },
    ],
    
    volatilityMetrics: {
      irrDevaluation: -25,   // IRR loses 25% vs USD
      portfolioIrrValue: +25, // Portfolio worth more in IRR
    },
    
    expectedPortfolioImpact: {
      // All portfolios benefit in IRR terms
      conservative: { min: +22, max: +26 },
      balanced: { min: +22, max: +26 },
      aggressive: { min: +22, max: +26 },
    },
    
    usdHedgeBenefit: 'critical',
    fixedIncomeIrrLoss: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // V8: USDT DEPEG CRISIS (Stablecoin Black Swan)
  // ─────────────────────────────────────────────────────────────────────────────
  V8_USDT_DEPEG: {
    id: 'V8_USDT_DEPEG',
    name: 'USDT Depeg Crisis',
    nameFa: 'بحران جدا شدن USDT از دلار',
    description: 'Tether loses dollar peg temporarily',
    duration: '7 days',
    
    priceSequence: [
      { day: 0, BTC: 97500, ETH: 3200, SOL: 185, TON: 5.20, GOLD: 2650, USDT: 1.00 },
      { day: 1, BTC: 95000, ETH: 3100, SOL: 175, TON: 5.00, GOLD: 2680, USDT: 0.98 },
      { day: 2, BTC: 90000, ETH: 2900, SOL: 160, TON: 4.60, GOLD: 2720, USDT: 0.92 },
      { day: 3, BTC: 85000, ETH: 2700, SOL: 145, TON: 4.20, GOLD: 2750, USDT: 0.85 }, // Worst
      { day: 5, BTC: 92000, ETH: 3000, SOL: 170, TON: 4.80, GOLD: 2700, USDT: 0.95 },
      { day: 7, BTC: 95000, ETH: 3100, SOL: 180, TON: 5.00, GOLD: 2670, USDT: 1.00 }, // Recovery
    ],
    
    volatilityMetrics: {
      usdtMinPrice: 0.85,
      cryptoPanicSell: -13,
      goldFlightToSafety: +4,
    },
    
    expectedPortfolioImpact: {
      // USDT-heavy portfolios suffer most
      conservative: { min: -18, max: -12 }, // Heavy USDT allocation
      balanced: { min: -15, max: -10 },
      aggressive: { min: -12, max: -8 },    // Less USDT exposure
    },
    
    foundationLayerRisk: 'critical',
    diversificationLesson: 'USDT concentration risk',
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: USER PROFILES & RISK BEHAVIORS
// ═══════════════════════════════════════════════════════════════════════════════

const USER_PROFILES = {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PROFILE 1: THE ANXIOUS NOVICE (فرزانه - Farzaneh)
  // ─────────────────────────────────────────────────────────────────────────────
  ANXIOUS_NOVICE: {
    id: 'ANXIOUS_NOVICE',
    name: 'Farzaneh',
    nameFa: 'فرزانه',
    persona: 'The Anxious Novice',
    
    demographics: {
      age: 28,
      occupation: 'School Teacher',
      occupationFa: 'معلم مدرسه',
      monthlyIncome: 35_000_000,    // IRR
      investmentExperience: 'None',
      financialDependents: 'Parents',
    },
    
    questionnaire: {
      q1_horizon: 'short',           // 1-2 years
      q2_reaction: 'sell_all',       // Panic sell on -20%
      q3_income: 'fixed_low',        // Fixed, no flexibility
      q4_experience: 'none',         // Zero experience
      q5_goal: 'preserve',           // Capital preservation
    },
    
    riskProfile: {
      riskScore: 2,                  // Out of 15
      riskLevel: 'VERY_CONSERVATIVE',
      targetAllocation: { FOUNDATION: 80, GROWTH: 18, UPSIDE: 2 },
    },
    
    behavioralPatterns: {
      appCheckFrequency: 'daily',
      panicSellThreshold: -10,       // Panics at -10% loss
      fomoBuyThreshold: +20,         // FOMO buys after +20% gain
      rebalanceWillingness: 'low',
      loanAversion: 'extreme',       // Will never take loans
      protectionInterest: 'high',    // Wants downside protection
    },
    
    investmentPattern: {
      initialAmount: 50_000_000,     // 50M IRR (~$34 USD)
      monthlyContribution: 5_000_000, // 5M IRR/month DCA
      maxTotalInvestment: 200_000_000,
      incomeAllocationPercent: 14,   // 14% of salary
    },
    
    expectedBehaviors: [
      'Checks portfolio value multiple times daily',
      'Calls support during any market dip',
      'Hesitant to rebalance even when suggested',
      'Strongly prefers USDT and fixed income',
      'May panic sell if portfolio drops >10%',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PROFILE 2: THE STEADY BUILDER (علی - Ali)
  // ─────────────────────────────────────────────────────────────────────────────
  STEADY_BUILDER: {
    id: 'STEADY_BUILDER',
    name: 'Ali',
    nameFa: 'علی',
    persona: 'The Steady Builder',
    
    demographics: {
      age: 35,
      occupation: 'Software Engineer',
      occupationFa: 'مهندس نرم‌افزار',
      monthlyIncome: 120_000_000,   // IRR
      investmentExperience: '3 years stocks',
      financialDependents: 'Spouse',
    },
    
    questionnaire: {
      q1_horizon: 'medium',          // 3-5 years
      q2_reaction: 'hold',           // Hold through volatility
      q3_income: 'stable_growing',   // Stable with growth potential
      q4_experience: 'moderate',     // Some experience
      q5_goal: 'growth',             // Wealth accumulation
    },
    
    riskProfile: {
      riskScore: 6,
      riskLevel: 'BALANCED',
      targetAllocation: { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 },
    },
    
    behavioralPatterns: {
      appCheckFrequency: 'weekly',
      panicSellThreshold: -25,       // More tolerant
      fomoBuyThreshold: +35,
      rebalanceWillingness: 'moderate',
      loanAversion: 'moderate',
      protectionInterest: 'moderate',
    },
    
    investmentPattern: {
      initialAmount: 200_000_000,    // 200M IRR (~$137 USD)
      monthlyContribution: 30_000_000, // 30M IRR/month
      maxTotalInvestment: 1_000_000_000,
      incomeAllocationPercent: 25,
    },
    
    expectedBehaviors: [
      'Consistent monthly DCA regardless of market conditions',
      'Reviews portfolio weekly but doesn\'t panic',
      'Willing to rebalance when drift exceeds 5%',
      'May consider small loans for specific opportunities',
      'Values diversification over maximum returns',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PROFILE 3: THE AGGRESSIVE ACCUMULATOR (سارا - Sara)
  // ─────────────────────────────────────────────────────────────────────────────
  AGGRESSIVE_ACCUMULATOR: {
    id: 'AGGRESSIVE_ACCUMULATOR',
    name: 'Sara',
    nameFa: 'سارا',
    persona: 'The Aggressive Accumulator',
    
    demographics: {
      age: 30,
      occupation: 'Tech Startup Founder',
      occupationFa: 'بنیانگذار استارتاپ',
      monthlyIncome: 250_000_000,   // IRR (variable)
      investmentExperience: '5 years crypto',
      financialDependents: 'None',
    },
    
    questionnaire: {
      q1_horizon: 'long',            // 5+ years
      q2_reaction: 'buy_more',       // Buy the dip
      q3_income: 'variable_high',    // Variable but high
      q4_experience: 'experienced',  // Crypto native
      q5_goal: 'maximize',           // Maximum growth
    },
    
    riskProfile: {
      riskScore: 11,
      riskLevel: 'AGGRESSIVE',
      targetAllocation: { FOUNDATION: 20, GROWTH: 30, UPSIDE: 50 },
    },
    
    behavioralPatterns: {
      appCheckFrequency: 'multiple_daily',
      panicSellThreshold: -50,       // Very tolerant
      fomoBuyThreshold: +80,
      rebalanceWillingness: 'high',
      loanAversion: 'low',           // Uses leverage
      protectionInterest: 'strategic', // Only for specific plays
    },
    
    investmentPattern: {
      initialAmount: 1_000_000_000,  // 1B IRR (~$687 USD)
      monthlyContribution: 100_000_000, // 100M IRR/month
      maxTotalInvestment: 5_000_000_000,
      incomeAllocationPercent: 40,
      dipReserve: 500_000_000,       // Cash reserved for dips
    },
    
    expectedBehaviors: [
      'Actively buys dips, views corrections as opportunities',
      'Comfortable with 30%+ portfolio swings',
      'Uses loans strategically when confident',
      'Rebalances frequently to maintain allocation',
      'Heavy emphasis on UPSIDE layer assets',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PROFILE 4: THE WEALTH PRESERVER (مریم - Maryam)
  // ─────────────────────────────────────────────────────────────────────────────
  WEALTH_PRESERVER: {
    id: 'WEALTH_PRESERVER',
    name: 'Maryam',
    nameFa: 'مریم',
    persona: 'The Wealth Preserver',
    
    demographics: {
      age: 55,
      occupation: 'Retired Business Owner',
      occupationFa: 'بازنشسته، صاحب کسب‌وکار سابق',
      monthlyIncome: 80_000_000,    // IRR (pension + rental)
      investmentExperience: 'Traditional (real estate, gold)',
      financialDependents: 'Spouse, adult children',
    },
    
    questionnaire: {
      q1_horizon: 'medium',          // 3-5 years
      q2_reaction: 'hold',           // Hold, don't panic
      q3_income: 'fixed_high',       // Pension + rental income
      q4_experience: 'traditional',  // Real estate/gold only
      q5_goal: 'income',             // Income generation
    },
    
    riskProfile: {
      riskScore: 5,
      riskLevel: 'CONSERVATIVE',
      targetAllocation: { FOUNDATION: 60, GROWTH: 35, UPSIDE: 5 },
    },
    
    behavioralPatterns: {
      appCheckFrequency: 'monthly',
      panicSellThreshold: -15,
      fomoBuyThreshold: +50,
      rebalanceWillingness: 'low',
      loanAversion: 'high',
      protectionInterest: 'high',
    },
    
    investmentPattern: {
      initialAmount: 2_000_000_000,  // 2B IRR (~$1,374 USD)
      monthlyContribution: 0,        // Lump sum only
      maxTotalInvestment: 3_000_000_000,
      incomeAllocationPercent: 0,    // Already retired
    },
    
    expectedBehaviors: [
      'Strongly prefers gold and fixed income',
      'Minimal crypto exposure (only 5% in Upside)',
      'Values capital preservation over growth',
      'Interested in protection products',
      'Checks portfolio monthly at most',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PROFILE 5: THE SPECULATOR (بهرام - Bahram)
  // ─────────────────────────────────────────────────────────────────────────────
  SPECULATOR: {
    id: 'SPECULATOR',
    name: 'Bahram',
    nameFa: 'بهرام',
    persona: 'The Speculator',
    
    demographics: {
      age: 32,
      occupation: 'Day Trader',
      occupationFa: 'معامله‌گر روزانه',
      monthlyIncome: 'Variable (trading profits)',
      investmentExperience: '7 years active trading',
      financialDependents: 'None',
    },
    
    questionnaire: {
      q1_horizon: 'short',           // Trades frequently
      q2_reaction: 'buy_more',       // Counter-trades
      q3_income: 'trading',          // Lives off trading
      q4_experience: 'professional', // Full-time trader
      q5_goal: 'maximize',           // Maximum returns
    },
    
    riskProfile: {
      riskScore: 15,                 // Maximum
      riskLevel: 'SPECULATIVE',
      targetAllocation: { FOUNDATION: 10, GROWTH: 20, UPSIDE: 70 },
    },
    
    behavioralPatterns: {
      appCheckFrequency: 'continuous',
      panicSellThreshold: -70,       // Almost never panics
      fomoBuyThreshold: +200,        // Contrarian
      rebalanceWillingness: 'very_high',
      loanAversion: 'none',          // Uses leverage freely
      protectionInterest: 'strategic', // Uses for specific plays
    },
    
    investmentPattern: {
      initialAmount: 500_000_000,    // 500M IRR (~$343 USD)
      monthlyContribution: 'variable',
      maxTotalInvestment: 'unlimited',
      incomeAllocationPercent: 100,  // All-in approach
    },
    
    expectedBehaviors: [
      '70% allocation to high-risk UPSIDE assets',
      'Actively uses loans for leverage',
      'Counter-trades market movements',
      'High tolerance for volatility',
      'May face liquidation risk during crashes',
    ],
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: CASH-IN PATTERNS (INITIAL & INCREMENTAL)
// ═══════════════════════════════════════════════════════════════════════════════

const CASH_IN_PATTERNS = {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // D1: FIXED MONTHLY DCA
  // ─────────────────────────────────────────────────────────────────────────────
  DCA_FIXED_MONTHLY: {
    id: 'DCA_FIXED_MONTHLY',
    name: 'Fixed Monthly DCA',
    nameFa: 'میانگین‌گیری ماهانه ثابت',
    description: 'Consistent monthly contributions regardless of market',
    
    pattern: {
      type: 'recurring',
      frequency: 'monthly',
      amountStrategy: 'fixed',
    },
    
    amounts: {
      small: {
        initial: 50_000_000,
        monthly: 5_000_000,
        yearTotal: 110_000_000,
      },
      medium: {
        initial: 200_000_000,
        monthly: 30_000_000,
        yearTotal: 560_000_000,
      },
      large: {
        initial: 500_000_000,
        monthly: 100_000_000,
        yearTotal: 1_700_000_000,
      },
    },
    
    suitableProfiles: ['ANXIOUS_NOVICE', 'STEADY_BUILDER'],
    
    testCases: [
      {
        id: 'D1-001',
        scenario: '12 months consistent DCA',
        initialInvestment: 50_000_000,
        monthlyAmount: 5_000_000,
        duration: 12,
        expectedBehavior: 'Automated deposits on 1st of each month',
        assertions: {
          totalDeposited: 110_000_000,
          depositCount: 13, // Initial + 12 monthly
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // D2: VARIABLE DCA (Income-Based)
  // ─────────────────────────────────────────────────────────────────────────────
  DCA_VARIABLE: {
    id: 'DCA_VARIABLE',
    name: 'Variable Income-Based DCA',
    nameFa: 'میانگین‌گیری متغیر بر اساس درآمد',
    description: 'Monthly contributions vary with income/bonuses',
    
    pattern: {
      type: 'recurring',
      frequency: 'monthly',
      amountStrategy: 'variable',
    },
    
    exampleSequence: [
      { month: 1,  amount: 30_000_000, note: 'Regular salary' },
      { month: 2,  amount: 30_000_000, note: 'Regular salary' },
      { month: 3,  amount: 30_000_000, note: 'Regular salary' },
      { month: 4,  amount: 80_000_000, note: 'Nowruz bonus' },
      { month: 5,  amount: 30_000_000, note: 'Regular salary' },
      { month: 6,  amount: 30_000_000, note: 'Regular salary' },
      { month: 7,  amount: 50_000_000, note: 'Freelance income' },
      { month: 8,  amount: 30_000_000, note: 'Regular salary' },
      { month: 9,  amount: 30_000_000, note: 'Regular salary' },
      { month: 10, amount: 100_000_000, note: 'Year-end bonus' },
      { month: 11, amount: 30_000_000, note: 'Regular salary' },
      { month: 12, amount: 30_000_000, note: 'Regular salary' },
    ],
    
    yearlyStats: {
      total: 500_000_000,
      average: 41_667_000,
      min: 30_000_000,
      max: 100_000_000,
    },
    
    suitableProfiles: ['STEADY_BUILDER', 'AGGRESSIVE_ACCUMULATOR'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // D3: OPPORTUNISTIC (Buy the Dip)
  // ─────────────────────────────────────────────────────────────────────────────
  DCA_OPPORTUNISTIC: {
    id: 'DCA_OPPORTUNISTIC',
    name: 'Opportunistic Dip Buying',
    nameFa: 'خرید در ریزش‌ها',
    description: 'Large deployments during market dips',
    
    pattern: {
      type: 'event_triggered',
      trigger: 'market_dip',
      dipThreshold: -10, // Buy when market drops 10%+
    },
    
    strategy: {
      reserveCash: 500_000_000,      // Kept aside for dips
      normalDca: 50_000_000,         // Monthly baseline
      dipDeployment: 200_000_000,    // Per dip event
    },
    
    exampleSequence: [
      { event: 'Initial investment', amount: 1_000_000_000 },
      { event: 'Month 1 DCA', amount: 50_000_000 },
      { event: 'Month 2 DCA', amount: 50_000_000 },
      { event: 'Market -12% dip', amount: 200_000_000, dipBuy: true },
      { event: 'Month 3 DCA', amount: 50_000_000 },
      { event: 'Month 4 DCA', amount: 50_000_000 },
      { event: 'Market -18% dip', amount: 200_000_000, dipBuy: true },
      { event: 'Month 5 DCA', amount: 50_000_000 },
      { event: 'Month 6 DCA', amount: 50_000_000 },
    ],
    
    suitableProfiles: ['AGGRESSIVE_ACCUMULATOR', 'SPECULATOR'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // D4: LARGE LUMP SUM (One-Time Investment)
  // ─────────────────────────────────────────────────────────────────────────────
  LUMP_SUM: {
    id: 'LUMP_SUM',
    name: 'Large Lump Sum',
    nameFa: 'سرمایه‌گذاری یکجا',
    description: 'Single large investment with no follow-up',
    
    pattern: {
      type: 'one_time',
      frequency: null,
      amountStrategy: 'all_at_once',
    },
    
    amounts: {
      small: 500_000_000,
      medium: 2_000_000_000,
      large: 5_000_000_000,
      whale: 10_000_000_000,
    },
    
    suitableProfiles: ['WEALTH_PRESERVER'],
    
    considerations: [
      'All exposure happens at single price point',
      'No cost averaging benefit',
      'Higher timing risk',
      'May miss future dip opportunities',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // D5: HYBRID (Lump Sum + DCA)
  // ─────────────────────────────────────────────────────────────────────────────
  HYBRID: {
    id: 'HYBRID',
    name: 'Hybrid Lump Sum + DCA',
    nameFa: 'ترکیبی: یکجا + میانگین‌گیری',
    description: 'Large initial investment followed by regular DCA',
    
    pattern: {
      type: 'hybrid',
      initialType: 'lump_sum',
      followUpType: 'dca',
    },
    
    examples: [
      {
        profile: 'WEALTH_PRESERVER',
        initial: 2_000_000_000,
        monthly: 0,                  // No ongoing DCA
        strategy: 'Deploy inheritance/sale proceeds',
      },
      {
        profile: 'AGGRESSIVE_ACCUMULATOR',
        initial: 1_000_000_000,
        monthly: 100_000_000,
        strategy: 'Base investment + aggressive accumulation',
      },
      {
        profile: 'STEADY_BUILDER',
        initial: 200_000_000,
        monthly: 30_000_000,
        strategy: 'Savings deployment + salary allocation',
      },
    ],
    
    suitableProfiles: ['WEALTH_PRESERVER', 'AGGRESSIVE_ACCUMULATOR', 'STEADY_BUILDER'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // D6: MICRO DCA (Very Small Regular)
  // ─────────────────────────────────────────────────────────────────────────────
  MICRO_DCA: {
    id: 'MICRO_DCA',
    name: 'Micro DCA',
    nameFa: 'میانگین‌گیری کوچک',
    description: 'Very small but consistent contributions',
    
    pattern: {
      type: 'recurring',
      frequency: 'weekly',
      amountStrategy: 'micro',
    },
    
    amounts: {
      weekly: 1_000_000,             // ~$0.69 per week
      monthly_equivalent: 4_000_000,
      yearTotal: 52_000_000,
    },
    
    suitableProfiles: ['ANXIOUS_NOVICE'],
    
    considerations: [
      'Builds habit without large commitment',
      'Good for testing system',
      'May not be economically significant',
      'Transaction costs may be disproportionate',
    ],
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// PART 5: COMBINED TEST MATRIX
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full Test Matrix: Profile × Volatility × Cash-In Pattern
 * 
 * This matrix generates comprehensive test scenarios by combining
 * all three dimensions systematically.
 */

const TEST_MATRIX = [
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ANXIOUS NOVICE TEST SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    testId: 'AN-V1-D1',
    profile: 'ANXIOUS_NOVICE',
    volatility: 'V1_NORMAL',
    cashIn: 'DCA_FIXED_MONTHLY',
    
    setup: {
      initialInvestment: 50_000_000,
      monthlyDCA: 5_000_000,
      duration: '12 months',
    },
    
    expectedOutcome: {
      portfolioGrowth: { min: 10, max: 18 },   // %
      fixedIncomeAccrued: 3_500_000,            // ~IRR
      rebalanceEvents: 0,
      panicEvents: 0,
    },
    
    assertions: [
      { check: 'foundationLayerPct', expected: { min: 78, max: 82 } },
      { check: 'upsideLayerPct', expected: { max: 4 } },
      { check: 'hasLoans', expected: false },
      { check: 'portfolioHealth', expected: 'Balanced' },
    ],
  },

  {
    testId: 'AN-V3-D1',
    profile: 'ANXIOUS_NOVICE',
    volatility: 'V3_CORRECTION',
    cashIn: 'DCA_FIXED_MONTHLY',
    
    setup: {
      initialInvestment: 50_000_000,
      monthlyDCA: 5_000_000,
      duration: '21 days',
    },
    
    expectedOutcome: {
      portfolioChange: { min: -6, max: -3 },   // Small loss due to conservative
      emotionalState: 'anxious',
      dcaBenefit: 'Buying at lower prices',
    },
    
    assertions: [
      { check: 'portfolioHealth', expected: 'Slightly Off' },
      { check: 'panicSellTriggered', expected: 'possible', note: 'At -10%' },
    ],
    
    behavioralNotes: [
      'User likely checks app frequently',
      'May consider panic selling near -10%',
      'System should show reassuring messaging',
    ],
  },

  {
    testId: 'AN-V4-D1',
    profile: 'ANXIOUS_NOVICE',
    volatility: 'V4_FLASH_CRASH',
    cashIn: 'DCA_FIXED_MONTHLY',
    
    setup: {
      initialInvestment: 50_000_000,
      monthlyDCA: 0, // During 1-day event
    },
    
    expectedOutcome: {
      maxIntraDayLoss: { min: -2, max: -1 },   // Conservative allocation limits damage
      recoveryTime: 'same day',
      emotionalState: 'panicked',
    },
    
    assertions: [
      { check: 'cryptoLossExposure', expected: 'minimal' },
      { check: 'foundationStable', expected: true },
    ],
    
    behavioralNotes: [
      'User will likely see scary intraday numbers',
      'May call support',
      'Foundation layer provides stability',
    ],
  },

  {
    testId: 'AN-V8-D1',
    profile: 'ANXIOUS_NOVICE',
    volatility: 'V8_USDT_DEPEG',
    cashIn: 'DCA_FIXED_MONTHLY',
    
    setup: {
      initialInvestment: 50_000_000,
    },
    
    expectedOutcome: {
      portfolioLoss: { min: -15, max: -10 },   // Heavy USDT allocation hurts
      foundationLayerDamage: 'significant',
    },
    
    assertions: [
      { check: 'usdtExposure', expected: 'high' },
      { check: 'portfolioHealth', expected: 'Attention Required' },
    ],
    
    lessonsLearned: [
      'USDT concentration is a risk factor',
      'Diversification within Foundation matters',
      'Consider USDC/gold mix for stability',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // STEADY BUILDER TEST SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    testId: 'SB-V1-D1',
    profile: 'STEADY_BUILDER',
    volatility: 'V1_NORMAL',
    cashIn: 'DCA_FIXED_MONTHLY',
    
    setup: {
      initialInvestment: 200_000_000,
      monthlyDCA: 30_000_000,
      duration: '12 months',
    },
    
    expectedOutcome: {
      portfolioGrowth: { min: 15, max: 25 },
      totalInvested: 560_000_000,
      finalValue: { min: 640_000_000, max: 700_000_000 },
    },
    
    assertions: [
      { check: 'allocationMaintained', tolerance: 5 },
      { check: 'rebalanceEvents', expected: { min: 0, max: 2 } },
      { check: 'portfolioHealth', expected: 'Balanced' },
    ],
  },

  {
    testId: 'SB-V2-D1',
    profile: 'STEADY_BUILDER',
    volatility: 'V2_BULL_RUN',
    cashIn: 'DCA_FIXED_MONTHLY',
    
    setup: {
      initialInvestment: 200_000_000,
      monthlyDCA: 30_000_000,
      duration: '14 days',
    },
    
    expectedOutcome: {
      portfolioGrowth: { min: 18, max: 28 },
      upsideOverweight: true,
      rebalanceNeeded: true,
    },
    
    assertions: [
      { check: 'portfolioHealth', expected: 'Rebalance Needed' },
      { check: 'growthLayerPct', expected: { min: 38, max: 45 } },
      { check: 'upsideLayerPct', expected: { min: 18, max: 25 } },
    ],
    
    expectedActions: [
      'System suggests rebalancing',
      'User likely accepts rebalance',
      'Sell some Upside, buy Foundation',
    ],
  },

  {
    testId: 'SB-V3-D2',
    profile: 'STEADY_BUILDER',
    volatility: 'V3_CORRECTION',
    cashIn: 'DCA_VARIABLE',
    
    setup: {
      initialInvestment: 200_000_000,
      variableDCA: true,
      bonusAvailable: 80_000_000,
    },
    
    expectedOutcome: {
      portfolioLoss: { min: -18, max: -12 },
      dcaBenefit: 'Accumulating at lower prices',
      bonusDeployment: 'optimal timing',
    },
    
    assertions: [
      { check: 'portfolioHealth', expected: 'Rebalance Needed' },
      { check: 'emotionalState', expected: 'concerned but steady' },
    ],
    
    expectedActions: [
      'Continue DCA as planned',
      'Deploy bonus into dip (good timing)',
      'Rebalance to target allocation',
    ],
  },

  {
    testId: 'SB-V5-D1',
    profile: 'STEADY_BUILDER',
    volatility: 'V5_CRYPTO_WINTER',
    cashIn: 'DCA_FIXED_MONTHLY',
    
    setup: {
      initialInvestment: 200_000_000,
      monthlyDCA: 30_000_000,
      duration: '180 days',
    },
    
    expectedOutcome: {
      portfolioLoss: { min: -35, max: -25 },
      dcaBenefit: 'Significant accumulation at lows',
      recoveryPosition: 'Well positioned for next cycle',
    },
    
    assertions: [
      { check: 'totalInvested', expected: 380_000_000 }, // 200M + 6×30M
      { check: 'portfolioHealth', expected: 'Attention Required' },
    ],
    
    timeline: [
      { month: 0, portfolioValue: 200_000_000 },
      { month: 3, portfolioValue: 165_000_000, invested: 290_000_000 },
      { month: 6, portfolioValue: 145_000_000, invested: 380_000_000 },
    ],
    
    lessonsLearned: [
      'DCA smooths entry points significantly',
      'Paper losses ≠ realized losses',
      'Continue investing through downturns',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // AGGRESSIVE ACCUMULATOR TEST SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    testId: 'AA-V2-D3',
    profile: 'AGGRESSIVE_ACCUMULATOR',
    volatility: 'V2_BULL_RUN',
    cashIn: 'DCA_OPPORTUNISTIC',
    
    setup: {
      initialInvestment: 1_000_000_000,
      dipReserve: 500_000_000,
      monthlyDCA: 100_000_000,
      duration: '14 days',
    },
    
    expectedOutcome: {
      portfolioGrowth: { min: 35, max: 55 },
      peakValue: { min: 1_350_000_000, max: 1_550_000_000 },
      dipReserveStatus: 'unused',
    },
    
    assertions: [
      { check: 'upsideLayerGrowth', expected: { min: 40, max: 60 } },
      { check: 'rebalanceTriggered', expected: true },
      { check: 'portfolioHealth', expected: 'Rebalance Needed' },
    ],
    
    concerns: [
      'Upside overweight risk',
      'Timing of rebalance matters',
      'Bull run may reverse quickly',
    ],
  },

  {
    testId: 'AA-V3-D3',
    profile: 'AGGRESSIVE_ACCUMULATOR',
    volatility: 'V3_CORRECTION',
    cashIn: 'DCA_OPPORTUNISTIC',
    
    setup: {
      initialInvestment: 1_000_000_000,
      dipReserve: 500_000_000,
      dipThreshold: -10, // Deploy at -10%
    },
    
    expectedOutcome: {
      portfolioLoss: { min: -35, max: -25 },
      dipReserveDeployed: true,
      newPosition: 'Larger holdings at lower prices',
    },
    
    timeline: [
      { day: 0, portfolioValue: 1_000_000_000, action: 'Hold' },
      { day: 7, portfolioValue: 850_000_000, action: 'Deploy 200M dip reserve' },
      { day: 14, portfolioValue: 720_000_000, action: 'Deploy remaining 300M' },
      { day: 21, portfolioValue: 780_000_000, action: 'Hold (recovery begins)' },
    ],
    
    assertions: [
      { check: 'totalInvested', expected: 1_500_000_000 },
      { check: 'averageCostBasis', expected: 'lowered significantly' },
    ],
    
    postCorrectionAnalysis: {
      holdingsIncrease: '+30% more units',
      breakEvenPrice: 'Much lower than original entry',
      recoveryPotential: 'Enhanced',
    },
  },

  {
    testId: 'AA-V4-D3-LEVERAGED',
    profile: 'AGGRESSIVE_ACCUMULATOR',
    volatility: 'V4_FLASH_CRASH',
    cashIn: 'DCA_OPPORTUNISTIC',
    
    setup: {
      initialInvestment: 1_000_000_000,
      loans: [
        { collateral: 'BTC', amount: 200_000_000, initialLTV: 0.40 },
        { collateral: 'ETH', amount: 100_000_000, initialLTV: 0.30 },
      ],
      totalLeverage: '1.3x',
    },
    
    expectedOutcome: {
      maxDrawdown: { min: -35, max: -25 },
      loanStress: 'warning to critical',
      recoveryTime: 'same day',
    },
    
    hourlyTimeline: [
      { hour: 0, portfolioValue: 1_300_000_000, btcLTV: 40, ethLTV: 30 },
      { hour: 4, portfolioValue: 1_050_000_000, btcLTV: 52, ethLTV: 42 },
      { hour: 6, portfolioValue: 950_000_000, btcLTV: 58, ethLTV: 48, status: 'WARNING' },
      { hour: 12, portfolioValue: 1_150_000_000, btcLTV: 48, ethLTV: 38 },
      { hour: 24, portfolioValue: 1_250_000_000, btcLTV: 42, ethLTV: 32 },
    ],
    
    assertions: [
      { check: 'liquidationOccurred', expected: false },
      { check: 'maxLTVReached', expected: { btc: 58, eth: 48 } },
      { check: 'warningTriggered', expected: true },
    ],
    
    lessonsLearned: [
      'Leverage amplifies both gains and losses',
      'Flash crashes can trigger loan warnings rapidly',
      'LTV buffers are essential',
    ],
  },

  {
    testId: 'AA-V5-D3-LEVERAGED',
    profile: 'AGGRESSIVE_ACCUMULATOR',
    volatility: 'V5_CRYPTO_WINTER',
    cashIn: 'DCA_OPPORTUNISTIC',
    
    setup: {
      initialInvestment: 1_000_000_000,
      loans: [
        { collateral: 'BTC', amount: 200_000_000, initialLTV: 0.40 },
        { collateral: 'ETH', amount: 100_000_000, initialLTV: 0.30 },
      ],
    },
    
    expectedOutcome: {
      portfolioLoss: { min: -70, max: -55 },
      loanStatus: 'critical_multiple',
      liquidationRisk: 'very_high',
    },
    
    monthlyTimeline: [
      { month: 0, portfolioValue: 1_300_000_000, btcLTV: 40, ethLTV: 30 },
      { month: 2, portfolioValue: 900_000_000, btcLTV: 58, ethLTV: 45 },
      { month: 4, portfolioValue: 550_000_000, btcLTV: 85, ethLTV: 68, status: 'CRITICAL' },
      { month: 6, portfolioValue: 350_000_000, btcLTV: 'LIQUIDATED', ethLTV: 95 },
    ],
    
    assertions: [
      { check: 'btcLoanLiquidated', expected: true, timing: 'Month 4-5' },
      { check: 'ethLoanCritical', expected: true },
      { check: 'remainingEquity', expected: { min: 150_000_000, max: 250_000_000 } },
    ],
    
    lessonsLearned: [
      'Crypto winter + leverage = potential wipeout',
      'Always maintain margin of safety',
      'Consider de-leveraging when markets turn',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // WEALTH PRESERVER TEST SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    testId: 'WP-V1-D4',
    profile: 'WEALTH_PRESERVER',
    volatility: 'V1_NORMAL',
    cashIn: 'LUMP_SUM',
    
    setup: {
      initialInvestment: 2_000_000_000,
      monthlyDCA: 0, // Lump sum only
      duration: '12 months',
    },
    
    expectedOutcome: {
      portfolioGrowth: { min: 12, max: 18 },
      fixedIncomeYield: 138_000_000, // 600M × 23%
      goldAppreciation: { min: 2, max: 5 },
    },
    
    assertions: [
      { check: 'foundationLayerPct', expected: { min: 58, max: 62 } },
      { check: 'fixedIncomeAccrued', expected: { min: 130_000_000, max: 145_000_000 } },
      { check: 'portfolioHealth', expected: 'Balanced' },
    ],
    
    expectedHoldings: {
      USDT: 400,                    // ~582M IRR
      IRR_FIXED_INCOME: 600_000_000,
      GOLD: 150,                    // ~578M IRR (heavy gold)
      BTC: 0.5,                     // ~71M IRR
      QQQ: 50,                      // ~38M IRR
      ETH: 15,                      // ~70M IRR
      SOL: 100,                     // ~27M IRR
    },
  },

  {
    testId: 'WP-V5-D4',
    profile: 'WEALTH_PRESERVER',
    volatility: 'V5_CRYPTO_WINTER',
    cashIn: 'LUMP_SUM',
    
    setup: {
      initialInvestment: 2_000_000_000,
    },
    
    expectedOutcome: {
      portfolioLoss: { min: -8, max: -5 },  // Much less than aggressive
      cryptoImpact: 'minimal',
      goldHedge: 'appreciates',
      foundationIntact: true,
    },
    
    assertions: [
      { check: 'portfolioValue', expected: { min: 1_840_000_000, max: 1_950_000_000 } },
      { check: 'goldValueIncrease', expected: { min: 5, max: 12 } },
      { check: 'portfolioHealth', expected: 'Slightly Off' },
    ],
    
    comparison: {
      conservativePortfolio: '-6%',
      aggressivePortfolio: '-60%',
      preservationSuccess: true,
    },
  },

  {
    testId: 'WP-V6-D4',
    profile: 'WEALTH_PRESERVER',
    volatility: 'V6_GOLD_SURGE',
    cashIn: 'LUMP_SUM',
    
    setup: {
      initialInvestment: 2_000_000_000,
      goldAllocation: 30, // Heavy gold weighting
    },
    
    expectedOutcome: {
      portfolioGrowth: { min: 12, max: 18 },
      goldContribution: 'Primary driver',
      cryptoFlat: 'Minimal impact',
    },
    
    assertions: [
      { check: 'portfolioValue', expected: { min: 2_240_000_000, max: 2_360_000_000 } },
      { check: 'goldValueIncrease', expected: { min: 18, max: 22 } },
      { check: 'portfolioHealth', expected: 'Balanced' },
    ],
    
    analysis: {
      goldAllocationBenefit: 'Outsized returns',
      riskTaken: 'Low',
      idealScenario: true,
    },
  },

  {
    testId: 'WP-V7-D4',
    profile: 'WEALTH_PRESERVER',
    volatility: 'V7_IRR_DEVALUATION',
    cashIn: 'LUMP_SUM',
    
    setup: {
      initialInvestment: 2_000_000_000,
    },
    
    expectedOutcome: {
      portfolioIrrGrowth: { min: 20, max: 28 },
      usdValueFlat: true,
      fixedIncomeLoss: 'Real value eroded',
    },
    
    assertions: [
      { check: 'portfolioIrrValue', expected: { min: 2_400_000_000, max: 2_560_000_000 } },
      { check: 'portfolioUsdValue', expected: { stable: true } },
    ],
    
    analysis: {
      usdHedgeBenefit: 'Critical',
      fixedIncomeRisk: 'IRR-denominated loses real value',
      goldBenefit: 'Maintains international purchasing power',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SPECULATOR TEST SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    testId: 'SP-V2-D3-LEVERAGED',
    profile: 'SPECULATOR',
    volatility: 'V2_BULL_RUN',
    cashIn: 'DCA_OPPORTUNISTIC',
    
    setup: {
      initialInvestment: 500_000_000,
      loans: [
        { collateral: 'BTC', amount: 150_000_000, initialLTV: 0.45 },
        { collateral: 'ETH', amount: 80_000_000, initialLTV: 0.28 },
        { collateral: 'SOL', amount: 50_000_000, initialLTV: 0.28 },
      ],
      totalLeverage: '1.56x',
      loanUseOfFunds: 'Buy more UPSIDE',
    },
    
    expectedOutcome: {
      portfolioGrowth: { min: 80, max: 120 },
      peakValue: { min: 1_200_000_000, max: 1_500_000_000 },
      leverageAmplification: '1.8x returns',
    },
    
    assertions: [
      { check: 'totalExposure', expected: 780_000_000 },
      { check: 'ltvHealthAll', expected: 'healthy' },
      { check: 'portfolioHealth', expected: 'Rebalance Needed' },
    ],
    
    riskFactors: [
      'High leverage increases risk of margin calls on reversal',
      'Rebalancing requires loan consideration',
      'Timing exit is critical',
    ],
  },

  {
    testId: 'SP-V4-D3-LEVERAGED',
    profile: 'SPECULATOR',
    volatility: 'V4_FLASH_CRASH',
    cashIn: 'DCA_OPPORTUNISTIC',
    
    setup: {
      initialInvestment: 500_000_000,
      loans: [
        { collateral: 'BTC', amount: 150_000_000, initialLTV: 0.45 },
        { collateral: 'ETH', amount: 80_000_000, initialLTV: 0.28 },
        { collateral: 'SOL', amount: 50_000_000, initialLTV: 0.28 },
      ],
    },
    
    expectedOutcome: {
      maxDrawdown: { min: -45, max: -35 },
      multipleLoansCritical: true,
      recoveryDependent: 'Speed of market recovery',
    },
    
    hourlyTimeline: [
      { hour: 0, portfolioValue: 780_000_000, loans: 'healthy' },
      { hour: 4, portfolioValue: 550_000_000, loans: 'warning' },
      { hour: 6, portfolioValue: 450_000_000, loans: 'critical', liquidationRisk: 'imminent' },
      { hour: 12, portfolioValue: 600_000_000, loans: 'warning' },
      { hour: 24, portfolioValue: 720_000_000, loans: 'caution' },
    ],
    
    assertions: [
      { check: 'btcLTV_max', expected: { min: 75, max: 85 } },
      { check: 'ethLTV_max', expected: { min: 50, max: 60 } },
      { check: 'solLTV_max', expected: { min: 55, max: 65 } },
      { check: 'liquidationOccurred', expected: false, note: 'If recovery fast enough' },
    ],
    
    alternateScenario: {
      ifCrashLasted2Hours: {
        btcLiquidated: true,
        solLiquidated: true,
        remainingEquity: 200_000_000,
        totalLoss: '-74%',
      },
    },
  },

  {
    testId: 'SP-V5-D3-LEVERAGED',
    profile: 'SPECULATOR',
    volatility: 'V5_CRYPTO_WINTER',
    cashIn: 'DCA_OPPORTUNISTIC',
    
    setup: {
      initialInvestment: 500_000_000,
      loans: [
        { collateral: 'BTC', amount: 150_000_000, initialLTV: 0.45 },
        { collateral: 'ETH', amount: 80_000_000, initialLTV: 0.28 },
        { collateral: 'SOL', amount: 50_000_000, initialLTV: 0.28 },
      ],
    },
    
    expectedOutcome: {
      portfolioLoss: { min: -90, max: -80 },
      allLoansLiquidated: true,
      remainingEquity: { min: 50_000_000, max: 100_000_000 },
    },
    
    monthlyTimeline: [
      { month: 0, portfolioValue: 780_000_000, loans: 'healthy' },
      { month: 1, portfolioValue: 550_000_000, loans: 'warning' },
      { month: 2, portfolioValue: 380_000_000, loans: 'critical' },
      { month: 3, portfolioValue: 180_000_000, loans: 'liquidating' },
      { month: 4, portfolioValue: 80_000_000, loans: 'all_liquidated' },
    ],
    
    assertions: [
      { check: 'allLoansLiquidated', expected: true, timing: 'Month 3-4' },
      { check: 'remainingEquity', expected: { min: 50_000_000, max: 100_000_000 } },
      { check: 'totalLossPercent', expected: { min: 85, max: 95 } },
    ],
    
    lessonsLearned: [
      'Maximum leverage + extended bear market = near total loss',
      'Liquidation cascades wipe out equity quickly',
      'Never use leverage without stop-loss strategy',
      'Crypto winter is worst-case for leveraged positions',
    ],
  },
];


// ═══════════════════════════════════════════════════════════════════════════════
// PART 6: EDGE CASE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

const EDGE_CASE_TESTS = [
  
  {
    testId: 'E-001',
    title: 'Minimum Investment Through Maximum Volatility',
    
    setup: {
      initialInvestment: 1_000_000,  // Absolute minimum
      profile: 'ANXIOUS_NOVICE',
      volatility: 'V5_CRYPTO_WINTER',
    },
    
    expectedOutcome: {
      allocation: '100% FOUNDATION (likely all USDT)',
      cryptoExposure: 0,
      portfolioChange: '~0%',
    },
    
    assertions: [
      { check: 'portfolioProtected', expected: true },
      { check: 'cryptoLossExposure', expected: 0 },
      { check: 'fixedIncomeOption', expected: false, note: 'Below minimum' },
    ],
    
    purpose: 'Verify system handles minimum amounts gracefully',
  },

  {
    testId: 'E-002',
    title: 'Whale Investment + Flash Crash',
    
    setup: {
      initialInvestment: 5_000_000_000,  // 5B IRR whale
      profile: 'WEALTH_PRESERVER',
      volatility: 'V4_FLASH_CRASH',
    },
    
    expectedOutcome: {
      maxDrawdown: { min: -8, max: -5 },
      goldHedge: 'appreciates during crash',
      recoveryTime: 'same day',
    },
    
    concerns: [
      'Execution slippage on large orders',
      'Market impact if rebalancing',
      'Loan liquidation cascade risk (if leveraged)',
    ],
    
    assertions: [
      { check: 'executionComplete', expected: true },
      { check: 'slippage', expected: { max: 2 } },  // %
    ],
    
    purpose: 'Verify system handles large portfolios during volatility',
  },

  {
    testId: 'E-003',
    title: 'All Loans at Max LTV + Correction',
    
    setup: {
      profile: 'SPECULATOR',
      initialPortfolio: 500_000_000,
      loans: [
        { collateral: 'BTC', amount: 'max_ltv' },  // 50% of BTC value
        { collateral: 'ETH', amount: 'max_ltv' },  // 30% of ETH value
        { collateral: 'SOL', amount: 'max_ltv' },  // 30% of SOL value
      ],
      volatility: 'V3_CORRECTION',
    },
    
    expectedOutcome: {
      multipleLoans: 'critical',
      liquidationSequence: ['SOL first', 'ETH second', 'BTC last'],
      remainingEquity: 'severely diminished',
    },
    
    assertions: [
      { check: 'solLoanLiquidated', expected: true },
      { check: 'ethLoanLiquidated', expected: true },
      { check: 'btcLoanCritical', expected: true },
    ],
    
    lessonsLearned: [
      'Never max out all LTVs simultaneously',
      'Maintain buffer for volatility',
      'Stagger loan maturities',
    ],
    
    purpose: 'Verify liquidation cascade handling',
  },

  {
    testId: 'E-004',
    title: 'Protection Expires During Crash',
    
    setup: {
      profile: 'STEADY_BUILDER',
      protectedAsset: 'BTC',
      protectionExpiry: 'Day 5',
      volatility: 'V3_CORRECTION',
      correctionTiming: 'Day 7 onwards',
    },
    
    expectedOutcome: {
      day1to5: 'Protected, no downside',
      day6onwards: 'Unprotected, full exposure',
      totalLoss: 'Higher than if protection remained',
    },
    
    assertions: [
      { check: 'protectionPayoutBeforeExpiry', expected: 0 },
      { check: 'exposureAfterExpiry', expected: 'full' },
    ],
    
    userExperience: [
      'System should warn about expiring protection',
      'Suggest renewal before expiry',
      'Show impact of non-renewal',
    ],
    
    purpose: 'Verify protection expiry handling and user warnings',
  },

  {
    testId: 'E-005',
    title: 'Rebalance with All Assets Frozen',
    
    setup: {
      profile: 'AGGRESSIVE_ACCUMULATOR',
      loans: [
        { collateral: 'BTC', amount: 150_000_000 },
        { collateral: 'ETH', amount: 100_000_000 },
        { collateral: 'SOL', amount: 50_000_000 },
      ],
      frozenAssets: ['BTC', 'ETH', 'SOL'],  // All collateral frozen
      unfrozenAssets: ['TON', 'GOLD'],       // Only these can move
    },
    
    expectedOutcome: {
      rebalanceScope: 'Very limited',
      achievableRebalance: { max: 10 },  // Only 10% of portfolio can move
      userGuidance: 'Repay loans to unlock assets for rebalancing',
    },
    
    assertions: [
      { check: 'frozenAssetsUntouched', expected: true },
      { check: 'rebalancePartial', expected: true },
      { check: 'userWarningShown', expected: true },
    ],
    
    purpose: 'Verify rebalance logic with constrained assets',
  },

  {
    testId: 'E-006',
    title: 'IRR Devaluation + Fixed Income Heavy Portfolio',
    
    setup: {
      profile: 'WEALTH_PRESERVER',
      initialInvestment: 2_000_000_000,
      fixedIncomeAllocation: 40,  // 800M IRR in fixed income
      volatility: 'V7_IRR_DEVALUATION',
    },
    
    expectedOutcome: {
      fixedIncomeLoss: 'Real purchasing power eroded by 25%',
      usdAssetGain: 'IRR value up 25%',
      netPortfolioChange: 'Mixed',
    },
    
    assertions: [
      { check: 'fixedIncomeRealValueLoss', expected: { min: 20, max: 30 } },
      { check: 'usdAssetsIrrGain', expected: { min: 20, max: 30 } },
    ],
    
    analysis: {
      fixedIncomeRisk: 'Currency-specific, not diversified',
      mitigation: 'Reduce IRR-denominated fixed income in favor of USD assets',
    },
    
    purpose: 'Verify currency risk exposure in fixed income',
  },

  {
    testId: 'E-007',
    title: 'Consecutive Flash Crashes (Double Dip)',
    
    setup: {
      profile: 'SPECULATOR',
      volatility: 'V4_FLASH_CRASH_DOUBLE',  // Two crashes in one week
      crashTiming: ['Day 1', 'Day 5'],
      recoveryBetween: 'Partial (80%)',
    },
    
    priceSequence: [
      { day: 0, BTC: 97500 },
      { day: 1, BTC: 78000 },  // Crash 1 bottom
      { day: 2, BTC: 88000 },
      { day: 4, BTC: 92000 },  // Partial recovery
      { day: 5, BTC: 74000 },  // Crash 2 bottom
      { day: 7, BTC: 85000 },  // Stabilization
    ],
    
    expectedOutcome: {
      totalDrawdown: { min: -28, max: -22 },
      loanStress: 'critical_both_events',
      liquidationRisk: 'very_high_second_crash',
    },
    
    assertions: [
      { check: 'secondCrashWorse', expected: true, note: 'Less buffer after first' },
      { check: 'liquidationDuringSecond', expected: 'possible' },
    ],
    
    purpose: 'Verify system handles consecutive volatility events',
  },

  {
    testId: 'E-008',
    title: 'Zero Cash + Rebalance Suggestion',
    
    setup: {
      profile: 'STEADY_BUILDER',
      cashBalance: 0,
      portfolioDrift: 15,  // Needs rebalancing
      frozenAssets: ['BTC'],  // Some assets locked
    },
    
    expectedOutcome: {
      rebalanceCapability: 'Partial only',
      cashNeededForFull: 50_000_000,
      userOptions: ['Add funds', 'Partial rebalance', 'Repay loan'],
    },
    
    assertions: [
      { check: 'smartRebalanceSuggestion', expected: true },
      { check: 'addFundsPrompt', expected: true },
      { check: 'partialRebalanceAvailable', expected: true },
    ],
    
    purpose: 'Verify smart rebalance with cash constraints',
  },
];


// ═══════════════════════════════════════════════════════════════════════════════
// PART 7: VERIFICATION CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════════

const VERIFICATION_CHECKLIST = {
  
  portfolioCalculations: [
    { item: 'Total value calculates correctly', automated: true },
    { item: 'Layer percentages sum to 100%', automated: true },
    { item: 'Holdings multiply correctly (quantity × price × FX)', automated: true },
    { item: 'Fixed income accrual is accurate (23% annual)', automated: true },
    { item: 'IRR/USD conversion uses current FX rate', automated: true },
  ],
  
  loanSystem: [
    { item: 'LTV calculates correctly', automated: true },
    { item: 'Health levels trigger at right thresholds', automated: true },
    { item: 'Liquidation warnings appear appropriately', automated: true },
    { item: 'Frozen assets cannot be sold', automated: true },
    { item: 'Loan interest accrues correctly', automated: true },
    { item: 'Collateral value updates with price changes', automated: true },
  ],
  
  rebalancing: [
    { item: 'Trade directions are correct (buy/sell)', automated: true },
    { item: 'Frozen assets are skipped', automated: true },
    { item: 'Cash remains untouched during rebalance', automated: true },
    { item: 'Post-rebalance allocation closer to target', automated: true },
    { item: 'Smart rebalance cash option works', automated: true },
  ],
  
  protections: [
    { item: 'Premium deducted from cash correctly', automated: true },
    { item: 'Days remaining counts down accurately', automated: true },
    { item: 'Expiration handled gracefully', automated: true },
    { item: 'Strike price locks at purchase', automated: true },
  ],
  
  uiux: [
    { item: 'All colors follow monochrome design', manual: true },
    { item: 'No layer-specific colored elements', manual: true },
    { item: 'Loading states appear correctly', manual: true },
    { item: 'Error messages are clear and actionable', manual: true },
    { item: 'Persian text renders correctly', manual: true },
    { item: 'Number formatting uses correct locale', automated: true },
  ],
  
  edgeCases: [
    { item: 'Minimum investment amounts work', automated: true },
    { item: 'Maximum (whale) investments work', automated: true },
    { item: 'Zero balance states handled', automated: true },
    { item: 'All assets frozen state handled', automated: true },
    { item: 'Network timeout recovery works', manual: true },
  ],
};


// ═══════════════════════════════════════════════════════════════════════════════
// PART 8: TEST RUNNER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const TEST_RUNNER_CONFIG = {
  
  // Test execution settings
  execution: {
    parallelTests: false,         // Run tests sequentially for clarity
    verboseLogging: true,
    screenshotOnFailure: true,
    videoRecording: false,
    timeout: 30000,               // 30 seconds per test
  },
  
  // Price simulation settings
  priceSimulation: {
    updateInterval: 1000,         // 1 second
    volatilityMultiplier: 1.0,    // Adjust for stress testing
    randomSeed: 12345,            // For reproducibility
  },
  
  // User behavior simulation
  behaviorSimulation: {
    decisionDelay: 500,           // ms between actions
    panicThreshold: -10,          // Trigger panic behavior
    fomoThreshold: 20,            // Trigger FOMO behavior
  },
  
  // Reporting
  reporting: {
    outputFormat: 'json',
    includeScreenshots: true,
    includePerformanceMetrics: true,
    outputPath: './test-results/',
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Constants
  BASELINE_PRICES,
  BASELINE_PRICES_IRR,
  FX_RATES,
  
  // Core test dimensions
  VOLATILITY_SCENARIOS,
  USER_PROFILES,
  CASH_IN_PATTERNS,
  
  // Test cases
  TEST_MATRIX,
  EDGE_CASE_TESTS,
  
  // Configuration
  VERIFICATION_CHECKLIST,
  TEST_RUNNER_CONFIG,
  
  // Helpers
  toIRR,
};


// ═══════════════════════════════════════════════════════════════════════════════
// END OF FILE
// ═══════════════════════════════════════════════════════════════════════════════
