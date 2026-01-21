// Loans Hook
// src/hooks/useLoans.ts

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { loans as loansApi } from '../services/api/index';
import type { Loan } from '../types';
import type { LoanCapacityResponse } from '../services/api/index';

interface UseLoansResult {
  loans: Loan[];
  capacity: LoanCapacityResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createLoan: (amountIrr: number, termMonths: 3 | 6) => Promise<Loan | null>;
  repayLoan: (loanId: string, amountIrr: number) => Promise<boolean>;
}

export function useLoans(): UseLoansResult {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [capacity, setCapacity] = useState<LoanCapacityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLoans = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (loans.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      // Fetch loans and capacity in parallel
      const [loansResponse, capacityResponse] = await Promise.all([
        loansApi.getAll(),
        loansApi.getCapacity(),
      ]);

      setLoans(loansResponse.loans);
      setCapacity(capacityResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load loans');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loans.length]);

  const refresh = useCallback(async () => {
    await fetchLoans(true);
  }, [fetchLoans]);

  const createLoan = useCallback(async (amountIrr: number, termMonths: 3 | 6): Promise<Loan | null> => {
    try {
      setError(null);
      const newLoan = await loansApi.create(amountIrr, termMonths);
      setLoans((prev) => [newLoan, ...prev]);
      // Refresh capacity after creating loan
      const newCapacity = await loansApi.getCapacity();
      setCapacity(newCapacity);
      return newLoan;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create loan');
      return null;
    }
  }, []);

  const repayLoan = useCallback(async (loanId: string, amountIrr: number): Promise<boolean> => {
    try {
      setError(null);
      await loansApi.repay(loanId, amountIrr);
      // Refresh data after repayment
      await fetchLoans(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to repay loan');
      return false;
    }
  }, [fetchLoans]);

  // Fetch on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchLoans();
    }, [fetchLoans])
  );

  return {
    loans,
    capacity,
    isLoading,
    isRefreshing,
    error,
    refresh,
    createLoan,
    repayLoan,
  };
}

export default useLoans;
