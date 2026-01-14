import React, { useMemo } from 'react';
import { formatIRR, formatUSD, getAssetDisplayName } from '../helpers.js';

/**
 * Loans - Active loans list with LTV health indicators
 * Decision 11: Shows liquidation price in USD with explanation
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
    if (usedPercent >= 75) return { level: 'critical', color, message: `If ${getAssetDisplayName(loan.collateralAssetId)} drops ${Math.round(100 - usedPercent)}%, this loan will auto-close.` };
    if (usedPercent >= 65) return { level: 'warning', color, message: 'Close to limit. Consider repaying soon.' };
    if (usedPercent >= 50) return { level: 'caution', color, message: null };
    return { level: 'healthy', color, message: null };
  };

  // Decision 11: Calculate liquidation price in USD for each loan
  const getLiquidationPriceUSD = (loan) => {
    const holding = holdings?.find(h => h.assetId === loan.collateralAssetId);
    if (!holding || holding.quantity <= 0 || !fxRate) return null;
    // Liquidation price = (liquidationIRR / fxRate) / quantity
    return loan.liquidationIRR / fxRate / holding.quantity;
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

              {/* Decision 11: Liquidation price with explanation */}
              {(() => {
                const liquidationPrice = getLiquidationPriceUSD(loan);
                if (!liquidationPrice) return null;
                return (
                  <div className="loanLiquidation">
                    <div className="liquidationRow">
                      <span className="liquidationLabel">Liquidation price:</span>
                      <span className="liquidationPrice">{formatUSD(liquidationPrice)}</span>
                    </div>
                    <p className="liquidationExplain">
                      If {getAssetDisplayName(loan.collateralAssetId)} drops below this price, your collateral will be sold.
                    </p>
                  </div>
                );
              })()}

              {/* Warning message if applicable */}
              {health.message && (
                <div className={`loanWarning ${health.level}`}>
                  <span className="warningIcon">{health.level === 'critical' ? '⛔' : '⚠'}</span>
                  <span className="warningText">{health.message}</span>
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
        })}
      </div>
    </div>
  );
}

export default React.memo(Loans);
