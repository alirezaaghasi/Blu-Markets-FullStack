import React, { useMemo, Dispatch } from 'react';
import { formatIRR, getAssetDisplayName, getHoldingValueIRR } from '../../helpers';
import { LOAN_INTEREST_RATE, COLLATERAL_LTV_BY_LAYER } from '../../constants/index';
import { ASSET_LAYER } from '../../state/domain';
import LoanHealthBar from './LoanHealthBar';
import type { Loan, Holding, Layer, AppAction } from '../../types';

interface ActiveLoanDetailProps {
  loan: Loan;
  holding: Holding | undefined;
  prices: Record<string, number>;
  fxRate: number;
  dispatch: Dispatch<AppAction>;
  onBack: () => void;
}

function ActiveLoanDetail({
  loan,
  holding,
  prices,
  fxRate,
  dispatch,
  onBack,
}: ActiveLoanDetailProps) {
  // Calculate days remaining
  const daysRemaining = useMemo(() => {
    const startDate = new Date(loan.startISO);
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + (loan.durationMonths || 3));
    return Math.max(0, Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }, [loan.startISO, loan.durationMonths]);

  // Calculate accrued interest (time-based)
  const interestDetails = useMemo(() => {
    const startDate = new Date(loan.startISO);
    const now = new Date();
    const daysElapsed = Math.max(0, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const dailyRate = LOAN_INTEREST_RATE / 365;
    const accruedInterest = Math.floor(loan.amountIRR * dailyRate * daysElapsed);

    const totalDays = (loan.durationMonths || 3) * 30;
    const totalInterest = Math.floor(loan.amountIRR * (LOAN_INTEREST_RATE / 12) * (loan.durationMonths || 3));
    const totalDue = loan.amountIRR + totalInterest;

    // Early repayment = principal + accrued interest
    const earlyRepayment = loan.amountIRR + accruedInterest;
    const interestSaved = totalInterest - accruedInterest;

    return {
      accruedInterest,
      totalInterest,
      totalDue,
      earlyRepayment,
      interestSaved,
    };
  }, [loan.amountIRR, loan.startISO, loan.durationMonths]);

  // Collateral details
  const collateralDetails = useMemo(() => {
    if (!holding) return null;
    const valueIRR = getHoldingValueIRR(holding, prices, fxRate);
    const layer = ASSET_LAYER[loan.collateralAssetId] as Layer;
    const maxLtv = (COLLATERAL_LTV_BY_LAYER[layer] || 0.3) * 100;
    return {
      quantity: holding.quantity,
      valueIRR,
      maxLtv,
    };
  }, [holding, prices, fxRate, loan.collateralAssetId]);

  const handleRepay = () => {
    dispatch({ type: 'START_REPAY', loanId: loan.id });
  };

  const startDateStr = new Date(loan.startISO).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="loanDetailView">
      {/* Header */}
      <div className="loanDetailNav">
        <button className="backBtn" onClick={onBack}>
          ← Back
        </button>
        <span className="loanDetailTitle">Loan Details</span>
      </div>

      {/* Countdown Circle */}
      <div className="loanDetailHeader">
        <div className="countdownCircle">
          <span className="countdownDays">{daysRemaining}</span>
          <span className="countdownLabel">days remaining</span>
        </div>

        <div className="loanPrincipal">{formatIRR(loan.amountIRR)}</div>
        <div className="loanStartDate">Borrowed {startDateStr}</div>

        <div className="interestSummary">
          <div className="interestBox">
            <div className="interestLabel">Accrued Interest</div>
            <div className="interestValue">{formatIRR(interestDetails.accruedInterest)}</div>
          </div>
          <div className="interestBox">
            <div className="interestLabel">Total Due at Maturity</div>
            <div className="interestValue">{formatIRR(interestDetails.totalDue)}</div>
          </div>
        </div>
      </div>

      {/* Collateral Card */}
      {collateralDetails && (
        <div className="collateralCard">
          <div className="collateralCardHeader">
            <span className="lockIcon">🔒</span>
            <span className="collateralName">{getAssetDisplayName(loan.collateralAssetId)}</span>
          </div>
          <div className="collateralDetails">
            <div>{collateralDetails.quantity} units locked</div>
            <div>Current value: {formatIRR(collateralDetails.valueIRR)}</div>
          </div>
        </div>
      )}

      {/* Loan Health */}
      {collateralDetails && (
        <LoanHealthBar
          loanAmount={loan.amountIRR}
          collateralValue={collateralDetails.valueIRR}
          liquidationValue={loan.amountIRR}
          maxLtv={collateralDetails.maxLtv}
        />
      )}

      {/* Repayment Summary */}
      <div className="repaymentSummary">
        <div className="summaryTitle">Repayment Options</div>
        <div className="summaryRow">
          <span>Repay now (early)</span>
          <span>{formatIRR(interestDetails.earlyRepayment)}</span>
        </div>
        <div className="summaryRow earlyRepayDiscount">
          <span>Interest saved</span>
          <span>{formatIRR(interestDetails.interestSaved)}</span>
        </div>
        <div className="summaryRow total">
          <span>At maturity</span>
          <span>{formatIRR(interestDetails.totalDue)}</span>
        </div>
      </div>

      {/* Repay Button */}
      <button className="btn primary repayLoanBtn" onClick={handleRepay}>
        Repay Loan
      </button>
    </div>
  );
}

export default ActiveLoanDetail;
