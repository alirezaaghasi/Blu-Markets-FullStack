import React, { useMemo, Dispatch } from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers';
import { selectHoldingsById, selectLoanSummary, selectLoanHealth } from '../selectors/index';
import type { Loan, Holding, AppAction } from '../types';

/**
 * Calculate liquidation price in IRR for a loan
 */
function getLiquidationPriceIRR(loan: Loan, quantity: number | undefined): number | null {
  if (!quantity || quantity <= 0) return null;
  return loan.liquidationIRR / quantity;
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
  const usedPercent = (loan.amountIRR / loan.liquidationIRR) * 100;
  const health = selectLoanHealth(usedPercent);
  const liquidationPrice = getLiquidationPriceIRR(loan, holdingQuantity);

  return (
    <div className={`loanCard ${health.level}`}>
      <div className="loanCardHeader">
        <div className="loanCardTitle">
          <span className="loanLabel">LOAN</span>
          <span className="loanCollateral">{getAssetDisplayName(loan.collateralAssetId)} Collateral</span>
        </div>
      </div>

      <div className="loanCardAmount">
        <span className="amountLabel">Borrowed:</span>
        <span className="amountValue">{formatIRR(loan.amountIRR)}</span>
      </div>

      {/* Health bar */}
      <div className="loanHealthSection">
        <div className="healthBarTrack">
          <div
            className="healthBarFill"
            style={{ width: `${Math.min(100, usedPercent)}%`, background: health.color }}
          />
        </div>
        <div className="healthLabelRow">
          <span className="healthPercent">{Math.round(usedPercent)}% used</span>
          <span className="healthLimit">Limit: {formatIRR(loan.liquidationIRR)}</span>
        </div>
      </div>

      {/* Liquidation price display */}
      {liquidationPrice && (
        <div className="loanLiquidation">
          <div className="liquidationRow">
            <span className="liquidationLabel">Liquidation price:</span>
            <span className="liquidationPrice">{formatIRR(liquidationPrice)}</span>
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
