// Fixed Income Calculation Utility
// Based on PRD Section 17 - Fixed Income Asset
//
// ⚠️⚠️⚠️ BUG-009 FIX: DEMO/MOCK USE ONLY - NEVER USE IN PRODUCTION ⚠️⚠️⚠️
//
// Fixed income accrual and valuation MUST be computed by the backend.
// This utility exists ONLY for demo mode when backend is unavailable.
//
// PRODUCTION REQUIREMENT:
// - Backend portfolio API MUST return { principal, accrued, total } for fixed income
// - Frontend displays backend-provided values ONLY
// - Any displayed interest/accrual values must come from backend
//
// FINANCIAL ACCURACY: Backend is AUTHORITATIVE for all fixed income valuations.
// Client calculations may diverge from backend due to rounding, timing, or rate changes.
//
// DELETION CANDIDATE: This file should be removed once backend provides
// all fixed income values. Consider adding TODO to track removal.

// BUG-009/BUG-019 FIX: Runtime guard to prevent production use
// In production, throw error instead of just logging (which pollutes logs)
if (!__DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE !== 'true') {
  throw new Error('[SECURITY] fixedIncome.ts loaded in production - backend must compute fixed income values');
}

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
 * BACKEND-DERIVED VALUES: Accepts backend breakdown or local calculation
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

/**
 * Get fixed income breakdown from backend-derived fields or calculate locally (fallback)
 * BACKEND-DERIVED VALUES: Prefer backend fixedIncome object when available
 */
export function getFixedIncomeBreakdown(
  holding: {
    quantity: number;
    purchasedAt?: string;
    fixedIncome?: {
      principal: number;
      accruedInterest: number;
      total: number;
      daysHeld: number;
      dailyRate: number;
    };
  }
): FixedIncomeBreakdown {
  // BACKEND-DERIVED: Use backend-provided breakdown if available
  if (holding.fixedIncome) {
    return {
      principal: holding.fixedIncome.principal,
      accrued: holding.fixedIncome.accruedInterest,
      total: holding.fixedIncome.total,
      daysHeld: holding.fixedIncome.daysHeld,
      dailyRate: holding.fixedIncome.dailyRate,
    };
  }

  // Fallback: calculate locally (for demo/mock mode only)
  return calculateFixedIncomeValue(holding.quantity, holding.purchasedAt);
}
