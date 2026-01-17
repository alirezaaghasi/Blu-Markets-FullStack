import type { Loan } from '../types';

export interface LoanSummary {
  loanList: Loan[];
  totalLoanAmount: number;
  criticalRatio: number;
}

/**
 * Compute loan summary in a single pass
 */
export function selectLoanSummary(loans: Loan[]): LoanSummary {
  const list = loans || [];
  let total = 0;
  let maxRatio = 0;

  for (const loan of list) {
    total += loan.amountIRR;
    // Guard against division by zero (liquidationIRR should never be 0, but be defensive)
    const ratio = loan.liquidationIRR > 0 ? loan.amountIRR / loan.liquidationIRR : 0;
    if (ratio > maxRatio) maxRatio = ratio;
  }

  return {
    loanList: list,
    totalLoanAmount: total,
    criticalRatio: maxRatio,
  };
}

/**
 * Get loan by ID
 */
export function selectLoanById(loans: Loan[], loanId: string): Loan | undefined {
  return (loans || []).find(l => l.id === loanId);
}

export type LoanHealthLevel = 'critical' | 'warning' | 'caution' | 'healthy';

export interface LoanHealth {
  level: LoanHealthLevel;
  color: string;
}

/**
 * Get loan health level based on usage percentage
 */
export function selectLoanHealth(usedPercent: number): LoanHealth {
  const color = '#3B82F6';
  if (usedPercent >= 75) return { level: 'critical', color };
  if (usedPercent >= 65) return { level: 'warning', color };
  if (usedPercent >= 50) return { level: 'caution', color };
  return { level: 'healthy', color };
}
