// Borrow System - Collateralized lending against portfolio
// LTV (Loan-to-Value) ratios determine borrowing capacity

export const LOAN_STATUS = {
  NONE: 'NONE',
  HEALTHY: 'HEALTHY',       // LTV < 50%
  MODERATE: 'MODERATE',     // LTV 50-70%
  AT_RISK: 'AT_RISK',       // LTV 70-85%
  LIQUIDATION: 'LIQUIDATION', // LTV > 85%
};

const MAX_LTV = 0.70; // 70% max loan-to-value
const LIQUIDATION_LTV = 0.85; // 85% triggers liquidation warning

export function calculateBorrowingCapacity(portfolio) {
  // Collateral value is the portfolio total minus cash
  // (Can't borrow against cash)
  const holdings = portfolio.holdings || [];
  const nonCashValue = holdings
    .filter(h => h.asset !== 'CASH')
    .reduce((sum, h) => sum + h.amountIRR, 0);

  const maxBorrow = Math.floor(nonCashValue * MAX_LTV);

  return {
    collateralValue: nonCashValue,
    portfolioTotal: portfolio.totalIRR,
    maxBorrowable: maxBorrow,
    ltvLimit: MAX_LTV * 100,
  };
}

export function createLoan(portfolio, borrowAmountIRR, existingLoan = null) {
  const capacity = calculateBorrowingCapacity(portfolio);
  const currentBorrowed = existingLoan?.borrowedIRR || 0;
  const newTotal = currentBorrowed + borrowAmountIRR;

  if (newTotal > capacity.maxBorrowable) {
    return {
      success: false,
      error: `Cannot borrow ${borrowAmountIRR.toLocaleString('en-US')} IRR. Max available: ${(capacity.maxBorrowable - currentBorrowed).toLocaleString('en-US')} IRR`,
    };
  }

  const loan = {
    borrowedIRR: newTotal,
    collateralIRR: capacity.collateralValue,
    createdAt: existingLoan?.createdAt || Date.now(),
    lastUpdated: Date.now(),
  };

  return { success: true, loan };
}

export function repayLoan(loan, repayAmountIRR) {
  if (!loan || loan.borrowedIRR === 0) {
    return { success: false, error: 'No outstanding loan' };
  }

  const repayAmount = Math.min(repayAmountIRR, loan.borrowedIRR);
  const newBorrowed = loan.borrowedIRR - repayAmount;

  return {
    success: true,
    loan: newBorrowed > 0 ? {
      ...loan,
      borrowedIRR: newBorrowed,
      lastUpdated: Date.now(),
    } : null,
    repaid: repayAmount,
  };
}

export function getLoanStatus(portfolio, loan) {
  if (!loan || loan.borrowedIRR === 0) {
    return { status: LOAN_STATUS.NONE, ltv: 0, message: null };
  }

  const capacity = calculateBorrowingCapacity(portfolio);
  const ltv = loan.borrowedIRR / capacity.collateralValue;
  const ltvPct = Math.round(ltv * 100);

  if (ltv >= LIQUIDATION_LTV) {
    return {
      status: LOAN_STATUS.LIQUIDATION,
      ltv: ltvPct,
      message: `⚠️ LIQUIDATION RISK: LTV at ${ltvPct}%. Repay loan or add collateral immediately.`,
      borrowedIRR: loan.borrowedIRR,
      collateralIRR: capacity.collateralValue,
    };
  }

  if (ltv >= 0.70) {
    return {
      status: LOAN_STATUS.AT_RISK,
      ltv: ltvPct,
      message: `Warning: LTV at ${ltvPct}%. Consider repaying some of your loan.`,
      borrowedIRR: loan.borrowedIRR,
      collateralIRR: capacity.collateralValue,
    };
  }

  if (ltv >= 0.50) {
    return {
      status: LOAN_STATUS.MODERATE,
      ltv: ltvPct,
      message: `Loan active. LTV: ${ltvPct}%.`,
      borrowedIRR: loan.borrowedIRR,
      collateralIRR: capacity.collateralValue,
    };
  }

  return {
    status: LOAN_STATUS.HEALTHY,
    ltv: ltvPct,
    message: `Loan healthy. LTV: ${ltvPct}%.`,
    borrowedIRR: loan.borrowedIRR,
    collateralIRR: capacity.collateralValue,
  };
}
