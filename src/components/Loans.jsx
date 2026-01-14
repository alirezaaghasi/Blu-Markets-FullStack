import React from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers.js';

/**
 * Loans - Active loans list with LTV health indicators
 * Shows loan details, collateral, liquidation thresholds
 */
function Loans({ loans, dispatch }) {
  const loanList = loans || [];

  if (loanList.length === 0) {
    return (
      <div className="card">
        <h3>Active Loans</h3>
        <div className="muted">No active loans.</div>
      </div>
    );
  }

  const getLoanStatus = (loan) => {
    const ltvPercent = (loan.amountIRR / loan.liquidationIRR) * 100;
    if (ltvPercent > 75) return { level: 'critical', message: '🔴 Liquidation risk — repay or add collateral' };
    if (ltvPercent > 60) return { level: 'warning', message: '⚠️ Monitor collateral' };
    return null;
  };

  const totalLoanAmount = loanList.reduce((sum, l) => sum + l.amountIRR, 0);

  return (
    <div className="card">
      <h3>Active Loans ({loanList.length})</h3>
      {loanList.length > 1 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total borrowed: </span>
          <span style={{ fontWeight: 600 }}>{formatIRR(totalLoanAmount)}</span>
        </div>
      )}
      <div className="list">
        {loanList.map((loan) => {
          const status = getLoanStatus(loan);
          return (
            <div
              key={loan.id}
              className="item loanItem"
              style={{ marginBottom: 12, padding: '12px', borderRadius: 8, background: 'var(--bg-secondary)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="loanAmount">{formatIRR(loan.amountIRR)}</div>
                  <div className="loanDetails">Collateral: {getAssetDisplayName(loan.collateralAssetId)}</div>
                  <div className="loanUsage">LTV: {Math.round(loan.ltv * 100)}%</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="liquidationValue">{formatIRR(loan.liquidationIRR)}</div>
                  <div className="muted">Liquidation</div>
                </div>
              </div>
              {status && (
                <div
                  className={`loanStatus loanStatus${status.level.charAt(0).toUpperCase() + status.level.slice(1)}`}
                  style={{ marginBottom: 8 }}
                >
                  {status.message}
                </div>
              )}
              <button
                className="btn primary"
                style={{ width: '100%' }}
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
