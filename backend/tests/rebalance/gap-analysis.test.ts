/**
 * Gap Analysis Tests (10 tests)
 * Tests for gap calculation logic in rebalancing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPricesMap,
  createPortfolioSnapshot,
  createHolding,
  createDriftedPortfolio,
  RISK_PROFILES,
  isValidGapAnalysis,
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

describe('Gap Analysis Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentPrices).mockResolvedValue(createPricesMap() as any);
  });

  // Test 36: Foundation gap calculation
  it('should correctly calculate Foundation layer gap', async () => {
    const holdings = [
      createHolding('USDT', 60_000_000_000),  // 60% of 100B
      createHolding('BTC', 30_000_000_000),   // 30%
      createHolding('SOL', 10_000_000_000),   // 10%
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED, // 50/35/15 target
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const foundationGap = result.gapAnalysis.find((g) => g.layer === 'FOUNDATION');
    expect(foundationGap).toBeDefined();

    // Current ~60%, Target 50%, so gap should be negative (overweight)
    expect(foundationGap!.current).toBeCloseTo(60, 0);
    expect(foundationGap!.target).toBe(50);
    expect(foundationGap!.gap).toBeCloseTo(-10, 1); // Overweight by ~10%
  });

  // Test 37: gapIrr calculation from holdings value
  it('should calculate gapIrr based on holdings value', async () => {
    const holdingsValueIrr = 100_000_000_000; // 100B
    const holdings = [
      createHolding('USDT', holdingsValueIrr * 0.60),  // 60%
      createHolding('BTC', holdingsValueIrr * 0.30),   // 30%
      createHolding('SOL', holdingsValueIrr * 0.10),   // 10%
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED, // 50/35/15
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const foundationGap = result.gapAnalysis.find((g) => g.layer === 'FOUNDATION');

    // gapIrr = (gap/100) * holdingsValue = (-10/100) * 100B = -10B
    expect(foundationGap!.gapIrr).toBeCloseTo(-10_000_000_000, -9);
  });

  // Test 38: sellableIrr excludes frozen assets
  it('should calculate sellableIrr excluding frozen assets', async () => {
    const holdings = [
      createHolding('USDT', 30_000_000_000, { frozen: true }),   // Frozen
      createHolding('PAXG', 30_000_000_000, { frozen: false }),  // Sellable
      createHolding('BTC', 25_000_000_000, { frozen: false }),
      createHolding('SOL', 15_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const foundationGap = result.gapAnalysis.find((g) => g.layer === 'FOUNDATION');

    // sellableIrr should be PAXG only (30B), not USDT (frozen)
    expect(foundationGap!.sellableIrr).toBeCloseTo(30_000_000_000, -9);
  });

  // Test 39: frozenIrr accuracy
  it('should accurately report frozenIrr for each layer', async () => {
    const holdings = [
      createHolding('USDT', 20_000_000_000, { frozen: true }),
      createHolding('PAXG', 10_000_000_000, { frozen: false }),
      createHolding('BTC', 25_000_000_000, { frozen: true }),
      createHolding('ETH', 10_000_000_000, { frozen: false }),
      createHolding('SOL', 15_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const foundationGap = result.gapAnalysis.find((g) => g.layer === 'FOUNDATION');
    const growthGap = result.gapAnalysis.find((g) => g.layer === 'GROWTH');

    expect(foundationGap!.frozenIrr).toBeCloseTo(20_000_000_000, -9);
    expect(growthGap!.frozenIrr).toBeCloseTo(25_000_000_000, -9);
  });

  // Test 40: HOLDINGS_PLUS_CASH uses totalValue for calculations
  it('should use totalValue (holdings + cash) in HOLDINGS_PLUS_CASH mode', async () => {
    const cashIrr = 50_000_000_000;
    const holdingsValueIrr = 50_000_000_000;
    const totalValueIrr = cashIrr + holdingsValueIrr;

    const holdings = [
      createHolding('USDT', holdingsValueIrr * 0.50),
      createHolding('BTC', holdingsValueIrr * 0.35),
      createHolding('SOL', holdingsValueIrr * 0.15),
    ];

    const snapshot = createPortfolioSnapshot({
      cashIrr,
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // In HOLDINGS_PLUS_CASH, gaps should be calculated against total value
    // All layers should appear underweight since there's cash to deploy
    const totalGapIrr = result.gapAnalysis.reduce((sum, g) => sum + Math.abs(g.gapIrr), 0);

    // Total gap should be significant since cash needs deployment
    expect(totalGapIrr).toBeGreaterThan(0);
  });

  // Test 41: Empty layer gap calculation
  it('should handle empty layer (gap equals target allocation)', async () => {
    const holdings = [
      createHolding('USDT', 70_000_000_000),  // Foundation only
      createHolding('BTC', 30_000_000_000),   // Growth only
      // No Upside holdings
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED, // Expects 15% Upside
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const upsideGap = result.gapAnalysis.find((g) => g.layer === 'UPSIDE');

    // Upside has 0% current, 15% target, so gap = 15%
    expect(upsideGap!.current).toBeCloseTo(0, 0);
    expect(upsideGap!.target).toBe(15);
    expect(upsideGap!.gap).toBeCloseTo(15, 0);
  });

  // Test 42: Over-allocated layer shows negative gap
  it('should show negative gap for over-allocated layer', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 15, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const foundationGap = result.gapAnalysis.find((g) => g.layer === 'FOUNDATION');

    // Foundation is overweight, so gap should be negative
    expect(foundationGap!.gap).toBeLessThan(0);
    expect(foundationGap!.gapIrr).toBeLessThan(0);
  });

  // Test 43: Returns all 3 layers
  it('should always return exactly 3 layers in gap analysis', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 10, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.gapAnalysis.length).toBe(3);

    const layers = result.gapAnalysis.map((g) => g.layer);
    expect(layers).toContain('FOUNDATION');
    expect(layers).toContain('GROWTH');
    expect(layers).toContain('UPSIDE');
  });

  // Test 44: Zero holdings value handling
  it('should handle zero holdings value without division by zero', async () => {
    const snapshot = createPortfolioSnapshot({
      cashIrr: 100_000_000_000,
      holdings: [],
      allocation: { foundation: 0, growth: 0, upside: 0 },
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    // Should not throw
    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    expect(result.gapAnalysis.length).toBe(3);

    // All layers should be valid
    for (const gap of result.gapAnalysis) {
      expect(isValidGapAnalysis(gap)).toBe(true);
      expect(Number.isFinite(gap.gapIrr)).toBe(true);
    }
  });

  // Test 45: Very large portfolio (1T IRR) precision
  it('should maintain precision with very large portfolio values', async () => {
    const veryLargeValue = PORTFOLIO_SIZES.VERY_LARGE; // 10T IRR
    const holdings = [
      createHolding('USDT', veryLargeValue * 0.50),
      createHolding('BTC', veryLargeValue * 0.35),
      createHolding('SOL', veryLargeValue * 0.15),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      holdingsValueIrr: veryLargeValue,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // All gaps should be finite and reasonable
    for (const gap of result.gapAnalysis) {
      expect(Number.isFinite(gap.gapIrr)).toBe(true);
      expect(Number.isFinite(gap.gap)).toBe(true);
      expect(Math.abs(gap.gap)).toBeLessThan(100); // Gap percentage should be reasonable
    }

    // Sum of current allocations should be approximately 100%
    const totalAllocation = result.gapAnalysis.reduce((sum, g) => sum + g.current, 0);
    expect(totalAllocation).toBeCloseTo(100, 0);
  });
});
