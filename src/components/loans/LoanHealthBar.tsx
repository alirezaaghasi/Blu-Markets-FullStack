import React from 'react';
import { formatIRR } from '../../helpers';

interface LoanHealthBarProps {
  loanAmount: number;
  collateralValue: number;
  liquidationValue: number;
  maxLtv: number;
}

function LoanHealthBar({
  loanAmount,
  collateralValue,
  liquidationValue,
  maxLtv,
}: LoanHealthBarProps) {
  const currentLtv = collateralValue > 0 ? (loanAmount / collateralValue) * 100 : 0;

  // Health percentage: how far from liquidation
  // 100% = safe (collateral >> loan), 0% = liquidation imminent
  const healthPct =
    collateralValue > 0
      ? Math.max(0, Math.min(100, ((collateralValue - loanAmount) / collateralValue) * 100))
      : 0;

  const getHealthColor = () => {
    if (healthPct > 60) return 'healthy';
    if (healthPct > 40) return 'caution';
    if (healthPct > 20) return 'warning';
    return 'danger';
  };

  return (
    <div className="loanHealthSection">
      <div className="loanHealthHeader">Loan Health</div>

      <div className="loanHealthBarContainer">
        <div
          className={`loanHealthBar ${getHealthColor()}`}
          style={{ width: `${healthPct}%` }}
        />
      </div>

      <div className="loanHealthMetrics">
        <div className="healthMetricRow">
          <span className="healthMetricLabel">Loan amount</span>
          <span className="healthMetricValue">{formatIRR(loanAmount)}</span>
        </div>
        <div className="healthMetricRow">
          <span className="healthMetricLabel">Collateral value</span>
          <span className="healthMetricValue">{formatIRR(collateralValue)}</span>
        </div>
        <div className="healthMetricRow">
          <span className="healthMetricLabel">Liquidation at</span>
          <span className="healthMetricValue danger">{formatIRR(liquidationValue)}</span>
        </div>
      </div>

      <div className="ltvDisplay">
        <span>
          Current LTV: <strong>{currentLtv.toFixed(0)}%</strong>
        </span>
        <span className="ltvDivider">│</span>
        <span>
          Max LTV: <strong>{maxLtv}%</strong>
        </span>
      </div>
    </div>
  );
}

export default LoanHealthBar;
