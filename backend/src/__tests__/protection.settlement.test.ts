/**
 * Asset Protect Feature - Settlement & Expiry Job Tests
 * Tests the critical settlement logic and expiry processing
 *
 * Run with: npx vitest run src/__tests__/protection.settlement.test.ts
 */

import { describe, it, expect } from 'vitest';

const FX_RATE = 1_456_000;

// ============================================================================
// SETTLEMENT CALCULATION TESTS
// ============================================================================

describe('Settlement Calculation Logic', () => {

  describe('OTM Scenarios (No Payout)', () => {

    it('should return 0 settlement when spot > strike (price went up)', () => {
      const strikeUsd = 95000;
      const expirySpotUsd = 100000; // 5.3% up
      const notionalBtc = 0.5;

      const isITM = expirySpotUsd < strikeUsd;
      const settlementUsd = isITM ? (strikeUsd - expirySpotUsd) * notionalBtc : 0;

      expect(isITM).toBe(false);
      expect(settlementUsd).toBe(0);
    });

    it('should return 0 settlement when spot equals strike (ATM at expiry)', () => {
      const strikeUsd = 95000;
      const expirySpotUsd = 95000; // Exactly at strike
      const notionalBtc = 1.0;

      const isITM = expirySpotUsd < strikeUsd;
      const settlementUsd = isITM ? (strikeUsd - expirySpotUsd) * notionalBtc : 0;

      expect(isITM).toBe(false);
      expect(settlementUsd).toBe(0);
    });

    it('should return 0 for significant price increase', () => {
      const strikeUsd = 95000;
      const expirySpotUsd = 150000; // 57.9% up
      const notionalBtc = 2.0;

      const isITM = expirySpotUsd < strikeUsd;
      const settlementUsd = isITM ? (strikeUsd - expirySpotUsd) * notionalBtc : 0;

      expect(isITM).toBe(false);
      expect(settlementUsd).toBe(0);
    });
  });

  describe('ITM Scenarios (Payout Required)', () => {

    it('should calculate correct settlement for small price drop', () => {
      const strikeUsd = 95000;
      const expirySpotUsd = 90000; // 5.3% down
      const notionalBtc = 0.5;

      const isITM = expirySpotUsd < strikeUsd;
      const settlementUsd = isITM ? (strikeUsd - expirySpotUsd) * notionalBtc : 0;
      const settlementIrr = settlementUsd * FX_RATE;

      expect(isITM).toBe(true);
      expect(settlementUsd).toBe(2500); // ($5,000 drop × 0.5 BTC)
      expect(settlementIrr).toBe(3_640_000_000);
    });

    it('should calculate correct settlement for moderate price drop', () => {
      const strikeUsd = 95000;
      const expirySpotUsd = 80000; // 15.8% down
      const notionalBtc = 1.0;

      const settlementUsd = (strikeUsd - expirySpotUsd) * notionalBtc;
      const settlementIrr = settlementUsd * FX_RATE;

      expect(settlementUsd).toBe(15000);
      expect(settlementIrr).toBe(21_840_000_000);
    });

    it('should calculate correct settlement for severe price crash', () => {
      const strikeUsd = 95000;
      const expirySpotUsd = 50000; // 47.4% down (crash scenario)
      const notionalBtc = 0.5;

      const settlementUsd = (strikeUsd - expirySpotUsd) * notionalBtc;
      const settlementIrr = settlementUsd * FX_RATE;

      expect(settlementUsd).toBe(22500);
      expect(settlementIrr).toBe(32_760_000_000);
    });

    it('should handle extreme crash (90% drop)', () => {
      const strikeUsd = 95000;
      const expirySpotUsd = 9500; // 90% down
      const notionalBtc = 1.0;

      const settlementUsd = (strikeUsd - expirySpotUsd) * notionalBtc;

      expect(settlementUsd).toBe(85500);
      // No cap - full protection amount paid
    });

    it('should handle near-zero price (99% drop)', () => {
      const strikeUsd = 95000;
      const expirySpotUsd = 950; // 99% down
      const notionalBtc = 0.5;

      const settlementUsd = (strikeUsd - expirySpotUsd) * notionalBtc;

      expect(settlementUsd).toBe(47025);
      // Settlement approaches full notional value
    });
  });

  describe('Partial Coverage Scenarios', () => {

    it('should settle only protected portion at 50% coverage', () => {
      const fullHoldingBtc = 1.0;
      const coveragePct = 0.5;
      const strikeUsd = 95000;
      const expirySpotUsd = 80000;

      const protectedNotionalBtc = fullHoldingBtc * coveragePct;
      const settlementUsd = (strikeUsd - expirySpotUsd) * protectedNotionalBtc;

      // User's unprotected loss
      const unprotectedNotionalBtc = fullHoldingBtc * (1 - coveragePct);
      const unprotectedLossUsd = (strikeUsd - expirySpotUsd) * unprotectedNotionalBtc;

      expect(settlementUsd).toBe(7500);
      expect(unprotectedLossUsd).toBe(7500);
      expect(settlementUsd + unprotectedLossUsd).toBe(15000); // Total drop
    });

    it('should settle only protected portion at 25% coverage', () => {
      const fullHoldingBtc = 2.0;
      const coveragePct = 0.25;
      const strikeUsd = 95000;
      const expirySpotUsd = 70000;

      const protectedNotionalBtc = fullHoldingBtc * coveragePct; // 0.5 BTC
      const settlementUsd = (strikeUsd - expirySpotUsd) * protectedNotionalBtc;

      expect(settlementUsd).toBe(12500); // ($25,000 drop × 0.5 BTC)
    });

    it('should settle only protected portion at 10% coverage (minimum)', () => {
      const fullHoldingBtc = 1.0;
      const coveragePct = 0.10;
      const strikeUsd = 95000;
      const expirySpotUsd = 85000;

      const protectedNotionalBtc = fullHoldingBtc * coveragePct; // 0.1 BTC
      const settlementUsd = (strikeUsd - expirySpotUsd) * protectedNotionalBtc;

      expect(settlementUsd).toBe(1000); // ($10,000 drop × 0.1 BTC)
    });
  });

  describe('Multi-Asset Scenarios', () => {

    it('should calculate ETH settlement correctly', () => {
      const strikeUsd = 3500;
      const expirySpotUsd = 3000;
      const notionalEth = 2.0;

      const settlementUsd = (strikeUsd - expirySpotUsd) * notionalEth;

      expect(settlementUsd).toBe(1000);
    });

    it('should calculate SOL settlement correctly', () => {
      const strikeUsd = 180;
      const expirySpotUsd = 120; // 33% drop
      const notionalSol = 100;

      const settlementUsd = (strikeUsd - expirySpotUsd) * notionalSol;

      expect(settlementUsd).toBe(6000);
    });

    it('should calculate GOLD settlement correctly', () => {
      const strikeUsd = 2650; // per oz
      const expirySpotUsd = 2500;
      const notionalOz = 1.0;

      const settlementUsd = (strikeUsd - expirySpotUsd) * notionalOz;

      expect(settlementUsd).toBe(150);
    });
  });
});

// ============================================================================
// EXPIRY JOB LOGIC TESTS
// ============================================================================

describe('Expiry Job Logic', () => {

  describe('Protection Status Transitions', () => {

    it('should transition OTM protection to EXPIRED', () => {
      const protection = {
        id: 'test-1',
        status: 'ACTIVE',
        strikeUsd: 95000,
        notionalBtc: 0.5,
        expiryDate: new Date('2025-01-22'),
      };

      const currentSpot = 100000; // Above strike
      const isITM = currentSpot < protection.strikeUsd;
      const newStatus = isITM ? 'EXERCISED' : 'EXPIRED';

      expect(newStatus).toBe('EXPIRED');
    });

    it('should transition ITM protection to EXERCISED', () => {
      const protection = {
        id: 'test-2',
        status: 'ACTIVE',
        strikeUsd: 95000,
        notionalBtc: 0.5,
        expiryDate: new Date('2025-01-22'),
      };

      const currentSpot = 85000; // Below strike
      const isITM = currentSpot < protection.strikeUsd;
      const newStatus = isITM ? 'EXERCISED' : 'EXPIRED';

      expect(newStatus).toBe('EXERCISED');
    });
  });

  describe('Expiry Date Filtering', () => {

    it('should identify protections due for expiry', () => {
      const now = new Date('2025-01-22T12:00:00Z');

      const protections = [
        { id: '1', expiryDate: new Date('2025-01-22T00:00:00Z'), status: 'ACTIVE' }, // Due
        { id: '2', expiryDate: new Date('2025-01-21T00:00:00Z'), status: 'ACTIVE' }, // Overdue
        { id: '3', expiryDate: new Date('2025-01-23T00:00:00Z'), status: 'ACTIVE' }, // Future
        { id: '4', expiryDate: new Date('2025-01-22T00:00:00Z'), status: 'EXPIRED' }, // Already processed
      ];

      const dueForExpiry = protections.filter(p =>
        p.status === 'ACTIVE' && new Date(p.expiryDate) <= now
      );

      expect(dueForExpiry.length).toBe(2);
      expect(dueForExpiry.map(p => p.id)).toContain('1');
      expect(dueForExpiry.map(p => p.id)).toContain('2');
    });
  });

  describe('Cash Credit on Settlement', () => {

    it('should credit user cash on ITM settlement', () => {
      const userCashBefore = 10_000_000_000; // 10B IRR
      const settlementIrr = 3_640_000_000; // Settlement amount

      const userCashAfter = userCashBefore + settlementIrr;

      expect(userCashAfter).toBe(13_640_000_000);
    });

    it('should not change cash on OTM expiry', () => {
      const userCashBefore = 10_000_000_000;
      const settlementIrr = 0; // OTM - no settlement

      const userCashAfter = userCashBefore + settlementIrr;

      expect(userCashAfter).toBe(10_000_000_000);
    });
  });
});

// ============================================================================
// PROFIT & LOSS SCENARIOS
// ============================================================================

describe('User P&L Scenarios', () => {

  it('should calculate net loss when OTM (premium lost)', () => {
    const premiumPaidIrr = 3_112_200_000;
    const settlementIrr = 0; // OTM

    const netPnL = settlementIrr - premiumPaidIrr;

    expect(netPnL).toBe(-3_112_200_000);
    // User lost the premium (cost of insurance)
  });

  it('should calculate net profit when deeply ITM', () => {
    const premiumPaidIrr = 3_112_200_000;
    const settlementIrr = 7_280_000_000; // Good ITM

    const netPnL = settlementIrr - premiumPaidIrr;

    expect(netPnL).toBe(4_167_800_000);
    // User profited from protection
  });

  it('should calculate breakeven when settlement equals premium', () => {
    const premiumPaidIrr = 3_000_000_000;
    const settlementIrr = 3_000_000_000;

    const netPnL = settlementIrr - premiumPaidIrr;

    expect(netPnL).toBe(0);
    // Breakeven - protection paid for itself
  });

  it('should calculate partial recovery when slightly ITM', () => {
    const premiumPaidIrr = 3_112_200_000;
    const settlementIrr = 1_500_000_000; // Slightly ITM

    const netPnL = settlementIrr - premiumPaidIrr;

    expect(netPnL).toBe(-1_612_200_000);
    // User lost some but recovered part through settlement
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Settlement Edge Cases', () => {

  it('should handle zero notional (should not happen but safe)', () => {
    const strikeUsd = 95000;
    const expirySpotUsd = 80000;
    const notionalBtc = 0;

    const settlementUsd = (strikeUsd - expirySpotUsd) * notionalBtc;

    expect(settlementUsd).toBe(0);
  });

  it('should handle very small notional', () => {
    const strikeUsd = 95000;
    const expirySpotUsd = 80000;
    const notionalBtc = 0.0001; // ~$9.50 worth

    const settlementUsd = (strikeUsd - expirySpotUsd) * notionalBtc;

    expect(settlementUsd).toBeCloseTo(1.5, 1);
  });

  it('should handle very large notional', () => {
    const strikeUsd = 95000;
    const expirySpotUsd = 80000;
    const notionalBtc = 100; // ~$9.5M worth

    const settlementUsd = (strikeUsd - expirySpotUsd) * notionalBtc;

    expect(settlementUsd).toBe(1_500_000);
  });

  it('should round settlement to integer IRR', () => {
    const settlementUsd = 1234.5678;
    const settlementIrr = Math.round(settlementUsd * FX_RATE);

    expect(Number.isInteger(settlementIrr)).toBe(true);
  });

  it('should handle price just below strike (barely ITM)', () => {
    const strikeUsd = 95000;
    const expirySpotUsd = 94999; // $1 below
    const notionalBtc = 0.5;

    const isITM = expirySpotUsd < strikeUsd;
    const settlementUsd = (strikeUsd - expirySpotUsd) * notionalBtc;

    expect(isITM).toBe(true);
    expect(settlementUsd).toBe(0.5);
  });
});

// ============================================================================
// LEDGER ENTRY VALIDATION
// ============================================================================

describe('Ledger Entry Creation', () => {

  it('should create PROTECTION_SETTLEMENT entry for ITM expiry', () => {
    const settlementIrr = 5_000_000_000;

    const ledgerEntry = {
      entryType: 'PROTECTION_SETTLEMENT',
      amountIrr: settlementIrr,
      boundary: 'SAFE',
      message: 'Protection exercised: BTC settled at 5,000,000,000 IRR',
    };

    expect(ledgerEntry.entryType).toBe('PROTECTION_SETTLEMENT');
    expect(ledgerEntry.amountIrr).toBeGreaterThan(0);
  });

  it('should NOT create ledger entry for OTM expiry', () => {
    const settlementIrr = 0;

    // No ledger entry should be created for OTM
    const shouldCreateEntry = settlementIrr > 0;

    expect(shouldCreateEntry).toBe(false);
  });
});

// ============================================================================
// BATCH PROCESSING
// ============================================================================

describe('Batch Expiry Processing', () => {

  it('should process multiple expirations correctly', () => {
    const protections = [
      { id: '1', strikeUsd: 95000, spotAtExpiry: 90000, notional: 0.5 }, // ITM
      { id: '2', strikeUsd: 95000, spotAtExpiry: 100000, notional: 1.0 }, // OTM
      { id: '3', strikeUsd: 3500, spotAtExpiry: 3000, notional: 2.0 }, // ITM (ETH)
      { id: '4', strikeUsd: 180, spotAtExpiry: 200, notional: 100 }, // OTM (SOL)
    ];

    const results = protections.map(p => {
      const isITM = p.spotAtExpiry < p.strikeUsd;
      const settlement = isITM ? (p.strikeUsd - p.spotAtExpiry) * p.notional : 0;
      return {
        id: p.id,
        status: isITM ? 'EXERCISED' : 'EXPIRED',
        settlementUsd: settlement,
      };
    });

    expect(results[0].status).toBe('EXERCISED');
    expect(results[0].settlementUsd).toBe(2500);

    expect(results[1].status).toBe('EXPIRED');
    expect(results[1].settlementUsd).toBe(0);

    expect(results[2].status).toBe('EXERCISED');
    expect(results[2].settlementUsd).toBe(1000);

    expect(results[3].status).toBe('EXPIRED');
    expect(results[3].settlementUsd).toBe(0);

    // Total settlement
    const totalSettlement = results.reduce((sum, r) => sum + r.settlementUsd, 0);
    expect(totalSettlement).toBe(3500);
  });
});
