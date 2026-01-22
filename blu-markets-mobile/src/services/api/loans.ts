// Loans API Module
// src/services/api/loans.ts

import { apiClient } from './client';
import type { LoansResponse, LoanCapacityResponse, Loan } from './types';

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

  // Create a loan with collateral asset
  create: (collateralAssetId: string, amountIrr: number, durationMonths: 3 | 6): Promise<Loan> =>
    apiClient.post('/loans', { collateralAssetId, amountIrr, durationMonths }) as unknown as Promise<Loan>,

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
