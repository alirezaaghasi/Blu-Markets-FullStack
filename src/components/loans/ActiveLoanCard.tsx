import React from 'react';
import { formatIRR, getAssetDisplayName } from '../../helpers';
import { LOAN_INTEREST_RATE } from '../../constants/index';
import { useLoanCalculations } from '../../hooks/useLoanCalculations';
import type { Loan } from '../../types';

interface ActiveLoanCardProps {
  loan: Loan;
  onRepay: () => void;
}

/**
 * ActiveLoanCard - Loan card with countdown circle and interest display
 * Uses shared useLoanCalculations hook to eliminate duplicate date calculations
 */
function ActiveLoanCard({ loan, onRepay }: ActiveLoanCardProps) {
  const calc = useLoanCalculations(loan);

  // SVG circle calculations (circumference = 2 * PI * radius)
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = calc
    ? `${(calc.progressPct / 100) * circumference} ${circumference}`
    : `0 ${circumference}`;

  if (!calc) return null;

  return (
    <div className="activeLoanCardEnhanced">
      {/* Header with countdown circle */}
      <div className="loanCardHeader">
        <div className="countdownCircle">
          <svg viewBox="0 0 100 100" className="countdownSvg">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--bg-tertiary)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="8"
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="countdownContent">
            <span className="countdownDays">{calc.daysRemaining}</span>
            <span className="countdownLabel">days left</span>
          </div>
        </div>

        <div className="loanHeaderInfo">
          <div className="loanCollateralName">
            {getAssetDisplayName(loan.collateralAssetId)} Collateral
          </div>
          <div className="loanBorrowedAmount">{formatIRR(loan.amountIRR)}</div>
          <div className="loanBadges">
            <div className="loanInterestBadge">{Math.round(LOAN_INTEREST_RATE * 100)}% annual</div>
            {loan.installments && loan.installments.length > 0 && (
              <div className="installmentBadge">
                {loan.installmentsPaid || 0} / 6 paid
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interest Summary */}
      <div className="interestSummary">
        <div className="interestBox">
          <div className="interestLabel">Accrued Interest</div>
          <div className="interestValue">{formatIRR(calc.accruedInterest)}</div>
        </div>
        <div className="interestDivider" />
        <div className="interestBox">
          <div className="interestLabel">Total at Maturity</div>
          <div className="interestValue">{formatIRR(calc.totalAtMaturity)}</div>
        </div>
      </div>

      {/* Loan Details */}
      <div className="loanDetailsSection">
        <div className="detailRow">
          <span className="detailLabel">Duration</span>
          <span className="detailValue">{loan.durationMonths || 3} months</span>
        </div>
        <div className="detailRow">
          <span className="detailLabel">Maturity</span>
          <span className="detailValue">{calc.maturityDate}</span>
        </div>
      </div>

      {/* Repay Button */}
      <button className="repayButton" onClick={onRepay}>
        Repay Loan
      </button>
    </div>
  );
}

export default React.memo(ActiveLoanCard);
