goi# Blu Markets PRD v6.0
## Complete Business Logic Specification

**Version:** 6.0  
**Date:** January 2026  
**Status:** Implementation Reference  
**Source:** Extracted from React Web App Codebase

---

# PART A: PRODUCT OVERVIEW

## 1. Executive Summary

Blu Markets is an investment platform for Iranian users providing:
- **Three-Layer Portfolio Model**: Foundation (stability), Growth (balanced), Upside (conviction)
- **Risk-Based Personalization**: 9-question questionnaire → 10 risk levels → personalized allocations
- **15-Asset Universe**: Stablecoins, precious metals, fixed income, crypto, ETFs
- **Smart Rebalancing**: HRAM algorithm for intra-layer asset weighting
- **Integrated Services**: Loans against holdings, downside protection

---

# PART B: RISK PROFILING SYSTEM

## 2. Questionnaire Structure

### 2.1 Dimensions and Weights

| Dimension | Weight | Questions |
|-----------|--------|-----------|
| **Capacity** | 40% | q_income, q_buffer, q_proportion |
| **Willingness** | 35% | q_crash_20, q_tradeoff, q_past_behavior, q_max_loss |
| **Horizon** | 15% | q_horizon |
| **Goal** | 10% | q_goal |

### 2.2 Questions Detail

```json
{
  "q_income": {
    "text_fa": "درآمدت چقدر قابل پیش‌بینیه؟",
    "text_en": "How predictable is your income?",
    "dimension": "capacity",
    "weight": 1.0,
    "options": [
      { "id": "inc_fixed", "score": 8, "text": "Fixed and reliable" },
      { "id": "inc_mostly", "score": 6, "text": "Mostly stable" },
      { "id": "inc_variable", "score": 4, "text": "Variable" },
      { "id": "inc_uncertain", "score": 1, "text": "Uncertain or unemployed" }
    ]
  },
  "q_buffer": {
    "text_fa": "بدون این پول، چند ماه می‌تونی خرج زندگیت رو بدی؟",
    "text_en": "Without this money, how many months can you cover expenses?",
    "dimension": "capacity",
    "weight": 1.2,
    "options": [
      { "id": "buf_12plus", "score": 10, "text": "More than 12 months" },
      { "id": "buf_6_12", "score": 7, "text": "6 to 12 months" },
      { "id": "buf_3_6", "score": 4, "text": "3 to 6 months" },
      { "id": "buf_under3", "score": 1, "text": "Less than 3 months" }
    ]
  },
  "q_proportion": {
    "text_fa": "این پول چند درصد از کل دارایی‌هاته؟",
    "text_en": "What percentage of your total wealth is this?",
    "dimension": "capacity",
    "weight": 1.3,
    "options": [
      { "id": "prop_small", "score": 10, "text": "Less than 25%" },
      { "id": "prop_medium", "score": 6, "text": "25% to 50%" },
      { "id": "prop_large", "score": 3, "text": "50% to 75%" },
      { "id": "prop_most", "score": 1, "text": "More than 75%", "flag": "high_proportion" }
    ]
  },
  "q_goal": {
    "text_fa": "هدف اصلیت از این سرمایه‌گذاری چیه؟",
    "dimension": "goal",
    "weight": 1.0,
    "options": [
      { "id": "goal_preserve", "score": 2, "text": "Preserve value against inflation" },
      { "id": "goal_income", "score": 4, "text": "Steady income" },
      { "id": "goal_grow", "score": 7, "text": "Long-term growth" },
      { "id": "goal_maximize", "score": 10, "text": "Maximum returns (high risk OK)" }
    ]
  },
  "q_horizon": {
    "text_fa": "کِی ممکنه بخوای این پول رو برداری؟",
    "dimension": "horizon",
    "weight": 1.0,
    "hard_caps": {
      "hz_1year": 3,
      "hz_1_3": 5
    },
    "options": [
      { "id": "hz_1year", "score": 1, "text": "Less than 1 year" },
      { "id": "hz_1_3", "score": 4, "text": "1 to 3 years" },
      { "id": "hz_3_7", "score": 7, "text": "3 to 7 years" },
      { "id": "hz_7plus", "score": 10, "text": "More than 7 years" }
    ]
  },
  "q_crash_20": {
    "text_fa": "فرض کن ۳ ماه بعد از سرمایه‌گذاری، ارزش پورتفوت ۲۰٪ کم شده. چیکار می‌کنی؟",
    "dimension": "willingness",
    "weight": 2.0,
    "options": [
      { "id": "crash_sell_all", "score": 1, "text": "Sell everything", "flag": "panic_seller" },
      { "id": "crash_sell_some", "score": 3, "text": "Sell some, keep rest" },
      { "id": "crash_hold", "score": 6, "text": "Wait for recovery" },
      { "id": "crash_buy", "score": 9, "text": "Buy more", "flag": "check_capacity" }
    ]
  },
  "q_tradeoff": {
    "text_fa": "کدوم رو ترجیح میدی؟",
    "dimension": "willingness",
    "weight": 1.5,
    "options": [
      { "id": "trade_safe", "score": 2, "text": "Guaranteed 20% annual" },
      { "id": "trade_moderate", "score": 5, "text": "50% chance of +40% or -10%" },
      { "id": "trade_risky", "score": 8, "text": "50% chance of +80% or -25%" },
      { "id": "trade_yolo", "score": 10, "text": "50% chance of +150% or -50%", "flag": "gambler" }
    ]
  },
  "q_past_behavior": {
    "text_fa": "آخرین باری که یه سرمایه‌گذاریت افت کرد، چه حسی داشتی؟",
    "dimension": "willingness",
    "weight": 1.0,
    "options": [
      { "id": "past_panic", "score": 1, "text": "Very stressed, couldn't sleep" },
      { "id": "past_worried", "score": 4, "text": "Worried but managed" },
      { "id": "past_calm", "score": 7, "text": "Relatively calm" },
      { "id": "past_none", "score": 5, "text": "No experience", "flag": "inexperienced" }
    ]
  },
  "q_max_loss": {
    "text_fa": "حداکثر چند درصد افت رو می‌تونی تحمل کنی بدون اینکه بفروشی؟",
    "dimension": "willingness",
    "weight": 1.5,
    "options": [
      { "id": "loss_5", "score": 1, "text": "5% — no more" },
      { "id": "loss_15", "score": 4, "text": "15% — hurts but OK" },
      { "id": "loss_30", "score": 7, "text": "30% — tough but I'll wait" },
      { "id": "loss_50", "score": 10, "text": "50%+ — I think long-term", "flag": "check_capacity" }
    ]
  }
}
```

## 3. Risk Scoring Algorithm

### 3.1 Conservative Dominance Rule

```typescript
function calculateFinalRisk(answers, questionnaire): RiskResult {
  // Step 1: Calculate sub-scores
  const C = weightedAverage(answers, CAPACITY_QUESTIONS);    // Capacity
  const W = weightedAverage(answers, WILLINGNESS_QUESTIONS); // Willingness
  const H = answers['q_horizon'].score;                      // Horizon
  const G = answers['q_goal'].score;                         // Goal

  // Step 2: Apply CONSERVATIVE DOMINANCE RULE
  // Final = min(Capacity, Willingness)
  let rawScore = Math.min(C, W);
  const limitingFactor = C < W ? 'capacity' : 'willingness';

  // Step 3: Apply horizon hard caps
  const horizonCap = getHorizonCap(answers['q_horizon']);
  if (horizonCap !== null) {
    rawScore = Math.min(rawScore, horizonCap);
  }

  // Step 4: Apply consistency penalties
  // If claims 30%+ loss tolerance but would panic sell at -20%
  if (answers['q_crash_20'].score <= 2 && answers['q_max_loss'].score >= 7) {
    rawScore -= 1; // Penalty for inconsistency
  }

  // Step 5: Apply pathological user caps
  if (flags.includes('panic_seller')) {
    rawScore = Math.min(rawScore, 3);  // Hard cap at 3
  }
  if (flags.includes('gambler') && flags.includes('high_proportion')) {
    rawScore = Math.min(rawScore, 5);  // Hard cap at 5
  }
  if (flags.includes('inexperienced') && flags.includes('gambler')) {
    rawScore = Math.min(rawScore, 5);  // Dangerous novice cap
  }

  // Step 6: Clamp to valid range
  const finalScore = Math.max(1, Math.min(10, Math.round(rawScore)));

  return {
    score: finalScore,
    profile: PROFILES[finalScore],
    allocation: ALLOCATIONS[finalScore]
  };
}
```

### 3.2 Score-to-Allocation Mapping

| Score | Profile (EN) | Profile (FA) | Foundation | Growth | Upside |
|-------|--------------|--------------|------------|--------|--------|
| 1 | Capital Preservation | حفظ سرمایه | 85% | 12% | 3% |
| 2 | Capital Preservation | حفظ سرمایه | 80% | 15% | 5% |
| 3 | Conservative | محتاط | 70% | 25% | 5% |
| 4 | Conservative | محتاط | 65% | 30% | 5% |
| 5 | Balanced | متعادل | 55% | 35% | 10% |
| 6 | Balanced | متعادل | 50% | 35% | 15% |
| 7 | Growth | رشدگرا | 45% | 38% | 17% |
| 8 | Growth | رشدگرا | 40% | 40% | 20% |
| 9 | Aggressive | جسور | 35% | 40% | 25% |
| 10 | Aggressive | جسور | 30% | 40% | 30% |

### 3.3 Pathological User Detection

| Pattern | Flags Required | Action | Max Score |
|---------|----------------|--------|-----------|
| Panic Seller | `panic_seller` | hard_cap_3 | 3 |
| Gambler + High Stakes | `gambler` + `high_proportion` | hard_cap_5 | 5 |
| Gambler alone | `gambler` | cap_willingness_7 | W≤7 |
| Dangerous Novice | `inexperienced` + `gambler` | hard_cap_5 | 5 |

---

# PART C: ASSET CONFIGURATION

## 4. 15-Asset Universe

### 4.1 Complete Asset Registry

```typescript
const ASSETS_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════
  // FOUNDATION LAYER — Capital Preservation
  // ═══════════════════════════════════════════════════════════════════════

  USDT: {
    id: 'USDT',
    name: 'US Dollar',
    layer: 'FOUNDATION',
    category: 'stablecoin',
    source: 'coingecko',
    coingeckoId: 'tether',
    defaultPrice: 1.00,
    currency: 'USD',
    layerWeight: 0.40,        // 40% of Foundation layer
    baseVolatility: 0.01,
    maxLTV: 90,               // 90% LTV for loans
    liquidityScore: 1.00,
    protectionEligible: false,
  },

  PAXG: {
    id: 'PAXG',
    name: 'Gold',
    layer: 'FOUNDATION',
    category: 'gold',
    source: 'coingecko',
    coingeckoId: 'pax-gold',
    defaultPrice: 2650,
    currency: 'USD',
    layerWeight: 0.30,        // 30% of Foundation layer
    baseVolatility: 0.12,
    maxLTV: 70,
    liquidityScore: 0.85,
    protectionEligible: true,
  },

  IRR_FIXED_INCOME: {
    id: 'IRR_FIXED_INCOME',
    name: 'Fixed Income',
    layer: 'FOUNDATION',
    category: 'fixed_income',
    source: 'internal',
    unitPrice: 500_000,       // 500,000 IRR per unit
    annualRate: 0.30,         // 30% annual yield
    currency: 'IRR',
    layerWeight: 0.30,        // 30% of Foundation layer
    baseVolatility: 0.05,
    maxLTV: 0,                // Cannot borrow against
    liquidityScore: 0.60,
    protectionEligible: false,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // GROWTH LAYER — Balanced Progress
  // ═══════════════════════════════════════════════════════════════════════

  BTC: {
    id: 'BTC',
    name: 'Bitcoin',
    layer: 'GROWTH',
    category: 'crypto_large',
    source: 'coingecko',
    coingeckoId: 'bitcoin',
    defaultPrice: 97500,
    currency: 'USD',
    layerWeight: 0.25,        // 25% of Growth layer
    baseVolatility: 0.45,
    maxLTV: 50,
    liquidityScore: 0.98,
    protectionEligible: true,
  },

  ETH: {
    id: 'ETH',
    name: 'Ethereum',
    layer: 'GROWTH',
    category: 'crypto_large',
    source: 'coingecko',
    coingeckoId: 'ethereum',
    defaultPrice: 3200,
    currency: 'USD',
    layerWeight: 0.20,        // 20% of Growth layer
    baseVolatility: 0.55,
    maxLTV: 50,
    liquidityScore: 0.97,
    protectionEligible: true,
  },

  BNB: {
    id: 'BNB',
    name: 'Binance Coin',
    layer: 'GROWTH',
    category: 'crypto_large',
    source: 'coingecko',
    coingeckoId: 'binancecoin',
    defaultPrice: 680,
    currency: 'USD',
    layerWeight: 0.15,        // 15% of Growth layer
    baseVolatility: 0.50,
    maxLTV: 50,
    liquidityScore: 0.95,
    protectionEligible: true,
  },

  XRP: {
    id: 'XRP',
    name: 'Ripple',
    layer: 'GROWTH',
    category: 'crypto_large',
    source: 'coingecko',
    coingeckoId: 'ripple',
    defaultPrice: 2.20,
    currency: 'USD',
    layerWeight: 0.10,        // 10% of Growth layer
    baseVolatility: 0.60,
    maxLTV: 45,
    liquidityScore: 0.94,
    protectionEligible: true,
  },

  KAG: {
    id: 'KAG',
    name: 'Silver',
    layer: 'GROWTH',
    category: 'silver',
    source: 'coingecko',
    coingeckoId: 'kinesis-silver',
    defaultPrice: 30,
    currency: 'USD',
    layerWeight: 0.15,        // 15% of Growth layer
    baseVolatility: 0.18,
    maxLTV: 60,
    liquidityScore: 0.75,
    protectionEligible: false,
  },

  QQQ: {
    id: 'QQQ',
    name: 'NASDAQ 100',
    layer: 'GROWTH',
    category: 'equity_etf',
    source: 'finnhub',
    symbol: 'QQQ',
    defaultPrice: 521,
    currency: 'USD',
    layerWeight: 0.15,        // 15% of Growth layer
    baseVolatility: 0.20,
    maxLTV: 60,
    liquidityScore: 0.90,
    protectionEligible: true,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // UPSIDE LAYER — Bounded Conviction
  // ═══════════════════════════════════════════════════════════════════════

  SOL: {
    id: 'SOL',
    name: 'Solana',
    layer: 'UPSIDE',
    category: 'alt_l1',
    source: 'coingecko',
    coingeckoId: 'solana',
    defaultPrice: 185,
    currency: 'USD',
    layerWeight: 0.20,        // 20% of Upside layer
    baseVolatility: 0.75,
    maxLTV: 30,
    liquidityScore: 0.92,
    protectionEligible: true,
  },

  TON: {
    id: 'TON',
    name: 'TON Coin',
    layer: 'UPSIDE',
    category: 'alt_l1',
    source: 'coingecko',
    coingeckoId: 'the-open-network',
    defaultPrice: 5.20,
    currency: 'USD',
    layerWeight: 0.18,        // 18% of Upside layer
    baseVolatility: 0.65,
    maxLTV: 30,
    liquidityScore: 0.85,
    protectionEligible: false,
  },

  LINK: {
    id: 'LINK',
    name: 'Chainlink',
    layer: 'UPSIDE',
    category: 'infrastructure',
    source: 'coingecko',
    coingeckoId: 'chainlink',
    defaultPrice: 22,
    currency: 'USD',
    layerWeight: 0.18,        // 18% of Upside layer
    baseVolatility: 0.60,
    maxLTV: 35,
    liquidityScore: 0.90,
    protectionEligible: true,
  },

  AVAX: {
    id: 'AVAX',
    name: 'Avalanche',
    layer: 'UPSIDE',
    category: 'alt_l1',
    source: 'coingecko',
    coingeckoId: 'avalanche-2',
    defaultPrice: 35,
    currency: 'USD',
    layerWeight: 0.16,        // 16% of Upside layer
    baseVolatility: 0.70,
    maxLTV: 30,
    liquidityScore: 0.88,
    protectionEligible: true,
  },

  MATIC: {
    id: 'MATIC',
    name: 'Polygon',
    layer: 'UPSIDE',
    category: 'l2',
    source: 'coingecko',
    coingeckoId: 'matic-network',
    defaultPrice: 0.45,
    currency: 'USD',
    layerWeight: 0.14,        // 14% of Upside layer
    baseVolatility: 0.65,
    maxLTV: 30,
    liquidityScore: 0.88,
    protectionEligible: false,
  },

  ARB: {
    id: 'ARB',
    name: 'Arbitrum',
    layer: 'UPSIDE',
    category: 'l2',
    source: 'coingecko',
    coingeckoId: 'arbitrum',
    defaultPrice: 0.80,
    currency: 'USD',
    layerWeight: 0.14,        // 14% of Upside layer
    baseVolatility: 0.70,
    maxLTV: 30,
    liquidityScore: 0.85,
    protectionEligible: false,
  },
};
```

### 4.2 Intra-Layer Weight Summary

| Layer | Asset | Weight | Sum |
|-------|-------|--------|-----|
| **FOUNDATION** | USDT | 40% | |
| | PAXG | 30% | |
| | IRR_FIXED_INCOME | 30% | **100%** |
| **GROWTH** | BTC | 25% | |
| | ETH | 20% | |
| | BNB | 15% | |
| | XRP | 10% | |
| | KAG | 15% | |
| | QQQ | 15% | **100%** |
| **UPSIDE** | SOL | 20% | |
| | TON | 18% | |
| | LINK | 18% | |
| | AVAX | 16% | |
| | MATIC | 14% | |
| | ARB | 14% | **100%** |

---

# PART D: PORTFOLIO CONSTRUCTION

## 5. Initial Portfolio Building Algorithm

```typescript
function buildInitialHoldings(
  totalIRR: number,
  targetLayerPct: TargetLayerPct,
  prices: Record<string, number>,
  fxRate: number,
  createdAt: string
): Holding[] {
  
  // Initialize all 15 assets with zero quantity
  const holdings: Holding[] = ASSETS.map(assetId => ({
    assetId,
    quantity: 0,
    purchasedAt: assetId === 'IRR_FIXED_INCOME' ? createdAt : undefined,
    frozen: false,
  }));

  const holdingsById = Object.fromEntries(holdings.map(h => [h.assetId, h]));

  for (const layer of ['FOUNDATION', 'GROWTH', 'UPSIDE']) {
    // Calculate target IRR for this layer
    const pct = targetLayerPct[layer] / 100;
    const targetLayerIRR = Math.round(totalIRR * pct);
    
    const weights = WEIGHTS[layer];  // e.g., { BTC: 0.25, ETH: 0.20, ... }
    const layerAssets = Object.keys(weights);

    // Phase 1: Initial allocation
    for (const assetId of layerAssets) {
      const h = holdingsById[assetId];
      const assetAmountIRR = Math.round(targetLayerIRR * weights[assetId]);

      if (assetId === 'IRR_FIXED_INCOME') {
        // Fixed income: quantity = IRR / unit_price
        h.quantity = assetAmountIRR / FIXED_INCOME_UNIT_PRICE;
      } else {
        // Crypto/ETF: quantity = IRR / (priceUSD × fxRate)
        const priceUSD = prices[assetId];
        h.quantity = assetAmountIRR / (priceUSD * fxRate);
      }
    }

    // Phase 2: Reconciliation - adjust last asset to hit exact target
    let actualLayerIRR = 0;
    for (const assetId of layerAssets) {
      actualLayerIRR += computeHoldingIRR(assetId, holdingsById[assetId].quantity, prices, fxRate);
    }

    const gapIRR = targetLayerIRR - actualLayerIRR;
    if (Math.abs(gapIRR) > 1) {
      // Find last adjustable asset (prefer non-fixed-income)
      const adjustAssetId = layerAssets.filter(a => a !== 'IRR_FIXED_INCOME').pop() || layerAssets.pop();
      const h = holdingsById[adjustAssetId];
      
      if (adjustAssetId === 'IRR_FIXED_INCOME') {
        h.quantity += gapIRR / FIXED_INCOME_UNIT_PRICE;
      } else {
        h.quantity += gapIRR / (prices[adjustAssetId] * fxRate);
      }
    }
  }

  return holdings;
}
```

### 5.1 Example: Portfolio Construction

**Input:**
- Investment: 100,000,000 IRR
- Profile: Balanced (Score 6)
- Target: Foundation 50%, Growth 35%, Upside 15%
- FX Rate: 1,456,000 IRR/USD

**Output:**

| Layer | Asset | Layer % | Weight | Budget (IRR) | Quantity |
|-------|-------|---------|--------|--------------|----------|
| FOUNDATION | USDT | 50% | 40% | 20,000,000 | 13.74 USDT |
| | PAXG | 50% | 30% | 15,000,000 | 0.00389 oz |
| | IRR_FIXED_INCOME | 50% | 30% | 15,000,000 | 30 units |
| GROWTH | BTC | 35% | 25% | 8,750,000 | 0.0000617 BTC |
| | ETH | 35% | 20% | 7,000,000 | 0.00150 ETH |
| | BNB | 35% | 15% | 5,250,000 | 0.00531 BNB |
| | XRP | 35% | 10% | 3,500,000 | 1.093 XRP |
| | KAG | 35% | 15% | 5,250,000 | 0.120 oz |
| | QQQ | 35% | 15% | 5,250,000 | 0.00692 shares |
| UPSIDE | SOL | 15% | 20% | 3,000,000 | 0.01115 SOL |
| | TON | 15% | 18% | 2,700,000 | 0.357 TON |
| | LINK | 15% | 18% | 2,700,000 | 0.0844 LINK |
| | AVAX | 15% | 16% | 2,400,000 | 0.0471 AVAX |
| | MATIC | 15% | 14% | 2,100,000 | 3.21 MATIC |
| | ARB | 15% | 14% | 2,100,000 | 1.80 ARB |

---

# PART E: INTRA-LAYER BALANCING (HRAM)

## 6. Hybrid Risk-Adjusted Momentum Algorithm

### 6.1 Formula

```typescript
Weight[i] = normalize(
  RiskParityWeight × MomentumFactor × CorrelationFactor × LiquidityFactor
)
```

### 6.2 Factor Calculations

```typescript
// 1. Risk Parity Weight (inverse volatility)
const riskParityWeight = (1 / volatility) / totalInverseVolatility;

// 2. Momentum Factor
const momentum = (currentPrice - sma50) / sma50;  // Range: -1 to 1
const momentumFactor = 1 + (momentum * MOMENTUM_STRENGTH);
// MOMENTUM_STRENGTH = 0.3 (default)

// 3. Correlation Factor
const avgCorrelation = averageCorrelationWithOtherAssets;
const correlationFactor = 1 - (avgCorrelation * CORRELATION_PENALTY);
// CORRELATION_PENALTY = 0.2 (default)

// 4. Liquidity Factor
const liquidityFactor = 1 + (liquidityScore * LIQUIDITY_BONUS);
// LIQUIDITY_BONUS = 0.1 (default)
```

### 6.3 Strategy Presets

| Strategy | Momentum Strength | Correlation Penalty | Min Weight | Max Weight |
|----------|-------------------|---------------------|------------|------------|
| EQUAL_WEIGHT | 0 | 0 | 5% | 50% |
| RISK_PARITY | 0 | 0 | 5% | 40% |
| MOMENTUM_TILT | 0.5 | 0.1 | 5% | 35% |
| MAX_DIVERSIFICATION | 0.1 | 0.4 | 10% | 30% |
| **BALANCED** (default) | 0.3 | 0.2 | 5% | 40% |
| CONSERVATIVE | 0.1 | 0.3 | 10% | 35% |
| AGGRESSIVE | 0.5 | 0.1 | 5% | 50% |

### 6.4 Balancer Configuration

```typescript
const BALANCER_CONFIG = {
  MIN_WEIGHT: 0.05,                    // 5% minimum per asset
  MAX_WEIGHT: 0.40,                    // 40% maximum per asset
  MOMENTUM_STRENGTH: 0.3,              // Default momentum influence
  CORRELATION_PENALTY: 0.2,            // Default correlation penalty
  LIQUIDITY_BONUS: 0.1,                // Bonus for liquid assets
  VOLATILITY_WINDOW: 30,               // Days for volatility calculation
  MOMENTUM_WINDOW: 50,                 // Days for momentum SMA
  CORRELATION_WINDOW: 60,              // Days for correlation calculation
  DRIFT_THRESHOLD: 0.05,               // 5% triggers normal rebalance
  EMERGENCY_DRIFT_THRESHOLD: 0.10,     // 10% triggers immediate rebalance
  MIN_REBALANCE_INTERVAL_DAYS: 1,      // 1 day between rebalances
  MIN_TRADE_VALUE_IRR: 100_000,        // Skip trades < 100,000 IRR
};
```

---

# PART F: REBALANCING SYSTEM

## 7. Rebalancing Algorithm

### 7.1 Rebalance Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| **HOLDINGS_ONLY** | Sell overweight, buy underweight | Default mode |
| **HOLDINGS_PLUS_CASH** | Use all available cash | User opts in |
| **SMART** | Optimal combination of holdings + specified cash | Advanced mode |

### 7.2 Layer-Level Rebalancing

```typescript
function previewRebalance(state, { mode, useCashAmount, prices, fxRate }) {
  const snap = computeSnapshot(state.holdings, state.cashIRR, prices, fxRate);
  const holdingsTotal = snap.holdingsIRR;

  // Calculate target IRR per layer
  const targetIRR = {
    FOUNDATION: (state.targetLayerPct.FOUNDATION / 100) * holdingsTotal,
    GROWTH: (state.targetLayerPct.GROWTH / 100) * holdingsTotal,
    UPSIDE: (state.targetLayerPct.UPSIDE / 100) * holdingsTotal,
  };

  // Calculate surpluses and deficits
  const surpluses = {};
  const deficits = {};
  for (const layer of LAYERS) {
    const diff = snap.layerIRR[layer] - targetIRR[layer];
    if (diff > 0) surpluses[layer] = diff;
    else if (diff < 0) deficits[layer] = Math.abs(diff);
  }

  // Determine movable amount (respect frozen collateral)
  const totalSurplus = sum(Object.values(surpluses));
  const totalDeficit = sum(Object.values(deficits));
  const amountToMove = Math.min(totalSurplus, totalDeficit);

  // Execute sells from overweight layers (pro-rata within layer)
  executeSells(surpluses, totalSurplus, amountToMove, sellableByLayer);

  // Execute buys into underweight layers (using HRAM weights)
  executeBuys(deficits, totalDeficit, amountToMove, holdingsByLayer, intraLayerWeights);

  // If SMART mode, deploy additional cash
  if (mode === 'SMART' && useCashAmount > 0) {
    // Recalculate targets with expanded portfolio
    // Buy into underweight layers with cash
  }
}
```

### 7.3 Intra-Layer Trade Execution

```typescript
// SELLS: Pro-rata from each asset based on current value
function executeSells(surpluses, totalSurplus, amountToMove, sellableByLayer) {
  for (const layer of Object.keys(surpluses)) {
    const toSell = surpluses[layer] / totalSurplus * amountToMove;
    const assets = sellableByLayer[layer];
    const layerTotal = sum(assets.map(h => h.valueIRR));
    
    for (const h of assets) {
      const proportion = h.valueIRR / layerTotal;
      const sellAmount = toSell * proportion;
      h.quantity -= sellAmount / (priceUSD * fxRate);
    }
  }
}

// BUYS: According to HRAM weights
function executeBuys(deficits, totalDeficit, amountToAllocate, holdingsByLayer, weights) {
  for (const layer of Object.keys(deficits)) {
    const layerBuy = deficits[layer] / totalDeficit * amountToAllocate;
    const layerWeights = weights[layer];  // From HRAM calculation
    
    for (const h of holdingsByLayer[layer]) {
      const assetWeight = layerWeights[h.assetId];
      const buyAmount = layerBuy * assetWeight;
      h.quantity += buyAmount / (priceUSD * fxRate);
    }
  }
}
```

### 7.4 Gap Analysis (Locked Collateral Handling)

```typescript
interface GapAnalysis {
  hasFrozenAssets: boolean;
  frozenByLayer: Record<Layer, number>;
  currentPct: TargetLayerPct;
  achievablePct: Record<Layer, number>;         // Best possible with HOLDINGS_ONLY
  remainingGapPct: number;                       // Total drift after rebalance
  gapByLayer: Record<Layer, number>;
  canAchievePerfectBalance: boolean;
  canAchieveWithCash: boolean;
  cashNeededForPerfectBalance: number;
  currentCash: number;
  cashSufficient: boolean;
  cashShortfall: number;
  cashWouldHelp: boolean;
  partialCashBenefit: number;
}
```

---

# PART G: TRADING RULES

## 8. Trade Validation

### 8.1 Trade Constraints

```typescript
const TRADE_RULES = {
  MIN_TRADE_IRR: 100_000,              // Minimum trade amount
  MIN_REBALANCE_TRADE: 100_000,        // Minimum trade in rebalance
};

function validateTrade({ side, assetId, amountIRR }, state) {
  // 1. Amount validation
  if (amountIRR < MIN_TRADE_IRR) return fail('INVALID_AMOUNT');
  
  // 2. Asset validation
  const holding = state.holdings.find(h => h.assetId === assetId);
  if (!holding) return fail('INVALID_ASSET');
  
  // 3. BUY validation
  if (side === 'BUY') {
    if (state.cashIRR < amountIRR) return fail('INSUFFICIENT_CASH');
  }
  
  // 4. SELL validation
  if (side === 'SELL') {
    if (holding.frozen) return fail('ASSET_FROZEN');
    const holdingValueIRR = getHoldingValueIRR(holding, prices, fxRate);
    if (holdingValueIRR < amountIRR) return fail('INSUFFICIENT_ASSET_VALUE');
  }
  
  return ok();
}
```

### 8.2 Trade Spread by Layer

| Layer | Spread | Range |
|-------|--------|-------|
| FOUNDATION | 0.15% | 0.1% - 0.2% |
| GROWTH | 0.30% | 0.2% - 0.4% |
| UPSIDE | 0.60% | 0.4% - 0.8% |

### 8.3 Trade Execution

```typescript
function previewTrade({ side, assetId, amountIRR, prices, fxRate }) {
  const h = holdings.find(x => x.assetId === assetId);
  
  let quantityChange;
  if (assetId === 'IRR_FIXED_INCOME') {
    quantityChange = amountIRR / FIXED_INCOME_UNIT_PRICE;
  } else {
    quantityChange = amountIRR / (prices[assetId] * fxRate);
  }

  if (side === 'BUY') {
    cashIRR -= amountIRR;
    h.quantity += quantityChange;
  } else {  // SELL
    h.quantity = Math.max(0, h.quantity - quantityChange);
    cashIRR += amountIRR;
  }
}
```

---

# PART H: BOUNDARY CLASSIFICATION

## 9. Trade Impact Assessment

### 9.1 Classification Algorithm

```typescript
function classifyActionBoundary({ kind, before, after, targetLayerPct }) {
  const beforeStatus = computePortfolioStatus(before.layerPct, targetLayerPct);
  const afterStatus = computePortfolioStatus(after.layerPct, targetLayerPct);

  // Special cases
  if (kind === 'REBALANCE') {
    const improved = afterStatus.issues.length < beforeStatus.issues.length;
    return improved ? 'SAFE' : 'STRUCTURAL';
  }
  
  if (kind === 'ADD_FUNDS') return 'SAFE';

  // General classification
  if (afterStatus.status === 'ATTENTION_REQUIRED') return 'STRUCTURAL';
  if (afterStatus.status === 'SLIGHTLY_OFF') return 'DRIFT';
  return 'SAFE';
}
```

### 9.2 Portfolio Status Calculation

```typescript
const DRIFT_TOLERANCE = 5;  // 5% tolerance

function computePortfolioStatus(layerPct, targetLayerPct) {
  const issues = [];

  // Check drift from target
  for (const layer of LAYERS) {
    const drift = Math.abs(layerPct[layer] - targetLayerPct[layer]);
    if (drift > DRIFT_TOLERANCE) {
      issues.push(`${layer}_${layerPct[layer] < targetLayerPct[layer] ? 'BELOW' : 'ABOVE'}_TARGET`);
    }
  }

  // Check hard limits
  if (layerPct.FOUNDATION < LAYER_RANGES.FOUNDATION.hardMin) {  // < 30%
    issues.push('FOUNDATION_BELOW_HARD_FLOOR');
    return { status: 'ATTENTION_REQUIRED', issues };
  }
  if (layerPct.UPSIDE > LAYER_RANGES.UPSIDE.hardMax) {  // > 25%
    issues.push('UPSIDE_ABOVE_HARD_CAP');
    return { status: 'ATTENTION_REQUIRED', issues };
  }

  if (issues.length) return { status: 'SLIGHTLY_OFF', issues };
  return { status: 'BALANCED', issues: [] };
}
```

### 9.3 Layer Health Ranges

| Layer | Min Target | Max Target | Hard Min | Hard Max |
|-------|------------|------------|----------|----------|
| FOUNDATION | 40% | 70% | 30% | - |
| GROWTH | 20% | 45% | - | - |
| UPSIDE | 0% | 20% | - | 25% |

### 9.4 Boundary Friction UI

| Boundary | Friction Level | UI Treatment |
|----------|----------------|--------------|
| SAFE | None | Green badge, one-tap confirm |
| DRIFT | Low | Amber badge, warning text |
| STRUCTURAL | Medium | Orange badge, expand to see impact |
| STRESS | High | Red badge, "I understand" checkbox |

---

# PART I: LOAN SYSTEM

## 10. Loan Business Rules

### 10.1 LTV Limits by Layer

| Layer | Max LTV | Assets |
|-------|---------|--------|
| FOUNDATION | 70% | USDT, PAXG |
| GROWTH | 50% | BTC, ETH, BNB, XRP, KAG, QQQ |
| UPSIDE | 30% | SOL, TON, LINK, AVAX, MATIC, ARB |

**Note:** IRR_FIXED_INCOME has 0% LTV (cannot borrow against).

### 10.2 Loan Constraints

```typescript
const LOAN_RULES = {
  MIN_LOAN_IRR: 1_000_000,             // 1M IRR minimum
  MAX_PORTFOLIO_LOAN_PCT: 0.25,        // 25% of total portfolio
  INTEREST_RATE: 0.30,                 // 30% annual (simple interest)
  DURATION_OPTIONS: [3, 6],            // 3 or 6 months
  INSTALLMENT_COUNT: 6,                // 6 equal installments
};
```

### 10.3 Loan Creation

```typescript
function previewBorrow({ assetId, amountIRR, durationMonths = 3 }) {
  const h = holdings.find(x => x.assetId === assetId);
  const layer = ASSET_LAYER[assetId];
  const ltv = COLLATERAL_LTV_BY_LAYER[layer];

  // Mark collateral as frozen
  h.frozen = true;

  // Add loan amount to cash
  cashIRR += amountIRR;

  // Generate 6-installment schedule
  const installments = generateInstallments(amountIRR, startDate, durationMonths);

  // Create loan record
  loans.push({
    id: `loan_${timestamp}`,
    amountIRR,
    originalAmountIRR: amountIRR,
    collateralAssetId: assetId,
    collateralQuantity: h.quantity,
    ltv,
    interestRate: LOAN_INTEREST_RATE,
    liquidationIRR: amountIRR,  // Liquidate if collateral value < loan
    startISO: today,
    dueISO: maturityDate,
    durationMonths,
    status: 'ACTIVE',
    installments,
    installmentsPaid: 0,
    totalPaidIRR: 0,
    totalInterestIRR: sum(installments.map(i => i.interestIRR)),
  });
}
```

### 10.4 Installment Schedule Generation

```typescript
function generateInstallments(principalIRR, startISO, durationMonths) {
  const INSTALLMENT_COUNT = 6;
  
  // Calculate total interest for full term
  const totalInterest = Math.floor(principalIRR * LOAN_INTEREST_RATE * (durationMonths / 12));
  
  // Equal principal + interest per installment
  const principalPerInstallment = Math.floor(principalIRR / INSTALLMENT_COUNT);
  const interestPerInstallment = Math.floor(totalInterest / INSTALLMENT_COUNT);
  
  // Days between installments
  const totalDays = durationMonths * 30;
  const daysPerInstallment = Math.floor(totalDays / INSTALLMENT_COUNT);
  
  const installments = [];
  for (let i = 0; i < INSTALLMENT_COUNT; i++) {
    const dueDate = addDays(startDate, daysPerInstallment * (i + 1));
    const isLast = i === INSTALLMENT_COUNT - 1;
    
    installments.push({
      number: i + 1,
      dueISO: dueDate,
      principalIRR: isLast ? remainder : principalPerInstallment,
      interestIRR: isLast ? interestRemainder : interestPerInstallment,
      totalIRR: principal + interest,
      status: 'PENDING',
      paidIRR: 0,
    });
  }
  
  return installments;
}
```

### 10.5 Loan Calculations

```typescript
function useLoanCalculations(loan) {
  // Time calculations
  const daysElapsed = Math.ceil((now - startMs) / 86400000);
  const daysRemaining = Math.ceil((maturityMs - now) / 86400000);
  const progressPct = (daysElapsed / totalDays) * 100;

  // Interest calculations
  const dailyRate = LOAN_INTEREST_RATE / 365;
  const accruedInterest = Math.floor(loan.amountIRR * dailyRate * daysElapsed);
  const fullTermInterest = Math.floor(loan.amountIRR * dailyRate * totalDays);
  const interestForgiveness = fullTermInterest - accruedInterest;
  
  // Settlement amount (early payoff)
  const settlementAmount = loan.amountIRR + accruedInterest;
  
  // Total at maturity
  const totalAtMaturity = loan.amountIRR + Math.floor(loan.amountIRR * (LOAN_INTEREST_RATE / 12) * durationMonths);

  return {
    daysRemaining,
    daysElapsed,
    progressPct,
    accruedInterest,
    fullTermInterest,
    interestForgiveness,
    settlementAmount,
    totalAtMaturity,
    nextInstallmentAmount,
    pendingInstallmentCount,
  };
}
```

### 10.6 Repayment

```typescript
function previewRepay({ loanId, amountIRR }) {
  const loan = loans.find(l => l.id === loanId);
  const repay = Math.min(amountIRR, cashIRR, loan.amountIRR + loan.accruedInterestIRR);

  cashIRR -= repay;
  loan.totalPaidIRR += repay;

  // Update installment statuses
  let remaining = loan.totalPaidIRR;
  let paidCount = 0;
  
  loan.installments = loan.installments.map(inst => {
    if (remaining >= inst.totalIRR) {
      remaining -= inst.totalIRR;
      paidCount++;
      return { ...inst, status: 'PAID', paidIRR: inst.totalIRR };
    } else if (remaining > 0) {
      const partial = remaining;
      remaining = 0;
      return { ...inst, status: 'PARTIAL', paidIRR: partial };
    }
    return inst;
  });

  loan.installmentsPaid = paidCount;
  loan.amountIRR = Math.max(0, loan.amountIRR - repay);

  // If fully repaid, release collateral
  if (loan.amountIRR <= 0) {
    const collateral = holdings.find(h => h.assetId === loan.collateralAssetId);
    collateral.frozen = false;
    loans = loans.filter(l => l.id !== loanId);
  }
}
```

### 10.7 Loan Validation

```typescript
function validateBorrow({ assetId, amountIRR, prices, fxRate }, state) {
  const h = state.holdings.find(x => x.assetId === assetId);
  
  // 1. Asset must exist and not be frozen
  if (!h) return fail('INVALID_ASSET');
  if (h.frozen) return fail('ASSET_ALREADY_FROZEN');
  
  // 2. Check asset-level LTV limit
  const layer = ASSET_LAYER[assetId];
  const maxLtv = COLLATERAL_LTV_BY_LAYER[layer];
  const holdingValueIRR = getHoldingValueIRR(h, prices, fxRate);
  const maxBorrowAsset = Math.floor(holdingValueIRR * maxLtv);
  
  if (amountIRR > maxBorrowAsset) {
    return fail('EXCEEDS_MAX_BORROW', { maxBorrow: maxBorrowAsset });
  }
  
  // 3. Check portfolio-level 25% limit
  const totalPortfolioIRR = state.cashIRR + sum(state.holdings.map(h => getHoldingValueIRR(h)));
  const existingLoansIRR = sum(state.loans.map(l => l.amountIRR));
  const maxTotalLoans = Math.floor(totalPortfolioIRR * MAX_TOTAL_LOAN_PCT);
  const remainingCapacity = maxTotalLoans - existingLoansIRR;
  
  if (amountIRR > remainingCapacity) {
    return fail('EXCEEDS_PORTFOLIO_LOAN_LIMIT', { remainingCapacity });
  }
  
  return ok({ maxBorrow: Math.min(maxBorrowAsset, remainingCapacity) });
}
```

---

# PART J: PROTECTION SYSTEM

## 11. Downside Protection Rules

### 11.1 Protection Eligibility

| Layer | Eligible Assets |
|-------|-----------------|
| FOUNDATION | PAXG only |
| GROWTH | BTC, ETH, BNB, XRP, QQQ |
| UPSIDE | SOL, LINK, AVAX |

**Not Eligible:** USDT, IRR_FIXED_INCOME, KAG, TON, MATIC, ARB

### 11.2 Premium Rates by Layer

| Layer | Monthly Rate |
|-------|--------------|
| FOUNDATION | 0.4% |
| GROWTH | 0.8% |
| UPSIDE | 1.2% |

### 11.3 Premium Calculation

```typescript
function calcPremiumIRR({ assetId, notionalIRR, months }) {
  const layer = ASSET_LAYER[assetId];
  const monthlyRate = PREMIUM_RATES[layer];
  return Math.floor(notionalIRR * monthlyRate * months);
}

// Example:
// BTC holding worth 50,000,000 IRR
// 3 months protection
// Layer: GROWTH (0.8% monthly)
// Premium = 50,000,000 × 0.008 × 3 = 1,200,000 IRR
```

### 11.4 Duration Options

```typescript
const PROTECTION_DURATIONS = [1, 3, 6];  // months
const PROTECTION_MIN_MONTHS = 1;
const PROTECTION_MAX_MONTHS = 6;
```

### 11.5 Protection Validation

```typescript
function validateProtect({ assetId, months, prices, fxRate }, state) {
  const h = state.holdings.find(x => x.assetId === assetId);
  
  // 1. Asset must exist
  if (!h) return fail('INVALID_ASSET');
  
  // 2. Asset must be eligible (has liquid derivatives market)
  if (!PROTECTION_ELIGIBLE_ASSETS.includes(assetId)) {
    return fail('ASSET_NOT_ELIGIBLE_FOR_PROTECTION');
  }
  
  // 3. Duration must be valid
  if (months < 1 || months > 6) return fail('INVALID_MONTHS');
  
  // 4. Holding must have value
  const holdingValueIRR = getHoldingValueIRR(h, prices, fxRate);
  if (holdingValueIRR <= 0) return fail('NO_NOTIONAL');
  
  // 5. No existing active protection
  const existingProtection = state.protections.find(p => 
    p.assetId === assetId && p.endTimeMs > Date.now()
  );
  if (existingProtection) return fail('ASSET_ALREADY_PROTECTED');
  
  // 6. Sufficient cash for premium
  const premium = calcPremiumIRR({ assetId, notionalIRR: holdingValueIRR, months });
  if (premium > state.cashIRR) {
    return fail('INSUFFICIENT_CASH_FOR_PREMIUM', { required: premium });
  }
  
  return ok({ notionalIRR: holdingValueIRR });
}
```

### 11.6 Protection Cancellation

- User can cancel protection at any time
- **No refund** of premium (premium covers the coverage period)
- Protection immediately becomes inactive

---

# PART K: FIXED INCOME CALCULATIONS

## 12. IRR Fixed Income Model

### 12.1 Configuration

```typescript
const FIXED_INCOME_CONFIG = {
  UNIT_PRICE: 500_000,     // 500,000 IRR per unit
  ANNUAL_RATE: 0.30,       // 30% annual yield
  INTEREST_TYPE: 'simple', // Simple interest (Iranian bank practice)
};
```

### 12.2 Value Calculation

```typescript
function calculateFixedIncomeValue(quantity, purchasedAt) {
  const principal = quantity * FIXED_INCOME_UNIT_PRICE;
  
  if (!purchasedAt) {
    return { principal, accrued: 0, total: principal };
  }
  
  const daysHeld = (Date.now() - new Date(purchasedAt)) / (1000 * 60 * 60 * 24);
  
  // Simple interest: P × r × (days/365)
  const accrued = Math.round(principal * FIXED_INCOME_ANNUAL_RATE * (daysHeld / 365));
  
  // Daily rate for display
  const dailyRate = principal * FIXED_INCOME_ANNUAL_RATE / 365;
  
  return {
    principal,
    accrued,
    total: principal + accrued,
    daysHeld: Math.floor(daysHeld),
    dailyRate: Math.round(dailyRate),
  };
}
```

### 12.3 Conversion Functions

```typescript
// IRR to Fixed Income units (for buying)
function irrToFixedIncomeUnits(amountIRR) {
  return amountIRR / FIXED_INCOME_UNIT_PRICE;
}

// Fixed Income units to IRR (for selling/display)
function fixedIncomeUnitsToIRR(units) {
  return units * FIXED_INCOME_UNIT_PRICE;
}
```

### 12.4 Example Calculation

**Scenario:** User holds 100 units of Fixed Income for 90 days

```
Principal = 100 × 500,000 = 50,000,000 IRR
Accrued = 50,000,000 × 0.30 × (90/365) = 3,698,630 IRR
Total Value = 53,698,630 IRR
Daily Rate = 50,000,000 × 0.30 / 365 = 41,096 IRR/day
```

---

# PART L: GLOBAL CONSTANTS

## 13. Configuration Reference

### 13.1 Application Stages

```typescript
const STAGES = {
  WELCOME: 'WELCOME',
  ONBOARDING_PHONE: 'ONBOARDING_PHONE',
  ONBOARDING_QUESTIONNAIRE: 'ONBOARDING_QUESTIONNAIRE',
  ONBOARDING_RESULT: 'ONBOARDING_RESULT',
  AMOUNT_REQUIRED: 'AMOUNT_REQUIRED',
  PORTFOLIO_CREATED: 'PORTFOLIO_CREATED',
  ACTIVE: 'ACTIVE',
};
```

### 13.2 Thresholds

```typescript
const THRESHOLDS = {
  MIN_AMOUNT_IRR: 1_000_000,          // 1M IRR minimum investment
  MIN_TRADE_IRR: 100_000,             // 100K IRR minimum trade
  DRIFT_TOLERANCE: 5,                  // 5% drift triggers status change
  PROTECTION_MIN_MONTHS: 1,
  PROTECTION_MAX_MONTHS: 6,
};
```

### 13.3 FX Rate

```typescript
const DEFAULT_FX_RATE = 1_456_000;  // 1 USD = 1,456,000 IRR
```

### 13.4 Error Messages

```typescript
const ERROR_MESSAGES = {
  INVALID_AMOUNT: 'Please enter a valid amount.',
  INVALID_ASSET: 'Invalid asset selected.',
  INSUFFICIENT_CASH: 'Not enough cash available.',
  INVALID_SIDE: 'Invalid trade side.',
  INSUFFICIENT_ASSET_VALUE: 'Not enough of this asset to sell.',
  ASSET_FROZEN: 'Asset is locked as loan collateral.',
  INVALID_MONTHS: 'Duration must be 1-6 months.',
  NO_NOTIONAL: 'Asset has no value to protect.',
  ASSET_ALREADY_PROTECTED: 'Asset already has active protection.',
  INSUFFICIENT_CASH_FOR_PREMIUM: 'Not enough cash for premium.',
  ASSET_NOT_ELIGIBLE_FOR_PROTECTION: 'Asset not eligible for protection.',
  ASSET_ALREADY_FROZEN: 'Asset already used as collateral.',
  EXCEEDS_MAX_BORROW: 'Exceeds maximum LTV for this asset.',
  EXCEEDS_PORTFOLIO_LOAN_LIMIT: 'Total loans cannot exceed 25% of portfolio.',
  NO_ACTIVE_LOAN: 'No active loan to repay.',
  NO_CASH: 'No cash available.',
  INVALID_MODE: 'Invalid rebalance mode.',
};
```

---

# PART M: CONSENT REQUIREMENTS

## 14. User Consent

### 14.1 Consent Text (Exact Match Required)

**Persian:**
```
متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم.
```

**English:**
```
I understand the risk of this portfolio and I agree with it.
```

### 14.2 Checkbox Consent (Alternative)

Three checkboxes, all required:
1. `riskAcknowledged` - Risk understanding
2. `lossAcknowledged` - Potential loss acknowledgment  
3. `noGuaranteeAcknowledged` - No guarantee acknowledgment

---

# APPENDIX A: TYPE DEFINITIONS

```typescript
type Layer = 'FOUNDATION' | 'GROWTH' | 'UPSIDE';
type AssetId = 'USDT' | 'PAXG' | 'IRR_FIXED_INCOME' | 'BTC' | 'ETH' | 'BNB' | 'XRP' | 'KAG' | 'QQQ' | 'SOL' | 'TON' | 'LINK' | 'AVAX' | 'MATIC' | 'ARB';
type TradeSide = 'BUY' | 'SELL';
type RebalanceMode = 'HOLDINGS_ONLY' | 'HOLDINGS_PLUS_CASH' | 'SMART';
type Boundary = 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';
type PortfolioStatus = 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';
type StrategyPreset = 'EQUAL_WEIGHT' | 'RISK_PARITY' | 'MOMENTUM_TILT' | 'MAX_DIVERSIFICATION' | 'BALANCED' | 'CONSERVATIVE' | 'AGGRESSIVE';

interface TargetLayerPct {
  FOUNDATION: number;
  GROWTH: number;
  UPSIDE: number;
}

interface Holding {
  assetId: AssetId;
  quantity: number;
  purchasedAt?: string;  // ISO date for fixed income accrual
  frozen: boolean;       // True if used as loan collateral
}

interface Loan {
  id: string;
  amountIRR: number;
  originalAmountIRR: number;
  collateralAssetId: AssetId;
  collateralQuantity: number;
  ltv: number;
  interestRate: number;
  liquidationIRR: number;
  startISO: string;
  dueISO: string;
  durationMonths: 3 | 6;
  status: 'ACTIVE' | 'SETTLED';
  installments: LoanInstallment[];
  installmentsPaid: number;
  totalPaidIRR: number;
  totalInterestIRR: number;
}

interface Protection {
  id: string;
  assetId: AssetId;
  notionalIRR: number;
  premiumIRR: number;
  durationMonths: number;
  startISO: string;
  endISO: string;
  startTimeMs: number;
  endTimeMs: number;
}
```

---

**Document Version History:**
- v5.0: Initial PRD
- v6.0: Complete business logic extracted from React Web App implementation
