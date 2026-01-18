import React, { useMemo } from 'react';
import { formatIRR, getAssetDisplayName } from '../../helpers';
import { LOAN_INTEREST_RATE, COLLATERAL_LTV_BY_LAYER } from '../../constants/index';
import { ASSET_LAYER } from '../../state/domain';
import type { Loan, Layer } from '../../types';

interface ActiveLoanCardProps {
  loan: Loan;
  collateralValue: number;
  onRepay: () => void;
}

/**
 * ActiveLoanCard - Enhanced loan card with countdown circle, health bar, and interest display
 */
function ActiveLoanCard({ loan, collateralValue, onRepay }: ActiveLoanCardProps) {
  // Calculate days remaining and progress
  const { daysRemaining, totalDays, daysElapsed, progressPct } = useMemo(() => {
    const now = new Date();
    const start = new Date(loan.startISO);
    const maturity = new Date(start);
    maturity.setMonth(maturity.getMonth() + (loan.durationMonths || 3));

    const remaining = Math.max(0, Math.ceil((maturity.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const total = (loan.durationMonths || 3) * 30;
    const elapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const progress = Math.min(100, (elapsed / total) * 100);

    return { daysRemaining: remaining, totalDays: total, daysElapsed: elapsed, progressPct: progress };
  }, [loan.startISO, loan.durationMonths]);

  // Calculate interest details
  const { accruedInterest, totalInterest, totalDue } = useMemo(() => {
    const dailyRate = LOAN_INTEREST_RATE / 365;
    const accrued = Math.floor(loan.amountIRR * dailyRate * daysElapsed);
    const total = Math.floor(loan.amountIRR * (LOAN_INTEREST_RATE / 12) * (loan.durationMonths || 3));
    return {
      accruedInterest: accrued,
      totalInterest: total,
      totalDue: loan.amountIRR + total,
    };
  }, [loan.amountIRR, loan.durationMonths, daysElapsed]);

  // Calculate loan health (LTV)
  const { currentLtv, maxLtv, healthPct, healthStatus } = useMemo(() => {
    const layer = ASSET_LAYER[loan.collateralAssetId] as Layer;
    const max = (COLLATERAL_LTV_BY_LAYER[layer] || 0.3) * 100;
    const current = collateralValue > 0 ? (loan.amountIRR / collateralValue) * 100 : 0;
    // Health is inverse of LTV ratio: higher health = safer
    const health = Math.max(0, Math.min(100, 100 - (current / max) * 100));

    let status: 'healthy' | 'caution' | 'warning' | 'danger' = 'healthy';
    if (health <= 20) status = 'danger';
    else if (health <= 40) status = 'warning';
    else if (health <= 60) status = 'caution';

    return { currentLtv: current, maxLtv: max, healthPct: health, healthStatus: status };
  }, [loan.amountIRR, loan.collateralAssetId, collateralValue]);

  // Calculate maturity date
  const maturityDate = useMemo(() => {
    const start = new Date(loan.startISO);
    const maturity = new Date(start);
    maturity.setMonth(maturity.getMonth() + (loan.durationMonths || 3));
    return maturity.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [loan.startISO, loan.durationMonths]);

  // Calculate liquidation price per unit
  const liquidationPricePerUnit = useMemo(() => {
    if (!loan.collateralQuantity || loan.collateralQuantity <= 0) return null;
    return Math.floor(loan.amountIRR / loan.collateralQuantity);
  }, [loan.amountIRR, loan.collateralQuantity]);

  // SVG circle calculations (circumference = 2 * PI * radius)
  const radius = 45;
  const circumference = 2 * Math.PI * radius; // ~282.74
  const strokeDasharray = `${(progressPct / 100) * circumference} ${circumference}`;

  return (
    <div className="activeLoanCardEnhanced">
      {/* Header with countdown circle */}
      <div className="loanCardHeader">
        <div className="countdownCircle">
          <svg viewBox="0 0 100 100" className="countdownSvg">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--bg-tertiary)"
              strokeWidth="8"
            />
            {/* Progress circle */}
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
          <div className="loanInterestBadge">{Math.round(LOAN_INTEREST_RATE * 100)}% annual</div>
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

      {/* Loan Health Bar */}
      <div className="loanHealthSection">
        <div className="healthHeader">
          <span className="healthLabel">Loan Health</span>
          <span className="healthLtv">LTV: {currentLtv.toFixed(0)}% / {maxLtv}%</span>
        </div>
        <div className="healthBarContainer">
          <div
            className={`healthBar ${healthStatus}`}
            style={{ width: `${healthPct}%` }}
          />
        </div>
        <div className="healthMetrics">
          <span>Collateral: {formatIRR(collateralValue)}</span>
          <span className="liquidationLabel">
            Liquidation: <span className="danger">{formatIRR(loan.amountIRR)}</span>
          </span>
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
        {liquidationPricePerUnit && (
          <div className="detailRow">
            <span className="detailLabel">Liquidation price</span>
            <span className="detailValue danger">
              {formatIRR(liquidationPricePerUnit)} / unit
            </span>
          </div>
        )}
      </div>

      {/* Repay Button */}
      <button className="repayButton" onClick={onRepay}>
        Repay Loan
      </button>
    </div>
  );
}

export default React.memo(ActiveLoanCard);
