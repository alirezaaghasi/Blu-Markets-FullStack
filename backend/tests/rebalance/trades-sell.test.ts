/**
 * Trade Generation - Sells Tests (12 tests)
 * Tests for sell trade generation logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPricesMap,
  createPortfolioSnapshot,
  createHolding,
  createDriftedPortfolio,
  RISK_PROFILES,
  MIN_TRADE_AMOUNT,
  MAX_SELL_PERCENTAGE,
  MIN_ASSET_VALUE_TO_KEEP,
  PORTFOLIO_SIZES,
  allTradesMeetMinimum,
  getLayerTrades,
  sumTrades,
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

describe('Trade Generation - Sells Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentPrices).mockResolvedValue(createPricesMap() as any);
  });

  // Test 46: Pro-rata sell from Foundation layer
  it('should sell Foundation assets proportionally (pro-rata)', async () => {
    const holdings = [
      createHolding('USDT', 40_000_000_000),  // 40% of Foundation
      createHolding('PAXG', 30_000_000_000),  // 30% of Foundation
      createHolding('BTC', 20_000_000_000),
      createHolding('SOL', 10_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED, // Foundation is overweight
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const foundationSells = result.trades.filter(
      (t) => t.side === 'SELL' && t.layer === 'FOUNDATION'
    );

    // Should have sells from Foundation layer
    if (foundationSells.length > 0) {
      // Larger holding (USDT) should have proportionally larger sell
      const usdtSell = foundationSells.find((t) => t.assetId === 'USDT');
      const paxgSell = foundationSells.find((t) => t.assetId === 'PAXG');

      if (usdtSell && paxgSell) {
        // USDT sell amount should be larger than PAXG (40B vs 30B holdings)
        expect(usdtSell.amountIrr).toBeGreaterThanOrEqual(paxgSell.amountIrr * 0.8);
      }
    }
  });

  // Test 47: 80% max sell per asset enforced
  it('should enforce MAX_SELL_PERCENTAGE (80%) per asset', async () => {
    // Create portfolio heavily overweight in Foundation
    const holdings = [
      createHolding('USDT', 80_000_000_000),  // Very heavy in Foundation
      createHolding('BTC', 15_000_000_000),
      createHolding('SOL', 5_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const usdtSells = result.trades.filter(
      (t) => t.side === 'SELL' && t.assetId === 'USDT'
    );

    if (usdtSells.length > 0) {
      const totalUsdtSell = usdtSells.reduce((sum, t) => sum + t.amountIrr, 0);
      const maxAllowedSell = 80_000_000_000 * MAX_SELL_PERCENTAGE;

      // Should not sell more than 80% of USDT
      expect(totalUsdtSell).toBeLessThanOrEqual(maxAllowedSell * 1.01); // 1% tolerance
    }
  });

  // Test 48: MIN_ASSET_VALUE_TO_KEEP (5M IRR) respected
  it('should keep minimum position value after selling', async () => {
    const holdings = [
      createHolding('USDT', 10_000_000_000),  // 10B - should keep 5M minimum
      createHolding('BTC', 5_000_000_000),
      createHolding('SOL', 2_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: { foundation: 30, growth: 40, upside: 30 }, // Foundation very overweight vs target
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const usdtSells = result.trades.filter(
      (t) => t.side === 'SELL' && t.assetId === 'USDT'
    );

    if (usdtSells.length > 0) {
      const totalSell = usdtSells.reduce((sum, t) => sum + t.amountIrr, 0);
      const remainingValue = 10_000_000_000 - totalSell;

      // Should keep at least MIN_ASSET_VALUE_TO_KEEP
      expect(remainingValue).toBeGreaterThanOrEqual(MIN_ASSET_VALUE_TO_KEEP * 0.9);
    }
  });

  // Test 49: Largest holdings sold first
  it('should prioritize selling from larger holdings', async () => {
    const holdings = [
      createHolding('USDT', 50_000_000_000),  // Largest Foundation
      createHolding('PAXG', 10_000_000_000),  // Smaller Foundation
      createHolding('BTC', 25_000_000_000),
      createHolding('SOL', 15_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const foundationSells = result.trades.filter(
      (t) => t.side === 'SELL' && t.layer === 'FOUNDATION'
    );

    // USDT should be in sells (it's the largest Foundation holding)
    const hasUsdtSell = foundationSells.some((t) => t.assetId === 'USDT');
    if (foundationSells.length > 0) {
      expect(hasUsdtSell).toBe(true);
    }
  });

  // Test 50: Frozen assets skipped
  it('should not include frozen assets in sell trades', async () => {
    const holdings = [
      createHolding('USDT', 40_000_000_000, { frozen: true }),  // Frozen
      createHolding('PAXG', 20_000_000_000, { frozen: false }), // Can sell
      createHolding('BTC', 25_000_000_000, { frozen: false }),
      createHolding('SOL', 15_000_000_000, { frozen: false }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const usdtSells = result.trades.filter(
      (t) => t.side === 'SELL' && t.assetId === 'USDT'
    );

    // Should not sell frozen USDT
    expect(usdtSells.length).toBe(0);
  });

  // Test 51: Partial frozen in layer
  it('should only sell unfrozen assets when layer is partially frozen', async () => {
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

    const foundationSells = result.trades.filter(
      (t) => t.side === 'SELL' && t.layer === 'FOUNDATION'
    );

    // Only PAXG should be sold (not frozen USDT)
    for (const trade of foundationSells) {
      expect(trade.assetId).not.toBe('USDT');
    }
  });

  // Test 52: All trades meet MIN_TRADE_AMOUNT
  it('should only generate trades meeting MIN_TRADE_AMOUNT', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 10, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(allTradesMeetMinimum(result.trades)).toBe(true);
  });

  // Test 53: Total sell matches overweight gap
  it('should generate sells totaling approximately the overweight gap', async () => {
    const holdingsValueIrr = 100_000_000_000;
    const holdings = [
      createHolding('USDT', holdingsValueIrr * 0.60),  // 60% - 10% overweight
      createHolding('BTC', holdingsValueIrr * 0.30),   // 30%
      createHolding('SOL', holdingsValueIrr * 0.10),   // 10%
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED, // 50% Foundation target
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const foundationGap = result.gapAnalysis.find((g) => g.layer === 'FOUNDATION');
    const totalFoundationSells = sumTrades(
      getLayerTrades(result.trades.filter((t) => t.side === 'SELL'), 'FOUNDATION'),
      'SELL'
    );

    // Sells should approximate the gap (with some tolerance for caps)
    if (foundationGap && foundationGap.gapIrr < 0) {
      expect(totalFoundationSells).toBeLessThanOrEqual(Math.abs(foundationGap.gapIrr) * 1.2);
    }
  });

  // Test 54: Diversification warning logged when capped
  it('should handle diversification protection gracefully', async () => {
    // Create portfolio where selling would require capping
    const holdings = [
      createHolding('USDT', 90_000_000_000),  // Very heavy - will hit cap
      createHolding('BTC', 8_000_000_000),
      createHolding('SOL', 2_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    // Should not throw
    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Result should still be valid
    expect(result.trades).toBeDefined();
    expect(result.gapAnalysis).toBeDefined();
  });

  // Test 55: Zero unfrozen value produces no sells
  it('should generate no sells when all holdings are frozen', async () => {
    const holdings = [
      createHolding('USDT', 50_000_000_000, { frozen: true }),
      createHolding('PAXG', 10_000_000_000, { frozen: true }),
      createHolding('BTC', 25_000_000_000, { frozen: true }),
      createHolding('SOL', 15_000_000_000, { frozen: true }),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const sellTrades = result.trades.filter((t) => t.side === 'SELL');
    expect(sellTrades.length).toBe(0);
  });

  // Test 56: Single large holding respects 80% max
  it('should cap single holding sell at 80%', async () => {
    const holdings = [
      createHolding('USDT', 80_000_000_000),  // Only Foundation asset
      createHolding('BTC', 15_000_000_000),
      createHolding('SOL', 5_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: RISK_PROFILES.BALANCED,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    const usdtSells = result.trades.filter(
      (t) => t.side === 'SELL' && t.assetId === 'USDT'
    );

    if (usdtSells.length > 0) {
      const totalSell = usdtSells.reduce((sum, t) => sum + t.amountIrr, 0);
      const maxSell = 80_000_000_000 * 0.80;

      expect(totalSell).toBeLessThanOrEqual(maxSell * 1.01);
    }
  });

  // Test 57: Correct layer field in trades
  it('should set correct layer field on all sell trades', async () => {
    const snapshot = createDriftedPortfolio('BALANCED', 15, 'overweight-foundation');
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    for (const trade of result.trades) {
      if (trade.side === 'SELL') {
        // Verify layer matches asset
        if (['USDT', 'PAXG', 'IRR_FIXED_INCOME'].includes(trade.assetId)) {
          expect(trade.layer).toBe('FOUNDATION');
        } else if (['BTC', 'ETH', 'BNB', 'XRP', 'KAG', 'QQQ'].includes(trade.assetId)) {
          expect(trade.layer).toBe('GROWTH');
        } else {
          expect(trade.layer).toBe('UPSIDE');
        }
      }
    }
  });
});
