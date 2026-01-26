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
      // Portfolio value is maxCapacity / 0.25 (since limit is 25% of portfolio)
      portfolioValueIrr: data?.portfolioValueIrr ?? (maxCapacity > 0 ? maxCapacity / 0.25 : 0),
    };
  },

  // Get loan calculation preview from backend (all business logic on server)
  preview: async (collateralAssetId: string, amountIrr: number, durationDays: 90 | 180): Promise<LoanPreviewResponse> => {
    const durationMonths = (durationDays / 30) as 3 | 6;
    const data = await apiClient.post('/loans/preview', {
      collateralAssetId,
      amountIrr,
      durationMonths,
    }) as unknown as ApiResponse<LoanPreviewResponse>;
    return data;
  },

  // Create a loan with collateral asset (duration in days: 90 or 180 = 3 or 6 months)
  create: async (collateralAssetId: string, amountIrr: number, durationDays: 90 | 180): Promise<Loan> => {
    // Backend expects durationMonths (3 or 6)
    const durationMonths = (durationDays / 30) as 3 | 6;
    const response = await apiClient.post('/loans', { collateralAssetId, amountIrr, durationMonths }) as unknown as ApiResponse<{
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
