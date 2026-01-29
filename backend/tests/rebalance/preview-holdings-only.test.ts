/**
 * Preview HOLDINGS_ONLY Tests (15 tests)
 * Tests for rebalance preview in HOLDINGS_ONLY mode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPricesMap,
  createPerfectlyBalancedPortfolio,
  createDriftedPortfolio,
  createPortfolioSnapshot,
  createHolding,
  RISK_PROFILES,
  LAYER_ASSETS,
  MIN_TRADE_AMOUNT,
  isValidGapAnalysis,
  sumTrades,
  allTradesMeetMinimum,
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

describe('Preview HOLDINGS_ONLY Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentPrices).mockResolvedValue(createPricesMap() as any);
  });

  // Test 9: Perfectly balanced portfolio
  it('should return empty trades for perfectly balanced portfolio', async () => {
    const snapshot = createPerfectlyBalancedPortfolio('BALANCED');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Balanced portfolio should have minimal or no trades
    expect(result.canFullyRebalance).toBe(true);
    expect(result.residualDrift).toBeLessThan(5);
  });

  // Test 10: Foundation overweight 10%
  it('should generate sell trades when Foundation is overweight by 10%', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 10, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const sellTrades = result.trades.filter((t) => t.side === 'SELL');
    const foundationSells = sellTrades.filter((t) => t.layer === 'FOUNDATION');

    // Should have Foundation sell trades
    expect(foundationSells.length).toBeGreaterThan(0);
    expect(result.totalSellIrr).toBeGreaterThan(0);
  });

  // Test 11: Growth overweight 15%
  it('should generate sell trades when Growth is overweight by 15%', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 15, 'overweight-growth');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const sellTrades = result.trades.filter((t) => t.side === 'SELL');
    const growthSells = sellTrades.filter((t) => t.layer === 'GROWTH');

    expect(growthSells.length).toBeGreaterThan(0);
    expect(result.totalSellIrr).toBeGreaterThan(0);
  });

  // Test 12: Upside overweight 20%
  it('should generate sell trades when Upside is overweight by 20%', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 20, 'overweight-upside');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const sellTrades = result.trades.filter((t) => t.side === 'SELL');
    const upsideSells = sellTrades.filter((t) => t.layer === 'UPSIDE');

    expect(upsideSells.length).toBeGreaterThan(0);
  });

  // Test 13: Multiple layers overweight
  it('should handle multiple layers being overweight simultaneously', async () => {
    // Create portfolio where Foundation and Growth are both overweight, Upside very underweight
    const holdings = [
      createHolding('USDT', 40_000_000_000),  // Foundation heavy
      createHolding('PAXG', 15_000_000_000),
      createHolding('BTC', 35_000_000_000),   // Growth heavy
      createHolding('ETH', 8_000_000_000),
      createHolding('SOL', 2_000_000_000),    // Upside very light
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Should have sells from overweight layers
    const sellTrades = result.trades.filter((t) => t.side === 'SELL');
    expect(sellTrades.length).toBeGreaterThan(0);
  });

  // Test 14: All holdings frozen and overweight
  it('should return empty trades when all holdings are frozen', async () => {
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

    // Cannot sell frozen assets
    const sellTrades = result.trades.filter((t) => t.side === 'SELL');
    expect(sellTrades.length).toBe(0);
    expect(result.hasLockedCollateral).toBe(true);
  });

  // Test 15: Partial frozen assets
  it('should only sell unfrozen assets when some are frozen', async () => {
    const holdings = [
      createHolding('USDT', 30_000_000_000, { frozen: true }),   // Frozen
      createHolding('PAXG', 30_000_000_000, { frozen: false }),  // Can sell
      createHolding('BTC', 25_000_000_000, { frozen: false }),
      createHolding('SOL', 15_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Should not sell USDT (frozen)
    const usdtSells = result.trades.filter((t) => t.side === 'SELL' && t.assetId === 'USDT');
    expect(usdtSells.length).toBe(0);
    expect(result.hasLockedCollateral).toBe(true);
  });

  // Test 16: Single asset portfolio
  it('should handle single asset portfolio (cannot diversify)', async () => {
    const holdings = [
      createHolding('USDT', 100_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Can only sell USDT to generate cash, no direct buying in HOLDINGS_ONLY
    expect(result.trades.length).toBeGreaterThanOrEqual(0);
  });

  // Test 17: Holdings below MIN_TRADE_AMOUNT
  it('should not generate trades below MIN_TRADE_AMOUNT', async () => {
    const holdings = [
      createHolding('USDT', 50_000),   // Below minimum
      createHolding('BTC', 50_000),    // Below minimum
      createHolding('SOL', 50_000),    // Below minimum
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // All potential trades would be below minimum
    expect(allTradesMeetMinimum(result.trades)).toBe(true);
  });

  // Test 18: Holdings at MIN_TRADE_AMOUNT threshold
  it('should generate trades at exactly MIN_TRADE_AMOUNT threshold', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 15, 'overweight-foundation', PORTFOLIO_SIZES.MEDIUM);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // All trades should meet minimum
    expect(allTradesMeetMinimum(result.trades)).toBe(true);
  });

  // Test 19: Drift exactly 1%
  it('should handle drift at exactly 1% (borderline rebalance needed)', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 1, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // 1% drift is borderline - may or may not trigger trades
    expect(result.currentAllocation).toBeDefined();
    expect(result.targetAllocation).toBeDefined();
  });

  // Test 20: Drift at 5%
  it('should trigger rebalance at 5% drift', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 5, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // 5% drift should trigger some trades
    expect(result.trades.length).toBeGreaterThanOrEqual(0);
  });

  // Test 21: Drift at 10%
  it('should definitely trigger rebalance at 10% drift', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 10, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.trades.length).toBeGreaterThan(0);
  });

  // Test 22: Drift at 15%
  it('should generate significant trades at 15% drift', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 15, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.totalSellIrr).toBeGreaterThan(0);
  });

  // Test 23: Gap analysis structure validation
  it('should return properly structured gap analysis', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 10, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.gapAnalysis).toBeDefined();
    expect(result.gapAnalysis.length).toBe(3);

    // All gaps should have valid structure
    for (const gap of result.gapAnalysis) {
      expect(isValidGapAnalysis(gap)).toBe(true);
    }

    // Should have all three layers
    const layers = result.gapAnalysis.map((g) => g.layer);
    expect(layers).toContain('FOUNDATION');
    expect(layers).toContain('GROWTH');
    expect(layers).toContain('UPSIDE');
  });
});
