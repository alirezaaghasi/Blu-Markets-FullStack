import React, { useState, useEffect } from 'react';
import { formatIRR, formatUSD, formatQuantity, getAssetDisplayName } from '../helpers.js';

/**
 * HoldingRow - Single asset holding with buy/sell/overflow menu
 * Shows layer-colored border, protection status, and frozen indicator
 * v9.9: Receives holdingValue (computed from quantity × price) instead of just holding
 */
function HoldingRow({ holding, holdingValue, layerInfo, layer, protDays, onStartTrade, onStartProtect, onStartBorrow }) {
  const [showOverflow, setShowOverflow] = useState(false);

  // v9.9: Use computed valueIRR from holdingValue, fallback to holding.valueIRR for backwards compat
  const valueIRR = holdingValue?.valueIRR ?? holding.valueIRR ?? 0;
  const isEmpty = valueIRR === 0;
  const isFixedIncome = holding.assetId === 'IRR_FIXED_INCOME';
  const breakdown = holdingValue?.breakdown;
  const quantity = holdingValue?.quantity ?? holding.quantity;
  const priceUSD = holdingValue?.priceUSD;

  // Close overflow when clicking outside
  useEffect(() => {
    if (showOverflow) {
      const handleClick = () => setShowOverflow(false);
      setTimeout(() => document.addEventListener('click', handleClick), 0);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showOverflow]);

  return (
    <div className={`holdingRow layer-${layer.toLowerCase()} ${isEmpty ? 'assetEmpty' : ''}`}>
      <div className="holdingInfo">
        <div className="holdingName">{getAssetDisplayName(holding.assetId)}</div>
        <div className="holdingLayer">
          <span className={`layerDot ${layer.toLowerCase()}`}></span>
          {layerInfo.name}
          {protDays !== null ? ` · ☂️ Protected (${protDays}d)` : ''}
          {holding.frozen ? ` · 🔒 Locked` : ''}
        </div>

        {/* v9.9: Show quantity and price for non-fixed-income assets */}
        {!isFixedIncome && quantity > 0 && (
          <div className="holdingQuantityPrice">
            <span className="holdingQty">{formatQuantity(quantity, holding.assetId)} units</span>
            {priceUSD && <span className="holdingPrice">@ {formatUSD(priceUSD)}</span>}
          </div>
        )}

        {/* v9.9: Special display for Fixed Income: Principal + Accrued */}
        {isFixedIncome && breakdown && !isEmpty && (
          <div className="fixedIncomeBreakdown">
            <span className="principal">{formatIRR(breakdown.principal)} Principal</span>
            <span className="accrued">+ {formatIRR(breakdown.accrued)} Accrued</span>
            <span className="daysHeld">({breakdown.daysHeld} days)</span>
          </div>
        )}
      </div>

      <div className="holdingValue">{formatIRR(valueIRR)}</div>

      <div className="holdingActions">
        <button className="btn small" onClick={() => onStartTrade(holding.assetId, 'BUY')}>Buy</button>
        <div className="sellButtonWrapper">
          <button
            className="btn small"
            disabled={holding.frozen || isEmpty}
            onClick={() => onStartTrade(holding.assetId, 'SELL')}
            title={holding.frozen ? 'Locked as loan collateral — repay loan to unlock' : ''}
          >
            Sell
          </button>
          {holding.frozen && (
            <div className="frozenTooltip">🔒 Repay loan to sell</div>
          )}
        </div>

        <div className="overflowContainer">
          <button className="btn small overflowTrigger" onClick={(e) => { e.stopPropagation(); setShowOverflow(!showOverflow); }}>⋯</button>

          {showOverflow && (
            <div className="overflowMenu" onClick={(e) => e.stopPropagation()}>
              <button
                className="overflowItem"
                onClick={() => { onStartProtect?.(holding.assetId); setShowOverflow(false); }}
                disabled={isEmpty || isFixedIncome}  // Can't protect fixed income
              >
                <span className="overflowIcon">☂️</span>
                Protect
              </button>
              <button
                className="overflowItem"
                onClick={() => { onStartBorrow?.(holding.assetId); setShowOverflow(false); }}
                disabled={isEmpty || holding.frozen}
              >
                <span className="overflowIcon">💰</span>
                Borrow
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(HoldingRow);
