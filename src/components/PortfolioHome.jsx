import React from 'react';
import { formatIRR } from '../helpers.js';
import { ASSET_LAYER } from '../state/domain.js';
import { LAYER_EXPLANATIONS } from '../constants/index.js';
import LayerMini from './LayerMini.jsx';
import HoldingRow from './HoldingRow.jsx';

/**
 * PortfolioHome - Main portfolio dashboard
 * Shows portfolio value, allocation, holdings grouped by layer
 */
function PortfolioHome({ state, snapshot, onStartTrade, onStartProtect, onStartBorrow }) {
  if (snapshot.holdingsIRR === 0 && state.cashIRR === 0) {
    return (
      <div className="card">
        <h3>Portfolio</h3>
        <div className="muted">Complete onboarding to create your portfolio.</div>
      </div>
    );
  }

  const getProtectionDays = (assetId) => {
    const p = (state.protections || []).find(x => x.assetId === assetId);
    if (!p) return null;
    const now = Date.now();
    const until = new Date(p.endISO).getTime();
    return Math.max(0, Math.ceil((until - now) / (1000 * 60 * 60 * 24)));
  };

  const loans = state.loans || [];
  const totalLoanAmount = loans.reduce((sum, l) => sum + l.amountIRR, 0);

  // Find the most critical loan (highest LTV ratio)
  const mostCriticalLoan = loans.reduce((worst, loan) => {
    const ratio = loan.amountIRR / loan.liquidationIRR;
    const worstRatio = worst ? worst.amountIRR / worst.liquidationIRR : 0;
    return ratio > worstRatio ? loan : worst;
  }, null);
  const criticalRatio = mostCriticalLoan ? mostCriticalLoan.amountIRR / mostCriticalLoan.liquidationIRR : 0;

  return (
    <div className="stack">
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
          {['FOUNDATION', 'GROWTH', 'UPSIDE'].map(layer => (
            <LayerMini key={layer} layer={layer} pct={snapshot.layerPct[layer]} target={state.targetLayerPct[layer]} />
          ))}
        </div>
      </div>

      <div className="card">
        <h3>HOLDINGS</h3>
        {/* Group holdings by layer with section headers */}
        {['FOUNDATION', 'GROWTH', 'UPSIDE'].map(layer => {
          const layerHoldings = state.holdings.filter(h => ASSET_LAYER[h.assetId] === layer);
          if (layerHoldings.length === 0) return null;
          const layerInfo = LAYER_EXPLANATIONS[layer];
          return (
            <div key={layer} className="layerSection">
              <div className="layerSectionHeader">
                <span className={`layerDot ${layer.toLowerCase()}`}></span>
                <span className="layerSectionTitle">{layerInfo.name} Assets</span>
                <span className="layerSectionCount">{layerHoldings.length}</span>
              </div>
              <div className="holdingsList">
                {layerHoldings.map((h) => {
                  const protDays = getProtectionDays(h.assetId);
                  return (
                    <HoldingRow
                      key={h.assetId}
                      holding={h}
                      layerInfo={layerInfo}
                      layer={layer}
                      protDays={protDays}
                      onStartTrade={onStartTrade}
                      onStartProtect={onStartProtect}
                      onStartBorrow={onStartBorrow}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(PortfolioHome);
