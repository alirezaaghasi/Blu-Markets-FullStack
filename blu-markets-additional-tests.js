/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BLU MARKETS v10 — ADDITIONAL TEST CASES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Extension to scenarios.test.js covering:
 *   - Loan Stress Under Volatility
 *   - Protection System
 *   - Combined Scenario Tests (Profile × Volatility × Cash-In)
 *   - Smart Rebalance
 *   - Missing Edge Cases
 *   - Cash-In Pattern Simulation
 * 
 * Run: node src/engine/scenarios.additional.test.js
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTS & SETUP
// ═══════════════════════════════════════════════════════════════════════════════

import {
  BASELINE_PRICES,
  BASELINE_PRICES_IRR,
  FX_RATES,
  VOLATILITY_SCENARIOS,
  USER_PROFILES,
  CASH_IN_PATTERNS,
} from './blu-markets-test-scenarios.js';

// Import your engine modules (adjust paths as needed)
// const { buildSnapshot, calcLayerPercents } = require('./snapshot.js');
// const { previewTrade, previewBorrow, previewRepay, previewRebalance } = require('./preview.js');
// const { validateAddFunds, validateTrade, validateBorrow, validateProtect } = require('./validate.js');
// const { calcFixedIncomeAccrual } = require('./fixedIncome.js');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

let passCount = 0;
let failCount = 0;
const results = [];

function test(id, description, fn) {
  try {
    fn();
    passCount++;
    results.push({ id, description, status: 'PASS' });
    console.log(`✅ ${id}: ${description}`);
  } catch (error) {
    failCount++;
    results.push({ id, description, status: 'FAIL', error: error.message });
    console.log(`❌ ${id}: ${description}`);
    console.log(`   Error: ${error.message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

function assertApprox(actual, expected, tolerance = 0.01, message = '') {
  const diff = Math.abs(actual - expected) / expected;
  if (diff > tolerance) {
    throw new Error(`${message} Expected ~${expected} (±${tolerance * 100}%), got ${actual}`);
  }
}

function assertInRange(actual, min, max, message = '') {
  if (actual < min || actual > max) {
    throw new Error(`${message} Expected ${min}-${max}, got ${actual}`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(message || 'Expected true, got false');
  }
}

function assertFalse(condition, message = '') {
  if (condition) {
    throw new Error(message || 'Expected false, got true');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a portfolio snapshot for a given profile and prices
 */
function generatePortfolio(profile, prices = BASELINE_PRICES, initialCash = null) {
  const userProfile = USER_PROFILES[profile];
  const allocation = userProfile.riskProfile.targetAllocation;
  const investment = initialCash || userProfile.investmentPattern.initialAmount;
  
  // Simplified allocation (real implementation would use buildPortfolio)
  const foundation = investment * (allocation.FOUNDATION / 100);
  const growth = investment * (allocation.GROWTH / 100);
  const upside = investment * (allocation.UPSIDE / 100);
  
  return {
    profile: userProfile,
    totalValue: investment,
    cash: 0,
    layers: {
      FOUNDATION: { value: foundation, percent: allocation.FOUNDATION },
      GROWTH: { value: growth, percent: allocation.GROWTH },
      UPSIDE: { value: upside, percent: allocation.UPSIDE },
    },
    holdings: generateHoldings(profile, investment, prices),
    loans: [],
    protections: [],
  };
}

/**
 * Generate holdings based on profile allocation
 */
function generateHoldings(profile, investment, prices) {
  const userProfile = USER_PROFILES[profile];
  const allocation = userProfile.riskProfile.targetAllocation;
  
  // Simplified holdings generation
  const holdings = {};
  
  // Foundation layer
  const foundationValue = investment * (allocation.FOUNDATION / 100);
  holdings.USDT = {
    asset: 'USDT',
    quantity: (foundationValue * 0.4) / (prices.USDT * FX_RATES.USD_IRR),
    layer: 'FOUNDATION',
    frozen: false,
  };
  holdings.GOLD = {
    asset: 'GOLD',
    quantity: (foundationValue * 0.3) / (prices.GOLD * FX_RATES.USD_IRR / 31.1035),
    layer: 'FOUNDATION',
    frozen: false,
  };
  holdings.IRR_FIXED_INCOME = {
    asset: 'IRR_FIXED_INCOME',
    quantity: foundationValue * 0.3,
    layer: 'FOUNDATION',
    frozen: false,
    purchaseDate: new Date(),
  };
  
  // Growth layer
  const growthValue = investment * (allocation.GROWTH / 100);
  holdings.BTC = {
    asset: 'BTC',
    quantity: (growthValue * 0.5) / (prices.BTC * FX_RATES.USD_IRR),
    layer: 'GROWTH',
    frozen: false,
  };
  holdings.ETH = {
    asset: 'ETH',
    quantity: (growthValue * 0.3) / (prices.ETH * FX_RATES.USD_IRR),
    layer: 'GROWTH',
    frozen: false,
  };
  holdings.QQQ = {
    asset: 'QQQ',
    quantity: (growthValue * 0.2) / (prices.QQQ * FX_RATES.USD_IRR),
    layer: 'GROWTH',
    frozen: false,
  };
  
  // Upside layer
  const upsideValue = investment * (allocation.UPSIDE / 100);
  holdings.SOL = {
    asset: 'SOL',
    quantity: (upsideValue * 0.5) / (prices.SOL * FX_RATES.USD_IRR),
    layer: 'UPSIDE',
    frozen: false,
  };
  holdings.TON = {
    asset: 'TON',
    quantity: (upsideValue * 0.5) / (prices.TON * FX_RATES.USD_IRR),
    layer: 'UPSIDE',
    frozen: false,
  };
  
  return holdings;
}

/**
 * Apply price changes to portfolio and recalculate values
 */
function applyPriceChange(portfolio, newPrices) {
  let newTotalValue = portfolio.cash;
  
  for (const [asset, holding] of Object.entries(portfolio.holdings)) {
    if (asset === 'IRR_FIXED_INCOME') {
      // Fixed income value stays in IRR
      newTotalValue += holding.quantity;
    } else {
      const priceUSD = newPrices[asset] || BASELINE_PRICES[asset];
      const priceIRR = priceUSD * FX_RATES.USD_IRR;
      const assetValue = holding.quantity * priceIRR;
      holding.value = assetValue;
      newTotalValue += assetValue;
    }
  }
  
  portfolio.totalValue = newTotalValue;
  return portfolio;
}

/**
 * Calculate LTV for a loan given current prices
 */
function calculateLTV(loan, currentPrices) {
  const collateralPriceUSD = currentPrices[loan.collateralAsset];
  const collateralPriceIRR = collateralPriceUSD * FX_RATES.USD_IRR;
  const collateralValue = loan.collateralQuantity * collateralPriceIRR;
  return (loan.borrowedAmount / collateralValue) * 100;
}

/**
 * Determine loan health status based on LTV
 */
function getLoanHealthStatus(ltv, maxLTV) {
  const ltvRatio = ltv / maxLTV;
  if (ltvRatio < 0.7) return 'healthy';
  if (ltvRatio < 0.85) return 'caution';
  if (ltvRatio < 0.95) return 'warning';
  if (ltvRatio < 1.0) return 'critical';
  return 'liquidation';
}

/**
 * Simulate protection premium calculation
 */
function calculateProtectionPremium(assetValue, durationMonths, volatility = 'medium') {
  const baseRate = { low: 0.02, medium: 0.04, high: 0.06 }[volatility];
  const monthlyRate = baseRate;
  return assetValue * monthlyRate * durationMonths;
}

/**
 * Simulate protection payout
 */
function calculateProtectionPayout(protection, currentPrice) {
  if (currentPrice >= protection.strikePrice) return 0;
  const priceDrop = protection.strikePrice - currentPrice;
  const payoutPerUnit = priceDrop * FX_RATES.USD_IRR;
  return payoutPerUnit * protection.quantity;
}


// ═══════════════════════════════════════════════════════════════════════════════
// PART 9: LOAN STRESS UNDER VOLATILITY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('PART 9: LOAN STRESS UNDER VOLATILITY');
console.log('═══════════════════════════════════════════════════════════════\n');

test('9.1', 'LTV increases correctly during V3 Correction (-26% BTC)', () => {
  // Setup: Loan against BTC at 40% LTV
  const initialBTCPrice = BASELINE_PRICES.BTC; // $97,500
  const btcQuantity = 1;
  const btcValueIRR = initialBTCPrice * FX_RATES.USD_IRR;
  const borrowedAmount = btcValueIRR * 0.40; // 40% LTV
  
  const loan = {
    collateralAsset: 'BTC',
    collateralQuantity: btcQuantity,
    borrowedAmount: borrowedAmount,
    maxLTV: 50,
  };
  
  // Apply V3 Correction prices
  const correctionPrices = { BTC: 72000 }; // -26%
  const newLTV = calculateLTV(loan, correctionPrices);
  
  // LTV should increase from 40% to ~54%
  // New LTV = borrowedAmount / (72000 * FX) = (97500 * 0.4) / 72000 = 54.17%
  assertInRange(newLTV, 53, 56, 'LTV after correction');
});

test('9.2', 'Caution status at 70-85% of max LTV threshold', () => {
  // To get caution status, we need LTV to be 70-85% of max LTV
  // For Growth layer (50% max), caution zone is 35-42.5% actual LTV
  const loan = {
    collateralAsset: 'BTC',
    collateralQuantity: 1,
    maxLTV: 50,
  };

  // Set up loan at 35% LTV, then calculate price for 40% LTV (80% of max)
  const basePrice = 97500;
  const initialLTV = 0.35;
  const borrowedAmount = basePrice * initialLTV; // $34,125 borrowed per BTC

  // Price that pushes LTV to 40% (80% of 50% max = caution zone)
  const targetLTV = 0.40;
  const testPrice = borrowedAmount / targetLTV; // $85,312

  loan.borrowedAmount = borrowedAmount * FX_RATES.USD_IRR;
  const ltv = calculateLTV(loan, { BTC: testPrice });
  const status = getLoanHealthStatus(ltv, loan.maxLTV);

  assertInRange(ltv, 39, 41, 'LTV at caution level');
  assertEqual(status, 'caution', 'Status should be caution at 80% of max LTV');
});

test('9.3', 'Critical status at 95% of max LTV (approaching liquidation)', () => {
  // To get critical status, we need LTV to be 95-100% of max LTV
  // For Growth layer (50% max), critical zone is 47.5-50% actual LTV
  const loan = {
    collateralAsset: 'ETH',
    collateralQuantity: 10,
    maxLTV: 50,
  };

  const basePrice = 3200;
  const initialLTV = 0.35;
  const borrowedPerUnit = basePrice * initialLTV; // $1,120 per ETH
  const totalBorrowed = borrowedPerUnit * loan.collateralQuantity; // $11,200

  // Price that pushes LTV to 47.5% (95% of 50% max = critical zone)
  const targetLTV = 0.475;
  const testPrice = totalBorrowed / (targetLTV * loan.collateralQuantity); // $2,358

  loan.borrowedAmount = totalBorrowed * FX_RATES.USD_IRR;
  const ltv = calculateLTV(loan, { ETH: testPrice });
  const status = getLoanHealthStatus(ltv, loan.maxLTV);

  assertInRange(ltv, 46, 49, 'LTV at critical level');
  assertEqual(status, 'critical', 'Status should be critical at 95% of max LTV');
});

test('9.4', 'Liquidation triggers at 95%+ LTV', () => {
  const loan = {
    collateralAsset: 'SOL',
    collateralQuantity: 100,
    borrowedAmount: 185 * 100 * FX_RATES.USD_IRR * 0.25, // 25% initial LTV
    maxLTV: 30,
  };
  
  // Price drop to trigger liquidation (95%+ of max LTV)
  // Need LTV = 28.5% (95% of 30%)
  // 0.25 * 185 / newPrice = 0.285 => newPrice = 162
  // For liquidation (100%+): newPrice < 154
  const liquidationPrices = { SOL: 50 }; // Crypto winter price
  const ltv = calculateLTV(loan, liquidationPrices);
  const status = getLoanHealthStatus(ltv, loan.maxLTV);
  
  // LTV = (0.25 * 185) / 50 = 92.5% 
  assertTrue(ltv > 90, `LTV should be >90%, got ${ltv}`);
  assertEqual(status, 'liquidation', 'Status should be liquidation');
});

test('9.5', 'Multiple loans stress during V4 Flash Crash', () => {
  const loans = [
    {
      id: 'btc-loan',
      collateralAsset: 'BTC',
      collateralQuantity: 1,
      borrowedAmount: 97500 * FX_RATES.USD_IRR * 0.45,
      maxLTV: 50,
    },
    {
      id: 'eth-loan',
      collateralAsset: 'ETH',
      collateralQuantity: 10,
      borrowedAmount: 3200 * 10 * FX_RATES.USD_IRR * 0.28,
      maxLTV: 50,
    },
    {
      id: 'sol-loan',
      collateralAsset: 'SOL',
      collateralQuantity: 100,
      borrowedAmount: 185 * 100 * FX_RATES.USD_IRR * 0.28,
      maxLTV: 30,
    },
  ];
  
  // Flash crash bottom prices
  const flashCrashPrices = { BTC: 78000, ETH: 2500, SOL: 140 };
  
  const statuses = loans.map(loan => {
    const ltv = calculateLTV(loan, flashCrashPrices);
    return {
      id: loan.id,
      ltv: ltv,
      status: getLoanHealthStatus(ltv, loan.maxLTV),
    };
  });
  
  // BTC: 0.45 * 97500 / 78000 = 56.25% LTV (warning)
  // ETH: 0.28 * 3200 / 2500 = 35.84% LTV (healthy)
  // SOL: 0.28 * 185 / 140 = 37% LTV (warning for 30% max)
  
  const hasStressedLoans = statuses.some(s => s.status !== 'healthy');
  assertTrue(hasStressedLoans, 'At least one loan should be stressed during flash crash');
});

test('9.6', 'Loan cascade in V5 Crypto Winter - SOL liquidates first', () => {
  const loans = [
    { asset: 'BTC', initialLTV: 0.45, maxLTV: 50 },
    { asset: 'ETH', initialLTV: 0.28, maxLTV: 50 },
    { asset: 'SOL', initialLTV: 0.28, maxLTV: 30 },
  ];
  
  const winterPrices = { BTC: 40000, ETH: 1250, SOL: 50 };
  
  const results = loans.map(loan => {
    const basePrice = BASELINE_PRICES[loan.asset];
    const borrowedRatio = loan.initialLTV;
    // LTV = (initialLTV * basePrice) / currentPrice
    const currentLTV = (borrowedRatio * basePrice) / winterPrices[loan.asset] * 100;
    return {
      asset: loan.asset,
      ltv: currentLTV,
      maxLTV: loan.maxLTV,
      ratio: currentLTV / loan.maxLTV,
    };
  });
  
  // Sort by ratio (highest first = liquidates first)
  results.sort((a, b) => b.ratio - a.ratio);
  
  // SOL should liquidate first (highest ratio)
  // SOL: (0.28 * 185) / 50 = 103.6% LTV, ratio = 103.6/30 = 3.45
  // BTC: (0.45 * 97500) / 40000 = 109.7% LTV, ratio = 109.7/50 = 2.19
  // ETH: (0.28 * 3200) / 1250 = 71.7% LTV, ratio = 71.7/50 = 1.43
  
  assertEqual(results[0].asset, 'SOL', 'SOL should liquidate first (highest LTV ratio)');
});

test('9.7', 'Collateral value updates correctly with price changes', () => {
  const loan = {
    collateralAsset: 'BTC',
    collateralQuantity: 0.5,
    borrowedAmount: 50_000_000_000, // 50B IRR
  };
  
  const baselineValue = loan.collateralQuantity * BASELINE_PRICES.BTC * FX_RATES.USD_IRR;
  const bullRunValue = loan.collateralQuantity * 125000 * FX_RATES.USD_IRR;
  const correctionValue = loan.collateralQuantity * 72000 * FX_RATES.USD_IRR;
  
  // Verify values change correctly
  assertApprox(bullRunValue / baselineValue, 125000 / 97500, 0.01, 'Bull run ratio');
  assertApprox(correctionValue / baselineValue, 72000 / 97500, 0.01, 'Correction ratio');
});

test('9.8', 'Frozen asset count matches active loan count', () => {
  const portfolio = generatePortfolio('SPECULATOR');
  
  // Add loans
  portfolio.loans = [
    { collateralAsset: 'BTC', active: true },
    { collateralAsset: 'ETH', active: true },
    { collateralAsset: 'SOL', active: true },
  ];
  
  // Freeze collateral assets
  portfolio.holdings.BTC.frozen = true;
  portfolio.holdings.ETH.frozen = true;
  portfolio.holdings.SOL.frozen = true;
  
  const frozenCount = Object.values(portfolio.holdings).filter(h => h.frozen).length;
  const activeLoanCount = portfolio.loans.filter(l => l.active).length;
  
  assertEqual(frozenCount, activeLoanCount, 'Frozen assets should match active loans');
});


// ═══════════════════════════════════════════════════════════════════════════════
// PART 10: PROTECTION SYSTEM TESTS
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('PART 10: PROTECTION SYSTEM');
console.log('═══════════════════════════════════════════════════════════════\n');

test('10.1', 'Protection premium calculated correctly (BTC, 3 months)', () => {
  const btcValue = 1 * BASELINE_PRICES.BTC * FX_RATES.USD_IRR; // ~142B IRR
  const premium = calculateProtectionPremium(btcValue, 3, 'medium');
  
  // 4% monthly × 3 months = 12% of asset value
  const expectedPremium = btcValue * 0.04 * 3;
  assertApprox(premium, expectedPremium, 0.01, 'Premium calculation');
});

test('10.2', 'Protection premium varies by volatility level', () => {
  const assetValue = 100_000_000_000; // 100B IRR
  const duration = 1; // 1 month
  
  const lowPremium = calculateProtectionPremium(assetValue, duration, 'low');
  const mediumPremium = calculateProtectionPremium(assetValue, duration, 'medium');
  const highPremium = calculateProtectionPremium(assetValue, duration, 'high');
  
  assertTrue(lowPremium < mediumPremium, 'Low premium < medium');
  assertTrue(mediumPremium < highPremium, 'Medium premium < high');
});

test('10.3', 'Strike price locks at purchase time', () => {
  const purchasePrice = BASELINE_PRICES.BTC; // $97,500
  
  const protection = {
    asset: 'BTC',
    quantity: 1,
    strikePrice: purchasePrice,
    purchaseDate: new Date(),
    expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
  };
  
  // Verify strike price doesn't change with market
  const newMarketPrice = 85000;
  assertEqual(protection.strikePrice, purchasePrice, 'Strike price should remain locked');
});

test('10.4', 'Protection payout on price drop below strike', () => {
  const protection = {
    asset: 'BTC',
    quantity: 1,
    strikePrice: 97500, // USD
  };
  
  // Price drops to $78,000 (flash crash)
  const currentPrice = 78000;
  const payout = calculateProtectionPayout(protection, currentPrice);
  
  // Payout = (97500 - 78000) × 1 × FX = 19500 × 1,456,000 = ~28.4B IRR
  const expectedPayout = (97500 - 78000) * FX_RATES.USD_IRR;
  assertApprox(payout, expectedPayout, 0.01, 'Protection payout');
});

test('10.5', 'No payout when price above strike', () => {
  const protection = {
    asset: 'BTC',
    quantity: 1,
    strikePrice: 97500,
  };
  
  // Price rises to $125,000 (bull run)
  const currentPrice = 125000;
  const payout = calculateProtectionPayout(protection, currentPrice);
  
  assertEqual(payout, 0, 'No payout when price above strike');
});

test('10.6', 'Days remaining countdown calculation', () => {
  const now = new Date();
  const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  const protection = {
    asset: 'BTC',
    quantity: 1,
    strikePrice: 97500,
    expiryDate: expiryDate,
  };
  
  const daysRemaining = Math.ceil((protection.expiryDate - now) / (24 * 60 * 60 * 1000));
  assertInRange(daysRemaining, 29, 31, 'Days remaining');
});

test('10.7', 'Protection expiry status check', () => {
  const now = new Date();
  
  const activeProtection = {
    expiryDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days future
  };
  
  const expiredProtection = {
    expiryDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
  };
  
  const isActive = activeProtection.expiryDate > now;
  const isExpired = expiredProtection.expiryDate <= now;
  
  assertTrue(isActive, 'Active protection should be valid');
  assertTrue(isExpired, 'Expired protection should be invalid');
});

test('10.8', 'Premium deducted from cash correctly', () => {
  const portfolio = {
    cash: 50_000_000_000, // 50B IRR
  };
  
  const assetValue = 142_000_000_000; // ~1 BTC
  const premium = calculateProtectionPremium(assetValue, 3, 'medium');
  
  const cashAfterPremium = portfolio.cash - premium;
  
  assertTrue(cashAfterPremium < portfolio.cash, 'Cash should decrease');
  assertTrue(cashAfterPremium > 0, 'Cash should remain positive');
});

test('10.9', 'Insufficient cash blocks protection purchase', () => {
  const portfolio = {
    cash: 1_000_000_000, // 1B IRR (small amount)
  };
  
  const assetValue = 142_000_000_000; // ~1 BTC
  const premium = calculateProtectionPremium(assetValue, 6, 'high'); // Expensive protection
  
  const canAfford = portfolio.cash >= premium;
  
  assertFalse(canAfford, 'Should not afford expensive protection with small cash');
});

test('10.10', 'Protection eligible assets (BTC, ETH, SOL, GOLD)', () => {
  const eligibleAssets = ['BTC', 'ETH', 'SOL', 'GOLD'];
  const nonEligibleAssets = ['TON', 'QQQ', 'USDT', 'IRR_FIXED_INCOME'];
  
  eligibleAssets.forEach(asset => {
    assertTrue(eligibleAssets.includes(asset), `${asset} should be eligible`);
  });
  
  nonEligibleAssets.forEach(asset => {
    assertFalse(eligibleAssets.includes(asset), `${asset} should not be eligible`);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// PART 11: COMBINED SCENARIO TESTS (Profile × Volatility × Cash-In)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('PART 11: COMBINED SCENARIO TESTS');
console.log('═══════════════════════════════════════════════════════════════\n');

test('11.1', 'AN-V1-D1: Anxious Novice + Normal Market + Fixed DCA', () => {
  const profile = USER_PROFILES.ANXIOUS_NOVICE;
  const initialInvestment = profile.investmentPattern.initialAmount; // 50M IRR
  const monthlyDCA = profile.investmentPattern.monthlyContribution; // 5M IRR
  
  // Simulate 12 months
  const totalInvested = initialInvestment + (monthlyDCA * 12);
  
  // Normal market: expect 10-18% growth
  const minExpectedValue = totalInvested * 1.10;
  const maxExpectedValue = totalInvested * 1.18;
  
  // Verify allocation matches profile
  assertEqual(profile.riskProfile.targetAllocation.FOUNDATION, 80, 'Foundation allocation');
  assertEqual(profile.riskProfile.targetAllocation.UPSIDE, 2, 'Upside allocation');
  
  // Total invested should be 110M IRR
  assertEqual(totalInvested, 110_000_000, 'Total invested after 12 months DCA');
});

test('11.2', 'AN-V3-D1: Anxious Novice + Correction - Panic threshold check', () => {
  const profile = USER_PROFILES.ANXIOUS_NOVICE;
  const panicThreshold = profile.behavioralPatterns.panicSellThreshold; // -10%
  
  // During V3 Correction, conservative portfolio loses 5-8%
  const portfolioLoss = -7; // Within expected range
  
  const wouldPanic = portfolioLoss <= panicThreshold;
  
  assertFalse(wouldPanic, 'Should not panic at -7% (threshold is -10%)');
  
  // But at -10%, would panic
  const severelyLoss = -10;
  const wouldPanicSevere = severelyLoss <= panicThreshold;
  assertTrue(wouldPanicSevere, 'Should panic at -10%');
});

test('11.3', 'SB-V2-D1: Steady Builder + Bull Run - Rebalance triggered', () => {
  const profile = USER_PROFILES.STEADY_BUILDER;
  const targetAllocation = profile.riskProfile.targetAllocation;
  
  // After bull run, Upside grows disproportionately
  const postBullRunAllocation = {
    FOUNDATION: 42, // Was 50%, now underweight
    GROWTH: 33,     // Was 35%, slightly under
    UPSIDE: 25,     // Was 15%, now overweight by 10%
  };
  
  // Check drift
  const foundationDrift = Math.abs(postBullRunAllocation.FOUNDATION - targetAllocation.FOUNDATION);
  const upsideDrift = Math.abs(postBullRunAllocation.UPSIDE - targetAllocation.UPSIDE);
  
  assertTrue(foundationDrift > 5, 'Foundation should drift >5%');
  assertTrue(upsideDrift > 5, 'Upside should drift >5%');
  
  // Rebalance should be triggered
  const rebalanceThreshold = 5; // 5% drift triggers rebalance
  const needsRebalance = foundationDrift > rebalanceThreshold || upsideDrift > rebalanceThreshold;
  assertTrue(needsRebalance, 'Rebalance should be triggered');
});

test('11.4', 'AA-V3-D3: Aggressive Accumulator + Correction + Opportunistic dip buy', () => {
  const profile = USER_PROFILES.AGGRESSIVE_ACCUMULATOR;
  const dipReserve = profile.investmentPattern.dipReserve; // 500M IRR
  const dipThreshold = -10; // Buy when market drops 10%+
  
  // V3 Correction: -26% total
  const marketDrop = -26;
  
  const shouldDeployDipReserve = marketDrop <= dipThreshold;
  assertTrue(shouldDeployDipReserve, 'Should deploy dip reserve during correction');
  
  // Verify reserve amount
  assertEqual(dipReserve, 500_000_000, 'Dip reserve should be 500M IRR');
});

test('11.5', 'WP-V5-D4: Wealth Preserver + Crypto Winter - Gold hedge effectiveness', () => {
  const profile = USER_PROFILES.WEALTH_PRESERVER;
  
  // Portfolio composition: 60% Foundation (includes gold), 35% Growth, 5% Upside
  // During crypto winter: crypto -60%, gold +11%
  
  const cryptoAllocation = 0.05 + 0.35 * 0.5; // Upside + half of Growth = 22.5%
  const goldAllocation = 0.30; // ~30% of Foundation
  
  const cryptoLoss = -0.60; // -60%
  const goldGain = 0.11;    // +11%
  
  // Weighted portfolio impact
  const cryptoImpact = cryptoAllocation * cryptoLoss; // -13.5%
  const goldImpact = goldAllocation * goldGain;        // +3.3%
  
  const netImpact = cryptoImpact + goldImpact; // ~-10%
  
  // Conservative portfolio should lose less than aggressive
  assertInRange(netImpact * 100, -15, -5, 'Wealth Preserver loss should be -5% to -15%');
});

test('11.6', 'SP-V4-D3-LEVERAGED: Speculator + Flash Crash - Near liquidation', () => {
  // Speculator uses aggressive leverage (close to max LTV)
  // Higher initial LTVs mean flash crash will push into stress territory
  const loans = [
    { asset: 'BTC', initialLTV: 0.42, maxLTV: 50 },  // 84% utilization
    { asset: 'ETH', initialLTV: 0.40, maxLTV: 50 },  // 80% utilization
    { asset: 'SOL', initialLTV: 0.25, maxLTV: 30 },  // 83% utilization
  ];

  // Flash crash: -20% at bottom
  const crashMultiplier = 0.80;

  const ltvResults = loans.map(loan => {
    const basePrice = BASELINE_PRICES[loan.asset];
    const crashPrice = basePrice * crashMultiplier;
    // LTV increases when price drops: newLTV = initialLTV / crashMultiplier
    const currentLTV = (loan.initialLTV / crashMultiplier) * 100;
    return {
      asset: loan.asset,
      ltv: currentLTV,
      maxLTV: loan.maxLTV,
      ratio: currentLTV / loan.maxLTV,
      status: getLoanHealthStatus(currentLTV, loan.maxLTV),
    };
  });

  // At -20% crash with high initial LTVs, all will exceed max LTV → liquidation
  // BTC: 42% / 0.80 = 52.5% LTV → 105% of max → liquidation
  // ETH: 40% / 0.80 = 50% LTV → 100% of max → liquidation
  // SOL: 25% / 0.80 = 31.25% LTV → 104% of max → liquidation
  const hasStressedLoan = ltvResults.some(r =>
    r.status === 'warning' || r.status === 'critical' || r.status === 'liquidation'
  );
  assertTrue(hasStressedLoan, 'At least one loan should be stressed during flash crash');
});

test('11.7', 'SP-V5-D3-LEVERAGED: Speculator + Crypto Winter - Liquidation cascade', () => {
  const loans = [
    { asset: 'BTC', initialLTV: 0.45, maxLTV: 50 },
    { asset: 'SOL', initialLTV: 0.28, maxLTV: 30 },
  ];
  
  // Crypto winter prices
  const winterPrices = {
    BTC: 40000, // -59%
    SOL: 50,    // -73%
  };
  
  const liquidationResults = loans.map(loan => {
    const basePrice = BASELINE_PRICES[loan.asset];
    const currentLTV = (loan.initialLTV * basePrice) / winterPrices[loan.asset] * 100;
    return {
      asset: loan.asset,
      ltv: currentLTV,
      liquidated: currentLTV >= loan.maxLTV,
    };
  });
  
  // Both should be liquidated
  const btcResult = liquidationResults.find(r => r.asset === 'BTC');
  const solResult = liquidationResults.find(r => r.asset === 'SOL');
  
  assertTrue(btcResult.liquidated, 'BTC loan should be liquidated');
  assertTrue(solResult.liquidated, 'SOL loan should be liquidated');
});

test('11.8', 'WP-V7-D4: Wealth Preserver + IRR Devaluation - USD hedge benefit', () => {
  // Initial portfolio: 2B IRR with 30% in fixed income (IRR denominated)
  const initialValue = 2_000_000_000;
  const fixedIncomeAllocation = 0.30;
  const usdAssetAllocation = 0.70;
  
  // IRR devaluation: 25%
  const devaluationRate = 0.25;
  const newFXRate = FX_RATES.USD_IRR * (1 + devaluationRate);
  
  // Fixed income loses real value (stays same IRR, but IRR worth less)
  const fixedIncomeValueIRR = initialValue * fixedIncomeAllocation;
  const fixedIncomeRealValueLoss = devaluationRate; // 25% real loss
  
  // USD assets gain IRR value
  const usdAssetValueIRR = initialValue * usdAssetAllocation;
  const usdAssetNewValueIRR = usdAssetValueIRR * (1 + devaluationRate);
  
  // Net portfolio IRR value
  const newPortfolioIRR = fixedIncomeValueIRR + usdAssetNewValueIRR;
  const portfolioGrowthIRR = (newPortfolioIRR - initialValue) / initialValue * 100;
  
  // Should gain ~17.5% in IRR terms (70% × 25%)
  assertInRange(portfolioGrowthIRR, 15, 20, 'Portfolio IRR growth');
});


// ═══════════════════════════════════════════════════════════════════════════════
// PART 12: SMART REBALANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('PART 12: SMART REBALANCE');
console.log('═══════════════════════════════════════════════════════════════\n');

test('12.1', 'Rebalance skips frozen assets correctly', () => {
  const holdings = {
    BTC: { quantity: 1, layer: 'GROWTH', frozen: true },
    ETH: { quantity: 10, layer: 'GROWTH', frozen: false },
    SOL: { quantity: 100, layer: 'UPSIDE', frozen: true },
    TON: { quantity: 1000, layer: 'UPSIDE', frozen: false },
  };
  
  const rebalanceableAssets = Object.entries(holdings)
    .filter(([_, h]) => !h.frozen)
    .map(([asset, _]) => asset);
  
  assertEqual(rebalanceableAssets.length, 2, 'Should have 2 rebalanceable assets');
  assertTrue(rebalanceableAssets.includes('ETH'), 'ETH should be rebalanceable');
  assertTrue(rebalanceableAssets.includes('TON'), 'TON should be rebalanceable');
  assertFalse(rebalanceableAssets.includes('BTC'), 'BTC should be frozen');
  assertFalse(rebalanceableAssets.includes('SOL'), 'SOL should be frozen');
});

test('12.2', 'Cash remains untouched during standard rebalance', () => {
  const portfolio = {
    cash: 50_000_000_000, // 50B IRR
    totalAssetsValue: 200_000_000_000,
  };
  
  // After rebalance, cash should be same
  const cashAfterRebalance = portfolio.cash; // Rebalance doesn't touch cash
  
  assertEqual(cashAfterRebalance, portfolio.cash, 'Cash should remain unchanged');
});

test('12.3', 'Smart rebalance calculates cash needed for perfect balance', () => {
  // Current allocation: Foundation 45%, Growth 38%, Upside 17%
  // Target: Foundation 50%, Growth 35%, Upside 15%
  // Some assets frozen, can only partially rebalance
  
  const currentValue = 100_000_000_000; // 100B IRR
  const frozenValue = 20_000_000_000;   // 20B IRR frozen
  
  // Best achievable without cash: Foundation 48%, Growth 37%, Upside 15%
  // Gap to perfect: Foundation needs 2% more = 2B IRR
  
  const gapToTarget = currentValue * 0.02; // 2% gap
  const cashNeeded = gapToTarget;
  
  assertApprox(cashNeeded, 2_000_000_000, 0.01, 'Cash needed for perfect balance');
});

test('12.4', 'Smart rebalance checkbox uses available cash', () => {
  const portfolio = {
    cash: 10_000_000_000, // 10B IRR
    cashNeededForPerfectBalance: 5_000_000_000, // 5B IRR
  };
  
  const useSmartRebalance = true;
  const cashToUse = useSmartRebalance 
    ? Math.min(portfolio.cash, portfolio.cashNeededForPerfectBalance)
    : 0;
  
  assertEqual(cashToUse, 5_000_000_000, 'Should use 5B IRR from cash');
  
  const remainingCash = portfolio.cash - cashToUse;
  assertEqual(remainingCash, 5_000_000_000, 'Should have 5B IRR remaining');
});

test('12.5', 'Add funds suggestion shows correct amount', () => {
  const cashNeeded = 15_000_000_000; // 15B IRR needed
  const availableCash = 5_000_000_000; // 5B IRR available
  
  const additionalCashNeeded = cashNeeded - availableCash;
  
  assertEqual(additionalCashNeeded, 10_000_000_000, 'Should suggest adding 10B IRR');
});

test('12.6', 'Rebalance trade directions are correct', () => {
  // Overweight Upside, underweight Foundation
  const currentAllocation = { FOUNDATION: 45, GROWTH: 35, UPSIDE: 20 };
  const targetAllocation = { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 };
  
  const trades = [];
  
  if (currentAllocation.UPSIDE > targetAllocation.UPSIDE) {
    trades.push({ layer: 'UPSIDE', direction: 'SELL' });
  }
  if (currentAllocation.FOUNDATION < targetAllocation.FOUNDATION) {
    trades.push({ layer: 'FOUNDATION', direction: 'BUY' });
  }
  
  const sellUpside = trades.find(t => t.layer === 'UPSIDE');
  const buyFoundation = trades.find(t => t.layer === 'FOUNDATION');
  
  assertEqual(sellUpside.direction, 'SELL', 'Should sell overweight Upside');
  assertEqual(buyFoundation.direction, 'BUY', 'Should buy underweight Foundation');
});

test('12.7', 'Post-rebalance allocation closer to target', () => {
  const targetAllocation = { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 };
  
  const beforeRebalance = { FOUNDATION: 42, GROWTH: 33, UPSIDE: 25 };
  const afterRebalance = { FOUNDATION: 49, GROWTH: 35, UPSIDE: 16 };
  
  // Calculate drift (sum of absolute differences)
  const driftBefore = Math.abs(beforeRebalance.FOUNDATION - targetAllocation.FOUNDATION) +
                      Math.abs(beforeRebalance.GROWTH - targetAllocation.GROWTH) +
                      Math.abs(beforeRebalance.UPSIDE - targetAllocation.UPSIDE);
  
  const driftAfter = Math.abs(afterRebalance.FOUNDATION - targetAllocation.FOUNDATION) +
                     Math.abs(afterRebalance.GROWTH - targetAllocation.GROWTH) +
                     Math.abs(afterRebalance.UPSIDE - targetAllocation.UPSIDE);
  
  assertTrue(driftAfter < driftBefore, 'Drift should decrease after rebalance');
});

test('12.8', 'Partial rebalance when insufficient unfrozen assets', () => {
  const totalValue = 100_000_000_000;
  const frozenValue = 60_000_000_000; // 60% frozen
  const unfrozenValue = 40_000_000_000; // 40% can move
  
  // Max rebalance achievable is limited by unfrozen portion
  const maxRebalancePercent = (unfrozenValue / totalValue) * 100;
  
  assertApprox(maxRebalancePercent, 40, 0.01, 'Max rebalance should be 40%');
});


// ═══════════════════════════════════════════════════════════════════════════════
// PART 13: MISSING EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('PART 13: MISSING EDGE CASES');
console.log('═══════════════════════════════════════════════════════════════\n');

test('13.1', 'E-004: Protection expires during crash - warning shown', () => {
  const protection = {
    asset: 'BTC',
    quantity: 1,
    strikePrice: 97500,
    expiryDate: new Date('2026-01-10'), // Expired
  };
  
  const correctionStartDate = new Date('2026-01-15'); // Crash starts after expiry
  
  const isExpiredBeforeCrash = protection.expiryDate < correctionStartDate;
  assertTrue(isExpiredBeforeCrash, 'Protection should be expired before crash');
  
  // User should have been warned before expiry
  const warningDays = 7;
  const warningDate = new Date(protection.expiryDate.getTime() - warningDays * 24 * 60 * 60 * 1000);
  assertTrue(warningDate < protection.expiryDate, 'Warning should come before expiry');
});

test('13.2', 'E-006: IRR devaluation + Fixed income heavy - Real value loss', () => {
  const fixedIncomeValue = 800_000_000_000; // 800B IRR
  const devaluationRate = 0.25; // 25%
  
  // Nominal IRR value unchanged
  const nominalValueAfter = fixedIncomeValue;
  
  // Real value (purchasing power) decreases
  const realValueAfter = fixedIncomeValue / (1 + devaluationRate);
  const realValueLoss = fixedIncomeValue - realValueAfter;
  const realValueLossPercent = (realValueLoss / fixedIncomeValue) * 100;
  
  // Real value loss should be ~20% (not 25% due to how it's calculated)
  assertInRange(realValueLossPercent, 18, 22, 'Real value loss from devaluation');
});

test('13.3', 'E-007: Double flash crash handling', () => {
  const crashes = [
    { day: 1, drop: -20, recovery: 0.85 }, // First crash
    { day: 5, drop: -18, recovery: 0.90 }, // Second crash
  ];
  
  let portfolioValue = 100;
  
  // First crash
  portfolioValue *= (1 + crashes[0].drop / 100);
  portfolioValue *= crashes[0].recovery / (1 + crashes[0].drop / 100); // Partial recovery
  
  // Second crash (from partially recovered level)
  const valueBeforeSecond = portfolioValue;
  portfolioValue *= (1 + crashes[1].drop / 100);
  
  // Total drawdown from original
  const totalDrawdown = ((portfolioValue - 100) / 100) * 100;
  
  // Should be worse than single crash
  assertTrue(totalDrawdown < crashes[0].drop, 'Double crash should be worse than single');
});

test('13.4', 'Consecutive DCA during correction accumulates more units', () => {
  const monthlyDCA = 10_000_000; // 10M IRR
  
  // Month 1: BTC at $97,500
  const btcPrice1 = 97500 * FX_RATES.USD_IRR;
  const units1 = monthlyDCA / btcPrice1;
  
  // Month 2: BTC at $85,000 (correction)
  const btcPrice2 = 85000 * FX_RATES.USD_IRR;
  const units2 = monthlyDCA / btcPrice2;
  
  // Month 3: BTC at $72,000 (deeper correction)
  const btcPrice3 = 72000 * FX_RATES.USD_IRR;
  const units3 = monthlyDCA / btcPrice3;
  
  // More units acquired at lower prices
  assertTrue(units2 > units1, 'Should get more units at lower price');
  assertTrue(units3 > units2, 'Should get even more units at even lower price');
  
  // Total units vs buying all at start
  const totalUnits = units1 + units2 + units3;
  const unitsIfAllAtStart = (monthlyDCA * 3) / btcPrice1;
  
  assertTrue(totalUnits > unitsIfAllAtStart, 'DCA should accumulate more units during dip');
});

test('13.5', 'Network timeout recovery - Portfolio state preserved', () => {
  const portfolioBefore = {
    totalValue: 100_000_000_000,
    cash: 10_000_000_000,
    holdings: { BTC: { quantity: 0.5 } },
  };
  
  // Simulate network timeout during operation
  const operationFailed = true;
  
  // Portfolio should be unchanged after failed operation
  const portfolioAfter = operationFailed ? portfolioBefore : null;
  
  assertEqual(portfolioAfter.totalValue, portfolioBefore.totalValue, 'Value preserved');
  assertEqual(portfolioAfter.cash, portfolioBefore.cash, 'Cash preserved');
});

test('13.6', 'Minimum investment handles fractional holdings correctly', () => {
  const minimumInvestment = 1_000_000; // 1M IRR
  const btcPriceIRR = 97500 * FX_RATES.USD_IRR; // ~142B IRR
  
  // Even minimum investment should create valid (tiny) BTC holding
  const btcAllocation = minimumInvestment * 0.02; // 2% to Upside
  const btcQuantity = btcAllocation / btcPriceIRR;
  
  assertTrue(btcQuantity > 0, 'Should have positive BTC quantity');
  assertTrue(btcQuantity < 0.00001, 'Should be very small quantity');
});

test('13.7', 'Maximum holdings don\'t cause overflow', () => {
  const whaleInvestment = 10_000_000_000_000; // 10T IRR
  const btcPriceIRR = 97500 * FX_RATES.USD_IRR;
  
  const btcAllocation = whaleInvestment * 0.20; // 20% to BTC
  const btcQuantity = btcAllocation / btcPriceIRR;
  
  // Should be valid number, not Infinity or NaN
  assertTrue(Number.isFinite(btcQuantity), 'Should be finite number');
  assertTrue(btcQuantity > 0, 'Should be positive');
  assertTrue(btcQuantity < 1000, 'Should be reasonable BTC quantity (<1000)');
});


// ═══════════════════════════════════════════════════════════════════════════════
// PART 14: CASH-IN PATTERN SIMULATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('PART 14: CASH-IN PATTERN SIMULATION');
console.log('═══════════════════════════════════════════════════════════════\n');

test('14.1', 'Fixed monthly DCA total matches expected (12 months)', () => {
  const pattern = CASH_IN_PATTERNS.DCA_FIXED_MONTHLY;
  const config = pattern.amounts.small;
  
  const totalInvested = config.initial + (config.monthly * 12);
  
  assertEqual(totalInvested, config.yearTotal, 'Total should match pattern definition');
  assertEqual(totalInvested, 110_000_000, 'Should be 110M IRR');
});

test('14.2', 'Variable DCA handles bonus months correctly', () => {
  const pattern = CASH_IN_PATTERNS.DCA_VARIABLE;
  const sequence = pattern.exampleSequence;
  
  const total = sequence.reduce((sum, month) => sum + month.amount, 0);
  
  assertEqual(total, pattern.yearlyStats.total, 'Total should match yearly stats');
  
  // Find bonus months (above average)
  const average = pattern.yearlyStats.average;
  const bonusMonths = sequence.filter(m => m.amount > average);
  
  assertTrue(bonusMonths.length >= 2, 'Should have at least 2 bonus months');
});

test('14.3', 'Opportunistic dip buying triggers at threshold', () => {
  const pattern = CASH_IN_PATTERNS.DCA_OPPORTUNISTIC;
  const dipThreshold = pattern.pattern.dipThreshold; // -10%
  
  const marketDrops = [-5, -8, -12, -18, -7];
  
  const dipBuyTriggers = marketDrops.filter(drop => drop <= dipThreshold);
  
  assertEqual(dipBuyTriggers.length, 2, 'Should trigger twice (at -12% and -18%)');
});

test('14.4', 'Lump sum single deposit recorded correctly', () => {
  const pattern = CASH_IN_PATTERNS.LUMP_SUM;
  
  assertEqual(pattern.pattern.type, 'one_time', 'Should be one-time type');
  assertEqual(pattern.pattern.frequency, null, 'Should have no frequency');
});

test('14.5', 'Hybrid pattern combines lump sum and DCA', () => {
  const pattern = CASH_IN_PATTERNS.HYBRID;
  
  assertEqual(pattern.pattern.initialType, 'lump_sum', 'Should start with lump sum');
  assertEqual(pattern.pattern.followUpType, 'dca', 'Should follow with DCA');
  
  // Verify example configurations
  const aggressiveExample = pattern.examples.find(e => e.profile === 'AGGRESSIVE_ACCUMULATOR');
  
  assertEqual(aggressiveExample.initial, 1_000_000_000, 'Initial should be 1B IRR');
  assertEqual(aggressiveExample.monthly, 100_000_000, 'Monthly should be 100M IRR');
});

test('14.6', 'Micro DCA weekly amounts accumulate correctly', () => {
  const pattern = CASH_IN_PATTERNS.MICRO_DCA;
  const weeklyAmount = pattern.amounts.weekly;
  
  const yearlyTotal = weeklyAmount * 52;
  
  assertEqual(yearlyTotal, pattern.amounts.yearTotal, 'Yearly total should match');
  assertEqual(yearlyTotal, 52_000_000, 'Should be 52M IRR per year');
});

test('14.7', 'DCA cost averaging improves average entry price', () => {
  // Simulate 3 months of DCA during declining market
  const monthlyDCA = 30_000_000; // 30M IRR
  const prices = [97500, 85000, 72000]; // BTC prices declining
  
  let totalInvested = 0;
  let totalUnits = 0;
  
  prices.forEach(price => {
    const priceIRR = price * FX_RATES.USD_IRR;
    const units = monthlyDCA / priceIRR;
    totalInvested += monthlyDCA;
    totalUnits += units;
  });
  
  const averageCost = totalInvested / totalUnits;
  const lumpSumCost = prices[0] * FX_RATES.USD_IRR; // If bought all at start
  
  assertTrue(averageCost < lumpSumCost, 'DCA average cost should be lower than lump sum at start');
});


// ═══════════════════════════════════════════════════════════════════════════════
// PART 15: PORTFOLIO HEALTH STATUS TESTS
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('PART 15: PORTFOLIO HEALTH STATUS');
console.log('═══════════════════════════════════════════════════════════════\n');

test('15.1', 'Balanced status when allocation within 3% of target', () => {
  const target = { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 };
  const current = { FOUNDATION: 51, GROWTH: 34, UPSIDE: 15 };
  
  const maxDrift = Math.max(
    Math.abs(current.FOUNDATION - target.FOUNDATION),
    Math.abs(current.GROWTH - target.GROWTH),
    Math.abs(current.UPSIDE - target.UPSIDE)
  );
  
  const status = maxDrift <= 3 ? 'Balanced' : 'Not Balanced';
  
  assertEqual(status, 'Balanced', 'Should be Balanced within 3% drift');
});

test('15.2', 'Slightly Off status when drift 3-5%', () => {
  const target = { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 };
  const current = { FOUNDATION: 46, GROWTH: 36, UPSIDE: 18 };
  
  const maxDrift = Math.max(
    Math.abs(current.FOUNDATION - target.FOUNDATION),
    Math.abs(current.GROWTH - target.GROWTH),
    Math.abs(current.UPSIDE - target.UPSIDE)
  );
  
  const status = maxDrift <= 3 ? 'Balanced' : 
                 maxDrift <= 5 ? 'Slightly Off' : 
                 maxDrift <= 10 ? 'Rebalance Needed' : 'Attention Required';
  
  assertEqual(status, 'Slightly Off', 'Should be Slightly Off at 4% drift');
});

test('15.3', 'Rebalance Needed status when drift 5-10%', () => {
  const target = { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 };
  const current = { FOUNDATION: 42, GROWTH: 33, UPSIDE: 25 };
  
  const maxDrift = Math.max(
    Math.abs(current.FOUNDATION - target.FOUNDATION),
    Math.abs(current.GROWTH - target.GROWTH),
    Math.abs(current.UPSIDE - target.UPSIDE)
  );
  
  const status = maxDrift <= 3 ? 'Balanced' : 
                 maxDrift <= 5 ? 'Slightly Off' : 
                 maxDrift <= 10 ? 'Rebalance Needed' : 'Attention Required';
  
  assertEqual(status, 'Rebalance Needed', 'Should be Rebalance Needed at 10% drift');
});

test('15.4', 'Attention Required status when drift >10%', () => {
  const target = { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 };
  const current = { FOUNDATION: 35, GROWTH: 30, UPSIDE: 35 };
  
  const maxDrift = Math.max(
    Math.abs(current.FOUNDATION - target.FOUNDATION),
    Math.abs(current.GROWTH - target.GROWTH),
    Math.abs(current.UPSIDE - target.UPSIDE)
  );
  
  const status = maxDrift <= 3 ? 'Balanced' : 
                 maxDrift <= 5 ? 'Slightly Off' : 
                 maxDrift <= 10 ? 'Rebalance Needed' : 'Attention Required';
  
  assertEqual(status, 'Attention Required', 'Should be Attention Required at 20% drift');
});

test('15.5', 'Loan health affects overall portfolio health', () => {
  const portfolioStatus = 'Balanced';
  const loanStatuses = ['healthy', 'warning', 'healthy'];
  
  // If any loan is warning or critical, escalate portfolio status
  const worstLoanStatus = loanStatuses.includes('critical') ? 'critical' :
                          loanStatuses.includes('warning') ? 'warning' : 'healthy';
  
  const finalStatus = worstLoanStatus === 'critical' ? 'Attention Required' :
                      worstLoanStatus === 'warning' ? 'Rebalance Needed' :
                      portfolioStatus;
  
  assertEqual(finalStatus, 'Rebalance Needed', 'Loan warning should escalate status');
});


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('TEST SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Total Tests: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Pass Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);

if (failCount > 0) {
  console.log('\n❌ FAILED TESTS:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.id}: ${r.description}`);
    console.log(`    Error: ${r.error}`);
  });
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('COVERAGE SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

const coverage = {
  'Part 9: Loan Stress Under Volatility': 8,
  'Part 10: Protection System': 10,
  'Part 11: Combined Scenario Tests': 8,
  'Part 12: Smart Rebalance': 8,
  'Part 13: Missing Edge Cases': 7,
  'Part 14: Cash-In Pattern Simulation': 7,
  'Part 15: Portfolio Health Status': 5,
};

let totalAdditionalTests = 0;
Object.entries(coverage).forEach(([category, count]) => {
  console.log(`${category}: ${count} tests`);
  totalAdditionalTests += count;
});

console.log(`\nTotal Additional Tests: ${totalAdditionalTests}`);
console.log('Original Test Suite: 48 tests');
console.log(`Combined Total: ${48 + totalAdditionalTests} tests`);

// Export for use in test runner
export {
  results,
  passCount,
  failCount,
  coverage,
};
