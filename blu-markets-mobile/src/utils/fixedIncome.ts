// Fixed Income Calculation Utility
// Based on PRD Section 17 - Fixed Income Asset
//
// ⚠️ BUG-008 WARNING: DEMO/MOCK USE ONLY
// Fixed income accrual and valuation MUST be computed by the backend.
// This utility is only for demo mode and UI placeholders.
//
// PRODUCTION REQUIREMENT:
// - Backend portfolio API must return { principal, accrued, total } for fixed income
// - Frontend displays backend-provided values only
// - This file should be gated behind __DEV__ or removed in production

export const FIXED_INCOME_UNIT_PRICE = 500_000;  // IRR per unit
export const FIXED_INCOME_ANNUAL_RATE = 0.30;    // 30% annual simple interest

export interface FixedIncomeBreakdown {
  principal: number;
  accrued: number;
  total: number;
  daysHeld: number;
  dailyRate: number;
}

/**
 * Calculate Fixed Income value with accrued interest
 * Uses simple interest: P × r × (days/365)
 */
export function calculateFixedIncomeValue(
  quantity: number,
  purchasedAt?: string | Date
): FixedIncomeBreakdown {
  const principal = quantity * FIXED_INCOME_UNIT_PRICE;

  if (!purchasedAt) {
    return {
      principal,
      accrued: 0,
      total: principal,
      daysHeld: 0,
      dailyRate: 0,
    };
  }

  const now = Date.now();
  const purchased = new Date(purchasedAt).getTime();
  const daysHeld = Math.max(0, (now - purchased) / (1000 * 60 * 60 * 24));

  // Simple interest: P × r × (days/365)
  const accrued = Math.round(principal * FIXED_INCOME_ANNUAL_RATE * (daysHeld / 365));
  const dailyRate = Math.round(principal * FIXED_INCOME_ANNUAL_RATE / 365);

  return {
    principal,
    accrued,
    total: principal + accrued,
    daysHeld: Math.floor(daysHeld),
    dailyRate,
  };
}

/**
 * Format Fixed Income breakdown as display string
 */
export function formatFixedIncomeBreakdown(breakdown: FixedIncomeBreakdown): string {
  const formatIRR = (value: number): string => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toLocaleString('en-US');
  };

  if (breakdown.daysHeld === 0) {
    return `${formatIRR(breakdown.principal)} IRR`;
  }

  return `${formatIRR(breakdown.principal)} + ${formatIRR(breakdown.accrued)} accrued (${breakdown.daysHeld}d)`;
}
