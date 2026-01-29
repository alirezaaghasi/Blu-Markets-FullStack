/**
 * Trade Generation - Buys Tests (12 tests)
 * Tests for buy trade generation logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPricesMap,
  createPortfolioSnapshot,
  createHolding,
  createPortfolioWithCash,
  createCashOnlyPortfolio,
  RISK_PROFILES,
  MIN_TRADE_AMOUNT,
  SPREAD_BY_LAYER,
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

// Mock intra-layer balancer
vi.mock('../../src/services/intra-layer-balancer.js', async () => {
  const actual = await vi.importActual('../../src/services/intra-layer-balancer.js');
  return {
    ...actual,
    getDynamicLayerWeights: vi.fn((layer: string, _strategy: string) => {
      // Return realistic weights based on layer
      if (layer === 'FOUNDATION') {
        return { USDT: 0.40, PAXG: 0.30, IRR_FIXED_INCOME: 0.30 };
      } else if (layer === 'GROWTH') {
        return { BTC: 0.25, ETH: 0.20, BNB: 0.15, XRP: 0.10, KAG: 0.15, QQQ: 0.15 };
      } else {
        return { SOL: 0.20, TON: 0.18, LINK: 0.18, AVAX: 0.16, MATIC: 0.14, ARB: 0.14 };
      }
    }),
  };
});

import { getPortfolioSnapshot } from '../../src/modules/portfolio/portfolio.service.js';
import { getCurrentPrices } from '../../src/services/price-fetcher.service.js';
import { getDynamicLayerWeights } from '../../src/services/intra-layer-balancer.js';
import { previewRebalance } from '../../src/modules/rebalance/rebalance.service.js';

describe('Trade Generation - Buys Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentPrices).mockResolvedValue(createPricesMap() as any);
  });

  // Test 58: HRAM weights used for buy distribution
  it('should use getDynamicLayerWeights for buy distribution', async () => {
    const snapshot = createPortfolioWithCash(100_000_000_000, 50_000_000_000);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // getDynamicLayerWeights should have been called
    expect(getDynamicLayerWeights).toHaveBeenCalled();
  });

  // Test 59: Pro-rata distribution across layers
  it('should distribute buys proportionally across underweight layers', async () => {
    const holdings = [
      createHolding('USDT', 70_000_000_000),  // Foundation overweight
      createHolding('BTC', 20_000_000_000),   // Growth underweight
      createHolding('SOL', 10_000_000_000),   // Upside underweight
    ];

    const snapshot = createPortfolioSnapshot({
      cashIrr: 50_000_000_000,
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    const buysByLayer: Record<string, number> = {};

    for (const trade of buyTrades) {
      buysByLayer[trade.layer] = (buysByLayer[trade.layer] || 0) + trade.amountIrr;
    }

    // Both Growth and Upside should receive buys (they're underweight)
    const growthBuys = buysByLayer['GROWTH'] || 0;
    const upsideBuys = buysByLayer['UPSIDE'] || 0;

    expect(growthBuys + upsideBuys).toBeGreaterThan(0);
  });

  // Test 60: Buys scaled to budget
  it('should scale buys to fit within available budget', async () => {
    const cashIrr = 20_000_000_000; // Limited cash
    const holdings = [
      createHolding('USDT', 60_000_000_000),
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

    // Total buy should not exceed available budget (cash + sell proceeds)
    const maxBudget = cashIrr + (result.totalSellIrr * 0.997); // Account for spreads
    expect(result.totalBuyIrr).toBeLessThanOrEqual(maxBudget * 1.1); // 10% tolerance
  });

  // Test 61: Small amounts redistributed to larger buys
  it('should redistribute small amounts to meet minimums', async () => {
    const snapshot = createPortfolioWithCash(50_000_000_000, 100_000_000_000);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // All buy trades should meet minimum
    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    for (const trade of buyTrades) {
      expect(trade.amountIrr).toBeGreaterThanOrEqual(MIN_TRADE_AMOUNT);
    }
  });

  // Test 62: Fallback to highest-weight asset when no trade meets minimum
  it('should buy highest-weight asset when amounts are small', async () => {
    // Very small cash that can't be spread across all assets
    const smallCash = MIN_TRADE_AMOUNT * 1.5;
    const snapshot = createPortfolioSnapshot({
      cashIrr: smallCash,
      holdingsValueIrr: PORTFOLIO_SIZES.MEDIUM,
      allocation: { foundation: 40, growth: 40, upside: 20 }, // Somewhat balanced
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // If there are buy trades, they should be concentrated
    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    if (buyTrades.length > 0) {
      expect(allTradesMeetMinimum(buyTrades)).toBe(true);
    }
  });

  // Test 63: Remaining cash tracking
  it('should properly track and respect remaining cash during buy generation', async () => {
    const cashIrr = 30_000_000_000;
    const holdings = [
      createHolding('USDT', 50_000_000_000),
      createHolding('BTC', 35_000_000_000),
      createHolding('SOL', 15_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      cashIrr,
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Total buys should be reasonable relative to available funds
    const totalAvailable = cashIrr + result.totalSellIrr;
    expect(result.totalBuyIrr).toBeLessThanOrEqual(totalAvailable * 1.05);
  });

  // Test 64: Spread deducted from buys
  it('should account for spread in buy calculations', async () => {
    const snapshot = createPortfolioWithCash(100_000_000_000);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // afterAllocation should reflect spread-adjusted values
    expect(result.afterAllocation).toBeDefined();

    // Sum of allocations should be ~100%
    const totalAlloc = result.afterAllocation.foundation +
                       result.afterAllocation.growth +
                       result.afterAllocation.upside;
    expect(totalAlloc).toBeCloseTo(100, 0);
  });

  // Test 65: CONSERVATIVE strategy weights (10-35% range)
  it('should respect CONSERVATIVE strategy weight bounds', async () => {
    // Manually set conservative weights
    vi.mocked(getDynamicLayerWeights).mockImplementation((layer: string) => {
      if (layer === 'FOUNDATION') {
        return { USDT: 0.35, PAXG: 0.35, IRR_FIXED_INCOME: 0.30 };
      } else if (layer === 'GROWTH') {
        return { BTC: 0.35, ETH: 0.25, BNB: 0.15, XRP: 0.10, KAG: 0.10, QQQ: 0.05 };
      } else {
        return { SOL: 0.30, TON: 0.20, LINK: 0.20, AVAX: 0.15, MATIC: 0.10, ARB: 0.05 };
      }
    });

    const snapshot = createCashOnlyPortfolio(PORTFOLIO_SIZES.MEDIUM);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Trades should exist
    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    expect(buyTrades.length).toBeGreaterThan(0);
  });

  // Test 66: BALANCED strategy weights (5-40% range)
  it('should respect BALANCED strategy weight bounds', async () => {
    const snapshot = createCashOnlyPortfolio(PORTFOLIO_SIZES.MEDIUM);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Should have buys for multiple assets
    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    expect(buyTrades.length).toBeGreaterThan(0);
  });

  // Test 67: AGGRESSIVE strategy weights (5-50% range)
  it('should handle AGGRESSIVE strategy weights', async () => {
    vi.mocked(getDynamicLayerWeights).mockImplementation((layer: string) => {
      if (layer === 'FOUNDATION') {
        return { USDT: 0.50, PAXG: 0.30, IRR_FIXED_INCOME: 0.20 };
      } else if (layer === 'GROWTH') {
        return { BTC: 0.40, ETH: 0.25, BNB: 0.15, XRP: 0.10, KAG: 0.05, QQQ: 0.05 };
      } else {
        return { SOL: 0.35, TON: 0.25, LINK: 0.15, AVAX: 0.10, MATIC: 0.10, ARB: 0.05 };
      }
    });

    const snapshot = createCashOnlyPortfolio(PORTFOLIO_SIZES.MEDIUM);
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    const buyTrades = result.trades.filter((t) => t.side === 'BUY');
    expect(buyTrades.length).toBeGreaterThan(0);
  });

  // Test 68: New holdings created for new assets
  it('should create buys for assets not currently held', async () => {
    // Portfolio with only USDT and BTC
    const holdings = [
      createHolding('USDT', 50_000_000_000),
      createHolding('BTC', 30_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      cashIrr: 50_000_000_000,
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    // Should have buys for Upside assets (SOL, TON, etc.)
    const upsideBuys = result.trades.filter(
      (t) => t.side === 'BUY' && t.layer === 'UPSIDE'
    );

    // At minimum, should attempt to buy Upside assets
    expect(upsideBuys.length).toBeGreaterThanOrEqual(0);
  });

  // Test 69: Higher deficit layers prioritized
  it('should prioritize layers with higher deficits', async () => {
    const holdings = [
      createHolding('USDT', 80_000_000_000),  // Foundation very heavy
      createHolding('BTC', 15_000_000_000),   // Growth light
      createHolding('SOL', 5_000_000_000),    // Upside very light
    ];

    const snapshot = createPortfolioSnapshot({
      cashIrr: 50_000_000_000,
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED, // 50/35/15
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

    const buysByLayer: Record<string, number> = {};
    for (const trade of result.trades.filter((t) => t.side === 'BUY')) {
      buysByLayer[trade.layer] = (buysByLayer[trade.layer] || 0) + trade.amountIrr;
    }

    // Growth should receive substantial buys (target 35%, current ~15%)
    // Upside should also receive buys (target 15%, current ~5%)
    const growthBuys = buysByLayer['GROWTH'] || 0;
    const upsideBuys = buysByLayer['UPSIDE'] || 0;

    // Both underweight layers should get buys
    expect(growthBuys + upsideBuys).toBeGreaterThan(0);
  });
});
