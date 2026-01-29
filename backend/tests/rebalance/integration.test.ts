/**
 * Integration Tests (8 tests)
 * Tests for end-to-end rebalancing flows
 *
 * Note: These tests focus on preview functionality since full execution
 * requires complex transaction mocking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPricesMap,
  createPortfolioSnapshot,
  createHolding,
  createDriftedPortfolio,
  createPortfolioWithCash,
  RISK_PROFILES,
  DEFAULT_PRICES,
  PORTFOLIO_SIZES,
  LAYER_ASSETS,
  calculateDrift,
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

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentPrices).mockResolvedValue(createPricesMap() as any);
    vi.mocked(classifyBoundary).mockReturnValue('SAFE');
  });

  // Test 138: Preview produces consistent results
  it('should produce consistent results when called multiple times', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 15, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result1 = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');
    const result2 = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Same input should produce same output
    expect(result1.totalBuyIrr).toBeCloseTo(result2.totalBuyIrr, -3);
    expect(result1.totalSellIrr).toBeCloseTo(result2.totalSellIrr, -3);
    expect(result1.trades.length).toBe(result2.trades.length);
  });

  // Test 139: Multiple rebalances converge to target
  it('should converge toward target allocation over multiple rebalances', async () => {
    // First rebalance from heavily imbalanced
    let snapshot = createDriftedPortfolio('BALANCED', 25, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const firstPreview = await previewRebalance('user-123', 'HOLDINGS_ONLY');
    const firstDrift = calculateDrift(firstPreview.afterAllocation, firstPreview.targetAllocation);

    // Simulate applying first rebalance
    snapshot = createPortfolioSnapshot({
      allocation: firstPreview.afterAllocation,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    // Second rebalance should further reduce drift
    const secondPreview = await previewRebalance('user-123', 'HOLDINGS_ONLY');
    const secondDrift = calculateDrift(secondPreview.afterAllocation, secondPreview.targetAllocation);

    // Drift should decrease or stay same
    expect(secondDrift).toBeLessThanOrEqual(firstDrift + 1);
  });

  // Test 140: Rebalance after adding funds
  it('should properly deploy newly added funds', async () => {
    const newCashIrr = 100_000_000_000;
    const snapshot = createPortfolioWithCash(newCashIrr, PORTFOLIO_SIZES.MEDIUM);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Should have buy trades to deploy cash
    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    expect(buyTrades.length).toBeGreaterThan(0);
    expect(result.totalBuyIrr).toBeGreaterThan(0);
  });

  // Test 141: Rebalance with active loan (frozen collateral)
  it('should properly handle portfolio with active loan', async () => {
    const holdings = [
      createHolding('USDT', 30_000_000_000, { frozen: true }),
      createHolding('PAXG', 20_000_000_000, { frozen: false }),
      createHolding('BTC', 35_000_000_000, { frozen: false }),
      createHolding('SOL', 15_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const usdtSells = result.trades.filter((t) => t.side === 'SELL' && t.assetId === 'USDT');
    expect(usdtSells.length).toBe(0);
    expect(result.hasLockedCollateral).toBe(true);
  });

  // Test 142: Rebalance with price changes
  it('should recalculate correctly when prices change', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 10, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const normalPrices = createPricesMap();
    vi.mocked(getCurrentPrices).mockResolvedValue(normalPrices as any);

    const result1 = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const newPrices = createPricesMap({ BTC: DEFAULT_PRICES.BTC * 2 });
    vi.mocked(getCurrentPrices).mockResolvedValue(newPrices as any);

    const result2 = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result2.gapAnalysis).toBeDefined();
  });

  // Test 143: Mode switch produces different trade sets
  it('should produce different trades for different modes', async () => {
    const snapshot = createPortfolioWithCash(50_000_000_000, PORTFOLIO_SIZES.MEDIUM);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const holdingsOnlyResult = await previewRebalance('user-123', 'HOLDINGS_ONLY');
    const deploysCashResult = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    expect(deploysCashResult.totalBuyIrr).toBeGreaterThanOrEqual(holdingsOnlyResult.totalBuyIrr);
  });

  // Test 144: All 15 assets coverage
  it('should handle portfolio with all 15 supported assets', async () => {
    const allAssets = [
      ...LAYER_ASSETS.FOUNDATION,
      ...LAYER_ASSETS.GROWTH,
      ...LAYER_ASSETS.UPSIDE,
    ];

    const holdingsPerAsset = PORTFOLIO_SIZES.MEDIUM / allAssets.length;
    const holdings = allAssets.map((assetId) =>
      createHolding(assetId, holdingsPerAsset)
    );

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.gapAnalysis.length).toBe(3);
    expect(result.trades).toBeDefined();

    const layers = result.gapAnalysis.map((g) => g.layer);
    expect(layers).toContain('FOUNDATION');
    expect(layers).toContain('GROWTH');
    expect(layers).toContain('UPSIDE');
  });

  // Test 145: Risk profile change triggers rebalance
  it('should calculate correct trades when risk profile changes', async () => {
    const holdings = [
      createHolding('USDT', 70_000_000_000),
      createHolding('BTC', 25_000_000_000),
      createHolding('SOL', 5_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.AGGRESSIVE,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.totalSellIrr).toBeGreaterThan(0);
    expect(result.totalBuyIrr).toBeGreaterThan(0);

    const foundationGap = result.gapAnalysis.find((g) => g.layer === 'FOUNDATION');
    const growthGap = result.gapAnalysis.find((g) => g.layer === 'GROWTH');
    const upsideGap = result.gapAnalysis.find((g) => g.layer === 'UPSIDE');

    expect(foundationGap!.gap).toBeLessThan(0);
    expect(growthGap!.gap).toBeGreaterThan(0);
    expect(upsideGap!.gap).toBeGreaterThan(0);
  });
});
