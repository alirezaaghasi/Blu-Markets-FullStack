// Loans API Module
// src/services/api/loans.ts

import { apiClient } from './client';
import type { LoansResponse, LoanCapacityResponse, Loan } from './types';

export const loans = {
  getAll: (): Promise<LoansResponse> =>
    apiClient.get('/loans'),

  getCapacity: (): Promise<LoanCapacityResponse> =>
    apiClient.get('/loans/capacity'),

  create: (collateralAssetId: string, amountIrr: number, durationMonths: 3 | 6): Promise<Loan> =>
    apiClient.post('/loans', { collateralAssetId, amountIrr, durationMonths }),

  repay: (loanId: string, amountIrr: number): Promise<{
    success: boolean;
    remainingBalance: number;
    installmentsPaid: number;
  }> =>
    apiClient.post(`/loans/${loanId}/repay`, { amountIrr }),
};
