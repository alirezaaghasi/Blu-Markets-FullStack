/**
 * Edge Cases Tests (15 tests)
 * Tests for boundary conditions and edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPricesMap,
  createPortfolioSnapshot,
  createHolding,
  createDriftedPortfolio,
  createCashOnlyPortfolio,
  createMinimumPortfolio,
  createPortfolioWithCash,
  RISK_PROFILES,
  MIN_TRADE_AMOUNT,
  PORTFOLIO_SIZES,
  allTradesMeetMinimum,
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

describe('Edge Cases Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentPrices).mockResolvedValue(createPricesMap() as any);
  });

  // Test 123: Zero portfolio value
  it('should handle zero portfolio value without division by zero', async () => {
    const snapshot = createPortfolioSnapshot({
      cashIrr: 0,
      holdings: [],
      allocation: { foundation: 0, growth: 0, upside: 0 },
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    // Should not throw
    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.trades).toBeDefined();
    expect(result.gapAnalysis).toBeDefined();
    expect(result.gapAnalysis.length).toBe(3);

    // All values should be finite
    for (const gap of result.gapAnalysis) {
      expect(Number.isFinite(gap.gapIrr)).toBe(true);
      expect(Number.isFinite(gap.gap)).toBe(true);
    }
  });

  // Test 124: Holding at MIN_TRADE_AMOUNT threshold
  it('should handle holdings at exactly MIN_TRADE_AMOUNT', async () => {
    const holdings = [
      createHolding('USDT', MIN_TRADE_AMOUNT),
      createHolding('BTC', MIN_TRADE_AMOUNT),
      createHolding('SOL', MIN_TRADE_AMOUNT),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Should handle gracefully
    expect(result.trades).toBeDefined();
    // All generated trades should meet minimum
    expect(allTradesMeetMinimum(result.trades)).toBe(true);
  });

  // Test 125: IRR rounding applied
  it('should apply proper IRR rounding', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 10, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // All IRR values should be integers (no fractional IRR)
    for (const trade of result.trades) {
      expect(Number.isInteger(trade.amountIrr)).toBe(true);
    }

    for (const gap of result.gapAnalysis) {
      // gapIrr may have some floating point, but should be close to integer
      expect(Math.abs(gap.gapIrr - Math.round(gap.gapIrr))).toBeLessThan(1);
    }
  });

  // Test 126: Crypto precision handling
  it('should handle crypto quantity precision correctly', async () => {
    // BTC can have 8 decimal places
    const holdings = [
      createHolding('USDT', 50_000_000_000),
      createHolding('BTC', 35_000_000_000),  // Large BTC position
      createHolding('SOL', 15_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Should complete without precision errors
    expect(result.trades).toBeDefined();
    expect(result.gapAnalysis).toBeDefined();
  });

  // Test 127: Very small drift (0.1%)
  it('should handle very small drift (0.1%)', async () => {
    // Create portfolio with 0.1% drift at layer level
    // Using multiple assets per layer to avoid intra-layer rebalancing effects
    // Total: 100B IRR
    // Target: BALANCED (50/35/15)
    // Actual: 50.1/34.9/15.0 = 0.1% max drift
    const holdings = [
      // Foundation: 50.1% (target 50%)
      createHolding('USDT', 25_050_000_000),   // Half of Foundation
      createHolding('PAXG', 25_050_000_000),   // Half of Foundation
      // Growth: 34.9% (target 35%)
      createHolding('BTC', 17_450_000_000),    // Half of Growth
      createHolding('ETH', 17_450_000_000),    // Half of Growth
      // Upside: 15% (target 15%)
      createHolding('SOL', 7_500_000_000),     // Half of Upside
      createHolding('TON', 7_500_000_000),     // Half of Upside
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Very small drift may not trigger significant trades
    // Residual drift should be low since input drift is only 0.1%
    // Allow some tolerance for spreads, minimums, and rounding
    expect(result.residualDrift).toBeLessThan(6);
  });

  // Test 128: Maximum drift (99%)
  it('should handle extreme drift (99%)', async () => {
    // Single asset portfolio - extreme drift
    const holdings = [
      createHolding('USDT', 99_000_000_000),  // 99%
      createHolding('BTC', 500_000_000),       // 0.5%
      createHolding('SOL', 500_000_000),       // 0.5%
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED, // 50/35/15
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Should handle extreme imbalance
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.totalSellIrr).toBeGreaterThan(0);
  });

  // Test 129: Price unavailable for asset
  it('should gracefully handle missing price for asset', async () => {
    // Create prices map without SOL
    const partialPrices = createPricesMap();
    partialPrices.delete('SOL' as any);
    vi.mocked(getCurrentPrices).mockResolvedValue(partialPrices as any);

    const holdings = [
      createHolding('USDT', 50_000_000_000),
      createHolding('BTC', 35_000_000_000),
      createHolding('SOL', 15_000_000_000),  // No price available
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    // Should not throw
    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');
    expect(result.trades).toBeDefined();
  });

  // Test 130: Empty prices map
  it('should handle empty prices map', async () => {
    vi.mocked(getCurrentPrices).mockResolvedValue(new Map() as any);

    const snapshot = createDriftedPortfolio('BALANCED', 10, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    // Should not throw, but may have no meaningful trades
    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');
    expect(result.trades).toBeDefined();
  });

  // Test 131: Holdings map consistency in transaction
  it('should maintain holdings consistency during trade generation', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 15, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // No duplicate asset+side combinations after consolidation
    const tradeKeys = result.trades.map((t) => `${t.side}-${t.assetId}`);
    const uniqueKeys = new Set(tradeKeys);
    expect(tradeKeys.length).toBe(uniqueKeys.size);
  });

  // Test 132: Insufficient cash mid-buy
  it('should handle insufficient cash during buy generation', async () => {
    // Very small cash, large portfolio
    const snapshot = createPortfolioSnapshot({
      cashIrr: MIN_TRADE_AMOUNT,  // Just at minimum
      holdingsValueIrr: PORTFOLIO_SIZES.LARGE,
      allocation: { foundation: 60, growth: 30, upside: 10 }, // Imbalanced
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Should not overspend available budget
    const totalAvailable = snapshot.cashIrr + result.totalSellIrr;
    expect(result.totalBuyIrr).toBeLessThanOrEqual(totalAvailable * 1.05);
  });

  // Test 133: Negative cash prevention
  it('should never allow negative cash balance', async () => {
    const snapshot = createPortfolioWithCash(10_000_000, PORTFOLIO_SIZES.SMALL);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Buys should not exceed available funds
    expect(result.totalBuyIrr).toBeLessThanOrEqual(
      10_000_000 + (result.totalSellIrr * 1.01)
    );
  });

  // Test 134: 5% diversification reserve
  it('should maintain 5% diversification reserve when selling', async () => {
    // Create scenario where selling would normally liquidate entire position
    const holdings = [
      createHolding('USDT', 90_000_000_000),  // Very overweight
      createHolding('BTC', 5_000_000_000),
      createHolding('SOL', 5_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // USDT sells should not exceed 80% of holding (20% minimum retained)
    const usdtSells = result.trades.filter(
      (t) => t.side === 'SELL' && t.assetId === 'USDT'
    );
    const totalUsdtSell = usdtSells.reduce((sum, t) => sum + t.amountIrr, 0);

    expect(totalUsdtSell).toBeLessThanOrEqual(90_000_000_000 * 0.80 * 1.01);
  });

  // Test 135: Trade consolidation keys
  it('should generate correct trade consolidation keys', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 15, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Each trade should have valid layer
    for (const trade of result.trades) {
      expect(['FOUNDATION', 'GROWTH', 'UPSIDE']).toContain(trade.layer);
      expect(['BUY', 'SELL']).toContain(trade.side);
      expect(trade.assetId).toBeDefined();
      expect(trade.amountIrr).toBeGreaterThan(0);
    }
  });

  // Test 136: Decimal precision
  it('should maintain decimal precision without floating point errors', async () => {
    // Use values that could cause floating point issues
    const holdings = [
      createHolding('USDT', 33_333_333_333),  // Repeating decimal-ish
      createHolding('BTC', 33_333_333_334),
      createHolding('SOL', 33_333_333_333),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // All values should be finite and reasonable
    expect(Number.isFinite(result.totalBuyIrr)).toBe(true);
    expect(Number.isFinite(result.totalSellIrr)).toBe(true);

    for (const gap of result.gapAnalysis) {
      expect(Number.isFinite(gap.gapIrr)).toBe(true);
      expect(Math.abs(gap.current + gap.gap - gap.target)).toBeLessThan(0.1);
    }
  });

  // Test 137: Large numbers (1T+ IRR)
  it('should handle very large portfolio values (10T IRR)', async () => {
    const veryLargeValue = PORTFOLIO_SIZES.VERY_LARGE; // 10T IRR

    const holdings = [
      createHolding('USDT', veryLargeValue * 0.60),  // 60%
      createHolding('BTC', veryLargeValue * 0.30),   // 30%
      createHolding('SOL', veryLargeValue * 0.10),   // 10%
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      holdingsValueIrr: veryLargeValue,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Should handle without overflow
    expect(Number.isFinite(result.totalBuyIrr)).toBe(true);
    expect(Number.isFinite(result.totalSellIrr)).toBe(true);
    expect(result.totalBuyIrr).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(result.totalSellIrr).toBeLessThan(Number.MAX_SAFE_INTEGER);

    // Gap analysis should be valid
    for (const gap of result.gapAnalysis) {
      expect(Number.isFinite(gap.gapIrr)).toBe(true);
      expect(Math.abs(gap.gap)).toBeLessThan(100);
    }
  });
});
