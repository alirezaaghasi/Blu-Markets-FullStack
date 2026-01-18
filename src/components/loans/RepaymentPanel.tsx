import React, { useState, useMemo } from 'react';
import { formatIRR, formatIRRShort, getAssetDisplayName } from '../../helpers';
import { useLoanCalculations } from '../../hooks/useLoanCalculations';
import type { Loan } from '../../types';

type RepayOption = 'INSTALLMENT' | 'SETTLE' | 'CUSTOM';

interface RepaymentPanelProps {
  loan: Loan;
  cashAvailable: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

/**
 * RepaymentPanel - Loan repayment options with installment, settle, and custom modes
 * Uses shared useLoanCalculations hook to eliminate duplicate date calculations
 */
function RepaymentPanel({ loan, cashAvailable, onConfirm, onCancel }: RepaymentPanelProps) {
  const [selectedOption, setSelectedOption] = useState<RepayOption>('INSTALLMENT');
  const [customInstallments, setCustomInstallments] = useState<number>(1);
  const [showSchedule, setShowSchedule] = useState(false);

  // Use shared hook for all loan calculations
  const calc = useLoanCalculations(loan);

  const installments = loan.installments || [];
  const installmentsPaid = loan.installmentsPaid || 0;
  const pendingInstallments = installments.filter(i => i.status !== 'PAID');
  const nextInstallment = pendingInstallments[0];
  const maxCustomInstallments = pendingInstallments.length;

  // Only need custom amount calculation locally
  const customAmount = useMemo(() => {
    return pendingInstallments
      .slice(0, customInstallments)
      .reduce((sum, i) => sum + i.totalIRR, 0);
  }, [pendingInstallments, customInstallments]);

  const getRepayAmount = () => {
    if (!calc) return 0;
    switch (selectedOption) {
      case 'INSTALLMENT': return calc.nextInstallmentAmount;
      case 'SETTLE': return calc.settlementAmount;
      case 'CUSTOM': return customAmount;
    }
  };

  const repayAmount = getRepayAmount();
  const canRepay = cashAvailable >= repayAmount && repayAmount > 0;
  const afterRepayment = cashAvailable - repayAmount;

  const willUnlockCollateral = selectedOption === 'SETTLE' ||
    (selectedOption === 'INSTALLMENT' && installmentsPaid === 5) ||
    (selectedOption === 'CUSTOM' && customInstallments === maxCustomInstallments);

  if (!calc) return null;

  return (
    <div className="repaymentPanel compact">
      {/* Header with inline progress badge */}
      <div className="panelHeader">
        <h3 className="panelTitle">Repay Loan</h3>
        {installments.length > 0 && (
          <span className="progressBadge">{installmentsPaid} / 6 paid</span>
        )}
      </div>

      {/* Compact Payment Options - Pills */}
      <div className="paymentOptions">
        <button
          className={`optionPill ${selectedOption === 'INSTALLMENT' ? 'active' : ''}`}
          onClick={() => setSelectedOption('INSTALLMENT')}
          disabled={!nextInstallment}
        >
          Installment #{nextInstallment?.number || '-'}
        </button>
        <button
          className={`optionPill ${selectedOption === 'SETTLE' ? 'active' : ''}`}
          onClick={() => setSelectedOption('SETTLE')}
        >
          Settle All
        </button>
        <button
          className={`optionPill ${selectedOption === 'CUSTOM' ? 'active' : ''}`}
          onClick={() => setSelectedOption('CUSTOM')}
          disabled={maxCustomInstallments === 0}
        >
          Custom
        </button>
      </div>

      {/* Custom Slider - Only when Custom selected */}
      {selectedOption === 'CUSTOM' && maxCustomInstallments > 1 && (
        <div className="customSliderCompact">
          <input
            type="range"
            min={1}
            max={maxCustomInstallments}
            value={customInstallments}
            onChange={(e) => setCustomInstallments(Number(e.target.value))}
          />
          <span className="sliderValue">{customInstallments} installment{customInstallments > 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Payment Summary Card */}
      <div className="paymentCard">
        {selectedOption === 'SETTLE' && (
          <>
            <div className="paymentRow">
              <span>Principal</span>
              <span>{formatIRR(loan.amountIRR)}</span>
            </div>
            <div className="paymentRow">
              <span>Interest ({calc.daysElapsed}d)</span>
              <span>{formatIRR(calc.accruedInterest)}</span>
            </div>
            {calc.interestForgiveness > 0 && (
              <div className="paymentRow savings">
                <span>You save</span>
                <span>-{formatIRR(calc.interestForgiveness)}</span>
              </div>
            )}
          </>
        )}

        <div className="paymentRow total">
          <span>Amount to pay</span>
          <span>{formatIRR(repayAmount)}</span>
        </div>

        <div className="paymentRow muted">
          <span>Cash available</span>
          <span>{formatIRR(cashAvailable)}</span>
        </div>
        <div className="paymentRow muted">
          <span>After payment</span>
          <span className={afterRepayment < 0 ? 'danger' : ''}>{formatIRR(Math.max(0, afterRepayment))}</span>
        </div>
      </div>

      {/* Collapsible Schedule */}
      {installments.length > 0 && (
        <button
          className="scheduleToggle"
          onClick={() => setShowSchedule(!showSchedule)}
        >
          {showSchedule ? '▼' : '▶'} View schedule ({pendingInstallments.length} pending)
        </button>
      )}

      {showSchedule && (
        <div className="scheduleListCompact">
          {pendingInstallments.map(inst => (
            <div key={inst.number} className="scheduleRow">
              <span>#{inst.number}</span>
              <span className="scheduleDate">{inst.dueISO}</span>
              <span>{formatIRR(inst.totalIRR)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Collateral Unlock Note */}
      {willUnlockCollateral && (
        <div className="unlockNote">
          ✓ {getAssetDisplayName(loan.collateralAssetId)} unlocks after payment
        </div>
      )}

      {/* Actions */}
      <div className="panelActions">
        <button
          className="btn primary"
          onClick={() => onConfirm(repayAmount)}
          disabled={!canRepay}
        >
          {canRepay ? 'Confirm Repayment' : `Need ${formatIRRShort(repayAmount - cashAvailable)} IRR more`}
        </button>
        <button className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default React.memo(RepaymentPanel);
