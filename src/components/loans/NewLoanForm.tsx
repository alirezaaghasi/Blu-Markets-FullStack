import React, { useState, useMemo, Dispatch } from 'react';
import { formatIRR, getAssetDisplayName, getHoldingValueIRR, formatNumberInput, parseFormattedNumber } from '../../helpers';
import { COLLATERAL_LTV_BY_LAYER, LOAN_INTEREST_RATE } from '../../constants/index';
import { ASSET_LAYER } from '../../state/domain';
import type { Holding, Layer, AppAction, AssetId } from '../../types';

interface NewLoanFormProps {
  holdings: Holding[];
  prices: Record<string, number>;
  fxRate: number;
  dispatch: Dispatch<AppAction>;
  onCancel: () => void;
}

function NewLoanForm({ holdings, prices, fxRate, dispatch, onCancel }: NewLoanFormProps) {
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [amountIRR, setAmountIRR] = useState<number>(0);
  const [durationMonths, setDurationMonths] = useState<3 | 6>(3);

  // Get borrowable holdings (not frozen)
  const borrowableHoldings = useMemo(() => {
    return holdings.filter((h) => h.quantity > 0 && !h.frozen);
  }, [holdings]);

  // Calculate selected asset details
  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    const holding = borrowableHoldings.find((h) => h.assetId === selectedAssetId);
    if (!holding) return null;

    const layer = ASSET_LAYER[selectedAssetId] as Layer;
    const ltv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;
    const valueIRR = getHoldingValueIRR(holding, prices, fxRate);
    const maxBorrow = Math.floor(valueIRR * ltv);
    const priceUSD = prices[selectedAssetId] || 0;

    return {
      holding,
      layer,
      ltv,
      valueIRR,
      maxBorrow,
      priceUSD,
      quantity: holding.quantity,
    };
  }, [selectedAssetId, borrowableHoldings, prices, fxRate]);

  // Calculate loan summary
  const loanSummary = useMemo(() => {
    if (!selectedAsset || amountIRR <= 0) return null;

    const monthlyRate = LOAN_INTEREST_RATE / 12;
    const interestIRR = Math.floor(amountIRR * monthlyRate * durationMonths);
    const totalRepayment = amountIRR + interestIRR;

    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + durationMonths);

    // Liquidation calculation
    const liquidationIRR = amountIRR;
    const liquidationPriceUSD =
      selectedAsset.quantity > 0 ? liquidationIRR / fxRate / selectedAsset.quantity : 0;
    const bufferPct =
      selectedAsset.valueIRR > 0
        ? ((selectedAsset.valueIRR - liquidationIRR) / selectedAsset.valueIRR) * 100
        : 0;

    return {
      principal: amountIRR,
      interest: interestIRR,
      totalRepayment,
      dueDate,
      liquidationIRR,
      liquidationPriceUSD,
      currentPriceUSD: selectedAsset.priceUSD,
      bufferPct,
    };
  }, [selectedAsset, amountIRR, durationMonths, fxRate]);

  const handleConfirm = () => {
    if (!selectedAssetId || amountIRR <= 0) return;
    // Set the borrow draft and preview
    dispatch({ type: 'START_BORROW', assetId: selectedAssetId as AssetId });
    dispatch({ type: 'SET_BORROW_AMOUNT', amountIRR });
    dispatch({ type: 'SET_BORROW_DURATION', durationMonths });
    dispatch({ type: 'PREVIEW_BORROW', prices, fxRate });
  };

  return (
    <div className="newLoanForm">
      <h2 className="formTitle">New Loan</h2>

      {/* Collateral Selection */}
      <div className="formSection">
        <label className="formLabel">Select Collateral</label>
        <select
          className="collateralSelect"
          value={selectedAssetId}
          onChange={(e) => {
            setSelectedAssetId(e.target.value);
            setAmountIRR(0);
          }}
        >
          <option value="">Choose an asset...</option>
          {borrowableHoldings.map((h) => {
            const layer = ASSET_LAYER[h.assetId] as Layer;
            const ltv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;
            return (
              <option key={h.assetId} value={h.assetId}>
                {getAssetDisplayName(h.assetId)} ({Math.round(ltv * 100)}% LTV)
              </option>
            );
          })}
        </select>

        {selectedAsset && (
          <div className="collateralInfo">
            <div className="collateralRow">
              <span>Value:</span>
              <span>{formatIRR(selectedAsset.valueIRR)}</span>
            </div>
            <div className="collateralRow">
              <span>Max borrow:</span>
              <span>
                {formatIRR(selectedAsset.maxBorrow)} ({Math.round(selectedAsset.ltv * 100)}%)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Loan Amount */}
      {selectedAsset && (
        <div className="formSection">
          <label className="formLabel">Loan Amount</label>
          <input
            type="text"
            inputMode="numeric"
            className="amountInput"
            value={formatNumberInput(amountIRR)}
            onChange={(e) => {
              const parsed = parseFormattedNumber(e.target.value);
              setAmountIRR(Math.min(parsed, selectedAsset.maxBorrow));
            }}
            placeholder="Enter amount..."
          />
          <input
            type="range"
            className="amountSlider"
            min={1000000}
            max={selectedAsset.maxBorrow}
            step={1000000}
            value={amountIRR}
            onChange={(e) => setAmountIRR(Number(e.target.value))}
          />
          <div className="sliderLabels">
            <span>Min: {formatIRR(1000000)}</span>
            <span>Max: {formatIRR(selectedAsset.maxBorrow)}</span>
          </div>
        </div>
      )}

      {/* Duration Selection */}
      {selectedAsset && (
        <div className="formSection">
          <label className="formLabel">Loan Duration</label>
          <div className="durationToggle">
            <button
              className={`durationBtn ${durationMonths === 3 ? 'selected' : ''}`}
              onClick={() => setDurationMonths(3)}
            >
              3 Months
            </button>
            <button
              className={`durationBtn ${durationMonths === 6 ? 'selected' : ''}`}
              onClick={() => setDurationMonths(6)}
            >
              6 Months
            </button>
          </div>
        </div>
      )}

      {/* Loan Summary */}
      {loanSummary && (
        <div className="loanSummarySection">
          <div className="summaryTitle">Loan Summary</div>
          <div className="summaryRow">
            <span>Loan amount</span>
            <span>{formatIRR(loanSummary.principal)}</span>
          </div>
          <div className="summaryRow">
            <span>Interest ({Math.round(LOAN_INTEREST_RATE * 100)}% APR)</span>
            <span>{formatIRR(loanSummary.interest)}</span>
          </div>
          <div className="summaryRow total">
            <span>Total repayment</span>
            <span>{formatIRR(loanSummary.totalRepayment)}</span>
          </div>
          <div className="summaryRow">
            <span>Due date</span>
            <span>
              {loanSummary.dueDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      )}

      {/* Liquidation Risk */}
      {loanSummary && (
        <div className="liquidationRiskBox">
          <div className="riskHeader">Liquidation Risk</div>
          <div className="riskRow">
            <span>Liquidation price:</span>
            <span>
              ${loanSummary.liquidationPriceUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })} /{' '}
              {getAssetDisplayName(selectedAssetId)}
            </span>
          </div>
          <div className="riskRow">
            <span>Current price:</span>
            <span>
              ${loanSummary.currentPriceUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })} /{' '}
              {getAssetDisplayName(selectedAssetId)}
            </span>
          </div>
          <div className="riskRow">
            <span>Buffer:</span>
            <span className={loanSummary.bufferPct < 20 ? 'warning' : ''}>
              {loanSummary.bufferPct.toFixed(1)}%
            </span>
          </div>
          <div className="riskExplanation">
            If {getAssetDisplayName(selectedAssetId)} drops below the liquidation price, your
            collateral will be sold to repay the loan automatically.
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="formActions">
        <button
          className="btn primary confirmLoanBtn"
          onClick={handleConfirm}
          disabled={!selectedAssetId || amountIRR <= 0}
        >
          Confirm Loan
        </button>
        <button className="btn cancelBtn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default NewLoanForm;
