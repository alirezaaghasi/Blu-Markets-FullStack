import React, { useState, useMemo, useEffect } from 'react';
import { formatIRR, formatIRRShort } from '../helpers.js';
import { ASSET_LAYER } from '../state/domain.js';
import { LAYER_EXPLANATIONS, LAYERS } from '../constants/index.js';
import LayerMini from './LayerMini.jsx';
import HoldingRow from './HoldingRow.jsx';

/**
 * PortfolioHome - Main portfolio dashboard
 * Shows portfolio value, allocation, holdings grouped by layer
 * Issue 3: Collapsible holdings by layer (default collapsed)
 * v9.9: Uses computed holdingValues from snapshot for live prices
 */
function PortfolioHome({ state, snapshot, portfolioStatus, onStartTrade, onStartProtect, onStartBorrow, onStartRebalance, pricesLoading, pricesUpdatedAt, pricesError }) {
  // Issue 3: Track expanded layers (default all collapsed)
  const [expandedLayers, setExpandedLayers] = useState({});

  // Timer tick for updating time-based calculations (protection countdown)
  // Updates every minute since we show days remaining
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setClockTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleLayer = (layer) => {
    setExpandedLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  if (snapshot.holdingsIRR === 0 && state.cashIRR === 0) {
    return (
      <div className="card">
        <h3>Portfolio</h3>
        <div className="muted">Complete onboarding to create your portfolio.</div>
      </div>
    );
  }

  // Use pre-computed portfolio status from App.jsx
  const isOff = portfolioStatus === 'SLIGHTLY_OFF' || portfolioStatus === 'ATTENTION_REQUIRED';
  const isAttention = portfolioStatus === 'ATTENTION_REQUIRED';

  // Memoize total drift calculation
  const totalDrift = useMemo(() => {
    return LAYERS.reduce((sum, layer) => {
      return sum + Math.abs(snapshot.layerPct[layer] - state.targetLayerPct[layer]);
    }, 0);
  }, [snapshot.layerPct, state.targetLayerPct]);

  // Memoize protection days as a Map keyed by assetId for O(1) lookups
  // clockTick dependency ensures this recalculates every minute for live countdown
  const protectionDaysMap = useMemo(() => {
    const map = new Map();
    const now = Date.now();
    for (const p of state.protections || []) {
      const until = new Date(p.endISO).getTime();
      map.set(p.assetId, Math.max(0, Math.ceil((until - now) / (1000 * 60 * 60 * 24))));
    }
    return map;
  }, [state.protections, clockTick]);

  // Memoize loan summary calculations
  const { loans, totalLoanAmount, criticalRatio } = useMemo(() => {
    const loanList = state.loans || [];
    const total = loanList.reduce((sum, l) => sum + l.amountIRR, 0);
    // Find highest LTV ratio in single pass
    let maxRatio = 0;
    for (const loan of loanList) {
      const ratio = loan.amountIRR / loan.liquidationIRR;
      if (ratio > maxRatio) maxRatio = ratio;
    }
    return { loans: loanList, totalLoanAmount: total, criticalRatio: maxRatio };
  }, [state.loans]);

  // v9.9: Precompute holdings grouped by layer using snapshot.holdingValues
  // This ensures we use live-computed values (quantity × price × fxRate)
  const holdingsByLayer = useMemo(() => {
    const result = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
    const totals = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
    // Build map of holdingValues by assetId for O(1) lookup
    const holdingValueMap = new Map();
    for (const hv of snapshot.holdingValues || []) {
      holdingValueMap.set(hv.assetId, hv);
    }
    // Group holdings with their computed values
    for (const h of state.holdings) {
      const layer = ASSET_LAYER[h.assetId];
      if (layer && result[layer]) {
        const holdingValue = holdingValueMap.get(h.assetId);
        result[layer].push({ holding: h, holdingValue });
        totals[layer] += holdingValue?.valueIRR || 0;
      }
    }
    return { holdings: result, totals };
  }, [state.holdings, snapshot.holdingValues]);

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
        {/* v9.9: Price feed status indicator */}
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
        {loans.length > 0 && (
          <div className="loanSummaryCard">
            <div className="loanSummaryHeader">
              <span className="loanSummaryLabel">💰 Active Loans ({loans.length})</span>
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
          {LAYERS.map(layer => (
            <LayerMini key={layer} layer={layer} pct={snapshot.layerPct[layer]} target={state.targetLayerPct[layer]} />
          ))}
        </div>
      </div>

      {/* Issue 3: Collapsible holdings by layer */}
      <div className="card">
        <h3>HOLDINGS</h3>
        {LAYERS.map(layer => {
          const layerHoldings = holdingsByLayer.holdings[layer];
          if (layerHoldings.length === 0) return null;
          const layerInfo = LAYER_EXPLANATIONS[layer];
          const layerTotal = holdingsByLayer.totals[layer];
          const isExpanded = expandedLayers[layer];
          const currentPct = snapshot.layerPct[layer];
          const targetPct = state.targetLayerPct[layer];
          const isOnTarget = Math.abs(currentPct - targetPct) < 3;

          return (
            <div key={layer} className={`layerSection ${isExpanded ? 'expanded' : ''}`}>
              <div
                className="layerSectionHeader collapsible"
                onClick={() => toggleLayer(layer)}
              >
                <span className={`layerDot ${layer.toLowerCase()}`}></span>
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
