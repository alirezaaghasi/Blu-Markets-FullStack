import { useMemo } from 'react';
import { LOAN_INTEREST_RATE } from '../constants/index';
import type { Loan } from '../types';

export interface LoanCalculations {
  // Time-based
  daysRemaining: number;
  daysElapsed: number;
  progressPct: number;
  maturityDate: string;

  // Interest-based
  accruedInterest: number;
  fullTermInterest: number;
  interestForgiveness: number;
  settlementAmount: number;
  totalAtMaturity: number;

  // Installment-based
  nextInstallmentAmount: number;
  pendingInstallmentCount: number;
}

/**
 * Calculate all loan metrics in a single memoized computation.
 * Eliminates duplicate calculations between ActiveLoanCard and RepaymentPanel.
 *
 * Optimization: Reduces Date object creations from 8 to 2 per loan render.
 */
export function useLoanCalculations(loan: Loan | null): LoanCalculations | null {
  return useMemo(() => {
    if (!loan) return null;

    const now = Date.now();
    const startMs = new Date(loan.startISO).getTime();
    const durationMonths = loan.durationMonths || 3;

    // Calculate maturity using proper month addition
    const maturityDate = new Date(loan.startISO);
    maturityDate.setMonth(maturityDate.getMonth() + durationMonths);
    const maturityMs = maturityDate.getTime();

    // Time calculations
    const totalDays = durationMonths * 30;
    const daysElapsed = Math.max(0, Math.ceil((now - startMs) / 86400000));
    const daysRemaining = Math.max(0, Math.ceil((maturityMs - now) / 86400000));
    const progressPct = Math.min(100, (daysElapsed / totalDays) * 100);

    const maturityFormatted = maturityDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // Interest calculations
    const dailyRate = LOAN_INTEREST_RATE / 365;
    const actualTotalDays = Math.ceil((maturityMs - startMs) / 86400000);
    const accruedInterest = Math.floor(loan.amountIRR * dailyRate * daysElapsed);
    const fullTermInterest = Math.floor(loan.amountIRR * dailyRate * actualTotalDays);
    const interestForgiveness = Math.max(0, fullTermInterest - accruedInterest);
    const settlementAmount = loan.amountIRR + accruedInterest;

    // Total at maturity (using monthly rate as in original code)
    const totalAtMaturity = loan.amountIRR + Math.floor(loan.amountIRR * (LOAN_INTEREST_RATE / 12) * durationMonths);

    // Installment calculations
    const pendingInstallments = (loan.installments || []).filter(i => i.status !== 'PAID');
    const nextInstallment = pendingInstallments[0];

    return {
      daysRemaining,
      daysElapsed,
      progressPct,
      maturityDate: maturityFormatted,
      accruedInterest,
      fullTermInterest,
      interestForgiveness,
      settlementAmount,
      totalAtMaturity,
      nextInstallmentAmount: nextInstallment?.totalIRR || 0,
      pendingInstallmentCount: pendingInstallments.length,
    };
  }, [loan?.id, loan?.startISO, loan?.durationMonths, loan?.amountIRR, loan?.installments]);
}
