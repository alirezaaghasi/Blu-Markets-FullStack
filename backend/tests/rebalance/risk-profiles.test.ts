/**
 * Risk Profile Tests (10 tests)
 * Tests for target allocation calculations based on risk profile
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPricesMap,
  createPortfolioSnapshot,
  createHolding,
  RISK_PROFILES,
  PORTFOLIO_SIZES,
} from './helpers.js';
import { TARGET_ALLOCATIONS, RISK_PROFILE_NAMES } from '../../src/types/domain.js';

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

describe('Risk Profile Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentPrices).mockResolvedValue(createPricesMap() as any);
  });

  // Test 107: CAPITAL_PRESERVATION target allocation (80/15/5)
  it('should correctly handle CAPITAL_PRESERVATION target allocation (80/15/5)', async () => {
    const target = RISK_PROFILES.CAPITAL_PRESERVATION;

    // Create portfolio with different allocation
    const holdings = [
      createHolding('USDT', 50_000_000_000),  // 50%
      createHolding('BTC', 35_000_000_000),   // 35%
      createHolding('SOL', 15_000_000_000),   // 15%
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: target,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    // Should have target allocation of 80/15/5
    expect(result.targetAllocation.foundation).toBe(80);
    expect(result.targetAllocation.growth).toBe(15);
    expect(result.targetAllocation.upside).toBe(5);
  });

  // Test 108: CONSERVATIVE target allocation (70/25/5)
  it('should correctly handle CONSERVATIVE target allocation (70/25/5)', async () => {
    const target = RISK_PROFILES.CONSERVATIVE;

    const holdings = [
      createHolding('USDT', 50_000_000_000),
      createHolding('BTC', 35_000_000_000),
      createHolding('SOL', 15_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: target,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.targetAllocation.foundation).toBe(70);
    expect(result.targetAllocation.growth).toBe(25);
    expect(result.targetAllocation.upside).toBe(5);
  });

  // Test 109: BALANCED target allocation (50/35/15)
  it('should correctly handle BALANCED target allocation (50/35/15)', async () => {
    const target = RISK_PROFILES.BALANCED;

    const holdings = [
      createHolding('USDT', 70_000_000_000),
      createHolding('BTC', 20_000_000_000),
      createHolding('SOL', 10_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: target,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.targetAllocation.foundation).toBe(50);
    expect(result.targetAllocation.growth).toBe(35);
    expect(result.targetAllocation.upside).toBe(15);
  });

  // Test 110: GROWTH target allocation (45/38/17)
  it('should correctly handle GROWTH target allocation (45/38/17)', async () => {
    const target = RISK_PROFILES.GROWTH;

    const holdings = [
      createHolding('USDT', 50_000_000_000),
      createHolding('BTC', 35_000_000_000),
      createHolding('SOL', 15_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: target,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.targetAllocation.foundation).toBe(45);
    expect(result.targetAllocation.growth).toBe(38);
    expect(result.targetAllocation.upside).toBe(17);
  });

  // Test 111: AGGRESSIVE target allocation (35/40/25)
  it('should correctly handle AGGRESSIVE target allocation (35/40/25)', async () => {
    const target = RISK_PROFILES.AGGRESSIVE;

    const holdings = [
      createHolding('USDT', 50_000_000_000),
      createHolding('BTC', 35_000_000_000),
      createHolding('SOL', 15_000_000_000),
    ];

    const snapshot = createPortfolioSnapshot({
      holdings,
      targetAllocation: target,
    });
    vi.mocked(getPortfolioSnapshot).mockResolvedValue(snapshot);

    const result = await previewRebalance('user-123', 'HOLDINGS_ONLY');

    expect(result.targetAllocation.foundation).toBe(35);
    expect(result.targetAllocation.growth).toBe(40);
    expect(result.targetAllocation.upside).toBe(25);
  });

  // Test 112: Risk score 1-2 maps to CAPITAL_PRESERVATION
  it('should map risk scores 1-2 to Capital Preservation profile', () => {
    expect(RISK_PROFILE_NAMES[1]).toBe('Capital Preservation');
    expect(RISK_PROFILE_NAMES[2]).toBe('Capital Preservation');

    // Verify allocations
    expect(TARGET_ALLOCATIONS[1]).toEqual({ foundation: 85, growth: 12, upside: 3 });
    expect(TARGET_ALLOCATIONS[2]).toEqual({ foundation: 80, growth: 15, upside: 5 });
  });

  // Test 113: Risk score 3-4 maps to CONSERVATIVE
  it('should map risk scores 3-4 to Conservative profile', () => {
    expect(RISK_PROFILE_NAMES[3]).toBe('Conservative');
    expect(RISK_PROFILE_NAMES[4]).toBe('Conservative');

    expect(TARGET_ALLOCATIONS[3]).toEqual({ foundation: 70, growth: 25, upside: 5 });
    expect(TARGET_ALLOCATIONS[4]).toEqual({ foundation: 65, growth: 30, upside: 5 });
  });

  // Test 114: Risk score 5-6 maps to BALANCED
  it('should map risk scores 5-6 to Balanced profile', () => {
    expect(RISK_PROFILE_NAMES[5]).toBe('Balanced');
    expect(RISK_PROFILE_NAMES[6]).toBe('Balanced');

    expect(TARGET_ALLOCATIONS[5]).toEqual({ foundation: 55, growth: 35, upside: 10 });
    expect(TARGET_ALLOCATIONS[6]).toEqual({ foundation: 50, growth: 35, upside: 15 });
  });

  // Test 115: Risk score 7-8 maps to GROWTH
  it('should map risk scores 7-8 to Growth profile', () => {
    expect(RISK_PROFILE_NAMES[7]).toBe('Growth');
    expect(RISK_PROFILE_NAMES[8]).toBe('Growth');

    expect(TARGET_ALLOCATIONS[7]).toEqual({ foundation: 45, growth: 38, upside: 17 });
    expect(TARGET_ALLOCATIONS[8]).toEqual({ foundation: 40, growth: 40, upside: 20 });
  });

  // Test 116: Risk score 9-10 maps to AGGRESSIVE
  it('should map risk scores 9-10 to Aggressive profile', () => {
    expect(RISK_PROFILE_NAMES[9]).toBe('Aggressive');
    expect(RISK_PROFILE_NAMES[10]).toBe('Aggressive');

    expect(TARGET_ALLOCATIONS[9]).toEqual({ foundation: 35, growth: 40, upside: 25 });
    expect(TARGET_ALLOCATIONS[10]).toEqual({ foundation: 30, growth: 40, upside: 30 });
  });

  // Additional validation: All target allocations sum to 100%
  it('should have all target allocations sum to 100%', () => {
    for (let score = 1; score <= 10; score++) {
      const allocation = TARGET_ALLOCATIONS[score];
      const sum = allocation.foundation + allocation.growth + allocation.upside;
      expect(sum).toBe(100);
    }
  });

  // Verify RISK_PROFILES constants match domain definitions
  it('should have RISK_PROFILES constants that sum to 100%', () => {
    for (const [name, allocation] of Object.entries(RISK_PROFILES)) {
      const sum = allocation.foundation + allocation.growth + allocation.upside;
      expect(sum).toBe(100);
    }
  });
});
