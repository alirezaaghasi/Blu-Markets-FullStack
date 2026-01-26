// Loans API Module
// src/services/api/loans.ts

import { apiClient } from './client';
import type { LoansResponse, LoanCapacityResponse, LoanPreviewResponse, Loan } from './types';

// Type for raw API responses (interceptor unwraps .data)
type ApiResponse<T> = T;

export const loans = {
  getAll: async (): Promise<LoansResponse> => {
    const data = await apiClient.get('/loans') as unknown as ApiResponse<{ loans?: Loan[] }>;
    return { loans: data?.loans || [] };
  },

  getCapacity: async (): Promise<LoanCapacityResponse> => {
    const data = await apiClient.get('/loans/capacity') as unknown as ApiResponse<Record<string, any>>;
    // Map backend field names to frontend expected names
    const maxCapacity = data?.maxCapacityIrr ?? data?.maxPortfolioLoanIrr ?? 0;
    return {
      availableIrr: data?.availableIrr ?? data?.available_irr ?? 0,
      usedIrr: data?.usedIrr ?? data?.currentLoansIrr ?? data?.used_irr ?? 0,
      maxCapacityIrr: maxCapacity,
      // BUG-003 FIX: Always use backend-provided portfolio value, never derive from maxCapacity
      // The 25% calculation is a business rule that must be computed by backend only
      portfolioValueIrr: data?.portfolioValueIrr ?? 0,
    };
  },

  // Get loan calculation preview from backend (all business logic on server)
  // BUG-002 FIX: Pass durationDays directly to backend; backend derives months internally
  // Frontend must NOT convert days to months (durationDays / 30 is prohibited)
  preview: async (collateralAssetId: string, amountIrr: number, durationDays: 90 | 180): Promise<LoanPreviewResponse> => {
    const data = await apiClient.post('/loans/preview', {
      collateralAssetId,
      amountIrr,
      durationDays, // Pass days directly, backend handles conversion
    }) as unknown as ApiResponse<LoanPreviewResponse>;
    return data;
  },

  // Create a loan with collateral asset (duration in days: 90 or 180 = 3 or 6 months)
  // BUG-002 FIX: Pass durationDays directly to backend; backend derives months internally
  create: async (collateralAssetId: string, amountIrr: number, durationDays: 90 | 180): Promise<Loan> => {
    const response = await apiClient.post('/loans', { collateralAssetId, amountIrr, durationDays }) as unknown as ApiResponse<{
      loan?: Loan;
      cashAdded?: number;
      holdingFrozen?: boolean;
    } | Loan>;

    // Handle wrapped response { loan: {...} } or direct Loan response
    if (response && typeof response === 'object' && 'loan' in response && response.loan) {
      // Ensure installments defaults to empty array
      return { ...response.loan, installments: response.loan.installments || [] };
    }
    // Direct loan response
    const loan = response as Loan;
    return { ...loan, installments: loan.installments || [] };
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
