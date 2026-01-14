import React, { useMemo } from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers.js';

/**
 * Loans - Active loans list with LTV health indicators
 * Decision 11: Shows liquidation price in IRR with explanation
 */
function Loans({ loans, holdings, prices, fxRate, dispatch }) {
  const loanList = loans || [];

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

  // Issue 5: Enhanced loan status - monochrome health bar
  const getLoanHealth = (loan) => {
    const usedPercent = (loan.amountIRR / loan.liquidationIRR) * 100;
    // All bars use blue - percentage tells the story
    const color = '#3B82F6';
    if (usedPercent >= 75) return { level: 'critical', color };
    if (usedPercent >= 65) return { level: 'warning', color };
    if (usedPercent >= 50) return { level: 'caution', color };
    return { level: 'healthy', color };
  };

  // Decision 11: Calculate liquidation price in IRR for each loan
  const getLiquidationPriceIRR = (loan) => {
    const holding = holdings?.find(h => h.assetId === loan.collateralAssetId);
    if (!holding || holding.quantity <= 0) return null;
    // Liquidation price per unit in IRR = liquidationIRR / quantity
    return loan.liquidationIRR / holding.quantity;
  };

  const totalLoanAmount = useMemo(
    () => loanList.reduce((sum, l) => sum + l.amountIRR, 0),
    [loanList]
  );

  // Issue 17: Consolidate loan header - just show title, total in subtitle
  return (
    <div className="card">
      <h3>Your Loans</h3>
      <div className="loanHeaderSummary">
        Total borrowed: <strong>{formatIRR(totalLoanAmount)}</strong>
      </div>
      {/* Issue 5: Redesigned loan cards with health bar */}
      <div className="loanCards">
        {loanList.map((loan) => {
          const health = getLoanHealth(loan);
          const usedPercent = (loan.amountIRR / loan.liquidationIRR) * 100;

          return (
            <div key={loan.id} className={`loanCard ${health.level}`}>
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
              {(() => {
                const liquidationPrice = getLiquidationPriceIRR(loan);
                if (!liquidationPrice) return null;
                return (
                  <div className="loanLiquidation">
                    <div className="liquidationRow">
                      <span className="liquidationLabel">Liquidation price:</span>
                      <span className="liquidationPrice">{formatIRR(liquidationPrice)}</span>
                    </div>
                  </div>
                );
              })()}


              <button
                className="btn primary"
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => dispatch({ type: 'START_REPAY', loanId: loan.id })}
              >
                Repay
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(Loans);
