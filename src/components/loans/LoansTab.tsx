import React, { useMemo, Dispatch } from 'react';
import { MAX_TOTAL_LOAN_PCT } from '../../constants/index';
import ActiveLoanCard from './ActiveLoanCard';
import LoanCapacityBar from './LoanCapacityBar';
import type { Loan, Holding, AppAction } from '../../types';

interface LoansTabProps {
  loans: Loan[];
  holdings: Holding[];
  cashIRR: number;
  totalPortfolioIRR: number;
  prices?: Record<string, number>;
  fxRate?: number;
  dispatch: Dispatch<AppAction>;
}

function LoansTab({
  loans,
  totalPortfolioIRR,
  dispatch,
}: LoansTabProps) {
  const loanList = loans || [];
  const activeLoans = loanList.filter((l) => l.status !== 'REPAID' && l.status !== 'LIQUIDATED');

  // Loan capacity calculations
  const loanCapacity = useMemo(() => {
    const totalBorrowed = loanList.reduce((sum, l) => sum + l.amountIRR, 0);
    const maxLoans = Math.floor(totalPortfolioIRR * MAX_TOTAL_LOAN_PCT);
    const remainingCapacity = Math.max(0, maxLoans - totalBorrowed);
    return { totalBorrowed, maxLoans, remainingCapacity };
  }, [loanList, totalPortfolioIRR]);

  const handleRepay = (loanId: string) => {
    dispatch({ type: 'START_REPAY', loanId });
  };

  // Empty state
  if (activeLoans.length === 0) {
    return (
      <div className="loansDashboard">
        <div className="emptyLoansState">
          <div className="emptyIcon">💰</div>
          <h3>No Active Loans</h3>
          <p>Borrow against your assets without selling them. Select an asset from your Portfolio to get started.</p>
        </div>

        <LoanCapacityBar
          used={loanCapacity.totalBorrowed}
          max={loanCapacity.maxLoans}
          remaining={loanCapacity.remainingCapacity}
        />
      </div>
    );
  }

  return (
    <div className="loansDashboard">
      {/* Active Loans */}
      <div className="activeLoansSection">
        <h3 className="sectionTitle">Active Loans</h3>
        {activeLoans.map((loan) => (
          <ActiveLoanCard
            key={loan.id}
            loan={loan}
            onRepay={() => handleRepay(loan.id)}
          />
        ))}
      </div>

      {/* Portfolio Loan Capacity */}
      <LoanCapacityBar
        used={loanCapacity.totalBorrowed}
        max={loanCapacity.maxLoans}
        remaining={loanCapacity.remainingCapacity}
      />
    </div>
  );
}

export default LoansTab;
