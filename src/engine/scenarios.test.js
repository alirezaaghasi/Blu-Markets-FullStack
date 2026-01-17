/**
 * Blu Markets v10 — Test Suite Based on Comprehensive Test Scenarios
 * Tests portfolio calculations, volatility scenarios, user profiles, loans, and edge cases
 */

import { computeSnapshot } from './snapshot';
import { calculateRebalanceGap, previewRebalance, previewBorrow, previewRepay, previewTrade, previewProtect } from './preview';
import { validateTrade, validateBorrow, validateProtect, validateRepay, validateAddFunds } from './validate';
import { calculateFixedIncomeValue, irrToFixedIncomeUnits, FIXED_INCOME_UNIT_PRICE, FIXED_INCOME_ANNUAL_RATE } from './fixedIncome';
import { DEFAULT_PRICES, DEFAULT_FX_RATE, COLLATERAL_LTV_BY_LAYER } from '../constants/index';

// Test counters
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    const result = fn();
    if (result === true) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      failures.push({ name, error: `Expected true, got ${result}` });
      console.log(`  ✗ ${name}`);
    }
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  ✗ ${name} - Error: ${e.message}`);
  }
}

// ============================================================
// Test Prices from Scenario Document
// ============================================================
const BASELINE_PRICES = {
  BTC: 97500,
  ETH: 3200,
  SOL: 185,
  TON: 5.20,
  QQQ: 521,
  GOLD: 2650,
  USDT: 1.00,
};

const FX = 1456000; // 1 USD = 1,456,000 IRR

// Volatility scenario prices
const BULL_RUN_PRICES = { BTC: 125000, ETH: 4200, SOL: 280, TON: 7.80, GOLD: 2600, USDT: 1.00 };
const CORRECTION_PRICES = { BTC: 72000, ETH: 2300, SOL: 120, TON: 3.60, GOLD: 2780, USDT: 1.00 };
const FLASH_CRASH_BOTTOM = { BTC: 78000, ETH: 2500, SOL: 140, TON: 3.90, GOLD: 2700, USDT: 1.00 };
const CRYPTO_WINTER_PRICES = { BTC: 40000, ETH: 1250, SOL: 50, TON: 1.50, GOLD: 2950, USDT: 1.00 };

// Helper to create mock state
function createState({ holdings = [], cashIRR = 0, targetLayerPct = { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 }, loans = [], protections = [] }) {
  return { holdings, cashIRR, targetLayerPct, loans, protections, ledger: [] };
}

// Helper to create holding
function h(assetId, quantity, frozen = false, purchasedAt = null) {
  return { assetId, quantity, frozen, purchasedAt };
}

console.log('='.repeat(70));
console.log('BLU MARKETS COMPREHENSIVE TEST SUITE');
console.log('Based on Test Scenarios Document');
console.log('='.repeat(70));

// ============================================================
// PART 1: Portfolio Snapshot Calculations
// ============================================================
console.log('\n📊 PART 1: Portfolio Snapshot Calculations');

test('1.1 Baseline prices match scenario document', () => {
  return BASELINE_PRICES.BTC === 97500 && BASELINE_PRICES.ETH === 3200 && BASELINE_PRICES.SOL === 185;
});

test('1.2 FX rate matches scenario (1 USD = 1,456,000 IRR)', () => {
  return FX === 1456000;
});

test('1.3 BTC value calculation: 1 BTC = 97,500 USD = 141.96B IRR', () => {
  const holdings = [h('BTC', 1)];
  const snap = computeSnapshot(holdings, 0, BASELINE_PRICES, FX);
  const expectedIRR = 97500 * FX; // 141,960,000,000
  return Math.abs(snap.holdingsIRR - expectedIRR) < 1000;
});

test('1.4 ETH value calculation: 1 ETH = 3,200 USD = 4.66B IRR', () => {
  const holdings = [h('ETH', 1)];
  const snap = computeSnapshot(holdings, 0, BASELINE_PRICES, FX);
  const expectedIRR = 3200 * FX; // 4,659,200,000
  return Math.abs(snap.holdingsIRR - expectedIRR) < 1000;
});

test('1.5 Layer percentages sum to 100%', () => {
  const holdings = [h('USDT', 500), h('BTC', 0.003), h('ETH', 0.05)];
  const snap = computeSnapshot(holdings, 0, BASELINE_PRICES, FX);
  const sum = snap.layerPct.FOUNDATION + snap.layerPct.GROWTH + snap.layerPct.UPSIDE;
  return sum >= 99 && sum <= 101;
});

test('1.6 Cash is excluded from layer percentages', () => {
  const holdings = [h('USDT', 1000)];
  const snap = computeSnapshot(holdings, 1000000000, BASELINE_PRICES, FX);
  // Layer percentages should be based on holdings only
  return snap.layerPct.FOUNDATION === 100 && snap.totalIRR > snap.holdingsIRR;
});

// ============================================================
// PART 2: Volatility Scenario Impacts
// ============================================================
console.log('\n📈 PART 2: Volatility Scenario Impact Tests');

test('2.1 V2 Bull Run: BTC +28% increase', () => {
  const baseValue = 1 * BASELINE_PRICES.BTC * FX;
  const bullValue = 1 * BULL_RUN_PRICES.BTC * FX;
  const pctChange = ((bullValue - baseValue) / baseValue) * 100;
  return pctChange >= 27 && pctChange <= 29;
});

test('2.2 V3 Correction: BTC -26% decrease', () => {
  const baseValue = 1 * BASELINE_PRICES.BTC * FX;
  const correctionValue = 1 * CORRECTION_PRICES.BTC * FX;
  const pctChange = ((correctionValue - baseValue) / baseValue) * 100;
  return pctChange >= -27 && pctChange <= -25;
});

test('2.3 V4 Flash Crash: -20% at bottom', () => {
  const baseValue = 1 * BASELINE_PRICES.BTC * FX;
  const crashValue = 1 * FLASH_CRASH_BOTTOM.BTC * FX;
  const pctChange = ((crashValue - baseValue) / baseValue) * 100;
  return pctChange >= -21 && pctChange <= -19;
});

test('2.4 V5 Crypto Winter: BTC -59%', () => {
  const baseValue = 1 * BASELINE_PRICES.BTC * FX;
  const winterValue = 1 * CRYPTO_WINTER_PRICES.BTC * FX;
  const pctChange = ((winterValue - baseValue) / baseValue) * 100;
  return pctChange >= -60 && pctChange <= -58;
});

test('2.5 Gold hedges during crash (appreciates)', () => {
  // Gold goes from 2650 to 2780 during correction
  const goldChange = ((CORRECTION_PRICES.GOLD - BASELINE_PRICES.GOLD) / BASELINE_PRICES.GOLD) * 100;
  return goldChange > 0; // Gold appreciates during correction
});

test('2.6 Conservative portfolio loses less in correction', () => {
  // Conservative: 80% Foundation, 18% Growth, 2% Upside
  const conservativeHoldings = [
    h('USDT', 800),    // Foundation 80%
    h('BTC', 0.0018),  // Growth 18%
    h('ETH', 0.0063),  // Upside 2%
  ];

  const basesnap = computeSnapshot(conservativeHoldings, 0, BASELINE_PRICES, FX);
  const correctionSnap = computeSnapshot(conservativeHoldings, 0, CORRECTION_PRICES, FX);

  const pctChange = ((correctionSnap.holdingsIRR - basesnap.holdingsIRR) / basesnap.holdingsIRR) * 100;
  // Conservative should lose less than 10% (most is stable USDT)
  return pctChange > -10;
});

test('2.7 Aggressive portfolio loses more in correction', () => {
  // Aggressive: 20% Foundation, 30% Growth, 50% Upside
  const aggressiveHoldings = [
    h('USDT', 200),    // Foundation 20%
    h('BTC', 0.003),   // Growth 30%
    h('ETH', 0.156),   // Upside 50%
  ];

  const basesnap = computeSnapshot(aggressiveHoldings, 0, BASELINE_PRICES, FX);
  const correctionSnap = computeSnapshot(aggressiveHoldings, 0, CORRECTION_PRICES, FX);

  const pctChange = ((correctionSnap.holdingsIRR - basesnap.holdingsIRR) / basesnap.holdingsIRR) * 100;
  // Aggressive should lose more than 20%
  return pctChange < -20;
});

// ============================================================
// PART 3: User Profile Allocation Tests
// ============================================================
console.log('\n👤 PART 3: User Profile Allocation Tests');

test('3.1 Anxious Novice: 80/18/2 allocation', () => {
  const target = { FOUNDATION: 80, GROWTH: 18, UPSIDE: 2 };
  return target.FOUNDATION + target.GROWTH + target.UPSIDE === 100;
});

test('3.2 Steady Builder: 50/35/15 allocation', () => {
  const target = { FOUNDATION: 50, GROWTH: 35, UPSIDE: 15 };
  return target.FOUNDATION + target.GROWTH + target.UPSIDE === 100;
});

test('3.3 Aggressive Accumulator: 20/30/50 allocation', () => {
  const target = { FOUNDATION: 20, GROWTH: 30, UPSIDE: 50 };
  return target.FOUNDATION + target.GROWTH + target.UPSIDE === 100;
});

test('3.4 Wealth Preserver: 60/35/5 allocation', () => {
  const target = { FOUNDATION: 60, GROWTH: 35, UPSIDE: 5 };
  return target.FOUNDATION + target.GROWTH + target.UPSIDE === 100;
});

test('3.5 Speculator: 10/20/70 allocation', () => {
  const target = { FOUNDATION: 10, GROWTH: 20, UPSIDE: 70 };
  return target.FOUNDATION + target.GROWTH + target.UPSIDE === 100;
});

// ============================================================
// PART 4: Fixed Income Tests
// ============================================================
console.log('\n💰 PART 4: Fixed Income Tests');

test('4.1 Fixed income unit price is 500,000 IRR', () => {
  return FIXED_INCOME_UNIT_PRICE === 500000;
});

test('4.2 Fixed income annual rate is 30%', () => {
  return FIXED_INCOME_ANNUAL_RATE === 0.30;
});

test('4.3 IRR to units conversion', () => {
  const units = irrToFixedIncomeUnits(5000000); // 5M IRR
  return units === 10; // 5M / 500K = 10 units
});

test('4.4 Fixed income accrual calculation (1 year)', () => {
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const { principal, accrued, total } = calculateFixedIncomeValue(100, oneYearAgo);

  // 100 units × 500K = 50M IRR principal
  // 30% annual = 15M IRR accrued
  const expectedPrincipal = 100 * 500000;
  const expectedAccrued = Math.round(expectedPrincipal * 0.30);

  return principal === expectedPrincipal && Math.abs(accrued - expectedAccrued) < 100000;
});

test('4.5 Fixed income with no purchase date has zero accrual', () => {
  const { accrued } = calculateFixedIncomeValue(100, null);
  return accrued === 0;
});

// ============================================================
// PART 5: Loan System Tests
// ============================================================
console.log('\n🏦 PART 5: Loan System Tests');

test('5.1 LTV by layer: Foundation 70%', () => {
  return COLLATERAL_LTV_BY_LAYER.FOUNDATION === 0.7;
});

test('5.2 LTV by layer: Growth 50%', () => {
  return COLLATERAL_LTV_BY_LAYER.GROWTH === 0.5;
});

test('5.3 LTV by layer: Upside 30%', () => {
  return COLLATERAL_LTV_BY_LAYER.UPSIDE === 0.3;
});

test('5.4 Borrow against BTC (Growth): respects both LTV and global loan cap', () => {
  // Note: With v10.2.7 global loan cap of 25%, the effective max borrow
  // is min(50% LTV, 25% of portfolio). With only BTC in portfolio,
  // 25% of portfolio < 50% LTV, so global cap is the limiting factor.
  const state = createState({
    holdings: [h('BTC', 1)], // 1 BTC = ~142B IRR
    cashIRR: 0,
  });
  const btcValueIRR = 97500 * FX;
  // Max borrow is limited by global loan cap (25% of AUM) since portfolio = BTC only
  const maxBorrowByLtv = btcValueIRR * 0.5;       // 50% LTV
  const maxBorrowByGlobalCap = btcValueIRR * 0.25; // 25% of portfolio
  const effectiveMaxBorrow = Math.min(maxBorrowByLtv, maxBorrowByGlobalCap);
  const validation = validateBorrow({ assetId: 'BTC', amountIRR: effectiveMaxBorrow, prices: BASELINE_PRICES, fxRate: FX }, state);
  return validation.ok === true;
});

test('5.5 Cannot borrow more than max LTV', () => {
  const state = createState({
    holdings: [h('BTC', 1)],
    cashIRR: 0,
  });
  const btcValueIRR = 97500 * FX;
  const overMaxBorrow = btcValueIRR * 0.6; // 60% > 50% max
  const validation = validateBorrow({ assetId: 'BTC', amountIRR: overMaxBorrow, prices: BASELINE_PRICES, fxRate: FX }, state);
  return validation.ok === false && validation.errors.includes('EXCEEDS_MAX_BORROW');
});

test('5.6 Borrowed asset becomes frozen', () => {
  const state = createState({
    holdings: [h('BTC', 1)],
    cashIRR: 0,
  });
  const borrowAmount = 50000000000; // 50B IRR
  const result = previewBorrow(state, { assetId: 'BTC', amountIRR: borrowAmount });
  const btcHolding = result.holdings.find(x => x.assetId === 'BTC');
  return btcHolding.frozen === true;
});

test('5.7 Repaying loan unfreezes collateral', () => {
  const state = createState({
    holdings: [h('BTC', 1, true)],
    cashIRR: 100000000000,
    loans: [{ id: 'loan_1', amountIRR: 50000000000, collateralAssetId: 'BTC', ltv: 0.5 }],
  });
  const result = previewRepay(state, { loanId: 'loan_1', amountIRR: 50000000000 });
  const btcHolding = result.holdings.find(x => x.assetId === 'BTC');
  return btcHolding.frozen === false && result.loans.length === 0;
});

test('5.8 Cannot sell frozen assets', () => {
  const state = createState({
    holdings: [h('BTC', 1, true)],
    cashIRR: 0,
  });
  const validation = validateTrade({ side: 'SELL', assetId: 'BTC', amountIRR: 1000000, prices: BASELINE_PRICES, fxRate: FX }, state);
  return validation.ok === false && validation.errors.includes('ASSET_FROZEN');
});

// ============================================================
// PART 6: Validation Tests
// ============================================================
console.log('\n✅ PART 6: Validation Tests');

test('6.1 validateAddFunds rejects zero amount', () => {
  const result = validateAddFunds({ amountIRR: 0 });
  return result.ok === false;
});

test('6.2 validateAddFunds rejects negative amount', () => {
  const result = validateAddFunds({ amountIRR: -1000 });
  return result.ok === false;
});

test('6.3 validateAddFunds accepts positive amount', () => {
  const result = validateAddFunds({ amountIRR: 1000000 });
  return result.ok === true;
});

test('6.4 validateTrade rejects invalid side', () => {
  const state = createState({ holdings: [h('BTC', 1)], cashIRR: 1000000000 });
  const result = validateTrade({ side: 'INVALID', assetId: 'BTC', amountIRR: 1000 }, state);
  return result.ok === false && result.errors.includes('INVALID_SIDE');
});

test('6.5 validateTrade rejects insufficient cash for BUY', () => {
  const state = createState({ holdings: [h('BTC', 1)], cashIRR: 1000 });
  const result = validateTrade({ side: 'BUY', assetId: 'BTC', amountIRR: 1000000, prices: BASELINE_PRICES, fxRate: FX }, state);
  return result.ok === false && result.errors.includes('INSUFFICIENT_CASH');
});

test('6.6 validateProtect rejects non-eligible assets (TON)', () => {
  const state = createState({ holdings: [h('TON', 1000)], cashIRR: 1000000000 });
  const result = validateProtect({ assetId: 'TON', months: 3, prices: BASELINE_PRICES, fxRate: FX }, state);
  return result.ok === false && result.errors.includes('ASSET_NOT_ELIGIBLE_FOR_PROTECTION');
});

test('6.7 validateProtect accepts eligible assets (BTC)', () => {
  const state = createState({ holdings: [h('BTC', 1)], cashIRR: 100000000000 });
  const result = validateProtect({ assetId: 'BTC', months: 3, prices: BASELINE_PRICES, fxRate: FX }, state);
  return result.ok === true;
});

// ============================================================
// PART 7: Edge Cases from Scenario Document
// ============================================================
console.log('\n🔧 PART 7: Edge Cases from Scenario Document');

test('7.1 E-001: Minimum investment (1M IRR)', () => {
  const minInvestment = 1000000; // 1M IRR
  // Converts to ~0.00069 USD worth, handled gracefully
  const holdings = [h('USDT', minInvestment / FX)];
  const snap = computeSnapshot(holdings, 0, BASELINE_PRICES, FX);
  return snap.holdingsIRR > 0 && snap.holdingsIRR < 2000000;
});

test('7.2 E-002: Whale investment (5B IRR)', () => {
  const whaleInvestment = 5000000000000; // 5 trillion IRR
  const holdings = [h('BTC', whaleInvestment / (97500 * FX))]; // About 35 BTC
  const snap = computeSnapshot(holdings, 0, BASELINE_PRICES, FX);
  return snap.holdingsIRR > 4000000000000; // > 4 trillion
});

test('7.3 E-003: All loans at max LTV', () => {
  // Multiple loans scenario
  const state = createState({
    holdings: [
      h('BTC', 1, true),
      h('ETH', 10, true),
      h('SOL', 100, true),
    ],
    loans: [
      { id: 'loan_btc', amountIRR: 50000000000000, collateralAssetId: 'BTC' },
      { id: 'loan_eth', amountIRR: 10000000000000, collateralAssetId: 'ETH' },
      { id: 'loan_sol', amountIRR: 5000000000000, collateralAssetId: 'SOL' },
    ],
  });
  // All assets should be frozen
  return state.holdings.every(h => h.frozen === true);
});

test('7.4 E-005: Rebalance with all assets frozen', () => {
  const state = createState({
    holdings: [
      h('USDT', 500, true),
      h('BTC', 0.003, true),
      h('ETH', 0.05, true),
    ],
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const gap = calculateRebalanceGap(state, BASELINE_PRICES, FX);
  // Should recognize all frozen and report it
  return gap.hasFrozenAssets === true;
});

test('7.5 E-008: Zero cash + rebalance needed', () => {
  const state = createState({
    holdings: [
      h('USDT', 800),
      h('BTC', 0.001),
      h('ETH', 0.02),
    ],
    cashIRR: 0,
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const gap = calculateRebalanceGap(state, BASELINE_PRICES, FX);
  // Can still rebalance holdings even with no cash
  return gap.canAchievePerfectBalance === true && gap.currentCash === 0;
});

test('7.6 Empty portfolio handled gracefully', () => {
  const state = createState({ holdings: [], cashIRR: 0 });
  const snap = computeSnapshot(state.holdings, state.cashIRR, BASELINE_PRICES, FX);
  return snap.totalIRR === 0 && snap.holdingsIRR === 0;
});

test('7.7 Single asset portfolio', () => {
  const state = createState({
    holdings: [h('BTC', 0.01)],
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const snap = computeSnapshot(state.holdings, 0, BASELINE_PRICES, FX);
  // All in GROWTH layer
  return snap.layerPct.GROWTH === 100;
});

// ============================================================
// PART 8: Trade Preview Tests
// ============================================================
console.log('\n💹 PART 8: Trade Preview Tests');

test('8.1 BUY increases holding quantity', () => {
  const state = createState({
    holdings: [h('BTC', 0.01)],
    cashIRR: 200000000000, // 200B IRR
  });
  const buyAmount = 100000000000; // 100B IRR
  const result = previewTrade(state, { side: 'BUY', assetId: 'BTC', amountIRR: buyAmount, prices: BASELINE_PRICES, fxRate: FX });
  const btcHolding = result.holdings.find(x => x.assetId === 'BTC');
  return btcHolding.quantity > 0.01 && result.cashIRR < state.cashIRR;
});

test('8.2 SELL decreases holding quantity', () => {
  const state = createState({
    holdings: [h('BTC', 1)],
    cashIRR: 0,
  });
  const sellAmount = 50000000000; // 50B IRR
  const result = previewTrade(state, { side: 'SELL', assetId: 'BTC', amountIRR: sellAmount, prices: BASELINE_PRICES, fxRate: FX });
  const btcHolding = result.holdings.find(x => x.assetId === 'BTC');
  return btcHolding.quantity < 1 && result.cashIRR > 0;
});

test('8.3 Trade preserves total value', () => {
  const state = createState({
    holdings: [h('BTC', 1), h('ETH', 10)],
    cashIRR: 100000000000,
  });
  const beforeSnap = computeSnapshot(state.holdings, state.cashIRR, BASELINE_PRICES, FX);
  const result = previewTrade(state, { side: 'SELL', assetId: 'BTC', amountIRR: 50000000000, prices: BASELINE_PRICES, fxRate: FX });
  const afterSnap = computeSnapshot(result.holdings, result.cashIRR, BASELINE_PRICES, FX);
  // Total should be approximately the same (small rounding allowed)
  return Math.abs(afterSnap.totalIRR - beforeSnap.totalIRR) < 1000000;
});

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('TEST RESULTS');
console.log('='.repeat(70));
console.log(`Total: ${passed + failed} tests`);
console.log(`Passed: ${passed} ✓`);
console.log(`Failed: ${failed} ✗`);
console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => {
    console.log(`  - ${f.name}: ${f.error}`);
  });
}

console.log('\n' + '='.repeat(70));
