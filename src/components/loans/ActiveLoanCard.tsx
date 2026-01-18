import React, { useMemo } from 'react';
import { formatIRR, getAssetDisplayName } from '../../helpers';
import { LOAN_INTEREST_RATE } from '../../constants/index';
import type { Loan } from '../../types';

interface ActiveLoanCardProps {
  loan: Loan;
  onRepay: () => void;
}

/**
 * ActiveLoanCard - Loan card with countdown circle and interest display
 */
function ActiveLoanCard({ loan, onRepay }: ActiveLoanCardProps) {
  // Calculate days remaining and progress
  const { daysRemaining, daysElapsed, progressPct } = useMemo(() => {
    const now = new Date();
    const start = new Date(loan.startISO);
    const maturity = new Date(start);
    maturity.setMonth(maturity.getMonth() + (loan.durationMonths || 3));

    const remaining = Math.max(0, Math.ceil((maturity.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const total = (loan.durationMonths || 3) * 30;
    const elapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const progress = Math.min(100, (elapsed / total) * 100);

    return { daysRemaining: remaining, daysElapsed: elapsed, progressPct: progress };
  }, [loan.startISO, loan.durationMonths]);

  // Calculate interest details
  const { accruedInterest, totalDue } = useMemo(() => {
    const dailyRate = LOAN_INTEREST_RATE / 365;
    const accrued = Math.floor(loan.amountIRR * dailyRate * daysElapsed);
    const total = Math.floor(loan.amountIRR * (LOAN_INTEREST_RATE / 12) * (loan.durationMonths || 3));
    return {
      accruedInterest: accrued,
      totalDue: loan.amountIRR + total,
    };
  }, [loan.amountIRR, loan.durationMonths, daysElapsed]);

  // Calculate maturity date
  const maturityDate = useMemo(() => {
    const start = new Date(loan.startISO);
    const maturity = new Date(start);
    maturity.setMonth(maturity.getMonth() + (loan.durationMonths || 3));
    return maturity.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [loan.startISO, loan.durationMonths]);

  // SVG circle calculations (circumference = 2 * PI * radius)
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(progressPct / 100) * circumference} ${circumference}`;

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
            <span className="countdownDays">{daysRemaining}</span>
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
          <div className="interestValue">{formatIRR(accruedInterest)}</div>
        </div>
        <div className="interestDivider" />
        <div className="interestBox">
          <div className="interestLabel">Total at Maturity</div>
          <div className="interestValue">{formatIRR(totalDue)}</div>
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
          <span className="detailValue">{maturityDate}</span>
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
