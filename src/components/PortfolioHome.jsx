import React, { useState, useMemo } from 'react';
import { formatIRR, formatIRRShort } from '../helpers.js';
import { ASSET_LAYER } from '../state/domain.js';
import { LAYER_EXPLANATIONS } from '../constants/index.js';
import LayerMini from './LayerMini.jsx';
import HoldingRow from './HoldingRow.jsx';

// Hoisted to module level to avoid per-render array allocation
const LAYERS = ['FOUNDATION', 'GROWTH', 'UPSIDE'];

/**
 * PortfolioHome - Main portfolio dashboard
 * Shows portfolio value, allocation, holdings grouped by layer
 * Issue 3: Collapsible holdings by layer (default collapsed)
 */
function PortfolioHome({ state, snapshot, portfolioStatus, onStartTrade, onStartProtect, onStartBorrow, onStartRebalance }) {
  // Issue 3: Track expanded layers (default all collapsed)
  const [expandedLayers, setExpandedLayers] = useState({});

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
  const protectionDaysMap = useMemo(() => {
    const map = new Map();
    const now = Date.now();
    for (const p of state.protections || []) {
      const until = new Date(p.endISO).getTime();
      map.set(p.assetId, Math.max(0, Math.ceil((until - now) / (1000 * 60 * 60 * 24))));
    }
    return map;
  }, [state.protections]);

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

  // Precompute holdings grouped by layer with totals
  const holdingsByLayer = useMemo(() => {
    const result = { FOUNDATION: [], GROWTH: [], UPSIDE: [] };
    const totals = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
    for (const h of state.holdings) {
      const layer = ASSET_LAYER[h.assetId];
      if (layer && result[layer]) {
        result[layer].push(h);
        totals[layer] += h.valueIRR;
      }
    }
    return { holdings: result, totals };
  }, [state.holdings]);

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
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>💰 Active Loans ({loans.length})</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{formatIRR(totalLoanAmount)}</span>
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
                  {layerHoldings.map((h) => (
                    <HoldingRow
                      key={h.assetId}
                      holding={h}
                      layerInfo={layerInfo}
                      layer={layer}
                      protDays={protectionDaysMap.get(h.assetId) ?? null}
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
