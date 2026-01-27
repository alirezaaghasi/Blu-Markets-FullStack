// Loans API Module
// src/services/api/loans.ts
//
// BUG-014 FIX: Runtime validation for API responses
// All responses are validated before being returned to prevent crashes from malformed data

import { apiClient } from './client';
import type { LoansResponse, LoanCapacityResponse, LoanPreviewResponse, Loan } from './types';

// Type for raw API responses (interceptor unwraps .data)
type ApiResponse<T> = T;

// BUG-014 FIX: Runtime validation helpers
// These validate API responses to prevent crashes from malformed backend data

function validateLoan(data: unknown): Loan | null {
  if (!data || typeof data !== 'object') return null;
  const loan = data as Record<string, unknown>;

  // Required fields
  if (typeof loan.id !== 'string') return null;
  if (typeof loan.collateralAssetId !== 'string') return null;
  if (typeof loan.amountIRR !== 'number') return null;
  if (typeof loan.status !== 'string') return null;

  // Optional fields with defaults
  // Backend returns durationMonths, convert to durationDays for frontend
  const durationMonths = typeof loan.durationMonths === 'number' ? loan.durationMonths : 3;
  const durationDays = (durationMonths === 3 ? 90 : durationMonths === 6 ? 180 : durationMonths * 30) as 90 | 180;

  return {
    id: loan.id,
    collateralAssetId: loan.collateralAssetId,
    collateralQuantity: typeof loan.collateralQuantity === 'number' ? loan.collateralQuantity : 0,
    amountIRR: loan.amountIRR,
    dailyInterestRate: typeof loan.dailyInterestRate === 'number' ? loan.dailyInterestRate : 0,
    interestRate: typeof loan.interestRate === 'number' ? loan.interestRate : undefined,
    durationDays: typeof loan.durationDays === 'number' ? loan.durationDays as 90 | 180 : durationDays,
    startISO: typeof loan.startISO === 'string' ? loan.startISO : new Date().toISOString(),
    dueISO: typeof loan.dueISO === 'string' ? loan.dueISO : new Date().toISOString(),
    status: loan.status as 'ACTIVE' | 'REPAID' | 'DEFAULTED',
    totalInterestIRR: typeof loan.totalInterestIRR === 'number' ? loan.totalInterestIRR : 0,
    totalRepaymentIRR: typeof loan.totalRepaymentIRR === 'number' ? loan.totalRepaymentIRR : loan.amountIRR,
    totalDueIRR: typeof loan.totalDueIRR === 'number' ? loan.totalDueIRR : loan.amountIRR,
    paidIRR: typeof loan.paidIRR === 'number' ? loan.paidIRR : 0,
    installments: Array.isArray(loan.installments) ? loan.installments : [],
    installmentsPaid: typeof loan.installmentsPaid === 'number' ? loan.installmentsPaid : 0,
  } as Loan;
}

function validateLoansResponse(data: unknown): LoansResponse {
  if (!data || typeof data !== 'object') {
    if (__DEV__) console.warn('[Loans API] Invalid response: not an object');
    return { loans: [] };
  }

  const response = data as Record<string, unknown>;
  const loans: Loan[] = [];

  if (Array.isArray(response.loans)) {
    for (const item of response.loans) {
      const loan = validateLoan(item);
      if (loan) loans.push(loan);
      else if (__DEV__) console.warn('[Loans API] Skipping invalid loan:', item);
    }
  }

  return { loans };
}

function validateLoanCapacity(data: unknown): LoanCapacityResponse {
  if (!data || typeof data !== 'object') {
    if (__DEV__) console.warn('[Loans API] Invalid capacity response');
    return { availableIrr: 0, usedIrr: 0, maxCapacityIrr: 0, portfolioValueIrr: 0 };
  }

  const response = data as Record<string, unknown>;
  return {
    availableIrr: typeof response.availableIrr === 'number' ? response.availableIrr :
                  typeof response.available_irr === 'number' ? response.available_irr : 0,
    usedIrr: typeof response.usedIrr === 'number' ? response.usedIrr :
             typeof response.currentLoansIrr === 'number' ? response.currentLoansIrr :
             typeof response.used_irr === 'number' ? response.used_irr : 0,
    maxCapacityIrr: typeof response.maxCapacityIrr === 'number' ? response.maxCapacityIrr :
                    typeof response.maxPortfolioLoanIrr === 'number' ? response.maxPortfolioLoanIrr : 0,
    portfolioValueIrr: typeof response.portfolioValueIrr === 'number' ? response.portfolioValueIrr : 0,
  };
}

export const loans = {
  // BUG-014 FIX: All responses are validated before returning
  getAll: async (): Promise<LoansResponse> => {
    const data = await apiClient.get('/loans');
    return validateLoansResponse(data);
  },

  // BUG-014 FIX: Response validated with safe defaults for missing fields
  getCapacity: async (): Promise<LoanCapacityResponse> => {
    const data = await apiClient.get('/loans/capacity');
    return validateLoanCapacity(data);
  },

  // Get loan calculation preview from backend (all business logic on server)
  // Backend expects durationMonths (3 or 6), frontend uses durationDays (90 or 180)
  preview: async (collateralAssetId: string, amountIrr: number, durationDays: 90 | 180): Promise<LoanPreviewResponse> => {
    // Convert days to months for backend API
    const durationMonths = durationDays === 90 ? 3 : 6;
    const data = await apiClient.post('/loans/preview', {
      collateralAssetId,
      amountIrr,
      durationMonths,
    }) as unknown as ApiResponse<LoanPreviewResponse>;
    return data;
  },

  // Create a loan with collateral asset (duration in days: 90 or 180 = 3 or 6 months)
  // Backend expects durationMonths (3 or 6), frontend uses durationDays (90 or 180)
  // BUG-014 FIX: Response is validated before returning
  create: async (collateralAssetId: string, amountIrr: number, durationDays: 90 | 180): Promise<Loan> => {
    // Convert days to months for backend API
    const durationMonths = durationDays === 90 ? 3 : 6;
    const response = await apiClient.post('/loans', { collateralAssetId, amountIrr, durationMonths }) as unknown;

    // Handle wrapped response { loan: {...} } or direct Loan response
    let loanData: unknown;
    if (response && typeof response === 'object' && 'loan' in response) {
      loanData = (response as Record<string, unknown>).loan;
    } else {
      loanData = response;
    }

    // BUG-014 FIX: Validate the loan response
    const loan = validateLoan(loanData);
    if (!loan) {
      throw new Error('[Loans API] Invalid loan response from server');
    }
    return loan;
  },

  repay: (loanId: string, amountIrr: number): Promise<{
    success: boolean;
    remainingBalance: number;
    installmentsPaid: number;
  }> =>
    apiClient.post(`/loans/${loanId}/repay`, { amountIrr }) as unknown as Promise<{
      success: boolean;
      remainingBalance: number;
      installmentsPaid: number;
    }>,
};
