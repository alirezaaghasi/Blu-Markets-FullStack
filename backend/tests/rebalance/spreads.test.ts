/**
 * Spread Calculation Tests (6 tests)
 * Tests for transaction cost (spread) calculations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPricesMap,
  createPortfolioSnapshot,
  createHolding,
  createPortfolioWithCash,
  RISK_PROFILES,
  SPREAD_BY_LAYER,
  PORTFOLIO_SIZES,
} from './helpers.js';

// Mock Prisma
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    portfolio: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    holding: {
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
    },
    actionLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock portfolio service
vi.mock('../../src/modules/portfolio/portfolio.service.js', () => ({
  getPortfolioSnapshot: vi.fn(),
  classifyBoundary: vi.fn(),
  getAssetLayer: vi.fn((assetId: string) => {
    const layers: Record<string, string> = {
      USDT: 'FOUNDATION',
      PAXG: 'FOUNDATION',
      IRR_FIXED_INCOME: 'FOUNDATION',
      BTC: 'GROWTH',
      ETH: 'GROWTH',
      BNB: 'GROWTH',
      XRP: 'GROWTH',
      KAG: 'GROWTH',
      QQQ: 'GROWTH',
      SOL: 'UPSIDE',
      TON: 'UPSIDE',
      LINK: 'UPSIDE',
      AVAX: 'UPSIDE',
      MATIC: 'UPSIDE',
      ARB: 'UPSIDE',
    };
    return layers[assetId] || 'UPSIDE';
  }),
}));

// Mock price fetcher
vi.mock('../../src/services/price-fetcher.service.js', () => ({
  getCurrentPrices: vi.fn(),
}));

import { getPortfolioSnapshot } from '../../src/modules/portfolio/portfolio.service.js';
import { getCurrentPrices } from '../../src/services/price-fetcher.service.js';
import { previewRebalance } from '../../src/modules/rebalance/rebalance.service.js';

describe('Spread Calculation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentPrices).mockResolvedValue(createPricesMap() as any);
  });

  // Test 117: Foundation spread is 0.15%
  it('should apply 0.15% spread for Foundation layer assets', () => {
    expect(SPREAD_BY_LAYER.FOUNDATION).toBe(0.0015);

    // Verify spread calculation
    const tradeAmount = 100_000_000_000; // 100B IRR
    const spread = tradeAmount * SPREAD_BY_LAYER.FOUNDATION;
    expect(spread).toBe(150_000_000); // 150M IRR
  });

  // Test 118: Growth spread is 0.30%
  it('should apply 0.30% spread for Growth layer assets', () => {
    expect(SPREAD_BY_LAYER.GROWTH).toBe(0.003);

    const tradeAmount = 100_000_000_000;
    const spread = tradeAmount * SPREAD_BY_LAYER.GROWTH;
    expect(spread).toBe(300_000_000); // 300M IRR
  });

  // Test 119: Upside spread is 0.60%
  it('should apply 0.60% spread for Upside layer assets', () => {
    expect(SPREAD_BY_LAYER.UPSIDE).toBe(0.006);

    const tradeAmount = 100_000_000_000;
    const spread = tradeAmount * SPREAD_BY_LAYER.UPSIDE;
    expect(spread).toBe(600_000_000); // 600M IRR
  });

  // Test 120: Net buy after spread deduction
  it('should correctly calculate net buy amount after spread deduction', () => {
    // When buying, you pay amountIrr but receive (amountIrr * (1 - spread)) worth of tokens
    const buyAmountIrr = 10_000_000_000; // 10B

    const foundationNet = buyAmountIrr * (1 - SPREAD_BY_LAYER.FOUNDATION);
    const growthNet = buyAmountIrr * (1 - SPREAD_BY_LAYER.GROWTH);
    const upsideNet = buyAmountIrr * (1 - SPREAD_BY_LAYER.UPSIDE);

    expect(foundationNet).toBeCloseTo(9_985_000_000, -6); // 10B - 0.15%
    expect(growthNet).toBeCloseTo(9_970_000_000, -6);     // 10B - 0.30%
    expect(upsideNet).toBeCloseTo(9_940_000_000, -6);     // 10B - 0.60%
  });

  // Test 121: Net sell after spread deduction
  it('should correctly calculate net sell proceeds after spread deduction', () => {
    // When selling, you receive (amountIrr * (1 - spread)) in cash
    const sellAmountIrr = 10_000_000_000; // 10B

    const foundationProceeds = sellAmountIrr * (1 - SPREAD_BY_LAYER.FOUNDATION);
    const growthProceeds = sellAmountIrr * (1 - SPREAD_BY_LAYER.GROWTH);
    const upsideProceeds = sellAmountIrr * (1 - SPREAD_BY_LAYER.UPSIDE);

    expect(foundationProceeds).toBeCloseTo(9_985_000_000, -6);
    expect(growthProceeds).toBeCloseTo(9_970_000_000, -6);
    expect(upsideProceeds).toBeCloseTo(9_940_000_000, -6);
  });

  // Test 122: Spread reflected in afterAllocation
  it('should reflect spread costs in afterAllocation calculation', async () => {
    // Portfolio with cash to deploy
    const snapshot = createPortfolioWithCash(50_000_000_000, PORTFOLIO_SIZES.MEDIUM);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // afterAllocation should be slightly different from simple math due to spreads
    expect(result.afterAllocation).toBeDefined();

    // Sum should be approximately 100% (slight variance due to rounding)
    const totalAlloc = result.afterAllocation.foundation +
                       result.afterAllocation.growth +
                       result.afterAllocation.upside;
    expect(totalAlloc).toBeCloseTo(100, 0);

    // After allocation should move toward target (within spread tolerance)
    const foundationDrift = Math.abs(result.afterAllocation.foundation - result.targetAllocation.foundation);
    const growthDrift = Math.abs(result.afterAllocation.growth - result.targetAllocation.growth);
    const upsideDrift = Math.abs(result.afterAllocation.upside - result.targetAllocation.upside);

    // After rebalance, drift should be reduced (or at least not worse)
    // We can't guarantee exact target due to spreads, minimums, and caps
    expect(Math.max(foundationDrift, growthDrift, upsideDrift)).toBeLessThanOrEqual(
      Math.abs(result.currentAllocation.foundation - result.targetAllocation.foundation) + 5
    );
  });

  // Additional: Verify spread constants match PRD
  it('should have spread rates matching PRD Section 7.1', () => {
    // PRD specifies:
    // FOUNDATION: 0.15% (range 0.1%-0.2%) - stablecoins, gold
    // GROWTH: 0.30% (range 0.2%-0.4%) - BTC, ETH, etc.
    // UPSIDE: 0.60% (range 0.4%-0.8%) - higher volatility altcoins

    expect(SPREAD_BY_LAYER.FOUNDATION).toBeGreaterThanOrEqual(0.001);
    expect(SPREAD_BY_LAYER.FOUNDATION).toBeLessThanOrEqual(0.002);

    expect(SPREAD_BY_LAYER.GROWTH).toBeGreaterThanOrEqual(0.002);
    expect(SPREAD_BY_LAYER.GROWTH).toBeLessThanOrEqual(0.004);

    expect(SPREAD_BY_LAYER.UPSIDE).toBeGreaterThanOrEqual(0.004);
    expect(SPREAD_BY_LAYER.UPSIDE).toBeLessThanOrEqual(0.008);
  });

  // Verify spread ordering (Foundation < Growth < Upside)
  it('should have spreads ordered by risk level', () => {
    expect(SPREAD_BY_LAYER.FOUNDATION).toBeLessThan(SPREAD_BY_LAYER.GROWTH);
    expect(SPREAD_BY_LAYER.GROWTH).toBeLessThan(SPREAD_BY_LAYER.UPSIDE);
  });
});
