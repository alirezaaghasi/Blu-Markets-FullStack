/**
 * Test scenarios for Smart Rebalance logic
 * Tests calculateRebalanceGap and previewRebalance functions
 */

import { calculateRebalanceGap, previewRebalance } from './preview.js';
import { computeSnapshot } from './snapshot.js';

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
function createHolding(assetId, quantity, frozen = false) {
  return {
    assetId,
    quantity,
    frozen,
    purchasedAt: assetId === 'IRR_FIXED_INCOME' ? '2024-01-01' : null,
  };
}

// Fixed prices for testing (in USD)
const TEST_PRICES = {
  USDT: 1,
  BTC: 100000,
  ETH: 3000,
  GOLD: 2000,
  QQQ: 500,
  SOL: 150,
  TON: 5,
  IRR_FIXED_INCOME: 1,
};

// Fixed FX rate for testing
const TEST_FX_RATE = 700000; // 700,000 IRR per USD

console.log('='.repeat(60));
console.log('SMART REBALANCE TEST SCENARIOS');
console.log('='.repeat(60));

// ============================================================
// SCENARIO 1: No frozen assets - should achieve perfect balance
// ============================================================
console.log('\n--- SCENARIO 1: No frozen assets ---');
{
  const state = createMockState({
    holdings: [
      createHolding('USDT', 1000, false),    // FOUNDATION: 1000 USD = 700M IRR
      createHolding('BTC', 0.01, false),      // GROWTH: 1000 USD = 700M IRR
      createHolding('ETH', 0.333, false),     // UPSIDE: ~1000 USD = 700M IRR
    ],
    cashIRR: 100_000_000, // 100M cash
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });

  const gap = calculateRebalanceGap(state, TEST_PRICES, TEST_FX_RATE);

  console.log('Holdings: ~700M per layer (2.1B total)');
  console.log('Cash: 100M IRR');
  console.log('Targets: F=50%, G=30%, U=20%');
  console.log('Current: F=33%, G=33%, U=33%');
  console.log('');
  console.log('Results:');
  console.log('  hasFrozenAssets:', gap.hasFrozenAssets);
  console.log('  remainingGapPct:', gap.remainingGapPct, '%');
  console.log('  canAchievePerfectBalance:', gap.canAchievePerfectBalance);
  console.log('  cashNeededForPerfectBalance:', gap.cashNeededForPerfectBalance.toLocaleString(), 'IRR');
  console.log('  achievablePct:', gap.achievablePct);

  // Verify: With no frozen assets, should be able to achieve perfect balance
  const passed = gap.hasFrozenAssets === false && gap.remainingGapPct < 5;
  console.log('  PASSED:', passed ? 'YES' : 'NO');
}

// ============================================================
// SCENARIO 2: Frozen assets in overweight layer - needs cash
// ============================================================
console.log('\n--- SCENARIO 2: Frozen GROWTH layer (overweight) ---');
{
  // GROWTH is 60% (target 30%), with most frozen
  const state = createMockState({
    holdings: [
      createHolding('USDT', 500, false),      // FOUNDATION: 500 USD = 350M IRR (25%)
      createHolding('BTC', 0.008, true),      // GROWTH frozen: 800 USD = 560M IRR
      createHolding('BTC', 0.004, false),     // GROWTH unfrozen: 400 USD = 280M IRR
      // Total GROWTH: 1200 USD = 840M IRR (60%)
      createHolding('ETH', 0.083, false),     // UPSIDE: ~250 USD = 175M IRR (12.5%)
    ],
    cashIRR: 200_000_000, // 200M cash
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });

  const gap = calculateRebalanceGap(state, TEST_PRICES, TEST_FX_RATE);
  const snap = computeSnapshot(state.holdings, state.cashIRR, TEST_PRICES, TEST_FX_RATE);

  console.log('Holdings total:', snap.holdingsIRR.toLocaleString(), 'IRR');
  console.log('Layer values:', snap.layerIRR);
  console.log('Current %:', snap.layerPct);
  console.log('Targets: F=50%, G=30%, U=20%');
  console.log('Frozen in GROWTH:', gap.frozenByLayer.GROWTH.toLocaleString(), 'IRR');
  console.log('Cash: 200M IRR');
  console.log('');
  console.log('Results:');
  console.log('  hasFrozenAssets:', gap.hasFrozenAssets);
  console.log('  remainingGapPct:', gap.remainingGapPct, '%');
  console.log('  achievablePct:', gap.achievablePct);
  console.log('  cashNeededForPerfectBalance:', gap.cashNeededForPerfectBalance.toLocaleString(), 'IRR');
  console.log('  cashSufficient:', gap.cashSufficient);
  console.log('  cashShortfall:', gap.cashShortfall.toLocaleString(), 'IRR');
  console.log('  cashWouldHelp:', gap.cashWouldHelp);

  // Verify: Should have frozen assets and need cash
  const passed = gap.hasFrozenAssets === true && gap.cashNeededForPerfectBalance > 0;
  console.log('  PASSED:', passed ? 'YES' : 'NO');
}

// ============================================================
// SCENARIO 3: User has ENOUGH cash for perfect balance
// ============================================================
console.log('\n--- SCENARIO 3: Sufficient cash for perfect balance ---');
{
  // UPSIDE is 40% (target 20%), all frozen
  const state = createMockState({
    holdings: [
      createHolding('USDT', 600, false),      // FOUNDATION: 600 USD = 420M IRR (30%)
      createHolding('BTC', 0.006, false),     // GROWTH: 600 USD = 420M IRR (30%)
      createHolding('ETH', 0.267, true),      // UPSIDE frozen: 800 USD = 560M IRR (40%)
    ],
    cashIRR: 1_500_000_000, // 1.5B cash - should be enough (with buffer for precision)
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });

  const gap = calculateRebalanceGap(state, TEST_PRICES, TEST_FX_RATE);
  const snap = computeSnapshot(state.holdings, state.cashIRR, TEST_PRICES, TEST_FX_RATE);

  console.log('Holdings total:', snap.holdingsIRR.toLocaleString(), 'IRR');
  console.log('UPSIDE frozen at 40% (target 20%)');
  console.log('Cash: 1.5B IRR');
  console.log('');
  console.log('Results:');
  console.log('  hasFrozenAssets:', gap.hasFrozenAssets);
  console.log('  remainingGapPct after HOLDINGS_ONLY:', gap.remainingGapPct, '%');
  console.log('  achievablePct:', gap.achievablePct);
  console.log('  cashNeededForPerfectBalance:', gap.cashNeededForPerfectBalance.toLocaleString(), 'IRR');
  console.log('  currentCash:', gap.currentCash.toLocaleString(), 'IRR');
  console.log('  cashSufficient:', gap.cashSufficient);
  console.log('  canAchieveWithCash:', gap.canAchieveWithCash);

  // Verify: Cash should be sufficient
  const passed = gap.cashSufficient === true && gap.canAchieveWithCash === true;
  console.log('  PASSED:', passed ? 'YES' : 'NO');

  // Verify the math: UPSIDE=560M at 20% needs total of 2.8B
  // Current holdings = 1.4B, so need 1.4B additional cash
  console.log('');
  console.log('  Math check:');
  console.log('  - UPSIDE value: 560M IRR');
  console.log('  - To be 20%: need total of 560M/0.20 = 2.8B');
  console.log('  - Holdings: 1.4B, so need additional:', (2800000000 - 1400000000).toLocaleString());
  console.log('  - Calculated need:', gap.cashNeededForPerfectBalance.toLocaleString());
}

// ============================================================
// SCENARIO 4: Extreme case - 80% in one frozen layer
// ============================================================
console.log('\n--- SCENARIO 4: Extreme imbalance (80% frozen in UPSIDE) ---');
{
  const state = createMockState({
    holdings: [
      createHolding('USDT', 100, false),      // FOUNDATION: 100 USD = 70M IRR (5%)
      createHolding('BTC', 0.003, false),     // GROWTH: 300 USD = 210M IRR (15%)
      createHolding('ETH', 0.533, true),      // UPSIDE frozen: 1600 USD = 1.12B IRR (80%)
    ],
    cashIRR: 500_000_000, // 500M cash
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });

  const gap = calculateRebalanceGap(state, TEST_PRICES, TEST_FX_RATE);
  const snap = computeSnapshot(state.holdings, state.cashIRR, TEST_PRICES, TEST_FX_RATE);

  console.log('Holdings total:', snap.holdingsIRR.toLocaleString(), 'IRR');
  console.log('UPSIDE frozen at 80% (target 20%)');
  console.log('Cash: 500M IRR');
  console.log('');
  console.log('Results:');
  console.log('  hasFrozenAssets:', gap.hasFrozenAssets);
  console.log('  remainingGapPct after HOLDINGS_ONLY:', gap.remainingGapPct, '%');
  console.log('  achievablePct:', gap.achievablePct);
  console.log('  cashNeededForPerfectBalance:', gap.cashNeededForPerfectBalance.toLocaleString(), 'IRR');
  console.log('  currentCash:', gap.currentCash.toLocaleString(), 'IRR');
  console.log('  cashSufficient:', gap.cashSufficient);
  console.log('  cashShortfall:', gap.cashShortfall.toLocaleString(), 'IRR');

  // With 80% frozen in UPSIDE (target 20%), need to 4x the portfolio!
  // UPSIDE = 1.12B, needs to be 20%, so total = 1.12B/0.20 = 5.6B
  // Holdings = 1.4B, so need 4.2B additional cash!
  console.log('');
  console.log('  Math check:');
  console.log('  - UPSIDE frozen value: ~1.12B IRR');
  console.log('  - To be 20%: need total of 1.12B/0.20 = 5.6B');
  console.log('  - This requires massive cash injection');

  const passed = gap.cashSufficient === false && gap.cashShortfall > 0;
  console.log('  PASSED:', passed ? 'YES' : 'NO');
}

// ============================================================
// SCENARIO 5: Test SMART mode rebalance execution
// ============================================================
console.log('\n--- SCENARIO 5: SMART mode rebalance execution ---');
{
  const state = createMockState({
    holdings: [
      createHolding('USDT', 400, false),      // FOUNDATION: 400 USD = 280M IRR
      createHolding('BTC', 0.008, true),      // GROWTH frozen: 800 USD = 560M IRR
      createHolding('ETH', 0.1, false),       // UPSIDE: 300 USD = 210M IRR
    ],
    cashIRR: 500_000_000, // 500M cash
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });

  const beforeSnap = computeSnapshot(state.holdings, state.cashIRR, TEST_PRICES, TEST_FX_RATE);
  console.log('BEFORE SMART rebalance:');
  console.log('  Holdings:', beforeSnap.holdingsIRR.toLocaleString(), 'IRR');
  console.log('  Cash:', state.cashIRR.toLocaleString(), 'IRR');
  console.log('  Layer %:', beforeSnap.layerPct);

  // Execute SMART mode rebalance with some cash
  const result = previewRebalance(state, {
    mode: 'SMART',
    useCashAmount: 300_000_000, // Use 300M of the 500M available
    prices: TEST_PRICES,
    fxRate: TEST_FX_RATE,
  });

  const afterSnap = computeSnapshot(result.holdings, result.cashIRR, TEST_PRICES, TEST_FX_RATE);
  console.log('');
  console.log('AFTER SMART rebalance (using 300M cash):');
  console.log('  Holdings:', afterSnap.holdingsIRR.toLocaleString(), 'IRR');
  console.log('  Cash remaining:', result.cashIRR.toLocaleString(), 'IRR');
  console.log('  Layer %:', afterSnap.layerPct);
  console.log('  Cash deployed:', result._rebalanceMeta?.cashDeployed?.toLocaleString() || 0, 'IRR');
  console.log('  Trades executed:', result._rebalanceMeta?.trades?.length || 0);

  // Check that cash was deployed and allocation improved
  const passed = result.cashIRR < state.cashIRR && afterSnap.holdingsIRR > beforeSnap.holdingsIRR;
  console.log('  PASSED:', passed ? 'YES' : 'NO');
}

// ============================================================
// SCENARIO 6: HOLDINGS_ONLY mode (no cash used)
// ============================================================
console.log('\n--- SCENARIO 6: HOLDINGS_ONLY mode ---');
{
  const state = createMockState({
    holdings: [
      createHolding('USDT', 1000, false),     // FOUNDATION: 1000 USD = 700M IRR (50%)
      createHolding('BTC', 0.003, false),     // GROWTH: 300 USD = 210M IRR (15%)
      createHolding('ETH', 0.167, false),     // UPSIDE: 500 USD = 350M IRR (25%)
      createHolding('SOL', 1, false),         // UPSIDE: 150 USD = 105M IRR (7.5%)
    ],
    cashIRR: 1_000_000_000, // 1B cash (should NOT be used)
    targetLayerPct: { FOUNDATION: 50, GROWTH: 30, UPSIDE: 20 },
  });

  const beforeSnap = computeSnapshot(state.holdings, state.cashIRR, TEST_PRICES, TEST_FX_RATE);
  console.log('BEFORE HOLDINGS_ONLY rebalance:');
  console.log('  Holdings:', beforeSnap.holdingsIRR.toLocaleString(), 'IRR');
  console.log('  Cash:', state.cashIRR.toLocaleString(), 'IRR');
  console.log('  Layer %:', beforeSnap.layerPct);

  const result = previewRebalance(state, {
    mode: 'HOLDINGS_ONLY',
    prices: TEST_PRICES,
    fxRate: TEST_FX_RATE,
  });

  const afterSnap = computeSnapshot(result.holdings, result.cashIRR, TEST_PRICES, TEST_FX_RATE);
  console.log('');
  console.log('AFTER HOLDINGS_ONLY rebalance:');
  console.log('  Holdings:', afterSnap.holdingsIRR.toLocaleString(), 'IRR');
  console.log('  Cash:', result.cashIRR.toLocaleString(), 'IRR');
  console.log('  Layer %:', afterSnap.layerPct);
  console.log('  Cash deployed:', result._rebalanceMeta?.cashDeployed || 0);

  // Cash should remain unchanged
  const passed = result.cashIRR === state.cashIRR && result._rebalanceMeta?.cashDeployed === 0;
  console.log('  PASSED:', passed ? 'YES' : 'NO');
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log('All scenarios demonstrate the smart rebalance logic:');
console.log('1. No frozen assets -> can achieve perfect balance');
console.log('2. Frozen overweight layer -> needs cash to dilute');
console.log('3. Sufficient cash -> can achieve perfect balance');
console.log('4. Extreme imbalance -> requires massive cash');
console.log('5. SMART mode -> deploys cash correctly');
console.log('6. HOLDINGS_ONLY -> cash untouched');
console.log('');
console.log('Run with: node --experimental-vm-modules src/engine/preview.test.js');
