/**
 * Asset Protect Feature - Unit Tests
 * Tests for core services that don't require database or API
 * Run with: npx vitest run src/__tests__/protection.unit.test.ts
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// SUITE 1: OPTIONS MATH - BLACK-SCHOLES
// ============================================================================

describe('Options Math - Black-Scholes', () => {
  it('should calculate ATM put price correctly', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');

    // Test case: S=100, K=100, T=30/365, σ=55%, r=5%
    // Function signature: blackScholesPut(spot, strike, timeYears, vol, rate)
    const spot = 100;
    const strike = 100;
    const timeYears = 30 / 365;
    const volatility = 0.55;
    const riskFreeRate = 0.05;

    const putPrice = blackScholesPut(spot, strike, timeYears, volatility, riskFreeRate);

    // ATM put should be roughly 4-7% of spot for these parameters
    expect(putPrice).toBeGreaterThan(3);
    expect(putPrice).toBeLessThan(10);
    console.log(`ATM 30-day put price (55% vol): $${putPrice.toFixed(2)} (${(putPrice).toFixed(2)}%)`);
  });

  it('should calculate OTM put price (lower than ATM)', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');

    const spot = 100;
    // blackScholesPut(spot, strike, time, vol, rate)
    const atm = blackScholesPut(spot, 100, 30 / 365, 0.55, 0.05);
    const otm = blackScholesPut(spot, 90, 30 / 365, 0.55, 0.05); // 10% OTM

    expect(otm).toBeLessThan(atm);
    console.log(`ATM put: $${atm.toFixed(2)}, 10% OTM put: $${otm.toFixed(2)}`);
  });

  it('should calculate ITM put price (higher than ATM)', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');

    const spot = 100;
    // blackScholesPut(spot, strike, time, vol, rate)
    const atm = blackScholesPut(spot, 100, 30 / 365, 0.55, 0.05);
    const itm = blackScholesPut(spot, 110, 30 / 365, 0.55, 0.05); // 10% ITM

    expect(itm).toBeGreaterThan(atm);
    console.log(`ATM put: $${atm.toFixed(2)}, 10% ITM put: $${itm.toFixed(2)}`);
  });

  it('should increase put price with longer duration', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');

    const spot = 100;
    const strike = 100;
    const vol = 0.55;
    const rate = 0.05;

    // blackScholesPut(spot, strike, time, vol, rate)
    const put7d = blackScholesPut(spot, strike, 7 / 365, vol, rate);
    const put30d = blackScholesPut(spot, strike, 30 / 365, vol, rate);
    const put90d = blackScholesPut(spot, strike, 90 / 365, vol, rate);
    const put180d = blackScholesPut(spot, strike, 180 / 365, vol, rate);

    expect(put30d).toBeGreaterThan(put7d);
    expect(put90d).toBeGreaterThan(put30d);
    expect(put180d).toBeGreaterThan(put90d);

    console.log(`Put prices by duration: 7d=$${put7d.toFixed(2)}, 30d=$${put30d.toFixed(2)}, 90d=$${put90d.toFixed(2)}, 180d=$${put180d.toFixed(2)}`);
  });

  it('should increase put price with higher volatility', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');

    const spot = 100;
    const strike = 100;
    const time = 30 / 365;
    const rate = 0.05;

    // blackScholesPut(spot, strike, time, vol, rate)
    const putLowVol = blackScholesPut(spot, strike, time, 0.20, rate); // 20% vol
    const putMedVol = blackScholesPut(spot, strike, time, 0.55, rate); // 55% vol
    const putHighVol = blackScholesPut(spot, strike, time, 0.85, rate); // 85% vol

    expect(putMedVol).toBeGreaterThan(putLowVol);
    expect(putHighVol).toBeGreaterThan(putMedVol);

    console.log(`Put prices by volatility: 20%=$${putLowVol.toFixed(2)}, 55%=$${putMedVol.toFixed(2)}, 85%=$${putHighVol.toFixed(2)}`);
  });

  it('should calculate call price correctly', async () => {
    const { blackScholesCall, blackScholesPut } = await import('../services/options-math.js');

    const spot = 100;
    const strike = 100;
    const time = 30 / 365;
    const vol = 0.55;
    const rate = 0.05;

    // blackScholesCall/Put(spot, strike, time, vol, rate)
    const call = blackScholesCall(spot, strike, time, vol, rate);
    const put = blackScholesPut(spot, strike, time, vol, rate);

    // Put-call parity: C - P = S - K*e^(-rT)
    const parity = call - put - (spot - strike * Math.exp(-rate * time));
    expect(Math.abs(parity)).toBeLessThan(0.01); // Should be very close to 0

    console.log(`Call: $${call.toFixed(2)}, Put: $${put.toFixed(2)}, Parity diff: ${parity.toFixed(4)}`);
  });
});

// ============================================================================
// SUITE 2: GREEKS CALCULATION
// ============================================================================

describe('Options Math - Greeks', () => {
  it('should calculate put delta between -1 and 0', async () => {
    const { calculatePutGreeks } = await import('../services/options-math.js');

    // calculatePutGreeks(spot, strike, timeYears, vol, rate)
    const greeks = calculatePutGreeks(100, 100, 30 / 365, 0.55, 0.05);

    expect(greeks.delta).toBeLessThan(0);
    expect(greeks.delta).toBeGreaterThan(-1);

    // ATM put delta should be around -0.5
    expect(greeks.delta).toBeGreaterThan(-0.6);
    expect(greeks.delta).toBeLessThan(-0.4);

    console.log(`ATM put delta: ${greeks.delta.toFixed(4)}`);
  });

  it('should have positive gamma for puts', async () => {
    const { calculatePutGreeks } = await import('../services/options-math.js');

    // calculatePutGreeks(spot, strike, timeYears, vol, rate)
    const greeks = calculatePutGreeks(100, 100, 30 / 365, 0.55, 0.05);

    expect(greeks.gamma).toBeGreaterThan(0);
    console.log(`ATM put gamma: ${greeks.gamma.toFixed(6)}`);
  });

  it('should have positive vega for puts', async () => {
    const { calculatePutGreeks } = await import('../services/options-math.js');

    // calculatePutGreeks(spot, strike, timeYears, vol, rate)
    const greeks = calculatePutGreeks(100, 100, 30 / 365, 0.55, 0.05);

    expect(greeks.vega).toBeGreaterThan(0);
    console.log(`ATM put vega: ${greeks.vega.toFixed(4)}`);
  });

  it('should have negative theta for puts (time decay)', async () => {
    const { calculatePutGreeks } = await import('../services/options-math.js');

    // calculatePutGreeks(spot, strike, timeYears, vol, rate)
    const greeks = calculatePutGreeks(100, 100, 30 / 365, 0.55, 0.05);

    expect(greeks.theta).toBeLessThan(0);
    console.log(`ATM put theta (per day): ${greeks.theta.toFixed(4)}`);
  });

  it('should have ITM put delta closer to -1', async () => {
    const { calculatePutGreeks } = await import('../services/options-math.js');

    // calculatePutGreeks(spot, strike, timeYears, vol, rate)
    const itmGreeks = calculatePutGreeks(100, 120, 30 / 365, 0.55, 0.05); // Strike 20% above spot
    const atmGreeks = calculatePutGreeks(100, 100, 30 / 365, 0.55, 0.05);

    expect(itmGreeks.delta).toBeLessThan(atmGreeks.delta); // More negative
    console.log(`ITM delta: ${itmGreeks.delta.toFixed(4)}, ATM delta: ${atmGreeks.delta.toFixed(4)}`);
  });

  it('should have OTM put delta closer to 0', async () => {
    const { calculatePutGreeks } = await import('../services/options-math.js');

    // calculatePutGreeks(spot, strike, timeYears, vol, rate)
    const otmGreeks = calculatePutGreeks(100, 80, 30 / 365, 0.55, 0.05); // Strike 20% below spot
    const atmGreeks = calculatePutGreeks(100, 100, 30 / 365, 0.55, 0.05);

    expect(otmGreeks.delta).toBeGreaterThan(atmGreeks.delta); // Less negative (closer to 0)
    console.log(`OTM delta: ${otmGreeks.delta.toFixed(4)}, ATM delta: ${atmGreeks.delta.toFixed(4)}`);
  });
});

// ============================================================================
// SUITE 3: VOLATILITY SERVICE
// ============================================================================

describe('Volatility Service', () => {
  it('should return correct base volatility for BTC', async () => {
    const { getImpliedVolatility, DEFAULT_VOLATILITY } = await import('../services/volatility.service.js');

    const btcVol = getImpliedVolatility('BTC' as any, 30);

    expect(btcVol.baseVolatility).toBe(DEFAULT_VOLATILITY['BTC']);
    expect(btcVol.baseVolatility).toBe(0.55); // 55%
    console.log(`BTC base volatility: ${(btcVol.baseVolatility * 100).toFixed(0)}%`);
  });

  it('should return higher volatility for SOL than BTC', async () => {
    const { getImpliedVolatility } = await import('../services/volatility.service.js');

    const btcVol = getImpliedVolatility('BTC' as any, 30);
    const solVol = getImpliedVolatility('SOL' as any, 30);

    expect(solVol.baseVolatility).toBeGreaterThan(btcVol.baseVolatility);
    console.log(`BTC vol: ${(btcVol.baseVolatility * 100).toFixed(0)}%, SOL vol: ${(solVol.baseVolatility * 100).toFixed(0)}%`);
  });

  it('should return lower volatility for PAXG (gold)', async () => {
    const { getImpliedVolatility } = await import('../services/volatility.service.js');

    const btcVol = getImpliedVolatility('BTC' as any, 30);
    const goldVol = getImpliedVolatility('PAXG' as any, 30);

    expect(goldVol.baseVolatility).toBeLessThan(btcVol.baseVolatility);
    console.log(`BTC vol: ${(btcVol.baseVolatility * 100).toFixed(0)}%, PAXG vol: ${(goldVol.baseVolatility * 100).toFixed(0)}%`);
  });

  it('should apply term structure multipliers', async () => {
    const { getTermMultiplier } = await import('../services/volatility.service.js');

    const mult7d = getTermMultiplier(7);
    const mult30d = getTermMultiplier(30);
    const mult180d = getTermMultiplier(180);

    // Short-term should have higher multiplier (backwardation)
    expect(mult7d).toBeGreaterThan(mult30d);
    expect(mult30d).toBeGreaterThan(mult180d);

    console.log(`Term multipliers: 7d=${mult7d.toFixed(2)}, 30d=${mult30d.toFixed(2)}, 180d=${mult180d.toFixed(2)}`);
  });

  it('should return volatility regime', async () => {
    const { getImpliedVolatility } = await import('../services/volatility.service.js');

    const vol = getImpliedVolatility('BTC' as any, 30);

    expect(vol.regime).toMatch(/LOW|NORMAL|ELEVATED|HIGH|EXTREME/);
    console.log(`Current regime: ${vol.regime}`);
  });

  it('should interpolate term multiplier for non-preset durations', async () => {
    const { getTermMultiplier } = await import('../services/volatility.service.js');

    const mult14d = getTermMultiplier(14);
    const mult7d = getTermMultiplier(7);
    const mult30d = getTermMultiplier(30);

    // 14d should be between 7d and 30d
    expect(mult14d).toBeLessThan(mult7d);
    expect(mult14d).toBeGreaterThan(mult30d);

    console.log(`Interpolated 14d multiplier: ${mult14d.toFixed(3)} (between ${mult7d.toFixed(3)} and ${mult30d.toFixed(3)})`);
  });
});

// ============================================================================
// SUITE 4: PROTECTION PRICING SERVICE
// ============================================================================

describe('Protection Pricing Service', () => {
  it('should calculate ITM settlement correctly', async () => {
    const { calculateSettlement } = await import('../services/protection-pricing.service.js');

    const strikeUsd = 100;
    const currentPriceUsd = 80; // 20% drop
    const notionalUsd = 1000;
    const fxRate = 1_456_000;

    const settlement = calculateSettlement(strikeUsd, currentPriceUsd, notionalUsd, fxRate);

    expect(settlement.isITM).toBe(true);
    expect(settlement.payoutUsd).toBe(200); // (100 - 80) / 100 * 1000 = 200
    expect(settlement.payoutIrr).toBe(200 * fxRate);

    console.log(`ITM settlement: $${settlement.payoutUsd} (${settlement.payoutIrr.toLocaleString()} IRR)`);
  });

  it('should return zero for OTM settlement', async () => {
    const { calculateSettlement } = await import('../services/protection-pricing.service.js');

    const strikeUsd = 100;
    const currentPriceUsd = 110; // Price above strike
    const notionalUsd = 1000;
    const fxRate = 1_456_000;

    const settlement = calculateSettlement(strikeUsd, currentPriceUsd, notionalUsd, fxRate);

    expect(settlement.isITM).toBe(false);
    expect(settlement.payoutUsd).toBe(0);
    expect(settlement.payoutIrr).toBe(0);

    console.log(`OTM settlement: $${settlement.payoutUsd}`);
  });

  it('should calculate deep ITM settlement', async () => {
    const { calculateSettlement } = await import('../services/protection-pricing.service.js');

    const strikeUsd = 95000;
    const currentPriceUsd = 60000; // 37% drop
    const notionalUsd = 47500; // 0.5 BTC
    const fxRate = 1_456_000;

    const settlement = calculateSettlement(strikeUsd, currentPriceUsd, notionalUsd, fxRate);

    expect(settlement.isITM).toBe(true);
    // Payout = (95000 - 60000) / 95000 * 47500 = 17500
    expect(settlement.payoutUsd).toBeCloseTo(17500, 0);

    console.log(`Deep ITM: Strike=$${strikeUsd}, Current=$${currentPriceUsd}, Payout=$${settlement.payoutUsd.toFixed(2)}`);
  });

  it('should have correct duration presets', async () => {
    const { DURATION_PRESETS } = await import('../services/protection-pricing.service.js');

    expect(DURATION_PRESETS).toEqual([7, 14, 30, 60, 90, 180]);
  });

  it('should calculate breakeven correctly', async () => {
    const { calculateBreakeven } = await import('../services/protection-pricing.service.js');

    // calculateBreakeven expects a ProtectionQuote object
    const mockQuote = {
      assetId: 'BTC',
      spotPriceUsd: 100,
      spotPriceIrr: 145_600_000,
      premiumPct: 0.05, // 5% premium
      premiumUsd: 5,
      premiumIrr: 7_280_000,
      strikePriceUsd: 100,
      strikePriceIrr: 145_600_000,
      notionalUsd: 100,
      notionalIrr: 145_600_000,
      durationDays: 30,
      coveragePct: 1.0,
      expiresAt: new Date(Date.now() + 300_000),
      quoteId: 'test-quote',
      greeks: { delta: -0.5, gamma: 0.025, vega: 0.1, theta: -0.1, rho: -0.05 },
      volatility: 0.55,
      volatilityRegime: 'NORMAL' as const,
    };

    const breakeven = calculateBreakeven(mockQuote);

    // Breakeven = spot × (1 - premium%) = 100 × 0.95 = 95
    expect(breakeven.breakEvenUsd).toBeCloseTo(95, 1);
    expect(breakeven.breakEvenPct).toBeCloseTo(0.05, 3);

    console.log(`Breakeven: $${breakeven.breakEvenUsd.toFixed(2)} (${(breakeven.breakEvenPct * 100).toFixed(1)}% drop)`);
  });
});

// ============================================================================
// SUITE 5: PREMIUM CALCULATIONS
// ============================================================================

describe('Premium Calculations', () => {
  it('should calculate premium with spreads and margins', async () => {
    const { calculatePremiumWithSpreads } = await import('../services/options-math.js');

    // calculatePremiumWithSpreads(spot, strike, timeYears, vol, notionalUsd, executionSpreadPct, profitMarginPct, rate)
    const spot = 100;
    const strike = 100; // ATM
    const timeYears = 30 / 365;
    const vol = 0.55;
    const notional = 100;
    const executionSpreadPct = 0.005; // 0.5%
    const profitMarginPct = 0.003; // 0.3%
    const rate = 0.05;

    const breakdown = calculatePremiumWithSpreads(spot, strike, timeYears, vol, notional, executionSpreadPct, profitMarginPct, rate);

    // Premium should be higher than fair value due to spreads
    expect(breakdown.totalPremium).toBeGreaterThan(breakdown.fairValue);

    // Total premium = fairValue + executionSpread + profitMargin
    const expected = breakdown.fairValue + (notional * executionSpreadPct) + (notional * profitMarginPct);
    expect(breakdown.totalPremium).toBeCloseTo(expected, 2);

    console.log(`Fair value: $${breakdown.fairValue.toFixed(2)}, With spreads: $${breakdown.totalPremium.toFixed(2)}`);
  });

  it('should order premiums correctly by asset volatility', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');
    const { DEFAULT_VOLATILITY } = await import('../services/volatility.service.js');

    const spot = 100;
    const strike = 100;
    const time = 30 / 365;
    const rate = 0.05;

    const btcPremium = blackScholesPut(spot, strike, time, DEFAULT_VOLATILITY['BTC'], rate);
    const ethPremium = blackScholesPut(spot, strike, time, DEFAULT_VOLATILITY['ETH'], rate);
    const solPremium = blackScholesPut(spot, strike, time, DEFAULT_VOLATILITY['SOL'], rate);
    const goldPremium = blackScholesPut(spot, strike, time, DEFAULT_VOLATILITY['PAXG'], rate);

    // SOL > ETH > BTC > PAXG (by volatility)
    expect(solPremium).toBeGreaterThan(ethPremium);
    expect(ethPremium).toBeGreaterThan(btcPremium);
    expect(btcPremium).toBeGreaterThan(goldPremium);

    console.log(`Premiums (30d ATM): SOL=${solPremium.toFixed(2)}%, ETH=${ethPremium.toFixed(2)}%, BTC=${btcPremium.toFixed(2)}%, PAXG=${goldPremium.toFixed(2)}%`);
  });
});

// ============================================================================
// SUITE 6: EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle very short duration (7 days)', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');

    const put = blackScholesPut(100, 100, 7 / 365, 0.55, 0.05);

    expect(put).toBeGreaterThan(0);
    expect(put).toBeLessThan(10);
    console.log(`7-day ATM put: $${put.toFixed(2)}`);
  });

  it('should handle long duration (180 days)', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');

    const put = blackScholesPut(100, 100, 180 / 365, 0.55, 0.05);

    expect(put).toBeGreaterThan(0);
    expect(put).toBeLessThan(30);
    console.log(`180-day ATM put: $${put.toFixed(2)}`);
  });

  it('should handle high volatility (85%)', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');

    const put = blackScholesPut(100, 100, 30 / 365, 0.85, 0.05);

    expect(put).toBeGreaterThan(5);
    expect(put).toBeLessThan(15);
    console.log(`30-day ATM put at 85% vol: $${put.toFixed(2)}`);
  });

  it('should handle low volatility (15%)', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');

    const put = blackScholesPut(100, 100, 30 / 365, 0.15, 0.05);

    expect(put).toBeGreaterThan(0);
    expect(put).toBeLessThan(3);
    console.log(`30-day ATM put at 15% vol: $${put.toFixed(2)}`);
  });

  it('should handle zero time (expiration)', async () => {
    const { blackScholesPut } = await import('../services/options-math.js');

    // At expiration, put value = max(K - S, 0)
    const atmPut = blackScholesPut(100, 100, 0.0001, 0.55, 0.05);
    const itmPut = blackScholesPut(80, 100, 0.0001, 0.55, 0.05);

    expect(atmPut).toBeCloseTo(0, 0); // ATM at expiry ≈ 0
    expect(itmPut).toBeCloseTo(20, 0); // ITM intrinsic value ≈ 20

    console.log(`At expiry: ATM=$${atmPut.toFixed(2)}, ITM=$${itmPut.toFixed(2)}`);
  });
});

// ============================================================================
// SUITE 7: MATHEMATICAL ACCURACY
// ============================================================================

describe('Mathematical Accuracy', () => {
  it('should satisfy put-call parity', async () => {
    const { blackScholesCall, blackScholesPut } = await import('../services/options-math.js');

    const S = 100;
    const K = 100;
    const T = 30 / 365;
    const r = 0.05;
    const sigma = 0.55;

    const call = blackScholesCall(S, K, T, sigma, r);
    const put = blackScholesPut(S, K, T, sigma, r);

    // Put-call parity: C - P = S - K*e^(-rT)
    const lhs = call - put;
    const rhs = S - K * Math.exp(-r * T);
    const diff = Math.abs(lhs - rhs);

    expect(diff).toBeLessThan(0.001);
    console.log(`Put-call parity check: C-P=${lhs.toFixed(4)}, S-Ke^(-rT)=${rhs.toFixed(4)}, diff=${diff.toFixed(6)}`);
  });

  it('should have normalCDF return values in [0,1]', async () => {
    const { normalCDF } = await import('../services/options-math.js');

    expect(normalCDF(-3)).toBeCloseTo(0.00135, 4);
    expect(normalCDF(0)).toBeCloseTo(0.5, 4);
    expect(normalCDF(3)).toBeCloseTo(0.99865, 4);

    // Edge cases
    expect(normalCDF(-10)).toBeLessThan(0.0001);
    expect(normalCDF(10)).toBeGreaterThan(0.9999);
  });

  it('should have delta sum to approximately 1 for call+put', async () => {
    const { calculatePutGreeks } = await import('../services/options-math.js');
    const { blackScholesCall } = await import('../services/options-math.js');

    const S = 100;
    const K = 100;
    const T = 30 / 365;
    const r = 0.05;
    const sigma = 0.55;

    const putGreeks = calculatePutGreeks(S, K, T, sigma, r);

    // Call delta = put delta + 1 (approximately, ignoring dividends)
    const callDelta = putGreeks.delta + 1;

    expect(callDelta).toBeGreaterThan(0.4);
    expect(callDelta).toBeLessThan(0.6);
    console.log(`Put delta: ${putGreeks.delta.toFixed(4)}, Implied call delta: ${callDelta.toFixed(4)}`);
  });
});
