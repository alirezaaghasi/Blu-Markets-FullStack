import React, { useMemo, Dispatch } from 'react';
import { formatIRR, getHoldingValueIRR } from '../../helpers';
import { MAX_TOTAL_LOAN_PCT, DEFAULT_FX_RATE } from '../../constants/index';
import ActiveLoanCard from './ActiveLoanCard';
import LoanProductCard from './LoanProductCard';
import LoanCapacityBar from './LoanCapacityBar';
import type { Loan, Holding, Layer, AppAction } from '../../types';

interface LoansTabProps {
  loans: Loan[];
  holdings: Holding[];
  cashIRR: number;
  totalPortfolioIRR: number;
  prices?: Record<string, number>;
  fxRate?: number;
  dispatch: Dispatch<AppAction>;
  onViewLoan?: (loanId: string) => void;
  onNewLoan?: (layer: Layer) => void;
}

function LoansTab({
  loans,
  holdings,
  cashIRR,
  totalPortfolioIRR,
  prices = {},
  fxRate = DEFAULT_FX_RATE,
  dispatch,
  onViewLoan,
  onNewLoan,
}: LoansTabProps) {
  const loanList = loans || [];
  const activeLoans = loanList.filter((l) => l.status !== 'REPAID' && l.status !== 'LIQUIDATED');

  // Create holdings map for quick lookup
  const holdingsMap = useMemo(() => {
    const map = new Map<string, Holding>();
    (holdings || []).forEach((h) => map.set(h.assetId, h));
    return map;
  }, [holdings]);

  // Loan capacity calculations
  const loanCapacity = useMemo(() => {
    const totalBorrowed = loanList.reduce((sum, l) => sum + l.amountIRR, 0);
    const maxLoans = Math.floor(totalPortfolioIRR * MAX_TOTAL_LOAN_PCT);
    const remainingCapacity = Math.max(0, maxLoans - totalBorrowed);
    return { totalBorrowed, maxLoans, remainingCapacity };
  }, [loanList, totalPortfolioIRR]);

  // Calculate collateral value for a loan
  const getCollateralValue = (loan: Loan): number => {
    const holding = holdingsMap.get(loan.collateralAssetId);
    if (!holding) return 0;
    return getHoldingValueIRR(holding, prices, fxRate);
  };

  const handleRepay = (loanId: string) => {
    dispatch({ type: 'START_REPAY', loanId });
  };

  const handleNewLoan = (layer: Layer) => {
    if (onNewLoan) {
      onNewLoan(layer);
    } else {
      dispatch({ type: 'START_BORROW' });
    }
  };

  // Empty state
  if (activeLoans.length === 0 && loanCapacity.totalBorrowed === 0) {
    return (
      <div className="loansDashboard">
        <div className="emptyLoansState">
          <div className="emptyIcon">💰</div>
          <h3>No Active Loans</h3>
          <p>Borrow against your assets without selling them. Keep your investments while accessing cash.</p>
        </div>

        <div className="loanProductsSection">
          <h3 className="sectionTitle">Borrow Against Your Assets</h3>

          <LoanProductCard
            layer="FOUNDATION"
            maxLtv={70}
            apr={30}
            assets={['USDT', 'PAXG']}
            onSelect={() => handleNewLoan('FOUNDATION')}
          />

          <LoanProductCard
            layer="GROWTH"
            maxLtv={50}
            apr={30}
            assets={['BTC', 'ETH', 'BNB', 'XRP']}
            onSelect={() => handleNewLoan('GROWTH')}
          />

          <LoanProductCard
            layer="UPSIDE"
            maxLtv={30}
            apr={30}
            assets={['SOL', 'TON', 'LINK', 'AVAX']}
            onSelect={() => handleNewLoan('UPSIDE')}
          />
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
      {/* Active Loans - Enhanced Cards */}
      {activeLoans.length > 0 && (
        <div className="activeLoansSection">
          <h3 className="sectionTitle">Active Loans</h3>
          {activeLoans.map((loan) => (
            <ActiveLoanCard
              key={loan.id}
              loan={loan}
              collateralValue={getCollateralValue(loan)}
              onRepay={() => handleRepay(loan.id)}
            />
          ))}
        </div>
      )}

      {/* Loan Products by Layer */}
      <div className="loanProductsSection">
        <h3 className="sectionTitle">Borrow Against Your Assets</h3>

        <LoanProductCard
          layer="FOUNDATION"
          maxLtv={70}
          apr={30}
          assets={['USDT', 'PAXG']}
          onSelect={() => handleNewLoan('FOUNDATION')}
        />

        <LoanProductCard
          layer="GROWTH"
          maxLtv={50}
          apr={30}
          assets={['BTC', 'ETH', 'BNB', 'XRP']}
          onSelect={() => handleNewLoan('GROWTH')}
        />

        <LoanProductCard
          layer="UPSIDE"
          maxLtv={30}
          apr={30}
          assets={['SOL', 'TON', 'LINK', 'AVAX']}
          onSelect={() => handleNewLoan('UPSIDE')}
        />
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
