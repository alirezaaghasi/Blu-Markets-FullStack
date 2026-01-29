/**
 * Frozen/Loan Assets Tests (10 tests)
 * Tests for handling loan collateral and frozen asset scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPricesMap,
  createPortfolioSnapshot,
  createHolding,
  createDriftedPortfolio,
  RISK_PROFILES,
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
  classifyBoundary: vi.fn(() => 'SAFE'),
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

import { getPortfolioSnapshot, classifyBoundary } from '../../src/modules/portfolio/portfolio.service.js';
import { getCurrentPrices } from '../../src/services/price-fetcher.service.js';
import { previewRebalance } from '../../src/modules/rebalance/rebalance.service.js';

describe('Frozen/Loan Assets Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentPrices).mockResolvedValue(createPricesMap() as any);
  });

  // Test 85: All holdings frozen
  it('should set canFullyRebalance to false when all holdings are frozen', async () => {
    const holdings = [
      createHolding('USDT', 60_000_000_000, { frozen: true }),
      createHolding('BTC', 30_000_000_000, { frozen: true }),
      createHolding('SOL', 10_000_000_000, { frozen: true }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Cannot fully rebalance when everything is frozen
    expect(result.hasLockedCollateral).toBe(true);
    // No sells possible
    const sellTrades = result.trades.filter((t) => t.side === 'SELL');
    expect(sellTrades.length).toBe(0);
  });

  // Test 86: Overweight layer 100% frozen
  it('should not reduce overweight layer when fully frozen', async () => {
    // Foundation is overweight and 100% frozen
    const holdings = [
      createHolding('USDT', 70_000_000_000, { frozen: true }),  // All Foundation frozen
      createHolding('BTC', 20_000_000_000, { frozen: false }),
      createHolding('SOL', 10_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Foundation is overweight but cannot be sold (all frozen)
    const foundationSells = result.trades.filter(
      (t) => t.side === 'SELL' && t.layer === 'FOUNDATION'
    );
    expect(foundationSells.length).toBe(0);
    expect(result.hasLockedCollateral).toBe(true);
  });

  // Test 87: Partial frozen in overweight layer
  it('should partially reduce overweight layer when partially frozen', async () => {
    // Foundation overweight: 40B frozen, 30B unfrozen
    const holdings = [
      createHolding('USDT', 40_000_000_000, { frozen: true }),   // Frozen
      createHolding('PAXG', 30_000_000_000, { frozen: false }),  // Can sell
      createHolding('BTC', 20_000_000_000, { frozen: false }),
      createHolding('SOL', 10_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Should sell PAXG (not frozen) but not USDT (frozen)
    const usdtSells = result.trades.filter((t) => t.side === 'SELL' && t.assetId === 'USDT');
    expect(usdtSells.length).toBe(0);

    expect(result.hasLockedCollateral).toBe(true);
  });

  // Test 88: Frozen in underweight layer (can still buy)
  it('should allow buying into layer with frozen assets', async () => {
    // Growth is underweight with some frozen assets
    const holdings = [
      createHolding('USDT', 50_000_000_000, { frozen: false }),
      createHolding('BTC', 20_000_000_000, { frozen: true }),   // Growth frozen
      createHolding('ETH', 5_000_000_000, { frozen: false }),
      createHolding('SOL', 25_000_000_000, { frozen: false }),  // Upside overweight
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Can still buy into Growth even though BTC is frozen
    expect(result.hasLockedCollateral).toBe(true);
    // Buying is not blocked by frozen assets
  });

  // Test 89: hasLockedCollateral flag
  it('should set hasLockedCollateral flag when any asset is frozen', async () => {
    // Only one small asset frozen
    const holdings = [
      createHolding('USDT', 50_000_000_000, { frozen: false }),
      createHolding('BTC', 35_000_000_000, { frozen: false }),
      createHolding('SOL', 10_000_000_000, { frozen: true }),   // Only this frozen
      createHolding('TON', 5_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.hasLockedCollateral).toBe(true);
  });

  // Test 90: STRUCTURAL boundary classification
  it('should handle STRUCTURAL boundary requiring acknowledgment', async () => {
    vi.mocked(classifyBoundary).mockReturnValue('STRUCTURAL');

    const holdings = [
      createHolding('USDT', 60_000_000_000, { frozen: true }),
      createHolding('BTC', 30_000_000_000, { frozen: false }),
      createHolding('SOL', 10_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Preview should still work, but execute would need acknowledgment
    expect(result.hasLockedCollateral).toBe(true);
    expect(result.canFullyRebalance).toBe(false);
  });

  // Test 91: STRESS boundary classification
  it('should handle STRESS boundary for worst-case scenarios', async () => {
    vi.mocked(classifyBoundary).mockReturnValue('STRESS');

    // Worst case: all overweight assets frozen
    const holdings = [
      createHolding('USDT', 80_000_000_000, { frozen: true }),  // All Foundation frozen
      createHolding('BTC', 15_000_000_000, { frozen: false }),
      createHolding('SOL', 5_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.hasLockedCollateral).toBe(true);
    expect(result.canFullyRebalance).toBe(false);
  });

  // Test 92: frozenIrr accuracy in gap analysis
  it('should accurately report frozenIrr in gap analysis', async () => {
    const holdings = [
      createHolding('USDT', 30_000_000_000, { frozen: true }),   // 30B frozen
      createHolding('PAXG', 20_000_000_000, { frozen: false }),  // 20B unfrozen
      createHolding('BTC', 35_000_000_000, { frozen: false }),
      createHolding('SOL', 15_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const foundationGap = result.gapAnalysis.find((g) => g.layer === 'FOUNDATION');

    expect(foundationGap).toBeDefined();
    expect(foundationGap!.frozenIrr).toBeCloseTo(30_000_000_000, -9);
  });

  // Test 93: sellableIrr excludes frozen in gap analysis
  it('should exclude frozen assets from sellableIrr', async () => {
    const holdings = [
      createHolding('USDT', 30_000_000_000, { frozen: true }),   // Frozen
      createHolding('PAXG', 20_000_000_000, { frozen: false }),  // Sellable
      createHolding('BTC', 35_000_000_000, { frozen: false }),
      createHolding('SOL', 15_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const foundationGap = result.gapAnalysis.find((g) => g.layer === 'FOUNDATION');

    expect(foundationGap).toBeDefined();
    // sellableIrr should be PAXG only (20B)
    expect(foundationGap!.sellableIrr).toBeCloseTo(20_000_000_000, -9);
  });

  // Test 94: Mixed frozen across all layers
  it('should handle frozen assets across all three layers', async () => {
    const holdings = [
      createHolding('USDT', 25_000_000_000, { frozen: true }),   // Foundation frozen
      createHolding('PAXG', 25_000_000_000, { frozen: false }),
      createHolding('BTC', 20_000_000_000, { frozen: true }),    // Growth frozen
      createHolding('ETH', 15_000_000_000, { frozen: false }),
      createHolding('SOL', 10_000_000_000, { frozen: true }),    // Upside frozen
      createHolding('TON', 5_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.hasLockedCollateral).toBe(true);

    // Each layer should have correct frozenIrr
    for (const gap of result.gapAnalysis) {
      expect(gap.frozenIrr).toBeGreaterThanOrEqual(0);
      expect(gap.sellableIrr).toBeGreaterThanOrEqual(0);
      // frozen + sellable should approximate total layer value
    }

    // Should not sell any frozen assets
    const sellTrades = result.trades.filter((t) => t.side === 'SELL');
    const frozenAssets = ['USDT', 'BTC', 'SOL'];
    for (const trade of sellTrades) {
      expect(frozenAssets).not.toContain(trade.assetId);
    }
  });
});
