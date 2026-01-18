import React, { useMemo, Dispatch } from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers';
import { selectHoldingsById, selectLoanSummary } from '../selectors/index';
import { LOAN_INTEREST_RATE } from '../constants/index';
import type { Loan, Holding, AppAction } from '../types';

/**
 * Calculate liquidation price in IRR for a loan
 * Liquidation happens when collateral value drops below loan amount
 */
function getLiquidationPriceIRR(loan: Loan, quantity: number | undefined): number | null {
  if (!quantity || quantity <= 0) return null;
  // Liquidation price = loan amount / quantity (not using liquidationIRR which was LTV-based)
  return loan.amountIRR / quantity;
}

// ============================================================================
// LOAN CARD COMPONENT (memoized for performance)
// ============================================================================

interface LoanCardProps {
  loan: Loan;
  holdingQuantity: number | undefined;
  dispatch: Dispatch<AppAction>;
}

const LoanCard = React.memo(function LoanCard({ loan, holdingQuantity, dispatch }: LoanCardProps) {
  const liquidationPrice = getLiquidationPriceIRR(loan, holdingQuantity);

  // Calculate maturity date from start date + duration
  const maturityDate = new Date(loan.startISO);
  maturityDate.setMonth(maturityDate.getMonth() + (loan.durationMonths || 3));
  const maturityStr = maturityDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="loanCard">
      <div className="loanCardHeader">
        <div className="loanCardTitle">
          <span className="loanLabel">LOAN</span>
          <span className="loanCollateral">{getAssetDisplayName(loan.collateralAssetId)} Collateral</span>
        </div>
      </div>

      <div className="loanCardAmount">
        <span className="amountLabel">Borrowed:</span>
        <span className="amountValue">{formatIRR(loan.amountIRR)}</span>
        <span className="interestRate">{Math.round(LOAN_INTEREST_RATE * 100)}% annual</span>
      </div>

      <div className="loanDetails">
        <div className="loanDetailRow">
          <span className="loanDetailLabel">Duration:</span>
          <span className="loanDetailValue">{loan.durationMonths || 3} months</span>
        </div>
        <div className="loanDetailRow">
          <span className="loanDetailLabel">Maturity:</span>
          <span className="loanDetailValue">{maturityStr}</span>
        </div>
      </div>

      {/* Liquidation price display */}
      {liquidationPrice && (
        <div className="loanLiquidation">
          <div className="liquidationRow">
            <span className="liquidationLabel">Liquidation price:</span>
            <span className="liquidationPrice">{formatIRR(liquidationPrice)} / unit</span>
          </div>
        </div>
      )}

      <button
        className="btn primary"
        style={{ width: '100%', marginTop: 12 }}
        onClick={() => dispatch({ type: 'START_REPAY', loanId: loan.id })}
      >
        Repay
      </button>
    </div>
  );
});

/**
 * Loans - Active loans list with LTV health indicators
 * Decision 11: Shows liquidation price in IRR with explanation
 *
 * Optimizations:
 * - Holdings lookup map (O(1) instead of O(n) per loan)
 * - Loan health calculations moved outside component
 * - Memoized loan data and total
 * - LoanCard component memoized
 */
interface LoansProps {
  loans: Loan[];
  holdings: Holding[];
  dispatch: Dispatch<AppAction>;
}

function Loans({ loans, holdings, dispatch }: LoansProps) {
  const loanList = loans || [];

  // Precompute holdings map for O(1) lookup - use selector
  const holdingsMap = useMemo(
    () => selectHoldingsById(holdings || []),
    [holdings]
  );

  // Memoize loan summary - use selector
  const { totalLoanAmount } = useMemo(
    () => selectLoanSummary(loanList),
    [loanList]
  );

  // Issue 18: Empty state with explanation and CTA
  if (loanList.length === 0) {
    return (
      <div className="card">
        <h3>Your Loans</h3>
        <div className="emptyState">
          <div className="emptyIcon">💰</div>
          <div className="emptyTitle">No active loans</div>
          <div className="emptyDescription">
            Borrow against your assets without selling them. Keep your investments while accessing cash.
          </div>
          <button className="btn primary" onClick={() => dispatch({ type: 'START_BORROW' })}>
            Borrow Funds
          </button>
        </div>
      </div>
    );
  }

  // Issue 17: Consolidate loan header - just show title, total in subtitle
  return (
    <div className="card">
      <h3>Your Loans</h3>
      <div className="loanHeaderSummary">
        Total borrowed: <strong>{formatIRR(totalLoanAmount)}</strong>
      </div>
      {/* Issue 5: Redesigned loan cards with health bar */}
      <div className="loanCards">
        {loanList.map((loan: Loan) => {
          const holding = holdingsMap.get(loan.collateralAssetId);
          return (
            <LoanCard
              key={loan.id}
              loan={loan}
              holdingQuantity={holding?.quantity}
              dispatch={dispatch}
            />
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(Loans);
