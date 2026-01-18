import React, { useState, useMemo } from 'react';
import { formatIRR, getAssetDisplayName } from '../../helpers';
import { LOAN_INTEREST_RATE } from '../../constants/index';
import type { Loan } from '../../types';

type RepayOption = 'NOW' | 'AT_MATURITY' | 'CUSTOM';

interface RepaymentPanelProps {
  loan: Loan;
  cashAvailable: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

/**
 * RepaymentPanel - Three repayment options with interest breakdown
 * Options: Repay Now (early), At Maturity, Custom amount
 */
function RepaymentPanel({ loan, cashAvailable, onConfirm, onCancel }: RepaymentPanelProps) {
  const [selectedOption, setSelectedOption] = useState<RepayOption>('NOW');
  const [customAmount, setCustomAmount] = useState<number>(loan.amountIRR);

  // Calculate interest details
  const {
    accruedInterest,
    totalInterest,
    earlyRepayAmount,
    maturityAmount,
    interestSaved,
    daysElapsed,
    totalDays,
  } = useMemo(() => {
    const now = new Date();
    const start = new Date(loan.startISO);
    const maturity = new Date(start);
    maturity.setMonth(maturity.getMonth() + (loan.durationMonths || 3));

    const total = Math.ceil((maturity.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const elapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    const dailyRate = LOAN_INTEREST_RATE / 365;
    const accrued = Math.floor(loan.amountIRR * dailyRate * elapsed);
    const totalInt = Math.floor(loan.amountIRR * dailyRate * total);

    return {
      accruedInterest: accrued,
      totalInterest: totalInt,
      earlyRepayAmount: loan.amountIRR + accrued,
      maturityAmount: loan.amountIRR + totalInt,
      interestSaved: totalInt - accrued,
      daysElapsed: elapsed,
      totalDays: total,
    };
  }, [loan.amountIRR, loan.startISO, loan.durationMonths]);

  // Get repay amount based on selected option
  const getRepayAmount = () => {
    switch (selectedOption) {
      case 'NOW':
        return earlyRepayAmount;
      case 'AT_MATURITY':
        return maturityAmount;
      case 'CUSTOM':
        return customAmount;
    }
  };

  const repayAmount = getRepayAmount();
  const canRepay = cashAvailable >= repayAmount;
  const afterRepayment = cashAvailable - repayAmount;

  // Calculate installment info for custom slider
  const minPayment = Math.floor(loan.amountIRR / 6);
  const installmentCount = Math.ceil(customAmount / minPayment);

  return (
    <div className="repaymentPanel">
      <h3 className="panelTitle">Repay Loan</h3>

      {/* Repayment Options */}
      <div className="repaymentOptions">
        <div className="optionLabel">Repayment Type</div>

        <div className="optionButtons">
          <button
            className={`optionBtn ${selectedOption === 'NOW' ? 'selected' : ''}`}
            onClick={() => setSelectedOption('NOW')}
          >
            <span className="optionTitle">Repay Now</span>
            <span className="optionSubtitle">Save on interest</span>
          </button>

          <button
            className={`optionBtn ${selectedOption === 'AT_MATURITY' ? 'selected' : ''}`}
            onClick={() => setSelectedOption('AT_MATURITY')}
          >
            <span className="optionTitle">At Maturity</span>
            <span className="optionSubtitle">Full term</span>
          </button>

          <button
            className={`optionBtn ${selectedOption === 'CUSTOM' ? 'selected' : ''}`}
            onClick={() => setSelectedOption('CUSTOM')}
          >
            <span className="optionTitle">Custom</span>
            <span className="optionSubtitle">Choose amount</span>
          </button>
        </div>
      </div>

      {/* Custom Amount Slider */}
      {selectedOption === 'CUSTOM' && (
        <div className="customAmountSection">
          <div className="customAmountHeader">
            <span>Payment amount</span>
            <span>{formatIRR(customAmount)}</span>
          </div>
          <input
            type="range"
            className="customSlider"
            min={minPayment}
            max={maturityAmount}
            step={minPayment}
            value={customAmount}
            onChange={(e) => setCustomAmount(Number(e.target.value))}
          />
          <div className="sliderLabels">
            <span>Min</span>
            <span>Max</span>
          </div>
        </div>
      )}

      {/* Payment Breakdown */}
      <div className="paymentBreakdown">
        <div className="breakdownRow">
          <span>Principal</span>
          <span>{formatIRR(loan.amountIRR)}</span>
        </div>

        {selectedOption === 'NOW' && (
          <>
            <div className="breakdownRow">
              <span>Accrued interest ({daysElapsed} days)</span>
              <span>{formatIRR(accruedInterest)}</span>
            </div>
            <div className="breakdownRow savings">
              <span>Interest saved</span>
              <span className="savingsValue">-{formatIRR(interestSaved)}</span>
            </div>
          </>
        )}

        {selectedOption === 'AT_MATURITY' && (
          <div className="breakdownRow">
            <span>Total interest ({totalDays} days)</span>
            <span>{formatIRR(totalInterest)}</span>
          </div>
        )}

        {selectedOption === 'CUSTOM' && (
          <div className="breakdownRow">
            <span>Custom payment</span>
            <span>{formatIRR(customAmount - loan.amountIRR)}</span>
          </div>
        )}

        <div className="breakdownRow total">
          <span>Amount to pay</span>
          <span>{formatIRR(repayAmount)}</span>
        </div>
      </div>

      {/* Cash Available */}
      <div className="cashAvailableSection">
        <div className="cashRow">
          <span>Cash available</span>
          <span>{formatIRR(cashAvailable)}</span>
        </div>
        <div className="cashRow">
          <span>After repayment</span>
          <span className={afterRepayment < 0 ? 'danger' : ''}>
            {formatIRR(Math.max(0, afterRepayment))}
          </span>
        </div>
      </div>

      {/* After Repayment Note */}
      <div className="repaymentNote">
        Your {getAssetDisplayName(loan.collateralAssetId)} will be unlocked after repayment
      </div>

      {/* Actions */}
      <div className="panelActions">
        <button
          className="btn primary confirmBtn"
          onClick={() => onConfirm(repayAmount)}
          disabled={!canRepay}
        >
          {canRepay ? 'Confirm Repayment' : 'Insufficient Cash'}
        </button>
        <button className="btn cancelBtn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default React.memo(RepaymentPanel);
