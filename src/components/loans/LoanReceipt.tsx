import React from 'react';
import { formatIRR, getAssetDisplayName } from '../../helpers';

interface LoanReceiptProps {
  amount: number;
  collateralAssetId: string;
  timestamp: Date;
  referenceId: string;
  interestPaid?: number;
  interestSaved?: number;
  onDone: () => void;
}

/**
 * LoanReceipt - Success confirmation screen after loan repayment
 */
function LoanReceipt({
  amount,
  collateralAssetId,
  timestamp,
  referenceId,
  interestPaid,
  interestSaved,
  onDone,
}: LoanReceiptProps) {
  const timeStr = timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = timestamp.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Blu Markets - Loan Repaid',
        text: `Successfully repaid ${formatIRR(amount)} loan`,
      }).catch(() => {
        // User cancelled or share not available
      });
    }
  };

  const handleSave = () => {
    // Create a simple text receipt for download
    const receiptText = `
Blu Markets - Loan Repayment Receipt
=====================================
Status: Successful
Amount: ${formatIRR(amount)}
Collateral: ${getAssetDisplayName(collateralAssetId)} - Unlocked
Time: ${timeStr}, ${dateStr}
Reference: ${referenceId}
${interestPaid ? `Interest Paid: ${formatIRR(interestPaid)}` : ''}
${interestSaved ? `Interest Saved: ${formatIRR(interestSaved)}` : ''}
=====================================
    `.trim();

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-receipt-${referenceId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="receiptScreen">
      {/* Success Icon */}
      <div className="receiptIcon">
        <svg viewBox="0 0 80 80" className="checkIconSvg">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#4ade80" strokeWidth="4" />
          <path
            d="M24 40l10 10 22-22"
            fill="none"
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Title */}
      <h2 className="receiptTitle">Loan Repaid</h2>

      {/* Amount */}
      <div className="receiptAmount">{formatIRR(amount)}</div>

      {/* Success Badge */}
      <div className="successBadge">
        <span className="checkmark">✓</span>
        Successful
      </div>

      {/* Divider */}
      <div className="receiptDivider" />

      {/* Details */}
      <div className="receiptDetails">
        <div className="receiptRow">
          <span className="receiptLabel">Time</span>
          <span className="receiptValue">{timeStr}, {dateStr}</span>
        </div>
        <div className="receiptRow">
          <span className="receiptLabel">Collateral</span>
          <span className="receiptValue">{getAssetDisplayName(collateralAssetId)} — Unlocked</span>
        </div>
        {interestPaid !== undefined && interestPaid > 0 && (
          <div className="receiptRow">
            <span className="receiptLabel">Interest paid</span>
            <span className="receiptValue">{formatIRR(interestPaid)}</span>
          </div>
        )}
        {interestSaved !== undefined && interestSaved > 0 && (
          <div className="receiptRow savings">
            <span className="receiptLabel">Interest saved</span>
            <span className="receiptValue savingsValue">{formatIRR(interestSaved)}</span>
          </div>
        )}
        <div className="receiptRow">
          <span className="receiptLabel">Reference</span>
          <span className="receiptValue receiptRef">{referenceId}</span>
        </div>
      </div>

      {/* Logo */}
      <div className="receiptLogo">
        <span className="logoIcon">B</span>
        <span className="logoText">Blu Markets</span>
      </div>

      {/* Action Buttons */}
      <div className="receiptActions">
        <button className="receiptActionBtn" onClick={handleSave}>
          Save
        </button>
        <button className="receiptActionBtn" onClick={handleShare}>
          Share
        </button>
      </div>

      {/* Done Button */}
      <button className="doneBtn" onClick={onDone}>
        Back to Portfolio
      </button>
    </div>
  );
}

export default React.memo(LoanReceipt);
