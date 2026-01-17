import React, { useState, useRef, useEffect } from 'react';
import { formatIRR, formatUSD, formatQuantity, getAssetDisplayName } from '../helpers';
import type { AssetId, Holding, Layer, TradeSide } from '../types';

interface HoldingValueBreakdown {
  principal: number;
  accrued: number;
  daysHeld: number;
}

interface HoldingValue {
  valueIRR: number;
  quantity: number;
  priceUSD?: number;
  breakdown?: HoldingValueBreakdown;
}

interface LayerInfo {
  name: string;
  nameFa?: string;
  icon?: string;
}

interface HoldingRowProps {
  holding: Holding & { valueIRR?: number };
  holdingValue?: HoldingValue;
  layerInfo: LayerInfo;
  layer: Layer;
  protDays: number | null;
  onStartTrade: (assetId: AssetId, side: TradeSide) => void;
  onStartProtect?: (assetId: AssetId) => void;
  onStartBorrow?: (assetId: AssetId) => void;
}

/**
 * HoldingRow - Single asset holding with buy/sell/overflow menu
 * Shows layer-colored border, protection status, and frozen indicator
 * v10: Receives holdingValue (computed from quantity × price) instead of just holding
 */
function HoldingRow({ holding, holdingValue, layerInfo, layer, protDays, onStartTrade, onStartProtect, onStartBorrow }: HoldingRowProps) {
  const [showOverflow, setShowOverflow] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // v10: Use computed valueIRR from holdingValue, fallback to holding.valueIRR for backwards compat
  const valueIRR = holdingValue?.valueIRR ?? (holding as { valueIRR?: number }).valueIRR ?? 0;
  const isEmpty = valueIRR === 0;
  const isFixedIncome = holding.assetId === 'IRR_FIXED_INCOME';
  const breakdown = holdingValue?.breakdown;
  const quantity = holdingValue?.quantity ?? holding.quantity;
  const priceUSD = holdingValue?.priceUSD;

  // Close overflow when clicking outside - uses ref instead of document listener per row
  // Only attach listener when menu is open, clean up immediately when closed
  useEffect(() => {
    if (!showOverflow) return;

    const handleClickOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowOverflow(false);
      }
    };

    // Use capture phase for reliable outside click detection
    document.addEventListener('pointerdown', handleClickOutside, true);
    return () => document.removeEventListener('pointerdown', handleClickOutside, true);
  }, [showOverflow]);

  return (
    <div className={`holdingRow layer-${layer.toLowerCase()} ${isEmpty ? 'assetEmpty' : ''}`}>
      <div className="holdingInfo">
        <div className="holdingName">{getAssetDisplayName(holding.assetId)}</div>
        <div className="holdingLayer">
          {layerInfo.name}
          {protDays !== null ? ' · ☂️ Protected (' + protDays + 'd)' : ''}
          {holding.frozen ? ' · 🔒 Locked' : ''}
        </div>

        {/* v10: Show quantity and price for non-fixed-income assets */}
        {!isFixedIncome && quantity > 0 && (
          <div className="holdingQuantityPrice">
            <span className="holdingQty">{formatQuantity(quantity, holding.assetId)} {holding.assetId}</span>
            {priceUSD && <span className="holdingPrice">@ {formatUSD(priceUSD)}</span>}
          </div>
        )}

        {/* v10: Special display for Fixed Income: Principal + Accrued */}
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

        <div className="overflowContainer" ref={menuRef}>
          <button className="btn small overflowTrigger" onClick={() => setShowOverflow(!showOverflow)}>⋯</button>

          {showOverflow && (
            <div className="overflowMenu">
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
