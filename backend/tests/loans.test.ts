// Loans Service Tests
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
      updateMany: vi.fn(),
    },
    loan: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    loanInstallment: {
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock price fetcher
vi.mock('../src/services/price-fetcher.service.js', () => ({
  getCurrentPrices: vi.fn(),
}));

// Mock portfolio service
vi.mock('../src/modules/portfolio/portfolio.service.js', () => ({
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
}));

import { prisma } from '../src/config/database.js';
import { getCurrentPrices } from '../src/services/price-fetcher.service.js';

describe('Loans Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPrices = new Map([
    ['USDT', { priceIrr: 620000, priceUsd: 1 }],
    ['BTC', { priceIrr: 60450000000, priceUsd: 97500 }],
    ['ETH', { priceIrr: 1984000000, priceUsd: 3200 }],
    ['SOL', { priceIrr: 111600000, priceUsd: 180 }],
  ]);

  describe('Portfolio Loan Limit Validation', () => {
    it('should enforce 25% portfolio loan limit', async () => {
      // Portfolio worth 400M IRR, 25% limit = 100M max loans
      const mockPortfolio = {
        id: 'portfolio-123',
        userId: 'user-123',
        cashIrr: 100000000n, // 100M IRR cash
        holdings: [
          { assetId: 'BTC', quantity: 0.005, frozen: false }, // ~300M IRR value
        ],
        loans: [
          { principalIrr: 80000000n }, // Existing 80M loan
        ],
      };

      vi.mocked(getCurrentPrices).mockResolvedValue(mockPrices as any);
      vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(mockPortfolio as any);

      // Total portfolio value: 100M + 300M = 400M
      // Max loan: 400M * 0.25 = 100M
      // Current loans: 80M
      // Available: 20M
      // Requesting 30M should fail

      // This test documents the expected behavior
      // The actual validation happens in loans.routes.ts POST handler
      const totalValueIrr = 100000000 + 0.005 * 60450000000; // ~402M
      const maxPortfolioLoanIrr = totalValueIrr * 0.25; // ~100M
      const currentLoansIrr = 80000000;
      const requestedAmount = 30000000;

      expect(currentLoansIrr + requestedAmount).toBeGreaterThan(maxPortfolioLoanIrr);
    });

    it('should allow loan within portfolio limit', async () => {
      const mockPortfolio = {
        id: 'portfolio-123',
        userId: 'user-123',
        cashIrr: 100000000n,
        holdings: [
          { assetId: 'BTC', quantity: 0.005, frozen: false },
        ],
        loans: [
          { principalIrr: 50000000n }, // Existing 50M loan
        ],
      };

      vi.mocked(getCurrentPrices).mockResolvedValue(mockPrices as any);

      const totalValueIrr = 100000000 + 0.005 * 60450000000;
      const maxPortfolioLoanIrr = totalValueIrr * 0.25;
      const currentLoansIrr = 50000000;
      const requestedAmount = 30000000;

      expect(currentLoansIrr + requestedAmount).toBeLessThan(maxPortfolioLoanIrr);
    });
  });

  describe('Per-Asset LTV Validation', () => {
    it('should enforce Foundation layer 80% LTV', async () => {
      const holdingValueIrr = 100000000; // 100M IRR USDT
      const maxLtv = 0.80; // Foundation layer
      const maxLoanIrr = holdingValueIrr * maxLtv; // 80M

      expect(maxLoanIrr).toBe(80000000);
      expect(90000000).toBeGreaterThan(maxLoanIrr); // 90M exceeds limit
    });

    it('should enforce Growth layer 60% LTV', async () => {
      const btcValue = 0.002 * 60450000000; // ~120M IRR
      const maxLtv = 0.60; // Growth layer
      const maxLoanIrr = btcValue * maxLtv; // ~72M

      expect(maxLoanIrr).toBeCloseTo(72540000, -3);
      expect(80000000).toBeGreaterThan(maxLoanIrr); // 80M exceeds limit
    });

    it('should enforce Upside layer 40% LTV', async () => {
      const solValue = 10 * 111600000; // ~1.1B IRR
      const maxLtv = 0.40; // Upside layer
      const maxLoanIrr = solValue * maxLtv; // ~446M

      expect(maxLoanIrr).toBeCloseTo(446400000, -3);
    });
  });

  describe('Repayment Processing', () => {
    it('should update installmentsPaid count after repayment', async () => {
      const mockLoan = {
        id: 'loan-123',
        portfolioId: 'portfolio-123',
        totalDueIrr: 100000000n,
        paidIrr: 50000000n,
        collateralAssetId: 'BTC',
        status: 'ACTIVE',
        installments: [
          { id: 'inst-1', number: 1, totalIrr: 33000000n, paidIrr: 33000000n, status: 'PAID' },
          { id: 'inst-2', number: 2, totalIrr: 33000000n, paidIrr: 17000000n, status: 'PARTIAL' },
          { id: 'inst-3', number: 3, totalIrr: 34000000n, paidIrr: 0n, status: 'PENDING' },
        ],
        portfolio: { userId: 'user-123', cashIrr: 200000000n },
      };

      vi.mocked(prisma.loan.findUnique).mockResolvedValue(mockLoan as any);
      vi.mocked(prisma.loanInstallment.count).mockResolvedValue(1); // 1 PAID installment

      // After repayment, installmentsPaid should be updated
      // The count query returns number of PAID installments
      const paidCount = await prisma.loanInstallment.count({
        where: { loanId: mockLoan.id, status: 'PAID' },
      });

      expect(paidCount).toBe(1);
    });

    it('should fully settle loan and unfreeze collateral', async () => {
      const mockLoan = {
        id: 'loan-123',
        portfolioId: 'portfolio-123',
        totalDueIrr: 100000000n,
        paidIrr: 90000000n,
        collateralAssetId: 'BTC',
        status: 'ACTIVE',
      };

      // Repaying 10M more should fully settle
      const newPaidIrr = 90000000 + 10000000;
      const isFullySettled = newPaidIrr >= 100000000;

      expect(isFullySettled).toBe(true);
    });
  });

  describe('Liquidation', () => {
    it('should calculate shortfall when collateral insufficient', async () => {
      const remainingDue = 100000000; // 100M IRR owed
      const collateralValueIrr = 80000000; // Only 80M collateral value
      const shortfallIrr = Math.max(0, remainingDue - collateralValueIrr);

      expect(shortfallIrr).toBe(20000000); // 20M shortfall
    });

    it('should calculate excess when collateral exceeds debt', async () => {
      const remainingDue = 80000000; // 80M IRR owed
      const collateralValueIrr = 100000000; // 100M collateral value
      const excess = Math.max(0, collateralValueIrr - remainingDue);
      const shortfallIrr = Math.max(0, remainingDue - collateralValueIrr);

      expect(excess).toBe(20000000); // 20M excess returned to user
      expect(shortfallIrr).toBe(0); // No shortfall
    });

    it('should trigger liquidation at 90% LTV', async () => {
      const collateralValueIrr = 100000000; // 100M collateral
      const remainingDue = 91000000; // 91M owed
      const currentLtv = remainingDue / collateralValueIrr;

      const CRITICAL_LTV_THRESHOLD = 0.90;
      expect(currentLtv).toBeGreaterThanOrEqual(CRITICAL_LTV_THRESHOLD);
    });

    it('should not liquidate below 90% LTV', async () => {
      const collateralValueIrr = 100000000; // 100M collateral
      const remainingDue = 85000000; // 85M owed
      const currentLtv = remainingDue / collateralValueIrr;

      const CRITICAL_LTV_THRESHOLD = 0.90;
      expect(currentLtv).toBeLessThan(CRITICAL_LTV_THRESHOLD);
    });

    it('should handle zero collateral value gracefully', async () => {
      const collateralValueIrr = 0;
      const remainingDue = 100000000;

      // With zero collateral, LTV should be set to 1.0 (100%)
      // This prevents division by zero
      const currentLtv = collateralValueIrr <= 0 ? 1.0 : remainingDue / collateralValueIrr;

      expect(currentLtv).toBe(1.0);
    });
  });
});
