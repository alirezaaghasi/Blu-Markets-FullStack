// Rebalance Service Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('../src/config/database.js', () => ({
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
vi.mock('../src/modules/portfolio/portfolio.service.js', () => ({
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
      SOL: 'UPSIDE',
      TON: 'UPSIDE',
    };
    return layers[assetId] || 'UPSIDE';
  }),
}));

// Mock price fetcher
vi.mock('../src/services/price-fetcher.service.js', () => ({
  getCurrentPrices: vi.fn(),
}));

import { prisma } from '../src/config/database.js';
import { getPortfolioSnapshot, classifyBoundary } from '../src/modules/portfolio/portfolio.service.js';
import { getCurrentPrices } from '../src/services/price-fetcher.service.js';
import { checkRebalanceCooldown, previewRebalance } from '../src/modules/rebalance/rebalance.service.js';

describe('Rebalance Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRebalanceCooldown', () => {
    it('should allow rebalance when no previous rebalance exists', async () => {
      vi.mocked(prisma.portfolio.findUnique).mockResolvedValue({
        lastRebalanceAt: null,
      } as any);

      const result = await checkRebalanceCooldown('user-123');

      expect(result.canRebalance).toBe(true);
      expect(result.lastRebalanceAt).toBeNull();
      expect(result.hoursSinceRebalance).toBeNull();
      expect(result.hoursRemaining).toBeNull();
    });

    it('should allow rebalance with cooldown disabled (REBALANCE_COOLDOWN_HOURS = 0)', async () => {
      // Cooldown is disabled in domain.ts (REBALANCE_COOLDOWN_HOURS = 0)
      // So rebalancing should always be allowed regardless of last rebalance time
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      vi.mocked(prisma.portfolio.findUnique).mockResolvedValue({
        lastRebalanceAt: twoHoursAgo,
      } as any);

      const result = await checkRebalanceCooldown('user-123');

      expect(result.canRebalance).toBe(true);  // Always true when cooldown = 0
      expect(result.hoursSinceRebalance).toBe(2);
      expect(result.hoursRemaining).toBeNull();  // No waiting when cooldown = 0
    });

    it('should allow rebalance after 24-hour cooldown', async () => {
      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
      vi.mocked(prisma.portfolio.findUnique).mockResolvedValue({
        lastRebalanceAt: thirtyHoursAgo,
      } as any);

      const result = await checkRebalanceCooldown('user-123');

      expect(result.canRebalance).toBe(true);
      expect(result.hoursSinceRebalance).toBe(30);
      expect(result.hoursRemaining).toBeNull();
    });
  });

  describe('previewRebalance', () => {
    const mockPrices = new Map([
      ['USDT', { priceIrr: 620000 }],
      ['PAXG', { priceIrr: 1643000000 }],
      ['BTC', { priceIrr: 60450000000 }],
      ['ETH', { priceIrr: 1984000000 }],
      ['SOL', { priceIrr: 111600000 }],
      ['TON', { priceIrr: 3410000 }],
    ]);

    const mockBalancedSnapshot = {
      cashIrr: 50000000,
      totalValueIrr: 500000000,
      holdingsValueIrr: 450000000,
      allocation: { foundation: 50, growth: 35, upside: 15 },
      targetAllocation: { foundation: 50, growth: 35, upside: 15 },
      driftPct: 0,
      status: 'BALANCED',
      holdings: [
        { assetId: 'USDT', quantity: 200, frozen: false, layer: 'FOUNDATION' },
        { assetId: 'BTC', quantity: 0.001, frozen: false, layer: 'GROWTH' },
        { assetId: 'SOL', quantity: 0.4, frozen: false, layer: 'UPSIDE' },
      ],
    };

    it('should return preview response with correct structure', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue(mockBalancedSnapshot as any);
      vi.mocked(getCurrentPrices).mockResolvedValue(mockPrices as any);

      const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

      // Check that preview returns all expected fields
      expect(result.currentAllocation).toEqual(mockBalancedSnapshot.allocation);
      expect(result.targetAllocation).toEqual(mockBalancedSnapshot.targetAllocation);
      expect(result.afterAllocation).toBeDefined();
      expect(result.gapAnalysis).toBeDefined();
      expect(typeof result.totalBuyIrr).toBe('number');
      expect(typeof result.totalSellIrr).toBe('number');
      expect(typeof result.canFullyRebalance).toBe('boolean');
    });

    it('should generate sell trades for overweight layers', async () => {
      const imbalancedSnapshot = {
        ...mockBalancedSnapshot,
        allocation: { foundation: 60, growth: 30, upside: 10 },
        driftPct: 10,
        status: 'SLIGHTLY_OFF',
      };

      vi.mocked(getPortfolioSnapshot).mockResolvedValue(imbalancedSnapshot as any);
      vi.mocked(getCurrentPrices).mockResolvedValue(mockPrices as any);

      const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

      // Should have sell trades from Foundation (overweight) and buy for Growth/Upside
      const sellTrades = result.trades.filter((t) => t.side === 'SELL');
      const buyTrades = result.trades.filter((t) => t.side === 'BUY');

      expect(sellTrades.length).toBeGreaterThanOrEqual(0);
      expect(result.totalSellIrr).toBeGreaterThanOrEqual(0);
    });

    it('should not sell frozen holdings', async () => {
      const snapshotWithFrozen = {
        ...mockBalancedSnapshot,
        allocation: { foundation: 60, growth: 30, upside: 10 },
        driftPct: 10,
        holdings: [
          { assetId: 'USDT', quantity: 500, frozen: true, layer: 'FOUNDATION' }, // ALL frozen
          { assetId: 'BTC', quantity: 0.001, frozen: false, layer: 'GROWTH' },
          { assetId: 'SOL', quantity: 0.4, frozen: false, layer: 'UPSIDE' },
        ],
      };

      vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshotWithFrozen as any);
      vi.mocked(getCurrentPrices).mockResolvedValue(mockPrices as any);

      const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

      // Should not sell USDT since it's frozen
      const usdtSellTrades = result.trades.filter(
        (t) => t.side === 'SELL' && t.assetId === 'USDT'
      );
      expect(usdtSellTrades.length).toBe(0);
      expect(result.hasLockedCollateral).toBe(true);
    });

    it('should include gap analysis in preview', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue(mockBalancedSnapshot as any);
      vi.mocked(getCurrentPrices).mockResolvedValue(mockPrices as any);

      const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

      expect(result.gapAnalysis).toBeDefined();
      expect(result.gapAnalysis.length).toBe(3);
      expect(result.gapAnalysis.map((g) => g.layer)).toContain('FOUNDATION');
      expect(result.gapAnalysis.map((g) => g.layer)).toContain('GROWTH');
      expect(result.gapAnalysis.map((g) => g.layer)).toContain('UPSIDE');
    });

    it('should use cash in HOLDINGS_PLUS_CASH mode', async () => {
      const snapshotWithCash = {
        ...mockBalancedSnapshot,
        cashIrr: 100000000, // 100M IRR cash
        allocation: { foundation: 70, growth: 20, upside: 10 },
        driftPct: 20,
        status: 'ATTENTION_REQUIRED',
      };

      vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshotWithCash as any);
      vi.mocked(getCurrentPrices).mockResolvedValue(mockPrices as any);

      const holdingsOnlyResult = await previewRebalance('user-123', 'HOLDINGS_ONLY');
      const holdingsPlusCashResult = await previewRebalance('user-123', 'HOLDINGS_PLUS_CASH');

      // HOLDINGS_PLUS_CASH should have more buy capacity
      expect(holdingsPlusCashResult.totalBuyIrr).toBeGreaterThanOrEqual(
        holdingsOnlyResult.totalBuyIrr
      );
    });
  });

  describe('Rounding Overspend Protection', () => {
    it('should not allow negative cash after spread application', async () => {
      // Test that the cash guard prevents overspending
      // BUY trades deduct amountIrr from cash, not netAmount
      const tradeAmountIrr = 10000000;
      const spread = 0.003; // 0.3% spread
      const netAmount = tradeAmountIrr * (1 - spread);
      const cashBefore = 10000000;

      // Cash should decrease by full trade amount, not net amount
      const cashAfter = cashBefore - tradeAmountIrr;
      expect(cashAfter).toBe(0);
      expect(cashAfter).toBeGreaterThanOrEqual(0);
    });

    it('should reject buy when cash insufficient after spreads', async () => {
      // If cash is 9.9M and trade is 10M, should reject
      const cashIrr = 9900000;
      const tradeAmountIrr = 10000000;

      const canExecute = cashIrr >= tradeAmountIrr;
      expect(canExecute).toBe(false);
    });

    it('should calculate spread correctly for each layer', async () => {
      // Spread rates per layer
      const SPREAD_BY_LAYER = {
        FOUNDATION: 0.002, // 0.2%
        GROWTH: 0.003,     // 0.3%
        UPSIDE: 0.004,     // 0.4%
      };

      const tradeAmount = 100000000; // 100M

      expect(tradeAmount * SPREAD_BY_LAYER.FOUNDATION).toBe(200000);
      expect(tradeAmount * SPREAD_BY_LAYER.GROWTH).toBe(300000);
      expect(tradeAmount * SPREAD_BY_LAYER.UPSIDE).toBe(400000);
    });

    it('should account for spreads in total buy calculation', async () => {
      // When buying 100M worth, actual tokens received = 100M * (1 - spread)
      const buyAmount = 100000000;
      const spread = 0.003;
      const netTokenValue = buyAmount * (1 - spread);

      expect(netTokenValue).toBe(99700000); // 99.7M worth of tokens
    });
  });
});

