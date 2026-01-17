import React, { useState, useMemo, useEffect } from 'react';
import { formatIRR, formatIRRShort } from '../helpers';
import { LAYER_EXPLANATIONS, LAYERS } from '../constants/index';
import LayerMini from './LayerMini';
import HoldingRow from './HoldingRow';
import {
  selectHoldingsByLayer,
  selectLoanSummary,
  selectDrift,
  selectProtectionDaysMap,
} from '../selectors/index';
import type { Holding, Protection, Loan, TargetLayerPct, PortfolioSnapshot, PortfolioStatus, AssetId, TradeSide, Layer } from '../types';
import type { HoldingValue } from '../engine/snapshot';

interface HoldingWithValue {
  holding: Holding;
  holdingValue: {
    valueIRR: number;
    quantity: number;
    priceUSD?: number;
  };
}

interface PortfolioHomeProps {
  holdings: Holding[];
  cashIRR: number;
  targetLayerPct: TargetLayerPct;
  protections: Protection[];
  loans: Loan[];
  snapshot: PortfolioSnapshot & { holdingValues?: HoldingValue[] };
  portfolioStatus: PortfolioStatus;
  onStartTrade: (assetId: AssetId, side?: TradeSide) => void;
  onStartProtect: (assetId: AssetId) => void;
  onStartBorrow: (assetId: AssetId) => void;
  onStartRebalance: () => void;
  pricesLoading: boolean;
  pricesUpdatedAt: string | null;
  pricesError: string | null;
}

/**
 * PortfolioHome - Main portfolio dashboard
 * Shows portfolio value, allocation, holdings grouped by layer
 * Issue 3: Collapsible holdings by layer (default collapsed)
 * v10: Uses computed holdingValues from snapshot for live prices
 * v10: Accepts individual state slices instead of whole state object to avoid stale UI
 */
function PortfolioHome({ holdings, cashIRR, targetLayerPct, protections, loans, snapshot, portfolioStatus, onStartTrade, onStartProtect, onStartBorrow, onStartRebalance, pricesLoading, pricesUpdatedAt, pricesError }: PortfolioHomeProps) {
  // Decision 8: Track expanded layers (default all expanded for better UX)
  const [expandedLayers, setExpandedLayers] = useState({
    FOUNDATION: true,
    GROWTH: true,
    UPSIDE: true,
  });

  // Optimization: Only run countdown timer if there are active protections
  // Since we show days (not minutes), update every hour instead of every minute
  const hasProtections = protections && protections.length > 0;
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    if (!hasProtections) return;
    const interval = setInterval(() => setClockTick(t => t + 1), 3600000); // 1 hour
    return () => clearInterval(interval);
  }, [hasProtections]);

  const toggleLayer = (layer: Layer) => {
    setExpandedLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  if (snapshot.holdingsIRR === 0 && cashIRR === 0) {
    return (
      <div className="card">
        <h3>Portfolio</h3>
        <div className="muted">Complete onboarding to create your portfolio.</div>
      </div>
    );
  }

  // Consolidated drift calculations - use selector
  const { totalDrift, isOff, isAttention } = useMemo(
    () => selectDrift(snapshot.layerPct, targetLayerPct, portfolioStatus),
    [snapshot.layerPct, targetLayerPct, portfolioStatus]
  );

  // Memoize protection days as a Map keyed by assetId for O(1) lookups - use selector
  const protectionDaysMap = useMemo(
    () => selectProtectionDaysMap(protections),
    [protections, clockTick]
  );

  // Consolidated loan summary - use selector
  const { loanList, totalLoanAmount, criticalRatio } = useMemo(
    () => selectLoanSummary(loans),
    [loans]
  );

  // v10: Precompute holdings grouped by layer - use selector
  const holdingsByLayer = useMemo(
    () => selectHoldingsByLayer(holdings, snapshot.holdingValues || []),
    [holdings, snapshot.holdingValues]
  );

  return (
    <div className="stack">
      {/* Drift warning banner - shows when portfolio is off target */}
      {isOff && (
        <div className={`driftBanner ${isAttention ? 'attention' : ''}`}>
          <span className="driftIcon">{isAttention ? '⚠️' : '📊'}</span>
          <div className="driftText">
            <strong>{isAttention ? 'Attention required' : 'Portfolio drifted'}</strong>
            {' — '}
            {Math.round(totalDrift)}% from target allocation.
            {isAttention
              ? ' Consider rebalancing to reduce risk.'
              : ' You can rebalance when ready.'}
          </div>
          {onStartRebalance && (
            <button className="btn small driftAction" onClick={onStartRebalance}>
              Rebalance
            </button>
          )}
        </div>
      )}

      <div className="portfolioValueCard">
        <div className="portfolioValueLabel">PORTFOLIO VALUE</div>
        <div className="portfolioValueAmount">{formatIRR(snapshot.totalIRR)}</div>
        {/* v10: Price feed status indicator */}
        <div className={`priceIndicator ${pricesError ? 'error' : pricesLoading ? 'loading' : 'live'}`}>
          <span className="priceIndicatorDot"></span>
          <span className="priceIndicatorText">
            {pricesError ? 'Offline prices' : pricesLoading ? 'Updating...' : 'Live prices'}
          </span>
          {pricesUpdatedAt && !pricesLoading && (
            <span className="priceIndicatorTime">
              {new Date(pricesUpdatedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="portfolioBreakdown">
          <div className="breakdownCard">
            <div className="breakdownCardIcon">📊</div>
            <div className="breakdownCardLabel">Invested</div>
            <div className="breakdownCardValue">{formatIRR(snapshot.holdingsIRR)}</div>
          </div>
          <div className="breakdownCard">
            <div className="breakdownCardIcon">💵</div>
            <div className="breakdownCardLabel">Cash</div>
            <div className="breakdownCardValue">{formatIRR(snapshot.cashIRR)}</div>
          </div>
        </div>

        {/* Loan health indicator - shows summary when loans exist */}
        {loanList.length > 0 && (
          <div className="loanSummaryCard">
            <div className="loanSummaryHeader">
              <span className="loanSummaryLabel">💰 Active Loans ({loanList.length})</span>
              <span className="loanSummaryAmount">{formatIRR(totalLoanAmount)}</span>
            </div>
            <div className="loanHealthIndicator">
              <div className="loanHealthBar">
                <div
                  className={`loanHealthFill ${
                    criticalRatio > 0.75 ? 'critical' :
                    criticalRatio > 0.6 ? 'warning' : 'healthy'
                  }`}
                  style={{ width: `${Math.min(100, criticalRatio * 100)}%` }}
                />
              </div>
              <span className={`loanHealthText ${
                criticalRatio > 0.75 ? 'critical' :
                criticalRatio > 0.6 ? 'warning' : 'healthy'
              }`}>
                {Math.round(criticalRatio * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="sectionTitle">ASSET ALLOCATION</div>
        <div className="grid3">
          {(LAYERS as Layer[]).map((layer: Layer) => (
            <LayerMini key={layer} layer={layer} pct={snapshot.layerPct[layer]} target={targetLayerPct[layer]} />
          ))}
        </div>
      </div>

      {/* Issue 3: Collapsible holdings by layer */}
      <div className="card">
        <h3>HOLDINGS</h3>
        {(LAYERS as Layer[]).map((layer: Layer) => {
          const layerHoldings = (holdingsByLayer as { holdings: Record<Layer, HoldingWithValue[]>; totals: Record<Layer, number> }).holdings[layer];
          if (layerHoldings.length === 0) return null;
          const layerInfo = (LAYER_EXPLANATIONS as Record<string, { name: string; nameFa?: string; icon?: string }>)[layer];
          const layerTotal = (holdingsByLayer as { holdings: Record<Layer, HoldingWithValue[]>; totals: Record<Layer, number> }).totals[layer];
          const isExpanded = expandedLayers[layer];
          const currentPct = snapshot.layerPct[layer];
          const targetPct = targetLayerPct[layer];
          const isOnTarget = Math.abs(currentPct - targetPct) < 3;

          return (
            <div key={layer} className={`layerSection ${isExpanded ? 'expanded' : ''}`}>
              <div
                className="layerSectionHeader collapsible"
                onClick={() => toggleLayer(layer)}
              >
                <div className="layerHeaderContent">
                  <span className="layerSectionTitle">{layerInfo.name}</span>
                  <span className="layerHeaderValue">{formatIRRShort(layerTotal)}</span>
                </div>
                <div className="layerHeaderMeta">
                  <span className="layerAssetCount">{layerHoldings.length} asset{layerHoldings.length > 1 ? 's' : ''}</span>
                  <span className={`layerStatus ${isOnTarget ? 'on-target' : 'off-target'}`}>
                    {isOnTarget ? '✓ On target' : '○ ' + Math.round(currentPct) + '%'}
                  </span>
                </div>
                <span className="expandIcon">{isExpanded ? '▲' : '▼'}</span>
              </div>
              {isExpanded && (
                <div className="holdingsList">
                  {layerHoldings.map(({ holding, holdingValue }) => (
                    <HoldingRow
                      key={holding.assetId}
                      holding={holding}
                      holdingValue={holdingValue}
                      layerInfo={layerInfo}
                      layer={layer}
                      protDays={protectionDaysMap.get(holding.assetId) ?? null}
                      onStartTrade={onStartTrade}
                      onStartProtect={onStartProtect}
                      onStartBorrow={onStartBorrow}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(PortfolioHome);
