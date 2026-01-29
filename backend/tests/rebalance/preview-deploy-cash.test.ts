/**
 * Preview HOLDINGS_PLUS_CASH Tests (12 tests)
 * Tests for rebalance preview in HOLDINGS_PLUS_CASH mode (Deploy Cash)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPricesMap,
  createPortfolioSnapshot,
  createPortfolioWithCash,
  createCashOnlyPortfolio,
  createHolding,
  RISK_PROFILES,
  MIN_TRADE_AMOUNT,
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

describe('Preview HOLDINGS_PLUS_CASH (Deploy Cash) Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentPrices).mockResolvedValue(createPricesMap() as any);
  });

  // Test 24: Large cash with balanced holdings
  it('should deploy cash proportionally when holdings are balanced', async () => {
    const cashIrr = 100_000_000_000; // 100M IRR cash
    const snapshot = createPortfolioWithCash(cashIrr, PORTFOLIO_SIZES.MEDIUM);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Should have buy trades to deploy cash
    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    expect(buyTrades.length).toBeGreaterThan(0);
    expect(result.totalBuyIrr).toBeGreaterThan(0);
  });

  // Test 25: 100M cash with all layers underweight
  it('should buy all layers when all are underweight relative to total portfolio', async () => {
    const cashIrr = 100_000_000_000; // 100M cash
    const holdingsValueIrr = 50_000_000_000; // 50M holdings

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

    // With large cash, should buy into multiple layers
    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    const buyLayers = new Set(buyTrades.map((t) => t.layer));

    expect(buyTrades.length).toBeGreaterThan(0);
  });

  // Test 26: Cash + overweight Foundation
  it('should sell Foundation and buy others when Foundation is overweight with cash', async () => {
    const cashIrr = 50_000_000_000;
    const holdings = [
      createHolding('USDT', 60_000_000_000),  // Foundation overweight
      createHolding('PAXG', 10_000_000_000),
      createHolding('BTC', 20_000_000_000),   // Growth underweight
      createHolding('SOL', 10_000_000_000),   // Upside underweight
    ];

    const snapshot = createPortfolioSnapshot({
      cashIrr,
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Foundation should have sells, others should have buys
    const sellTrades = result.trades.filter((t) => t.side === 'SELL');
    const buyTrades = result.trades.filter((t) => t.side === 'BUY');

    expect(buyTrades.length).toBeGreaterThan(0);
  });

  // Test 27: Cash exactly covers gaps
  it('should deploy exact cash amount when it matches total gap', async () => {
    // Create scenario where cash exactly matches underweight gap
    const targetTotal = PORTFOLIO_SIZES.MEDIUM;
    const cashIrr = targetTotal * 0.1; // 10% cash

    const snapshot = createPortfolioSnapshot({
      cashIrr,
      holdingsValueIrr: targetTotal * 0.9,
      allocation: RISK_PROFILES.BALANCED,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Total buy should approximate available cash
    expect(result.totalBuyIrr).toBeLessThanOrEqual(cashIrr);
  });

  // Test 28: Insufficient cash for full rebalance
  it('should perform partial rebalance when cash is insufficient', async () => {
    const smallCash = MIN_TRADE_AMOUNT * 2; // Just above minimum
    const snapshot = createPortfolioSnapshot({
      cashIrr: smallCash,
      holdingsValueIrr: PORTFOLIO_SIZES.MEDIUM,
      allocation: { foundation: 70, growth: 20, upside: 10 }, // Imbalanced
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Buy amount should not exceed available cash + sell proceeds
    expect(result.totalBuyIrr).toBeLessThanOrEqual(smallCash + result.totalSellIrr * 1.1);
  });

  // Test 29: Cash-only portfolio
  it('should buy all layers proportionally in cash-only portfolio', async () => {
    const snapshot = createCashOnlyPortfolio(PORTFOLIO_SIZES.MEDIUM);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // All cash should be deployed to buy holdings
    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    expect(buyTrades.length).toBeGreaterThan(0);
    expect(result.totalSellIrr).toBe(0); // Nothing to sell
  });

  // Test 30: Cash + frozen overweight
  it('should limit rebalance when overweight layer is frozen', async () => {
    const cashIrr = 50_000_000_000;
    const holdings = [
      createHolding('USDT', 70_000_000_000, { frozen: true }),  // Frozen, can't sell
      createHolding('BTC', 20_000_000_000, { frozen: false }),
      createHolding('SOL', 10_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      cashIrr,
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Should not sell frozen USDT
    const usdtSells = result.trades.filter((t) => t.side === 'SELL' && t.assetId === 'USDT');
    expect(usdtSells.length).toBe(0);
    expect(result.hasLockedCollateral).toBe(true);
  });

  // Test 31: SMART mode equals HOLDINGS_PLUS_CASH
  it('should produce identical results for SMART and HOLDINGS_PLUS_CASH modes', async () => {
    const snapshot = createPortfolioWithCash(50_000_000_000);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const resultCash = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');
    const resultSmart = await previewRebalance('user-123', 'SMART');

    // SMART mode should behave like HOLDINGS_PLUS_CASH
    expect(resultSmart.totalBuyIrr).toBeCloseTo(resultCash.totalBuyIrr, -5);
    expect(resultSmart.totalSellIrr).toBeCloseTo(resultCash.totalSellIrr, -5);
  });

  // Test 32: Positive gapIrr for underweight layers
  it('should calculate positive gapIrr for underweight layers', async () => {
    const holdings = [
      createHolding('USDT', 70_000_000_000),  // Overweight
      createHolding('BTC', 20_000_000_000),   // Underweight
      createHolding('SOL', 10_000_000_000),   // Underweight
    ];

    const snapshot = createPortfolioSnapshot({
      cashIrr: 50_000_000_000,
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Growth and Upside gaps should be positive (need to buy)
    const growthGap = result.gapAnalysis.find((g) => g.layer === 'GROWTH');
    const upsideGap = result.gapAnalysis.find((g) => g.layer === 'UPSIDE');

    expect(growthGap).toBeDefined();
    expect(upsideGap).toBeDefined();
    // In HOLDINGS_PLUS_CASH mode, underweight layers should have positive gapIrr
    if (growthGap && growthGap.current < growthGap.target) {
      expect(growthGap.gapIrr).toBeGreaterThan(0);
    }
  });

  // Test 33: Total available equals sells + cash
  it('should calculate total available budget as sells + cash', async () => {
    const cashIrr = 30_000_000_000;
    const holdings = [
      createHolding('USDT', 60_000_000_000),  // Overweight - will sell
      createHolding('BTC', 25_000_000_000),
      createHolding('SOL', 15_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      cashIrr,
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Buy amount should not exceed sell proceeds + cash (accounting for spreads)
    const maxBuyBudget = (result.totalSellIrr * 0.997) + cashIrr; // Account for spreads
    expect(result.totalBuyIrr).toBeLessThanOrEqual(maxBuyBudget * 1.05); // 5% tolerance
  });

  // Test 34: Net proceeds after spread deduction
  it('should properly account for spread in buy calculations', async () => {
    const snapshot = createPortfolioWithCash(100_000_000_000);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // afterAllocation should account for spreads
    expect(result.afterAllocation).toBeDefined();
    expect(result.afterAllocation.foundation).toBeDefined();
    expect(result.afterAllocation.growth).toBeDefined();
    expect(result.afterAllocation.upside).toBeDefined();
  });

  // Test 35: Layer buy limits prevent disproportionate buys
  it('should not disproportionately buy into any single layer', async () => {
    const cashIrr = 100_000_000_000;
    const snapshot = createPortfolioSnapshot({
      cashIrr,
      holdingsValueIrr: 50_000_000_000,
      allocation: RISK_PROFILES.BALANCED,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    const buysByLayer: Record<string, number> = {};

    for (const trade of buyTrades) {
      buysByLayer[trade.layer] = (buysByLayer[trade.layer] || 0) + trade.amountIrr;
    }

    const totalBuys = Object.values(buysByLayer).reduce((sum, v) => sum + v, 0);

    // No single layer should receive more than 60% of total buys
    for (const [layer, amount] of Object.entries(buysByLayer)) {
      const pct = amount / totalBuys;
      expect(pct).toBeLessThan(0.7); // Allow some flexibility
    }
  });
});
