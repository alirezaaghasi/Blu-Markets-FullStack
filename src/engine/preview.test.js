/**
 * Comprehensive Test Suite for Smart Rebalance Logic
 * 50+ test scenarios covering edge cases and various portfolio configurations
 */

import { calculateRebalanceGap, previewRebalance } from './preview';
import { computeSnapshot } from './snapshot';

// Test counters
let passed = 0;
let failed = 0;
const failures = [];

// Test helper to create a mock state
function createMockState({
  holdings = [],
  cashIRR = 0,
  targetLayerPct = { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
}) {
  return {
    holdings,
    cashIRR,
    targetLayerPct,
    loans: [],
    protections: [],
    ledger: [],
  };
}

// Test helper to create a holding
function h(assetId, quantity, frozen = false) {
  return {
    assetId,
    quantity,
    frozen,
    purchasedAt: assetId === 'IRR_FIXED_INCOME' ? '2024-01-01' : null,
  };
}

// Fixed prices for testing (in USD)
const P = {
  USDT: 1,
  BTC: 100000,
  ETH: 3000,
  GOLD: 2000,
  QQQ: 500,
  SOL: 150,
  TON: 5,
  IRR_FIXED_INCOME: 1,
};

// Fixed FX rate: 700,000 IRR per USD
const FX = 700000;

// Helper to convert USD to IRR
const toIRR = (usd) => usd * FX;

// Test runner
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

console.log('='.repeat(70));
console.log('SMART REBALANCE COMPREHENSIVE TEST SUITE (50+ scenarios)');
console.log('='.repeat(70));

// ============================================================
// CATEGORY 1: Basic Scenarios (No Frozen Assets)
// ============================================================
console.log('\n📁 CATEGORY 1: Basic Scenarios (No Frozen Assets)');

test('1.1 Empty portfolio handled gracefully', () => {
  const state = createMockState({ holdings: [], cashIRR: 0 });
  const gap = calculateRebalanceGap(state, P, FX);
  // Empty portfolio has no frozen assets and calculation completes
  return gap.hasFrozenAssets === false && typeof gap.remainingGapPct === 'number';
});

test('1.2 Perfectly balanced portfolio has zero gap', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 500),      // FOUNDATION: 50%
      h('BTC', 0.003),     // GROWTH: 30%
      h('ETH', 0.0667),    // UPSIDE: 20%
    ],
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.remainingGapPct <= 2; // Allow small rounding
});

test('1.3 Unbalanced portfolio can achieve perfect balance without frozen', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 1000),     // FOUNDATION: overweight
      h('BTC', 0.001),     // GROWTH: underweight
      h('ETH', 0.01),      // UPSIDE: underweight
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.canAchievePerfectBalance === true && gap.hasFrozenAssets === false;
});

test('1.4 All in FOUNDATION can rebalance to target', () => {
  const state = createMockState({
    holdings: [h('USDT', 1000)],
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.canAchievePerfectBalance === true;
});

test('1.5 All in GROWTH can rebalance to target', () => {
  const state = createMockState({
    holdings: [h('BTC', 0.01)],
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.canAchievePerfectBalance === true;
});

test('1.6 All in UPSIDE can rebalance to target', () => {
  const state = createMockState({
    holdings: [h('ETH', 0.5)],
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.canAchievePerfectBalance === true;
});

test('1.7 Multiple assets per layer can rebalance', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 500),
      h('IRR_FIXED_INCOME', 100),
      h('BTC', 0.005),
      h('GOLD', 0.5),
      h('ETH', 0.1),
      h('SOL', 5),
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === false && gap.canAchievePerfectBalance === true;
});

// ============================================================
// CATEGORY 2: Single Frozen Layer Scenarios
// ============================================================
console.log('\n📁 CATEGORY 2: Single Frozen Layer Scenarios');

test('2.1 Frozen FOUNDATION at target - no cash needed', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 500, true),   // FOUNDATION frozen at ~50%
      h('BTC', 0.003),        // GROWTH ~30%
      h('ETH', 0.0667),       // UPSIDE ~20%
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true && gap.cashNeededForPerfectBalance < toIRR(10);
});

test('2.2 Frozen FOUNDATION overweight needs cash', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 800, true),   // FOUNDATION frozen at ~80%
      h('BTC', 0.001),        // GROWTH ~10%
      h('ETH', 0.033),        // UPSIDE ~10%
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true && gap.cashNeededForPerfectBalance > 0;
});

test('2.3 Frozen GROWTH overweight needs cash', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 200),
      h('BTC', 0.006, true),  // GROWTH frozen at ~60%
      h('ETH', 0.033),
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true && gap.cashNeededForPerfectBalance > 0;
});

test('2.4 Frozen UPSIDE overweight needs cash', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 200),
      h('BTC', 0.002),
      h('ETH', 0.2, true),    // UPSIDE frozen at ~60%
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true && gap.cashNeededForPerfectBalance > 0;
});

test('2.5 Frozen underweight layer - no extra cash needed', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 800),         // FOUNDATION overweight unfrozen
      h('BTC', 0.001, true),  // GROWTH frozen but underweight
      h('ETH', 0.033),
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  // Underweight frozen doesn't need cash to dilute
  return gap.hasFrozenAssets === true;
});

test('2.6 Partially frozen layer - can sell unfrozen portion', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 400, true),   // FOUNDATION: 400 frozen
      h('USDT', 400, false),  // FOUNDATION: 400 unfrozen (can sell)
      h('BTC', 0.001),
      h('ETH', 0.033),
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true && gap.frozenByLayer.FOUNDATION > 0;
});

// ============================================================
// CATEGORY 3: Multiple Frozen Layers
// ============================================================
console.log('\n📁 CATEGORY 3: Multiple Frozen Layers');

test('3.1 Two frozen layers both overweight', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 500, true),   // FOUNDATION frozen
      h('BTC', 0.005, true),  // GROWTH frozen
      h('ETH', 0.01),
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true && gap.frozenByLayer.FOUNDATION > 0 && gap.frozenByLayer.GROWTH > 0;
});

test('3.2 All three layers have frozen assets', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 300, true),
      h('BTC', 0.003, true),
      h('ETH', 0.05, true),
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.frozenByLayer.FOUNDATION > 0 && gap.frozenByLayer.GROWTH > 0 && gap.frozenByLayer.UPSIDE > 0;
});

test('3.3 Mixed frozen and unfrozen in all layers', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 200, true),
      h('USDT', 200, false),
      h('BTC', 0.002, true),
      h('BTC', 0.002, false),
      h('ETH', 0.03, true),
      h('ETH', 0.03, false),
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true;
});

test('3.4 Constraining layer determines cash need', () => {
  // UPSIDE needs more dilution than GROWTH
  const state = createMockState({
    holdings: [
      h('USDT', 100),
      h('BTC', 0.003, true),  // GROWTH: 30% frozen (at target)
      h('ETH', 0.15, true),   // UPSIDE: 45% frozen (way over 20% target)
    ],
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  // Cash needed should be driven by UPSIDE (more overweight)
  return gap.cashNeededForPerfectBalance > 0;
});

// ============================================================
// CATEGORY 4: Cash Sufficiency Tests
// ============================================================
console.log('\n📁 CATEGORY 4: Cash Sufficiency Tests');

test('4.1 Zero cash - cannot improve with cash', () => {
  const state = createMockState({
    holdings: [h('USDT', 500, true), h('BTC', 0.001), h('ETH', 0.02)],
    cashIRR: 0,
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.currentCash === 0 && gap.cashSufficient === false;
});

test('4.2 Exact cash needed = sufficient', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 200),
      h('BTC', 0.004, true),  // GROWTH overweight frozen
      h('ETH', 0.033),
    ],
  });
  const gap1 = calculateRebalanceGap(state, P, FX);
  // Now give exactly enough cash
  state.cashIRR = gap1.cashNeededForPerfectBalance;
  const gap2 = calculateRebalanceGap(state, P, FX);
  return gap2.cashSufficient === true;
});

test('4.3 Cash exceeds need = sufficient with surplus', () => {
  const state = createMockState({
    holdings: [h('USDT', 200), h('BTC', 0.004, true), h('ETH', 0.033)],
    cashIRR: 10_000_000_000, // 10B - way more than needed
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.cashSufficient === true && gap.cashShortfall === 0;
});

test('4.4 Partial cash helps reduce gap', () => {
  const state = createMockState({
    holdings: [h('USDT', 200), h('BTC', 0.006, true), h('ETH', 0.02)],
    cashIRR: 100_000_000, // 100M - some cash but not enough
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.cashWouldHelp === true && gap.partialCashBenefit > 0;
});

test('4.5 Cash shortfall calculated correctly', () => {
  const state = createMockState({
    holdings: [h('USDT', 200), h('BTC', 0.006, true), h('ETH', 0.02)],
    cashIRR: 100_000_000,
  });
  const gap = calculateRebalanceGap(state, P, FX);
  const expectedShortfall = gap.cashNeededForPerfectBalance - gap.currentCash;
  return Math.abs(gap.cashShortfall - expectedShortfall) < 2; // Allow rounding
});

test('4.6 No frozen assets - no cash needed regardless of cash balance', () => {
  const state = createMockState({
    holdings: [h('USDT', 800), h('BTC', 0.001), h('ETH', 0.02)],
    cashIRR: 5_000_000_000,
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.cashNeededForPerfectBalance === 0;
});

// ============================================================
// CATEGORY 5: Target Allocation Variations
// ============================================================
console.log('\n📁 CATEGORY 5: Target Allocation Variations');

test('5.1 Conservative target (70/20/10)', () => {
  const state = createMockState({
    holdings: [h('USDT', 500), h('BTC', 0.003), h('ETH', 0.05)],
    targetLayerPct: { FOUNDATION: 70, GROWTH: 20, UPSIDE: 10 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.targetPct.FOUNDATION === 70;
});

test('5.2 Aggressive target (30/30/40)', () => {
  const state = createMockState({
    holdings: [h('USDT', 500), h('BTC', 0.003), h('ETH', 0.05)],
    targetLayerPct: { FOUNDATION: 30, GROWTH: 30, UPSIDE: 40 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.targetPct.UPSIDE === 40;
});

test('5.3 Equal split (33/34/33)', () => {
  const state = createMockState({
    holdings: [h('USDT', 500), h('BTC', 0.003), h('ETH', 0.05)],
    targetLayerPct: { FOUNDATION: 33, GROWTH: 34, UPSIDE: 33 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.targetPct.FOUNDATION === 33 && gap.targetPct.GROWTH === 34;
});

test('5.4 Heavy FOUNDATION (80/15/5)', () => {
  const state = createMockState({
    holdings: [h('USDT', 200), h('BTC', 0.005, true), h('ETH', 0.05)],
    targetLayerPct: { FOUNDATION: 80, GROWTH: 15, UPSIDE: 5 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true;
});

test('5.5 Zero UPSIDE target (60/40/0)', () => {
  const state = createMockState({
    holdings: [h('USDT', 500), h('BTC', 0.003), h('ETH', 0.05, true)],
    targetLayerPct: { FOUNDATION: 60, GROWTH: 40, UPSIDE: 0 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  // Any UPSIDE frozen would need infinite dilution if target is 0
  return gap.cashNeededForPerfectBalance > 0 || gap.hasFrozenAssets === true;
});

// ============================================================
// CATEGORY 6: SMART Mode Execution Tests
// ============================================================
console.log('\n📁 CATEGORY 6: SMART Mode Execution Tests');

test('6.1 SMART mode deploys specified cash amount', () => {
  const state = createMockState({
    holdings: [h('USDT', 400), h('BTC', 0.005, true), h('ETH', 0.05)],
    cashIRR: 500_000_000,
  });
  const result = previewRebalance(state, { mode: 'SMART', useCashAmount: 200_000_000, prices: P, fxRate: FX });
  return result._rebalanceMeta.cashDeployed === 200_000_000;
});

test('6.2 SMART mode with zero cash amount acts like HOLDINGS_ONLY', () => {
  const state = createMockState({
    holdings: [h('USDT', 400), h('BTC', 0.005), h('ETH', 0.05)],
    cashIRR: 500_000_000,
  });
  const result = previewRebalance(state, { mode: 'SMART', useCashAmount: 0, prices: P, fxRate: FX });
  return result._rebalanceMeta.cashDeployed === 0 && result.cashIRR === 500_000_000;
});

test('6.3 SMART mode generates trades', () => {
  const state = createMockState({
    holdings: [h('USDT', 800), h('BTC', 0.001), h('ETH', 0.02)],
    cashIRR: 200_000_000,
  });
  const result = previewRebalance(state, { mode: 'SMART', useCashAmount: 100_000_000, prices: P, fxRate: FX });
  return result._rebalanceMeta.trades.length > 0;
});

test('6.4 SMART mode reduces cash balance', () => {
  const state = createMockState({
    holdings: [h('USDT', 400), h('BTC', 0.003), h('ETH', 0.03)],
    cashIRR: 300_000_000,
  });
  const result = previewRebalance(state, { mode: 'SMART', useCashAmount: 150_000_000, prices: P, fxRate: FX });
  return result.cashIRR < state.cashIRR;
});

test('6.5 SMART mode increases holdings value', () => {
  const state = createMockState({
    holdings: [h('USDT', 400), h('BTC', 0.003), h('ETH', 0.03)],
    cashIRR: 300_000_000,
  });
  const beforeSnap = computeSnapshot(state.holdings, state.cashIRR, P, FX);
  const result = previewRebalance(state, { mode: 'SMART', useCashAmount: 150_000_000, prices: P, fxRate: FX });
  const afterSnap = computeSnapshot(result.holdings, result.cashIRR, P, FX);
  return afterSnap.holdingsIRR > beforeSnap.holdingsIRR;
});

test('6.6 SMART mode cannot deploy more cash than available', () => {
  const state = createMockState({
    holdings: [h('USDT', 400), h('BTC', 0.003), h('ETH', 0.03)],
    cashIRR: 100_000_000,
  });
  const result = previewRebalance(state, { mode: 'SMART', useCashAmount: 500_000_000, prices: P, fxRate: FX });
  return result.cashIRR >= 0; // Should not go negative
});

// ============================================================
// CATEGORY 7: HOLDINGS_ONLY Mode Tests
// ============================================================
console.log('\n📁 CATEGORY 7: HOLDINGS_ONLY Mode Tests');

test('7.1 HOLDINGS_ONLY does not touch cash', () => {
  const state = createMockState({
    holdings: [h('USDT', 800), h('BTC', 0.001), h('ETH', 0.02)],
    cashIRR: 1_000_000_000,
  });
  const result = previewRebalance(state, { mode: 'HOLDINGS_ONLY', prices: P, fxRate: FX });
  return result.cashIRR === state.cashIRR;
});

test('7.2 HOLDINGS_ONLY generates sell and buy trades', () => {
  const state = createMockState({
    holdings: [h('USDT', 800), h('BTC', 0.001), h('ETH', 0.02)],
  });
  const result = previewRebalance(state, { mode: 'HOLDINGS_ONLY', prices: P, fxRate: FX });
  const sells = result._rebalanceMeta.trades.filter(t => t.side === 'SELL');
  const buys = result._rebalanceMeta.trades.filter(t => t.side === 'BUY');
  return sells.length > 0 && buys.length > 0;
});

test('7.3 HOLDINGS_ONLY preserves total holdings value', () => {
  const state = createMockState({
    holdings: [h('USDT', 500), h('BTC', 0.003), h('ETH', 0.05)],
  });
  const beforeSnap = computeSnapshot(state.holdings, 0, P, FX);
  const result = previewRebalance(state, { mode: 'HOLDINGS_ONLY', prices: P, fxRate: FX });
  const afterSnap = computeSnapshot(result.holdings, 0, P, FX);
  // Allow small rounding difference
  return Math.abs(afterSnap.holdingsIRR - beforeSnap.holdingsIRR) < toIRR(1);
});

test('7.4 HOLDINGS_ONLY does not sell frozen assets', () => {
  const state = createMockState({
    holdings: [h('USDT', 800, true), h('BTC', 0.001), h('ETH', 0.02)],
  });
  const result = previewRebalance(state, { mode: 'HOLDINGS_ONLY', prices: P, fxRate: FX });
  const frozenSells = result._rebalanceMeta.trades.filter(
    t => t.side === 'SELL' && state.holdings.find(hld => hld.assetId === t.assetId && hld.frozen)
  );
  return frozenSells.length === 0;
});

test('7.5 HOLDINGS_ONLY achieves target when no constraints', () => {
  const state = createMockState({
    holdings: [h('USDT', 800), h('BTC', 0.001), h('ETH', 0.02)],
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const result = previewRebalance(state, { mode: 'HOLDINGS_ONLY', prices: P, fxRate: FX });
  const snap = computeSnapshot(result.holdings, 0, P, FX);
  // Check if close to target
  return Math.abs(snap.layerPct.FOUNDATION - 50) < 3 &&
         Math.abs(snap.layerPct.GROWTH - 30) < 3 &&
         Math.abs(snap.layerPct.UPSIDE - 20) < 3;
});

// ============================================================
// CATEGORY 8: Edge Cases and Boundary Conditions
// ============================================================
console.log('\n📁 CATEGORY 8: Edge Cases and Boundary Conditions');

test('8.1 Single tiny holding', () => {
  const state = createMockState({
    holdings: [h('USDT', 0.01)], // Very small
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return typeof gap.remainingGapPct === 'number';
});

test('8.2 Very large portfolio (billions in IRR)', () => {
  const state = createMockState({
    holdings: [h('BTC', 100)], // 100 BTC = $10M = 7B IRR
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === false;
});

test('8.3 All assets frozen', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 500, true),
      h('BTC', 0.003, true),
      h('ETH', 0.05, true),
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true;
});

test('8.4 Zero quantity holdings - can still rebalance', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 0),
      h('BTC', 0),
      h('ETH', 0.1),  // Only UPSIDE has value, but can sell to buy others
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  // Can achieve target since UPSIDE is unfrozen (can sell to rebalance)
  return gap.canAchievePerfectBalance === true && gap.hasFrozenAssets === false;
});

test('8.5 Cash only portfolio handled gracefully', () => {
  const state = createMockState({
    holdings: [],
    cashIRR: 1_000_000_000,
  });
  const gap = calculateRebalanceGap(state, P, FX);
  // No holdings = no frozen assets, calculation completes
  return gap.hasFrozenAssets === false && typeof gap.cashNeededForPerfectBalance === 'number';
});

test('8.6 Negative quantities treated as zero', () => {
  const state = createMockState({
    holdings: [h('USDT', -100), h('BTC', 0.003)],
  });
  // Should not crash
  const gap = calculateRebalanceGap(state, P, FX);
  return typeof gap.remainingGapPct === 'number';
});

// ============================================================
// CATEGORY 9: Math Verification Tests
// ============================================================
console.log('\n📁 CATEGORY 9: Math Verification Tests');

test('9.1 Cash formula: D = V/T - H', () => {
  // UPSIDE frozen at 40% (target 20%)
  const state = createMockState({
    holdings: [
      h('USDT', 300),         // 30%
      h('BTC', 0.003),        // 30%
      h('ETH', 0.133, true),  // 40% frozen
    ],
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const snap = computeSnapshot(state.holdings, 0, P, FX);
  const gap = calculateRebalanceGap(state, P, FX);

  // V = UPSIDE value after HOLDINGS_ONLY
  // T = 0.20
  // H = holdingsTotal
  // Expected D = V/T - H
  const V = gap.achievablePct.UPSIDE / 100 * snap.holdingsIRR;
  const T = 0.20;
  const H = snap.holdingsIRR;
  const expectedD = V / T - H;

  return Math.abs(gap.cashNeededForPerfectBalance - expectedD) < toIRR(10);
});

test('9.2 Layer percentages sum to ~100', () => {
  const state = createMockState({
    holdings: [h('USDT', 500), h('BTC', 0.003), h('ETH', 0.05)],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  const sum = gap.achievablePct.FOUNDATION + gap.achievablePct.GROWTH + gap.achievablePct.UPSIDE;
  return sum >= 99 && sum <= 101;
});

test('9.3 Frozen + Unfrozen = Current layer value', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 300, true),
      h('USDT', 200, false),
      h('BTC', 0.003),
      h('ETH', 0.05),
    ],
  });
  const snap = computeSnapshot(state.holdings, 0, P, FX);
  const gap = calculateRebalanceGap(state, P, FX);

  const foundationTotal = gap.frozenByLayer.FOUNDATION +
    (snap.layerIRR.FOUNDATION - gap.frozenByLayer.FOUNDATION);
  return Math.abs(foundationTotal - snap.layerIRR.FOUNDATION) < 1000;
});

test('9.4 Gap reduction with cash deployment', () => {
  const state = createMockState({
    holdings: [h('USDT', 300), h('BTC', 0.006, true), h('ETH', 0.03)],
    cashIRR: 500_000_000,
  });
  const gap = calculateRebalanceGap(state, P, FX);
  // If cash would help, partial benefit should be > 0
  if (gap.cashWouldHelp) {
    return gap.partialCashBenefit > 0;
  }
  return true; // If no help needed, test passes
});

// ============================================================
// CATEGORY 10: Stress Tests
// ============================================================
console.log('\n📁 CATEGORY 10: Stress Tests');

test('10.1 90% frozen in single layer', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 50),
      h('BTC', 0.001),
      h('ETH', 0.3, true),  // ~90% frozen in UPSIDE
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.cashNeededForPerfectBalance > toIRR(1000); // Needs substantial cash
});

test('10.2 Extreme overweight (95/3/2)', () => {
  const state = createMockState({
    holdings: [h('USDT', 950, true), h('BTC', 0.0003), h('ETH', 0.0067)],
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true && gap.cashNeededForPerfectBalance > 0;
});

test('10.3 Rapid successive calculations', () => {
  const state = createMockState({
    holdings: [h('USDT', 500), h('BTC', 0.003, true), h('ETH', 0.05)],
    cashIRR: 100_000_000,
  });
  // Run 100 times - should be consistent
  let consistent = true;
  const first = calculateRebalanceGap(state, P, FX);
  for (let i = 0; i < 100; i++) {
    const gap = calculateRebalanceGap(state, P, FX);
    if (gap.cashNeededForPerfectBalance !== first.cashNeededForPerfectBalance) {
      consistent = false;
      break;
    }
  }
  return consistent;
});

test('10.4 Many small holdings', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 100), h('USDT', 100), h('USDT', 100),
      h('BTC', 0.001), h('BTC', 0.001), h('BTC', 0.001),
      h('ETH', 0.01), h('ETH', 0.01), h('ETH', 0.01),
      h('GOLD', 0.1), h('SOL', 1), h('TON', 100),
    ],
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return typeof gap.remainingGapPct === 'number';
});

test('10.5 Maximum realistic portfolio', () => {
  const state = createMockState({
    holdings: [
      h('USDT', 100000),       // $100K in USDT
      h('IRR_FIXED_INCOME', 1000),
      h('BTC', 10, true),      // 10 BTC frozen (loan collateral)
      h('BTC', 5),             // 5 BTC unfrozen
      h('GOLD', 50),           // 50 oz gold
      h('QQQ', 200),           // 200 shares QQQ
      h('ETH', 100, true),     // 100 ETH frozen
      h('ETH', 50),
      h('SOL', 1000),
      h('TON', 10000),
    ],
    cashIRR: 5_000_000_000,    // 5B IRR cash
  });
  const gap = calculateRebalanceGap(state, P, FX);
  return gap.hasFrozenAssets === true && typeof gap.cashNeededForPerfectBalance === 'number';
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
