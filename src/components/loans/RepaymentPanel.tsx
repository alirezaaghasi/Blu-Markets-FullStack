import React, { useState, useMemo } from 'react';
import { formatIRR, getAssetDisplayName } from '../../helpers';
import { LOAN_INTEREST_RATE } from '../../constants/index';
import type { Loan } from '../../types';

type RepayOption = 'INSTALLMENT' | 'SETTLE' | 'CUSTOM';

interface RepaymentPanelProps {
  loan: Loan;
  cashAvailable: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

/**
 * RepaymentPanel - Installment-based repayment with progress tracking
 * Options: Pay Installment, Settle Loan, Custom (multi-installment)
 */
function RepaymentPanel({ loan, cashAvailable, onConfirm, onCancel }: RepaymentPanelProps) {
  const [selectedOption, setSelectedOption] = useState<RepayOption>('INSTALLMENT');
  const [customInstallments, setCustomInstallments] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'PAID'>('PENDING');

  // Get installment data
  const installments = loan.installments || [];
  const installmentsPaid = loan.installmentsPaid || 0;
  const totalPaid = loan.totalPaidIRR || 0;
  const originalAmount = loan.originalAmountIRR || loan.amountIRR;

  // Filter installments by status
  const pendingInstallments = installments.filter(i => i.status !== 'PAID');
  const paidInstallments = installments.filter(i => i.status === 'PAID');
  const nextInstallment = pendingInstallments[0];

  // Calculate amounts for each option
  const calculations = useMemo(() => {
    const now = new Date();
    const start = new Date(loan.startISO);
    const daysElapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyRate = LOAN_INTEREST_RATE / 365;

    // Accrued interest on remaining principal
    const accruedInterest = Math.floor(loan.amountIRR * dailyRate * daysElapsed);

    // Full term interest
    const maturity = new Date(start);
    maturity.setMonth(maturity.getMonth() + (loan.durationMonths || 3));
    const totalDays = Math.ceil((maturity.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const fullTermInterest = Math.floor(loan.amountIRR * dailyRate * totalDays);

    // Interest forgiveness for early settlement
    const interestForgiveness = Math.max(0, fullTermInterest - accruedInterest);

    // Settlement amount = remaining principal + accrued interest
    const settlementAmount = loan.amountIRR + accruedInterest;

    // Custom: sum of selected pending installments
    const customAmount = pendingInstallments
      .slice(0, customInstallments)
      .reduce((sum, i) => sum + i.totalIRR, 0);

    return {
      installmentAmount: nextInstallment?.totalIRR || 0,
      settlementAmount,
      interestForgiveness,
      accruedInterest,
      fullTermInterest,
      totalDays,
      daysElapsed,
      customAmount,
    };
  }, [loan, customInstallments, nextInstallment, pendingInstallments]);

  // Get repay amount based on selected option
  const getRepayAmount = () => {
    switch (selectedOption) {
      case 'INSTALLMENT':
        return calculations.installmentAmount;
      case 'SETTLE':
        return calculations.settlementAmount;
      case 'CUSTOM':
        return calculations.customAmount;
    }
  };

  const repayAmount = getRepayAmount();
  const canRepay = cashAvailable >= repayAmount && repayAmount > 0;
  const afterRepayment = cashAvailable - repayAmount;
  const maxCustomInstallments = pendingInstallments.length;

  // Will this payment unlock collateral?
  const willUnlockCollateral = selectedOption === 'SETTLE' ||
    (selectedOption === 'INSTALLMENT' && installmentsPaid === 5) ||
    (selectedOption === 'CUSTOM' && customInstallments === maxCustomInstallments);

  return (
    <div className="repaymentPanel">
      <h3 className="panelTitle">Repay Loan</h3>

      {/* Progress Indicator */}
      {installments.length > 0 && (
        <div className="installmentProgress">
          <div className="progressCircle">
            <span className="progressCount">{installmentsPaid}</span>
            <span className="progressTotal">of 6</span>
          </div>
          <div className="progressLabel">installments paid</div>
        </div>
      )}

      {/* Paid vs Remaining Summary */}
      <div className="paymentSummary">
        <div className="summaryBox">
          <div className="summaryLabel">Paid</div>
          <div className="summaryValue">{formatIRR(totalPaid)}</div>
        </div>
        <div className="summaryDivider" />
        <div className="summaryBox">
          <div className="summaryLabel">Remaining</div>
          <div className="summaryValue">{formatIRR(loan.amountIRR)}</div>
        </div>
      </div>

      {/* Payment Type Options */}
      <div className="repaymentOptions">
        <div className="optionLabel">Payment Type</div>

        <div className="optionButtons">
          <button
            className={`optionBtn ${selectedOption === 'INSTALLMENT' ? 'selected' : ''}`}
            onClick={() => setSelectedOption('INSTALLMENT')}
            disabled={!nextInstallment}
          >
            <span className="optionTitle">Pay Installment</span>
            <span className="optionSubtitle">
              {nextInstallment ? `#${nextInstallment.number}` : 'All paid'}
            </span>
          </button>

          <button
            className={`optionBtn ${selectedOption === 'SETTLE' ? 'selected' : ''}`}
            onClick={() => setSelectedOption('SETTLE')}
          >
            <span className="optionTitle">Settle Loan</span>
            <span className="optionSubtitle">Save interest</span>
          </button>

          <button
            className={`optionBtn ${selectedOption === 'CUSTOM' ? 'selected' : ''}`}
            onClick={() => setSelectedOption('CUSTOM')}
            disabled={pendingInstallments.length === 0}
          >
            <span className="optionTitle">Custom</span>
            <span className="optionSubtitle">Choose amount</span>
          </button>
        </div>
      </div>

      {/* Custom Installment Slider */}
      {selectedOption === 'CUSTOM' && maxCustomInstallments > 0 && (
        <div className="customAmountSection">
          <div className="customAmountHeader">
            <span>Number of installments</span>
            <span>{customInstallments} installment{customInstallments > 1 ? 's' : ''}</span>
          </div>
          <input
            type="range"
            className="customSlider"
            min={1}
            max={maxCustomInstallments}
            step={1}
            value={customInstallments}
            onChange={(e) => setCustomInstallments(Number(e.target.value))}
          />
          <div className="sliderLabels">
            <span>1</span>
            <span>{maxCustomInstallments}</span>
          </div>
        </div>
      )}

      {/* Payment Breakdown */}
      <div className="paymentBreakdown">
        {selectedOption === 'INSTALLMENT' && nextInstallment && (
          <>
            <div className="breakdownRow">
              <span>Installment #{nextInstallment.number}</span>
              <span>{formatIRR(nextInstallment.totalIRR)}</span>
            </div>
          </>
        )}

        {selectedOption === 'SETTLE' && (
          <>
            <div className="breakdownRow">
              <span>Principal</span>
              <span>{formatIRR(loan.amountIRR)}</span>
            </div>
            <div className="breakdownRow">
              <span>Accrued interest ({calculations.daysElapsed} days)</span>
              <span>{formatIRR(calculations.accruedInterest)}</span>
            </div>
            {calculations.interestForgiveness > 0 && (
              <div className="breakdownRow savings">
                <span>Interest saved</span>
                <span className="savingsValue">-{formatIRR(calculations.interestForgiveness)}</span>
              </div>
            )}
          </>
        )}

        {selectedOption === 'CUSTOM' && (
          <div className="breakdownRow">
            <span>{customInstallments} installment{customInstallments > 1 ? 's' : ''}</span>
            <span>{formatIRR(calculations.customAmount)}</span>
          </div>
        )}

        <div className="breakdownRow total">
          <span>Amount to pay</span>
          <span>{formatIRR(repayAmount)}</span>
        </div>
      </div>

      {/* Installment Schedule Tabs */}
      {installments.length > 0 && (
        <div className="installmentSchedule">
          <div className="scheduleTabs">
            <button
              className={`scheduleTab ${activeTab === 'PENDING' ? 'active' : ''}`}
              onClick={() => setActiveTab('PENDING')}
            >
              Pending ({pendingInstallments.length})
            </button>
            <button
              className={`scheduleTab ${activeTab === 'PAID' ? 'active' : ''}`}
              onClick={() => setActiveTab('PAID')}
            >
              Paid ({paidInstallments.length})
            </button>
          </div>

          <div className="scheduleList">
            {activeTab === 'PENDING' && pendingInstallments.map(inst => (
              <div key={inst.number} className="scheduleItem">
                <div className="scheduleItemLeft">
                  <span className="installmentNumber">#{inst.number}</span>
                  <span className="installmentDate">{inst.dueISO}</span>
                </div>
                <div className="scheduleItemRight">
                  <span className="installmentAmount">{formatIRR(inst.totalIRR)}</span>
                  {inst.status === 'PARTIAL' && (
                    <span className="partialBadge">Partial</span>
                  )}
                </div>
              </div>
            ))}

            {activeTab === 'PAID' && paidInstallments.map(inst => (
              <div key={inst.number} className="scheduleItem paid">
                <div className="scheduleItemLeft">
                  <span className="installmentNumber">#{inst.number}</span>
                  <span className="installmentDate">{inst.paidISO || inst.dueISO}</span>
                </div>
                <div className="scheduleItemRight">
                  <span className="installmentAmount">{formatIRR(inst.paidIRR)}</span>
                  <span className="paidCheck">✓</span>
                </div>
              </div>
            ))}

            {activeTab === 'PENDING' && pendingInstallments.length === 0 && (
              <div className="scheduleEmpty">All installments paid!</div>
            )}

            {activeTab === 'PAID' && paidInstallments.length === 0 && (
              <div className="scheduleEmpty">No payments yet</div>
            )}
          </div>
        </div>
      )}

      {/* Cash Available */}
      <div className="cashAvailableSection">
        <div className="cashRow">
          <span>Cash available</span>
          <span>{formatIRR(cashAvailable)}</span>
        </div>
        <div className="cashRow">
          <span>After payment</span>
          <span className={afterRepayment < 0 ? 'danger' : ''}>
            {formatIRR(Math.max(0, afterRepayment))}
          </span>
        </div>
      </div>

      {/* Collateral Unlock Note */}
      {willUnlockCollateral && (
        <div className="repaymentNote success">
          Your {getAssetDisplayName(loan.collateralAssetId)} will be unlocked after payment
        </div>
      )}

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
