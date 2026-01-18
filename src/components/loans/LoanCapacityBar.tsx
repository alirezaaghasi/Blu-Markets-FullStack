import React from 'react';
import { formatIRR } from '../../helpers';

interface LoanCapacityBarProps {
  used: number;
  max: number;
  remaining: number;
}

function LoanCapacityBar({ used, max, remaining }: LoanCapacityBarProps) {
  const usedPct = max > 0 ? (used / max) * 100 : 0;

  const getBarClass = () => {
    if (usedPct >= 90) return 'danger';
    if (usedPct >= 75) return 'warning';
    if (usedPct >= 50) return 'caution';
    return '';
  };

  return (
    <div className="loanCapacitySection">
      <div className="capacityHeader">
        <span className="capacityLabel">Portfolio Loan Capacity</span>
        <span className="capacityValue">
          {formatIRR(used)} / {formatIRR(max)}
        </span>
      </div>
      <div className="capacityBarContainer">
        <div
          className={`capacityBar ${getBarClass()}`}
          style={{ width: `${Math.min(100, usedPct)}%` }}
        />
      </div>
      <div className="capacityHint">
        {remaining > 0
          ? `${formatIRR(remaining)} available (25% of portfolio)`
          : 'Portfolio loan limit reached'}
      </div>
    </div>
  );
}

export default LoanCapacityBar;
