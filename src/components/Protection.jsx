import React from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers.js';
import { ASSET_LAYER } from '../state/domain.js';
import { LAYER_EXPLANATIONS } from '../constants/index.js';

/**
 * Protection - Active protections list with progress bars
 * Shows protection status, premium paid, days remaining
 */
function Protection({ protections }) {
  const list = protections || [];

  const getDaysRemaining = (endISO) => {
    const now = Date.now();
    const until = new Date(endISO).getTime();
    return Math.max(0, Math.ceil((until - now) / (1000 * 60 * 60 * 24)));
  };

  const getProgressPct = (startISO, endISO) => {
    const now = Date.now();
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    const totalDuration = end - start;
    const elapsed = now - start;
    const remaining = Math.max(0, 100 - (elapsed / totalDuration) * 100);
    return Math.min(100, Math.max(0, remaining));
  };

  return (
    <div className="card">
      <h3>Active Protections</h3>
      {list.length === 0 ? (
        <div className="muted">No assets protected.</div>
      ) : (
        <div className="list">
          {list.map((p, idx) => {
            const layer = ASSET_LAYER[p.assetId];
            const info = LAYER_EXPLANATIONS[layer];
            const daysLeft = getDaysRemaining(p.endISO);
            const progressPct = getProgressPct(p.startISO || p.tsISO, p.endISO);

            return (
              <div key={p.id || idx} className="item protectionItem">
                <div style={{ flex: 1 }}>
                  <div className="asset">☂️ {getAssetDisplayName(p.assetId)}</div>
                  <div className="muted">
                    <span className={`layerDot ${layer.toLowerCase()}`} style={{ marginRight: 6 }}></span>
                    {info?.name}
                  </div>
                  {/* Progress bar for protection days */}
                  <div className="protectionProgress">
                    <div className="protectionProgressBar">
                      <div className="protectionProgressFill" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="protectionProgressText">
                      <span>{daysLeft} days remaining</span>
                      <span>{Math.round(progressPct)}% left</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="asset">{formatIRR(p.premiumIRR)}</div>
                  <div className="muted">Premium paid</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default React.memo(Protection);
