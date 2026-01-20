// Trade Service Tests
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
  getAssetLayer: vi.fn((assetId: string) => {
    const layers: Record<string, string> = {
      USDT: 'FOUNDATION',
      PAXG: 'FOUNDATION',
      BTC: 'GROWTH',
      ETH: 'GROWTH',
      SOL: 'UPSIDE',
    };
    return layers[assetId] || 'UPSIDE';
  }),
  classifyBoundary: vi.fn(() => 'SAFE'),
}));

// Mock price fetcher
vi.mock('../src/services/price-fetcher.service.js', () => ({
  getAssetPrice: vi.fn(),
  getCurrentFxRate: vi.fn(),
}));

import { getPortfolioSnapshot, classifyBoundary } from '../src/modules/portfolio/portfolio.service.js';
import { getAssetPrice } from '../src/services/price-fetcher.service.js';
import { previewTrade, executeTrade } from '../src/modules/trade/trade.service.js';
import { prisma } from '../src/config/database.js';

describe('Trade Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSnapshot = {
    cashIrr: 100000000, // 100M IRR
    totalValueIrr: 500000000,
    holdingsValueIrr: 400000000,
    allocation: { foundation: 50, growth: 35, upside: 15 },
    targetAllocation: { foundation: 50, growth: 35, upside: 15 },
    driftPct: 0,
    status: 'BALANCED',
    holdings: [
      { assetId: 'BTC', quantity: 0.002, frozen: false, layer: 'GROWTH', valueIrr: 120000000 },
      { assetId: 'USDT', quantity: 200, frozen: false, layer: 'FOUNDATION', valueIrr: 124000000 },
    ],
  };

  const mockBtcPrice = { priceIrr: 60450000000, priceUsd: 97500 };

  describe('previewTrade', () => {
    it('should reject trades below minimum amount', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue(mockSnapshot as any);

      const result = await previewTrade('user-123', 'BUY', 'BTC', 500000);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Minimum trade amount');
    });

    it('should reject BUY when insufficient cash', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue({
        ...mockSnapshot,
        cashIrr: 5000000, // Only 5M IRR
      } as any);
      vi.mocked(getAssetPrice).mockResolvedValue(mockBtcPrice as any);

      const result = await previewTrade('user-123', 'BUY', 'BTC', 10000000);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient cash');
    });

    it('should reject SELL when insufficient holdings', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue({
        ...mockSnapshot,
        holdings: [
          { assetId: 'BTC', quantity: 0.0001, frozen: false, layer: 'GROWTH', valueIrr: 6000000 },
        ],
      } as any);
      vi.mocked(getAssetPrice).mockResolvedValue(mockBtcPrice as any);

      const result = await previewTrade('user-123', 'SELL', 'BTC', 50000000);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient holdings');
    });

    it('should reject SELL of frozen holdings', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue({
        ...mockSnapshot,
        holdings: [
          { assetId: 'BTC', quantity: 0.01, frozen: true, layer: 'GROWTH', valueIrr: 604500000 },
        ],
      } as any);
      vi.mocked(getAssetPrice).mockResolvedValue(mockBtcPrice as any);

      const result = await previewTrade('user-123', 'SELL', 'BTC', 50000000);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('frozen as loan collateral');
    });

    it('should return valid preview for valid BUY trade', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue(mockSnapshot as any);
      vi.mocked(getAssetPrice).mockResolvedValue(mockBtcPrice as any);
      vi.mocked(classifyBoundary).mockReturnValue('SAFE');

      const result = await previewTrade('user-123', 'BUY', 'BTC', 10000000);

      expect(result.valid).toBe(true);
      expect(result.preview.action).toBe('BUY');
      expect(result.preview.assetId).toBe('BTC');
      expect(result.preview.amountIrr).toBe(10000000);
      expect(result.preview.spread).toBe(0.003);
      expect(result.preview.spreadAmountIrr).toBe(30000);
      expect(result.allocation.before).toEqual(mockSnapshot.allocation);
      expect(result.allocation.target).toEqual(mockSnapshot.targetAllocation);
    });

    it('should return valid preview for valid SELL trade', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue({
        ...mockSnapshot,
        holdings: [
          { assetId: 'BTC', quantity: 0.01, frozen: false, layer: 'GROWTH', valueIrr: 604500000 },
        ],
      } as any);
      vi.mocked(getAssetPrice).mockResolvedValue(mockBtcPrice as any);
      vi.mocked(classifyBoundary).mockReturnValue('SAFE');

      const result = await previewTrade('user-123', 'SELL', 'BTC', 50000000);

      expect(result.valid).toBe(true);
      expect(result.preview.action).toBe('SELL');
      expect(result.preview.quantity).toBeGreaterThan(0);
    });

    it('should reject trade when price is unavailable', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue(mockSnapshot as any);
      vi.mocked(getAssetPrice).mockResolvedValue(null);

      const result = await previewTrade('user-123', 'BUY', 'BTC', 10000000);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Price not available');
    });

    it('should calculate allocation impact correctly', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue(mockSnapshot as any);
      vi.mocked(getAssetPrice).mockResolvedValue(mockBtcPrice as any);
      vi.mocked(classifyBoundary).mockReturnValue('DRIFT');

      const result = await previewTrade('user-123', 'BUY', 'BTC', 50000000);

      expect(result.valid).toBe(true);
      expect(result.allocation.after).toBeDefined();
      // BTC is GROWTH layer, so growth allocation should increase
      expect(result.allocation.after.growth).toBeGreaterThanOrEqual(result.allocation.before.growth);
    });

    it('should include friction copy for risky trades', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue(mockSnapshot as any);
      vi.mocked(getAssetPrice).mockResolvedValue(mockBtcPrice as any);
      vi.mocked(classifyBoundary).mockReturnValue('STRUCTURAL');

      const result = await previewTrade('user-123', 'BUY', 'BTC', 10000000);

      expect(result.valid).toBe(true);
      expect(result.boundary).toBe('STRUCTURAL');
      expect(result.frictionCopy).toBeDefined();
      expect(result.frictionCopy).toContain('significantly');
    });
  });

  describe('executeTrade', () => {
    it('should throw error for invalid trade', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue(mockSnapshot as any);

      await expect(executeTrade('user-123', 'BUY', 'BTC', 500000)).rejects.toThrow(
        'Minimum trade amount'
      );
    });

    it('should require acknowledgment for STRUCTURAL trades', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue(mockSnapshot as any);
      vi.mocked(getAssetPrice).mockResolvedValue(mockBtcPrice as any);
      vi.mocked(classifyBoundary).mockReturnValue('STRUCTURAL');

      await expect(
        executeTrade('user-123', 'BUY', 'BTC', 10000000, false)
      ).rejects.toThrow('acknowledge the warning');
    });

    it('should execute BUY trade successfully with acknowledgment', async () => {
      vi.mocked(getPortfolioSnapshot).mockResolvedValue(mockSnapshot as any);
      vi.mocked(getAssetPrice).mockResolvedValue(mockBtcPrice as any);
      vi.mocked(classifyBoundary).mockReturnValue('SAFE');

      const mockPortfolio = {
        id: 'portfolio-123',
        cashIrr: 100000000n,
        holdings: [
          { id: 'holding-1', assetId: 'BTC', quantity: 0.002 },
        ],
      };

      vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(mockPortfolio as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback({
          portfolio: { update: vi.fn() },
          holding: { update: vi.fn().mockResolvedValue({ quantity: 0.003 }), create: vi.fn() },
          ledgerEntry: { create: vi.fn().mockResolvedValue({ id: 'ledger-123' }) },
          actionLog: { create: vi.fn() },
        });
      });

      const result = await executeTrade('user-123', 'BUY', 'BTC', 10000000, true);

      expect(result.success).toBe(true);
      expect(result.trade.action).toBe('BUY');
      expect(result.trade.assetId).toBe('BTC');
      expect(result.ledgerEntryId).toBe('ledger-123');
    });
  });
});
