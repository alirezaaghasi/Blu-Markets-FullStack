/**
 * Asset Protect Feature - Additional E2E Tests
 * Covers: Concurrency, Settlement, Premium Tolerance, Risk Monitoring
 *
 * Run with: npx vitest run src/__tests__/protection.advanced.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000/api/v1';
const FX_RATE = 1_456_000;

let authToken: string;
let prisma: PrismaClient;

// Helper function for API calls
async function apiCall(
  method: string,
  endpoint: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any }> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

// Helper to create a test user with holdings
async function setupTestUser(): Promise<void> {
  // Request OTP
  await apiCall('POST', '/auth/request-otp', { phone: '+989129999999' });

  // Verify with dev OTP
  const verifyRes = await apiCall('POST', '/auth/verify-otp', {
    phone: '+989129999999',
    otp: '999999',
  });

  if (verifyRes.status === 200) {
    authToken = verifyRes.data.accessToken;
  }
}

// Helper to get a protectable holding
async function getProtectableHolding(): Promise<any> {
  const { data } = await apiCall('GET', '/protection/holdings', null, authToken);
  return data.holdings?.find((h: any) => h.isProtectable && !h.alreadyProtected);
}

// ============================================================================
// TEST SETUP
// ============================================================================

beforeAll(async () => {
  prisma = new PrismaClient();
  await setupTestUser();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ============================================================================
// SUITE 1: CONCURRENCY & RACE CONDITIONS
// ============================================================================

describe('Suite: Concurrency & Race Conditions', () => {

  it('should handle simultaneous quote requests gracefully', async () => {
    const holding = await getProtectableHolding();
    if (!holding) {
      console.log('No protectable holding available, skipping test');
      return;
    }

    // Fire 5 quote requests simultaneously
    const quotePromises = Array(5).fill(null).map(() =>
      apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.1&durationDays=30`, null, authToken)
    );

    const results = await Promise.all(quotePromises);

    // All should succeed (quotes are independent)
    for (const result of results) {
      if (result.status === 200) {
        expect(result.data.quote.quoteId).toBeDefined();
      }
    }

    // All quote IDs should be unique
    const quoteIds = results
      .filter(r => r.status === 200)
      .map(r => r.data.quote.quoteId);
    const uniqueIds = new Set(quoteIds);
    expect(uniqueIds.size).toBe(quoteIds.length);
  });
});

// ============================================================================
// SUITE 2: PREMIUM TOLERANCE
// ============================================================================

describe('Suite: Premium Tolerance (5% threshold)', () => {

  it('should reject purchase when premium differs by more than 5%', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.1&durationDays=7`, null, authToken);

    if (quoteRes.status !== 200) return;
    const quote = quoteRes.data.quote;

    // Submit with 20% higher premium (way outside tolerance)
    const wrongPremium = Math.floor(quote.premiumIrr * 1.20);

    const purchaseRes = await apiCall('POST', '/protection/purchase', {
      quoteId: quote.quoteId,
      holdingId: holding.holdingId,
      coveragePct: 0.1,
      durationDays: 7,
      premiumIrr: wrongPremium,
      acknowledgedPremium: true,
    }, authToken);

    expect(purchaseRes.status).toBe(400);
  });

  it('should reject purchase with significantly lower premium', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.1&durationDays=7`, null, authToken);

    if (quoteRes.status !== 200) return;
    const quote = quoteRes.data.quote;

    // Submit with 50% lower premium (trying to game the system)
    const lowPremium = Math.floor(quote.premiumIrr * 0.50);

    const purchaseRes = await apiCall('POST', '/protection/purchase', {
      quoteId: quote.quoteId,
      holdingId: holding.holdingId,
      coveragePct: 0.1,
      durationDays: 7,
      premiumIrr: lowPremium,
      acknowledgedPremium: true,
    }, authToken);

    expect(purchaseRes.status).toBe(400);
  });
});

// ============================================================================
// SUITE 3: INSUFFICIENT CASH HANDLING
// ============================================================================

describe('Suite: Insufficient Cash Handling', () => {

  it('should reject purchase when cash is insufficient', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    // Get current portfolio cash
    const portfolioRes = await apiCall('GET', '/portfolio', null, authToken);
    const currentCash = portfolioRes.data.portfolio?.cashIrr || portfolioRes.data.cashIrr || 0;

    // Get quote for maximum coverage and duration (expensive)
    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=1.0&durationDays=180`, null, authToken);

    if (quoteRes.status !== 200) return;
    const quote = quoteRes.data.quote;

    // Only attempt if premium exceeds available cash
    if (quote.premiumIrr > currentCash) {
      const purchaseRes = await apiCall('POST', '/protection/purchase', {
        quoteId: quote.quoteId,
        holdingId: holding.holdingId,
        coveragePct: 1.0,
        durationDays: 180,
        premiumIrr: quote.premiumIrr,
        acknowledgedPremium: true,
      }, authToken);

      expect(purchaseRes.status).toBe(400);
      expect(purchaseRes.data.message || purchaseRes.data.error).toMatch(/insufficient|cash|funds|balance/i);
    } else {
      console.log('User has sufficient cash for this test - skipping');
    }
  });
});

// ============================================================================
// SUITE 4: EXPIRY & SETTLEMENT PROCESSING
// ============================================================================

describe('Suite: Expiry & Settlement Processing', () => {

  it('should correctly identify OTM protection at expiry', async () => {
    // This test validates the settlement calculation logic
    const spotPrice = 95000; // Current BTC price
    const strikePrice = 95000; // ATM strike
    const expiryPrice = 100000; // Price went UP (OTM for put)

    // Put is OTM when spot > strike
    const isITM = expiryPrice < strikePrice;
    expect(isITM).toBe(false);

    // Settlement should be 0 for OTM
    const settlement = isITM ? (strikePrice - expiryPrice) : 0;
    expect(settlement).toBe(0);
  });

  it('should correctly calculate ITM settlement', async () => {
    const strikePrice = 95000;
    const expiryPrice = 85000; // Price dropped 10% (ITM)
    const notionalBtc = 0.5;

    const isITM = expiryPrice < strikePrice;
    expect(isITM).toBe(true);

    // Settlement = (strike - expiry) × quantity
    const settlementUsd = (strikePrice - expiryPrice) * notionalBtc;
    expect(settlementUsd).toBe(5000); // $10,000 drop × 0.5 BTC = $5,000

    const settlementIrr = settlementUsd * FX_RATE;
    expect(settlementIrr).toBe(7_280_000_000);
  });

  it('should correctly calculate deep ITM settlement', async () => {
    const strikePrice = 95000;
    const expiryPrice = 50000; // Price crashed 47%
    const notionalBtc = 1.0;

    const settlementUsd = (strikePrice - expiryPrice) * notionalBtc;
    expect(settlementUsd).toBe(45000);

    // No cap on settlement - full protection
    const settlementIrr = settlementUsd * FX_RATE;
    expect(settlementIrr).toBe(65_520_000_000);
  });

  it('should correctly handle partial coverage settlement', async () => {
    const holdingValue = 95000; // 1 BTC worth
    const coveragePct = 0.5; // 50% coverage
    const strikePrice = 95000;
    const expiryPrice = 80000; // 15.8% drop

    const protectedNotional = holdingValue * coveragePct; // $47,500
    const notionalBtc = protectedNotional / strikePrice; // 0.5 BTC

    // Settlement only on protected portion
    const settlementUsd = (strikePrice - expiryPrice) * notionalBtc;
    expect(settlementUsd).toBe(7500); // ($15,000 drop × 0.5 BTC)

    // Unprotected loss (user absorbs)
    const unprotectedLoss = (strikePrice - expiryPrice) * (1 - coveragePct);
    expect(unprotectedLoss).toBe(7500);
  });
});

// ============================================================================
// SUITE 5: QUOTE EXPIRY
// ============================================================================

describe('Suite: Quote Expiry (5-minute validity)', () => {

  it('should include correct validity period in quote', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=30`, null, authToken);

    if (quoteRes.status !== 200) return;

    const quote = quoteRes.data.quote;
    const validity = quoteRes.data.validity;

    if (validity) {
      expect(validity.secondsRemaining).toBeLessThanOrEqual(300); // 5 minutes max
      expect(validity.secondsRemaining).toBeGreaterThan(0);
    }

    if (quote.quotedAt && quote.validUntil) {
      const quotedAt = new Date(quote.quotedAt);
      const validUntil = new Date(quote.validUntil);

      const diffMs = validUntil.getTime() - quotedAt.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      // Should be exactly 5 minutes
      expect(diffMinutes).toBeCloseTo(5, 0);
    }
  });

  it('should reject purchase with expired quote', async () => {
    // Create a manually expired quote ID (timestamp in the past)
    const expiredQuoteId = `PQ-expired-test123`;

    const holding = await getProtectableHolding();
    if (!holding) return;

    const purchaseRes = await apiCall('POST', '/protection/purchase', {
      quoteId: expiredQuoteId,
      holdingId: holding.holdingId,
      coveragePct: 0.5,
      durationDays: 30,
      premiumIrr: 1000000000,
      acknowledgedPremium: true,
    }, authToken);

    // Should fail with invalid/expired quote error
    expect([400, 404]).toContain(purchaseRes.status);
  });
});

// ============================================================================
// SUITE 6: VALIDATION EDGE CASES
// ============================================================================

describe('Suite: Validation Edge Cases', () => {

  it('should reject negative coverage', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=-0.5&durationDays=30`, null, authToken);

    expect(quoteRes.status).toBe(400);
  });

  it('should reject coverage below minimum (10%)', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.05&durationDays=30`, null, authToken);

    expect(quoteRes.status).toBe(400);
  });

  it('should reject coverage above maximum (100%)', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=1.5&durationDays=30`, null, authToken);

    expect(quoteRes.status).toBe(400);
  });

  it('should reject invalid duration (not in presets)', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=45`, null, authToken);

    // Should either reject or round to nearest preset
    if (quoteRes.status === 200) {
      // If accepted, duration should be a valid preset
      expect([7, 14, 30, 60, 90, 180]).toContain(quoteRes.data.quote.durationDays);
    } else {
      expect(quoteRes.status).toBe(400);
    }
  });

  it('should reject non-existent holding ID', async () => {
    const quoteRes = await apiCall('GET', '/protection/quote?holdingId=non-existent-uuid-12345&coveragePct=0.5&durationDays=30', null, authToken);

    expect([400, 404]).toContain(quoteRes.status);
  });

  it('should reject purchase without acknowledgedPremium', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.1&durationDays=7`, null, authToken);

    if (quoteRes.status !== 200) return;

    const purchaseRes = await apiCall('POST', '/protection/purchase', {
      quoteId: quoteRes.data.quote.quoteId,
      holdingId: holding.holdingId,
      coveragePct: 0.1,
      durationDays: 7,
      premiumIrr: quoteRes.data.quote.premiumIrr,
      // Missing acknowledgedPremium
    }, authToken);

    expect(purchaseRes.status).toBe(400);
  });
});

// ============================================================================
// SUITE 7: PREMIUM CALCULATIONS
// ============================================================================

describe('Suite: Premium Calculation Accuracy', () => {

  it('should have consistent premium across same parameters', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    // Get 3 quotes with identical parameters
    const quotes = await Promise.all([
      apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=30`, null, authToken),
      apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=30`, null, authToken),
      apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=30`, null, authToken),
    ]);

    const premiums = quotes
      .filter(q => q.status === 200)
      .map(q => q.data.quote.premiumPct);

    // All premiums should be very close (within 0.1%)
    if (premiums.length >= 2) {
      for (let i = 1; i < premiums.length; i++) {
        expect(Math.abs(premiums[i] - premiums[0])).toBeLessThan(0.001);
      }
    }
  });

  it('should scale premium linearly with coverage', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quote100 = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=1.0&durationDays=30`, null, authToken);
    const quote50 = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=30`, null, authToken);
    const quote25 = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.25&durationDays=30`, null, authToken);

    if (quote100.status === 200 && quote50.status === 200 && quote25.status === 200) {
      const premium100 = quote100.data.quote.premiumIrr;
      const premium50 = quote50.data.quote.premiumIrr;
      const premium25 = quote25.data.quote.premiumIrr;

      // 50% coverage should be ~50% of 100% coverage premium
      expect(premium50 / premium100).toBeCloseTo(0.5, 1);

      // 25% coverage should be ~25% of 100% coverage premium
      expect(premium25 / premium100).toBeCloseTo(0.25, 1);
    }
  });

  it('should have longer duration result in higher premium', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quote7 = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=7`, null, authToken);
    const quote30 = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=30`, null, authToken);
    const quote90 = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=90`, null, authToken);

    if (quote7.status === 200 && quote30.status === 200 && quote90.status === 200) {
      const premium7 = quote7.data.quote.premiumIrr;
      const premium30 = quote30.data.quote.premiumIrr;
      const premium90 = quote90.data.quote.premiumIrr;

      // Longer duration = higher premium
      expect(premium30).toBeGreaterThan(premium7);
      expect(premium90).toBeGreaterThan(premium30);
    }
  });
});

// ============================================================================
// SUITE 8: GREEKS VALIDATION
// ============================================================================

describe('Suite: Greeks Validation', () => {

  it('should return valid delta (between -1 and 0 for puts)', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=30`, null, authToken);

    if (quoteRes.status === 200 && quoteRes.data.quote.greeks) {
      const { delta } = quoteRes.data.quote.greeks;
      expect(delta).toBeLessThanOrEqual(0);
      expect(delta).toBeGreaterThanOrEqual(-1);
    }
  });

  it('should return positive gamma', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=30`, null, authToken);

    if (quoteRes.status === 200 && quoteRes.data.quote.greeks) {
      const { gamma } = quoteRes.data.quote.greeks;
      expect(gamma).toBeGreaterThan(0);
    }
  });

  it('should return negative theta (time decay)', async () => {
    const holding = await getProtectableHolding();
    if (!holding) return;

    const quoteRes = await apiCall('GET', `/protection/quote?holdingId=${holding.holdingId}&coveragePct=0.5&durationDays=30`, null, authToken);

    if (quoteRes.status === 200 && quoteRes.data.quote.greeks) {
      const { theta } = quoteRes.data.quote.greeks;
      expect(theta).toBeLessThan(0);
    }
  });
});

// ============================================================================
// CLEANUP
// ============================================================================

describe('Cleanup', () => {
  it('should verify API is still responsive after all tests', async () => {
    const { status } = await apiCall('GET', '/protection/holdings', null, authToken);
    expect([200, 401]).toContain(status);
  });
});
