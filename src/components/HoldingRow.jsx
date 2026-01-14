import React, { useState, useEffect } from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers.js';

/**
 * HoldingRow - Single asset holding with buy/sell/overflow menu
 * Shows layer-colored border, protection status, and frozen indicator
 */
function HoldingRow({ holding, layerInfo, layer, protDays, onStartTrade, onStartProtect, onStartBorrow }) {
  const [showOverflow, setShowOverflow] = useState(false);
  const isEmpty = holding.valueIRR === 0;

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
      </div>

      <div className="holdingValue">{formatIRR(holding.valueIRR)}</div>

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
                disabled={isEmpty}
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
