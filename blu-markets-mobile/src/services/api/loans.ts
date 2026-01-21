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
    const data = await apiClient.get('/loans/capacity') as unknown as ApiResponse<Record<string, number>>;
    return {
      availableIrr: data?.availableIrr ?? data?.available_irr ?? 0,
      usedIrr: data?.usedIrr ?? data?.used_irr ?? 0,
      maxCapacityIrr: data?.maxCapacityIrr ?? data?.max_capacity_irr ?? 0,
      portfolioValueIrr: data?.portfolioValueIrr ?? data?.portfolio_value_irr ?? 0,
    };
  },

  // The hook calls with (amountIrr, termMonths) - backend will determine collateral automatically
  create: (amountIrr: number, durationMonths: 3 | 6): Promise<Loan> =>
    apiClient.post('/loans', { amountIrr, durationMonths }) as unknown as Promise<Loan>,

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
