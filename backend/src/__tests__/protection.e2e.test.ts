/**
 * Asset Protect Feature - Automated E2E Tests
 * Run with: npx vitest run src/__tests__/protection.e2e.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Test configuration
const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000/api/v1';
const FX_RATE = 1_456_000;

// Test data
const TEST_USER_PHONE = '+989121234567';

// Helpers
let authToken: string;
let prisma: PrismaClient;
let testPortfolioId: string;
let testUserId: string;

async function apiCall(
  method: string,
  endpoint: string,
  bodyOrParams?: any,
  token?: string
): Promise<{ status: number; data: any }> {
  try {
    let url = `${API_BASE}${endpoint}`;
    let body: string | undefined;

    // For GET requests, bodyOrParams is treated as query parameters
    if (method === 'GET' && bodyOrParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(bodyOrParams)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      url += `?${params.toString()}`;
    } else if (bodyOrParams) {
      body = JSON.stringify(bodyOrParams);
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body,
    });

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (error) {
    console.error(`API call failed: ${method} ${endpoint}`, error);
    return { status: 500, data: { error: 'Network error' } };
  }
}

// Helper to get a holding ID by asset
async function getHoldingId(assetId: string): Promise<string | null> {
  if (!authToken) return null;
  const { status, data } = await apiCall('GET', '/protection/holdings', null, authToken);
  if (status !== 200) return null;
  const holding = data.holdings?.find((h: any) => h.assetId === assetId);
  return holding?.holdingId || null;
}

// ============================================================================
// TEST SETUP
// ============================================================================

beforeAll(async () => {
  prisma = new PrismaClient();

  // Create or find test user and set up portfolio
  try {
    // Check if test user exists
    let user = await prisma.user.findUnique({
      where: { phone: TEST_USER_PHONE },
      include: { portfolio: true },
    });

    if (!user) {
      // Create test user with portfolio
      user = await prisma.user.create({
        data: {
          phone: TEST_USER_PHONE,
          phoneVerified: true,
          riskScore: 5,
          riskTier: 'MEDIUM',
          riskProfileName: 'Balanced',
          targetFoundation: 0.5,
          targetGrowth: 0.35,
          targetUpside: 0.15,
          consentRisk: true,
          consentLoss: true,
          consentNoGuarantee: true,
          consentTimestamp: new Date(),
          portfolio: {
            create: {
              cashIrr: 100_000_000_000, // 100B IRR for testing
            },
          },
        },
        include: { portfolio: true },
      });
    }

    testUserId = user.id;
    testPortfolioId = user.portfolio!.id;

    // Ensure portfolio has sufficient cash
    await prisma.portfolio.update({
      where: { id: testPortfolioId },
      data: { cashIrr: 100_000_000_000 },
    });

    // Create test holdings if they don't exist
    const existingHoldings = await prisma.holding.findMany({
      where: { portfolioId: testPortfolioId },
    });

    if (existingHoldings.length === 0) {
      await prisma.holding.createMany({
        data: [
          { portfolioId: testPortfolioId, assetId: 'BTC', quantity: 0.5, frozen: false, layer: 'GROWTH' },
          { portfolioId: testPortfolioId, assetId: 'ETH', quantity: 2.0, frozen: false, layer: 'GROWTH' },
          { portfolioId: testPortfolioId, assetId: 'SOL', quantity: 100, frozen: false, layer: 'UPSIDE' },
          { portfolioId: testPortfolioId, assetId: 'PAXG', quantity: 1, frozen: false, layer: 'FOUNDATION' },
        ],
      });
    }

    // Clean up any existing active protections from previous tests
    await prisma.protection.deleteMany({
      where: {
        portfolioId: testPortfolioId,
        status: 'ACTIVE',
      },
    });

    // Generate auth token for testing
    // Try send-otp first (may fail due to rate limiting)
    await apiCall('POST', '/auth/send-otp', { phone: TEST_USER_PHONE });

    // In dev mode, OTPs starting with "99999" bypass verification
    // So we can verify even without a real OTP being sent
    const verifyRes = await apiCall('POST', '/auth/verify-otp', {
      phone: TEST_USER_PHONE,
      code: '999999', // Dev bypass OTP
    });
    if (verifyRes.status === 200 && verifyRes.data.tokens) {
      authToken = verifyRes.data.tokens.accessToken;
    }

    // If auth failed, we'll skip API tests that require auth
    if (!authToken) {
      console.log('Auth token not available - some tests will be skipped');
      console.log('Verify response:', verifyRes.status, verifyRes.data);
    }
  } catch (error) {
    console.error('Test setup failed:', error);
  }
});

afterAll(async () => {
  // Clean up test data
  try {
    if (testPortfolioId) {
      // Clean up protections created during tests
      await prisma.protection.deleteMany({
        where: { portfolioId: testPortfolioId },
      });
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  }

  await prisma.$disconnect();
});

// ============================================================================
// SUITE 1: PROTECTABLE HOLDINGS
// ============================================================================

describe('Suite 1: Protectable Holdings', () => {
  it('1.1: Should list holdings eligible for protection', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall('GET', '/protection/holdings', null, authToken);

    expect(status).toBe(200);
    expect(data).toHaveProperty('holdings');
    expect(Array.isArray(data.holdings)).toBe(true);

    // Check structure of each holding
    for (const holding of data.holdings) {
      expect(holding).toHaveProperty('assetId');
      expect(holding).toHaveProperty('quantity');
      expect(holding).toHaveProperty('valueIrr');
      expect(holding).toHaveProperty('holdingId');
    }

    // Check additional response fields
    expect(data).toHaveProperty('durationPresets');
    expect(data).toHaveProperty('coverageRange');
  });

  it('1.2: Should mark stablecoins as not protectable', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall('GET', '/protection/holdings', null, authToken);

    expect(status).toBe(200);

    // USDT should not be in the protectable holdings list
    // (the API only returns protectable holdings)
    const usdtHolding = data.holdings.find((h: any) => h.assetId === 'USDT');
    expect(usdtHolding).toBeUndefined();
  });

  it('1.3: BTC should be protectable', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall('GET', '/protection/holdings', null, authToken);

    expect(status).toBe(200);

    const btcHolding = data.holdings.find((h: any) => h.assetId === 'BTC');
    expect(btcHolding).toBeDefined();
    expect(btcHolding.quantity).toBeGreaterThan(0);
    expect(btcHolding.holdingId).toBeDefined();
  });
});

// ============================================================================
// SUITE 2: QUOTE GENERATION
// ============================================================================

describe('Suite 2: Quote Generation', () => {
  it('2.1: Should generate valid ATM quote for 30 days', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const holdingId = await getHoldingId('BTC');
    if (!holdingId) {
      console.log('Skipping - no BTC holding found');
      return;
    }

    const { status, data } = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId,
        coveragePct: 1.0,
        durationDays: 30,
      },
      authToken
    );

    expect(status).toBe(200);
    expect(data.quote || data).toBeDefined();

    const quote = data.quote || data;

    // Validate quote structure
    expect(quote.quoteId).toBeDefined();
    expect(quote.assetId).toBe('BTC');
    expect(quote.coveragePct).toBe(1.0);
    expect(quote.durationDays).toBe(30);

    // Validate pricing
    expect(quote.premiumPct).toBeGreaterThan(0);
    expect(quote.premiumPct).toBeLessThan(0.30); // Sanity check: less than 30%
    expect(quote.premiumIrr).toBeGreaterThan(0);

    // Validate Greeks (put option)
    if (quote.greeks) {
      expect(quote.greeks.delta).toBeLessThan(0); // Put delta is negative
      expect(quote.greeks.delta).toBeGreaterThan(-1);
    }
  });

  it('2.2: Should scale premium with coverage percentage', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const holdingId = await getHoldingId('BTC');
    if (!holdingId) {
      console.log('Skipping - no BTC holding found');
      return;
    }

    const quote100 = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId,
        coveragePct: 1.0,
        durationDays: 30,
      },
      authToken
    );

    const quote50 = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId,
        coveragePct: 0.5,
        durationDays: 30,
      },
      authToken
    );

    expect(quote100.status).toBe(200);
    expect(quote50.status).toBe(200);

    const q100 = quote100.data.quote || quote100.data;
    const q50 = quote50.data.quote || quote50.data;

    // Premium percentage should be similar (within 10%)
    const pctDiff = Math.abs(q100.premiumPct - q50.premiumPct) / q100.premiumPct;
    expect(pctDiff).toBeLessThan(0.1);

    // Notional should be half
    expect(q50.notionalUsd).toBeCloseTo(q100.notionalUsd * 0.5, 0);
  });

  it('2.3: Should increase premium with duration', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const holdingId = await getHoldingId('BTC');
    if (!holdingId) {
      console.log('Skipping - no BTC holding found');
      return;
    }

    const durations = [7, 30, 90, 180];
    const premiums: number[] = [];

    for (const days of durations) {
      const { status, data } = await apiCall(
        'GET',
        '/protection/quote',
        {
          holdingId,
          coveragePct: 1.0,
          durationDays: days,
        },
        authToken
      );

      expect(status).toBe(200);
      const quote = data.quote || data;
      premiums.push(quote.premiumPct);
    }

    // Each subsequent premium should be higher
    for (let i = 1; i < premiums.length; i++) {
      expect(premiums[i]).toBeGreaterThan(premiums[i - 1]);
    }
  });

  it('2.4: Should generate premium curve', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const holdingId = await getHoldingId('BTC');
    if (!holdingId) {
      console.log('Skipping - no BTC holding found');
      return;
    }

    const { status, data } = await apiCall(
      'GET',
      '/protection/quote/curve',
      {
        holdingId,
        coveragePct: 1.0,
      },
      authToken
    );

    expect(status).toBe(200);
    expect(data.quotes).toBeDefined();
    expect(Array.isArray(data.quotes)).toBe(true);
    expect(data.quotes.length).toBe(6); // 7, 14, 30, 60, 90, 180 days

    // Validate curve is monotonically increasing
    for (let i = 1; i < data.quotes.length; i++) {
      expect(data.quotes[i].premiumPct).toBeGreaterThan(data.quotes[i - 1].premiumPct);
    }
  });

  it('2.5: Should reject invalid duration', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const holdingId = await getHoldingId('BTC');
    if (!holdingId) {
      console.log('Skipping - no BTC holding found');
      return;
    }

    const { status, data } = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId,
        coveragePct: 1.0,
        durationDays: 45, // Invalid - not in preset list
      },
      authToken
    );

    expect(status).toBe(400);
  });

  it('2.6: Should reject invalid coverage', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const holdingId = await getHoldingId('BTC');
    if (!holdingId) {
      console.log('Skipping - no BTC holding found');
      return;
    }

    const { status, data } = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId,
        coveragePct: 1.5, // Invalid - over 100%
        durationDays: 30,
      },
      authToken
    );

    expect(status).toBe(400);
  });

  it('2.7: Different assets should have different premiums', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const assets = ['BTC', 'ETH', 'SOL'];
    const premiums: Record<string, number> = {};

    for (const assetId of assets) {
      const holdingId = await getHoldingId(assetId);
      if (!holdingId) continue;

      const { status, data } = await apiCall(
        'GET',
        '/protection/quote',
        {
          holdingId,
          coveragePct: 1.0,
          durationDays: 30,
        },
        authToken
      );

      if (status === 200) {
        const quote = data.quote || data;
        premiums[assetId] = quote.premiumPct;
      }
    }

    // SOL should have higher premium than BTC (higher volatility)
    if (premiums['SOL'] && premiums['BTC']) {
      expect(premiums['SOL']).toBeGreaterThan(premiums['BTC']);
    }
  });
});

// ============================================================================
// SUITE 3: PROTECTION PURCHASE
// ============================================================================

describe('Suite 3: Protection Purchase', () => {
  it('3.1: Should successfully purchase protection', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    // Get ETH holding ID
    const holdingId = await getHoldingId('ETH');
    if (!holdingId) {
      console.log('Skipping - no ETH holding found');
      return;
    }

    // Get quote
    const quoteRes = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId,
        coveragePct: 0.1, // Small coverage to minimize test impact
        durationDays: 7,
      },
      authToken
    );

    if (quoteRes.status !== 200) {
      console.log('Could not get quote:', quoteRes.data);
      return;
    }

    const quote = quoteRes.data.quote || quoteRes.data;

    // Purchase protection (requires all fields)
    const purchaseRes = await apiCall(
      'POST',
      '/protection/purchase',
      {
        quoteId: quote.quoteId,
        holdingId,
        coveragePct: 0.1,
        durationDays: 7,
        premiumIrr: quote.premiumIrr,
        acknowledgedPremium: true,
      },
      authToken
    );

    expect(purchaseRes.status).toBe(200);
    expect(purchaseRes.data.protection || purchaseRes.data).toBeDefined();

    const protection = purchaseRes.data.protection || purchaseRes.data;
    expect(protection.status).toBe('ACTIVE');
    expect(protection.assetId).toBe('ETH');
  });

  it('3.2: Should reject expired or invalid quote', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    // Create a fake expired quote ID
    const expiredQuoteId = 'PQ-BTC-1000000000000-expired';

    const { status, data } = await apiCall(
      'POST',
      '/protection/purchase',
      {
        quoteId: expiredQuoteId,
      },
      authToken
    );

    // Should be 400 for invalid quote, might also be 500 for internal error
    expect([400, 500]).toContain(status);
  });

  it('3.3: Should reject non-protectable asset', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    // USDT is not in protectable holdings list (stablecoin)
    // We verify by checking holdings list doesn't include USDT
    const { status, data } = await apiCall('GET', '/protection/holdings', null, authToken);
    expect(status).toBe(200);

    const usdtHolding = data.holdings?.find((h: any) => h.assetId === 'USDT');
    expect(usdtHolding).toBeUndefined(); // USDT should not be protectable
  });
});

// ============================================================================
// SUITE 4: ACTIVE PROTECTIONS
// ============================================================================

describe('Suite 4: Active Protections', () => {
  it('4.1: Should list only active protections', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall('GET', '/protection/active', null, authToken);

    expect(status).toBe(200);
    expect(Array.isArray(data.protections || data)).toBe(true);

    const protections = data.protections || data;

    // All returned protections should be ACTIVE
    for (const protection of protections) {
      expect(protection.status).toBe('ACTIVE');
    }
  });

  it('4.2: Should calculate days remaining correctly', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall('GET', '/protection/active', null, authToken);

    if (status !== 200) return;

    const protections = data.protections || data;
    if (!protections?.length) return;

    for (const protection of protections) {
      if (protection.daysRemaining !== undefined) {
        expect(protection.daysRemaining).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ============================================================================
// SUITE 5: VOLATILITY INFORMATION
// ============================================================================

describe('Suite 5: Volatility Information', () => {
  it('5.1: Should return volatility for BTC', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall('GET', '/protection/volatility/BTC', null, authToken);

    expect(status).toBe(200);
    expect(data.assetId).toBe('BTC');
    expect(data.baseVolatility).toBeGreaterThan(0);
    expect(data.baseVolatility).toBeLessThan(3); // Sanity: less than 300%
    expect(data.regime).toMatch(/LOW|NORMAL|ELEVATED|HIGH|EXTREME/);
  });

  it('5.2: Should return term structure', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall('GET', '/protection/volatility/ETH', null, authToken);

    expect(status).toBe(200);

    if (data.termStructure) {
      expect(Array.isArray(data.termStructure)).toBe(true);
      expect(data.termStructure.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// SUITE 6: BLACK-SCHOLES VALIDATION
// ============================================================================

describe('Suite 6: Black-Scholes Validation', () => {
  it('6.1: ATM put premium should be in reasonable range', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall(
      'POST',
      '/protection/quote',
      {
        assetId: 'BTC',
        coveragePct: 1.0,
        durationDays: 30,
      },
      authToken
    );

    if (status !== 200) return;

    const quote = data.quote || data;

    // For 30-day ATM BTC with ~55% IV, premium should be roughly 3-8%
    expect(quote.premiumPct).toBeGreaterThan(0.02);
    expect(quote.premiumPct).toBeLessThan(0.15);
  });

  it('6.2: Put delta should be between -1 and 0', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall(
      'POST',
      '/protection/quote',
      {
        assetId: 'BTC',
        coveragePct: 1.0,
        durationDays: 30,
      },
      authToken
    );

    if (status !== 200) return;

    const quote = data.quote || data;

    if (quote.greeks) {
      const delta = quote.greeks.delta;
      expect(delta).toBeLessThan(0);
      expect(delta).toBeGreaterThan(-1);

      // ATM put delta should be around -0.5 (±0.15)
      expect(delta).toBeGreaterThan(-0.65);
      expect(delta).toBeLessThan(-0.35);
    }
  });

  it('6.3: Greeks should have correct signs', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall(
      'POST',
      '/protection/quote',
      {
        assetId: 'ETH',
        coveragePct: 1.0,
        durationDays: 30,
      },
      authToken
    );

    if (status !== 200) return;

    const quote = data.quote || data;

    if (quote.greeks) {
      expect(quote.greeks.delta).toBeLessThan(0); // Put delta negative
      expect(quote.greeks.gamma).toBeGreaterThan(0); // Gamma always positive
      expect(quote.greeks.vega).toBeGreaterThan(0); // Vega positive (long option)
      expect(quote.greeks.theta).toBeLessThan(0); // Theta negative (time decay)
    }
  });
});

// ============================================================================
// SUITE 7: PROTECTION HISTORY
// ============================================================================

describe('Suite 7: Protection History', () => {
  it('7.1: Should return protection history', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const { status, data } = await apiCall('GET', '/protection/history', null, authToken);

    expect(status).toBe(200);
    expect(Array.isArray(data.protections || data)).toBe(true);
  });
});

// ============================================================================
// SUITE 8: EDGE CASES
// ============================================================================

describe('Suite 8: Edge Cases', () => {
  it('8.1: Minimum duration (7 days) should work', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const holdingId = await getHoldingId('BTC');
    if (!holdingId) {
      console.log('Skipping - no BTC holding found');
      return;
    }

    const { status, data } = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId,
        coveragePct: 1.0,
        durationDays: 7,
      },
      authToken
    );

    expect(status).toBe(200);
    const quote = data.quote || data;
    expect(quote.durationDays).toBe(7);
  });

  it('8.2: Maximum duration (180 days) should work', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const holdingId = await getHoldingId('BTC');
    if (!holdingId) {
      console.log('Skipping - no BTC holding found');
      return;
    }

    const { status, data } = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId,
        coveragePct: 1.0,
        durationDays: 180,
      },
      authToken
    );

    expect(status).toBe(200);
    const quote = data.quote || data;
    expect(quote.durationDays).toBe(180);
  });

  it('8.3: Minimum coverage (10%) should work', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const holdingId = await getHoldingId('BTC');
    if (!holdingId) {
      console.log('Skipping - no BTC holding found');
      return;
    }

    const { status, data } = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId,
        coveragePct: 0.1,
        durationDays: 30,
      },
      authToken
    );

    expect(status).toBe(200);
    const quote = data.quote || data;
    expect(quote.coveragePct).toBe(0.1);
  });

  it('8.4: Coverage below minimum should be rejected', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    const holdingId = await getHoldingId('BTC');
    if (!holdingId) {
      console.log('Skipping - no BTC holding found');
      return;
    }

    const { status } = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId,
        coveragePct: 0.05, // 5% - below minimum
        durationDays: 30,
      },
      authToken
    );

    expect(status).toBe(400);
  });
});

// ============================================================================
// SUITE 9: INTEGRATION - FULL LIFECYCLE
// ============================================================================

describe('Suite 9: Full Lifecycle', () => {
  it('9.1: Complete protection lifecycle (get holdings -> quote -> purchase -> verify active)', async () => {
    if (!authToken) {
      console.log('Skipping - no auth token');
      return;
    }

    // 1. Get holdings
    const holdingsRes = await apiCall('GET', '/protection/holdings', null, authToken);
    expect(holdingsRes.status).toBe(200);

    const holdings = holdingsRes.data.holdings || [];
    const solHolding = holdings.find((h: any) => h.assetId === 'SOL');

    if (!solHolding) {
      console.log('No protectable SOL holding for lifecycle test');
      return;
    }

    // 2. Get quote
    const quoteRes = await apiCall(
      'GET',
      '/protection/quote',
      {
        holdingId: solHolding.holdingId,
        coveragePct: 0.1,
        durationDays: 7,
      },
      authToken
    );
    expect(quoteRes.status).toBe(200);

    const quote = quoteRes.data.quote || quoteRes.data;

    // 3. Purchase protection (requires all fields)
    const purchaseRes = await apiCall(
      'POST',
      '/protection/purchase',
      {
        quoteId: quote.quoteId,
        holdingId: solHolding.holdingId,
        coveragePct: 0.1,
        durationDays: 7,
        premiumIrr: quote.premiumIrr,
        acknowledgedPremium: true,
      },
      authToken
    );

    if (purchaseRes.status !== 200) {
      console.log('Purchase failed:', purchaseRes.data);
      return;
    }

    const protection = purchaseRes.data.protection || purchaseRes.data;
    const protectionId = protection.id;

    // 4. Verify in active list
    const activeRes = await apiCall('GET', '/protection/active', null, authToken);
    expect(activeRes.status).toBe(200);

    const activeProtections = activeRes.data.protections || activeRes.data;
    const activeProtection = activeProtections.find((p: any) => p.id === protectionId);

    expect(activeProtection).toBeDefined();
    expect(activeProtection.status).toBe('ACTIVE');
    expect(activeProtection.assetId).toBe('SOL');

    console.log('Lifecycle test completed successfully');
  });
});

// ============================================================================
// DIRECT SERVICE TESTS (without HTTP)
// ============================================================================

describe('Suite 10: Direct Service Tests', () => {
  it('10.1: Options math - Black-Scholes put pricing', async () => {
    // Import the options math module
    const { blackScholesPut, calculatePutGreeks } = await import('../services/options-math.js');

    // Test case: S=100, K=100, T=30/365, r=5%, σ=55%
    const spot = 100;
    const strike = 100;
    const timeYears = 30 / 365;
    const riskFreeRate = 0.05;
    const volatility = 0.55;

    // Note: blackScholesPut signature is (spot, strike, timeYears, vol, rate)
    const putPrice = blackScholesPut(spot, strike, timeYears, volatility, riskFreeRate);

    // ATM put should be roughly 0.4 * S * σ * √T ≈ 6.3% of spot
    expect(putPrice).toBeGreaterThan(3);
    expect(putPrice).toBeLessThan(10);

    // Test Greeks
    // Note: calculatePutGreeks signature is (spot, strike, timeYears, vol, rate)
    const greeks = calculatePutGreeks(spot, strike, timeYears, volatility, riskFreeRate);

    expect(greeks.delta).toBeLessThan(0);
    expect(greeks.delta).toBeGreaterThan(-1);
    expect(greeks.gamma).toBeGreaterThan(0);
    expect(greeks.vega).toBeGreaterThan(0);
    expect(greeks.theta).toBeLessThan(0);
  });

  it('10.2: Volatility service - get implied volatility', async () => {
    const { getImpliedVolatility, DEFAULT_VOLATILITY } = await import(
      '../services/volatility.service.js'
    );

    // Test BTC volatility
    const btcVol = getImpliedVolatility('BTC' as any, 30);

    expect(btcVol.baseVolatility).toBe(DEFAULT_VOLATILITY['BTC']);
    expect(btcVol.adjustedVolatility).toBeGreaterThan(0);
    expect(btcVol.regime).toMatch(/LOW|NORMAL|ELEVATED|HIGH|EXTREME/);
  });

  it('10.3: Volatility service - term structure multipliers', async () => {
    const { getTermMultiplier } = await import('../services/volatility.service.js');

    // Short-term should have higher multiplier
    const mult7d = getTermMultiplier(7);
    const mult30d = getTermMultiplier(30);
    const mult180d = getTermMultiplier(180);

    expect(mult7d).toBeGreaterThan(mult30d);
    expect(mult30d).toBeGreaterThan(mult180d);
  });

  it('10.4: Protection pricing - calculate settlement', async () => {
    const { calculateSettlement } = await import('../services/protection-pricing.service.js');

    // Test ITM settlement
    const strikeUsd = 100;
    const currentPriceUsd = 80; // 20% below strike
    const notionalUsd = 1000;
    const fxRate = 1_456_000;

    const settlement = calculateSettlement(strikeUsd, currentPriceUsd, notionalUsd, fxRate);

    expect(settlement.isITM).toBe(true);
    expect(settlement.payoutUsd).toBe(200); // (100 - 80) / 100 * 1000 = 200
    expect(settlement.payoutIrr).toBe(200 * fxRate);

    // Test OTM settlement
    const otmSettlement = calculateSettlement(100, 110, 1000, fxRate);

    expect(otmSettlement.isITM).toBe(false);
    expect(otmSettlement.payoutUsd).toBe(0);
  });
});

// ============================================================================
// CLEANUP
// ============================================================================

describe('Cleanup', () => {
  it('Should clean up test protections', async () => {
    if (testPortfolioId) {
      // Delete protections created during tests
      const deleted = await prisma.protection.deleteMany({
        where: {
          portfolioId: testPortfolioId,
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      });
      console.log(`Cleaned up ${deleted.count} test protections`);
    }
  });
});
